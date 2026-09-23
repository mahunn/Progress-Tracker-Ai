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

// ── Username Helpers ──────────────────────────────────────────

export function cleanUsername(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

/**
 * Check if a username is available across the users collection.
 * Optionally exclude a user's own uid so they can keep their existing username.
 */
export async function isUsernameAvailable(username: string, excludeUid?: string): Promise<boolean> {
  const clean = cleanUsername(username);
  if (!clean || clean.length < 2) return false;

  try {
    // Check username field
    const q1 = query(collection(db, "users"), where("username", "==", clean));
    const snap1 = await getDocs(q1);
    for (const d of snap1.docs) {
      if (d.id !== excludeUid) return false;
    }

    // Also check friendTag field for backward compatibility
    const q2 = query(collection(db, "users"), where("friendTag", "==", clean));
    const snap2 = await getDocs(q2);
    for (const d of snap2.docs) {
      if (d.id !== excludeUid) return false;
    }

    return true;
  } catch (err) {
    console.warn("Could not check username availability in Firestore:", err);
    // Don't crash login flow if collection query is denied or network is restricted
    return true;
  }
}

/**
 * Generate a unique username upon Google login:
 * 1. Default to user's first name (e.g. "Mahin" -> "mahin")
 * 2. If taken, combine first name + last name (e.g. "Mahin Khan" -> "mahinkhan")
 * 3. If taken or no last name, append numbers (e.g. "mahin2", "mahin3", ...)
 */
export async function generateUniqueUsername(
  displayName?: string | null,
  email?: string | null
): Promise<string> {
  const raw = (displayName || "").trim();
  const parts = raw
    .split(/\s+/)
    .map((p) => cleanUsername(p))
    .filter(Boolean);

  const firstName = parts[0] || "";
  const lastName = parts[1] || "";
  const base = firstName || cleanUsername(email?.split("@")[0] || "user") || "user";

  try {
    // 1. Try first name
    if (firstName.length >= 2) {
      const isFree = await isUsernameAvailable(firstName);
      if (isFree) return firstName;
    }

    // 2. Try first name + last name
    if (firstName && lastName) {
      const combined = cleanUsername(`${firstName}${lastName}`);
      if (combined.length >= 2) {
        const isFree = await isUsernameAvailable(combined);
        if (isFree) return combined;
      }
    }

    // 3. Try base + number (2 to 10)
    for (let i = 2; i <= 10; i++) {
      const candidate = `${base}${i}`;
      const isFree = await isUsernameAvailable(candidate);
      if (isFree) return candidate;
    }
  } catch (err) {
    console.warn("Error during unique username generation:", err);
  }

  // 4. Fallback random
  return `${base}${Math.floor(100 + Math.random() * 900)}`;
}

/**
 * Update a user's unique username in Firestore.
 */
export async function updateUsername(
  uid: string,
  newUsername: string
): Promise<{ success: boolean; error?: string; username?: string }> {
  const clean = cleanUsername(newUsername);
  if (!clean || clean.length < 2) {
    return { success: false, error: "Username must be at least 2 characters." };
  }
  if (clean.length > 20) {
    return { success: false, error: "Username cannot exceed 20 characters." };
  }
  if (!/^[a-z0-9_]+$/.test(clean)) {
    return { success: false, error: "Only letters, numbers, and underscores are allowed." };
  }

  try {
    const isFree = await isUsernameAvailable(clean, uid);
    if (!isFree) {
      return { success: false, error: `Username "${clean}" is already taken. Please try another.` };
    }

    const ref = doc(db, "users", uid);
    await setDoc(ref, { username: clean, friendTag: clean }, { merge: true });
    return { success: true, username: clean };
  } catch (err) {
    console.error("Failed to update username in Firestore:", err);
    return { success: false, error: "Database error while updating username. Please try again." };
  }
}

// ── Legacy Friend Tag Helpers (without pathly prefix) ─────────
export function generateFriendTag(uid: string, name?: string): string {
  if (name?.trim()) {
    const clean = cleanUsername(name.split(/\s+/)[0]);
    if (clean) return clean;
  }
  return `user${uid.slice(-4).toLowerCase()}`;
}

export function formatFriendTag(input: string): string {
  return cleanUsername(input.replace(/^[#@]/, "").replace(/^pathly-/, ""));
}

// ── Ensure user profile exists in Firestore ───────────────────
export async function ensureUserProfile(user: User): Promise<void> {
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const username = await generateUniqueUsername(user.displayName, user.email);
      await setDoc(ref, {
        uid: user.uid,
        displayName: user.displayName || username,
        email: user.email,
        photoURL: user.photoURL,
        username: username,
        friendTag: username,
        isPublic: true,
        createdAt: new Date().toISOString(),
      });
    } else {
      // Migrate existing users if missing a clean username or having legacy "#pathly-" format
      const data = snap.data();
      if (!data.username || data.friendTag?.startsWith("#pathly-")) {
        const existingClean = data.username
          ? cleanUsername(data.username)
          : data.friendTag
          ? cleanUsername(data.friendTag.replace(/^#pathly-/, ""))
          : "";

        let username = existingClean;
        try {
          if (existingClean && (await isUsernameAvailable(existingClean, user.uid))) {
            username = existingClean;
          } else {
            username = await generateUniqueUsername(user.displayName || data.displayName, user.email || data.email);
          }
        } catch {
          username = existingClean || cleanUsername(user.displayName?.split(/\s+/)[0] || "user");
        }
        await setDoc(ref, { username, friendTag: username }, { merge: true });
      }
    }
  } catch (err) {
    console.warn("Could not ensure user profile in Firestore:", err);
  }
}

export async function getUserProfile(uid: string) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn("Could not fetch user profile from Firestore:", err);
    return null;
  }
}

/**
 * Search user by clean username. Also matches legacy friendTag formats.
 */
export async function searchUserByUsername(searchQuery: string) {
  const clean = cleanUsername(searchQuery.replace(/^[#@]/, "").replace(/^pathly-/, ""));
  if (!clean) return null;

  try {
    // 1. Search by username
    const q1 = query(collection(db, "users"), where("username", "==", clean));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) return { uid: snap1.docs[0].id, ...snap1.docs[0].data() };

    // 2. Search by friendTag (exact clean tag)
    const q2 = query(collection(db, "users"), where("friendTag", "==", clean));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return { uid: snap2.docs[0].id, ...snap2.docs[0].data() };

    // 3. Search by legacy #pathly- prefix for backward compatibility
    const q3 = query(collection(db, "users"), where("friendTag", "==", `#pathly-${clean}`));
    const snap3 = await getDocs(q3);
    if (!snap3.empty) return { uid: snap3.docs[0].id, ...snap3.docs[0].data() };
  } catch (err) {
    console.warn("User search query failed:", err);
  }

  return null;
}

export async function searchUserByTag(tag: string) {
  return searchUserByUsername(tag);
}

