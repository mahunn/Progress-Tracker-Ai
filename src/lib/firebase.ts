import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  Auth,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  Firestore,
} from 'firebase/firestore';

// ── Firebase Config (same project as Pathly) ──────────────────
export const FIREBASE_CONFIG = {
  apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCGXIF3ilOfPZRxCAvsgAtGWSWqyXzFABw').trim(),
  authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'pathly-e1b6e.firebaseapp.com').trim(),
  projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pathly-e1b6e').trim(),
  storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pathly-e1b6e.firebasestorage.app').trim(),
  messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '888577741663').trim(),
  appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:888577741663:web:0dfd3a36cf8e47e2e71cea').trim(),
};

let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(FIREBASE_CONFIG);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

// ── Google Auth ───────────────────────────────────────────────
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// ── Friend Tag Helpers ────────────────────────────────────────
export function generateFriendTag(uid: string, name?: string): string {
  if (name?.trim()) {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    if (clean) return `#pathly-${clean}`;
  }
  const short = uid.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toLowerCase();
  return `#pathly-user${short || Math.floor(1000 + Math.random() * 9000)}`;
}

export function formatFriendTag(input: string): string {
  let clean = input.trim().toLowerCase().replace(/^#/, '');
  if (!clean.startsWith('pathly-')) clean = `pathly-${clean}`;
  return `#${clean}`;
}

// ── Ensure user profile exists in Firestore ───────────────────
export async function ensureUserProfile(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const tag = generateFriendTag(user.uid, user.displayName ?? undefined);
    await setDoc(ref, {
      uid: user.uid,
      displayName: user.displayName || 'Pathly User',
      email: user.email,
      photoURL: user.photoURL,
      friendTag: tag,
      isPublic: true,
      createdAt: new Date().toISOString(),
    });
  }
}

export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function searchUserByTag(tag: string) {
  const formatted = formatFriendTag(tag).toLowerCase();
  const q = query(collection(db, 'users'), where('friendTag', '==', formatted));
  const snaps = await getDocs(q);
  if (snaps.empty) return null;
  return snaps.docs[0].data();
}
