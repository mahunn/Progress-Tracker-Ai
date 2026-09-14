import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ProgressEntry, StreakData } from './types';
import { calculateStreak } from './utils';

// ── Entries ───────────────────────────────────────────────────

export async function saveEntryToFirestore(entry: ProgressEntry): Promise<void> {
  const ref = doc(db, 'entries', entry.id);
  await setDoc(ref, { ...entry, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function getUserEntries(userId: string): Promise<ProgressEntry[]> {
  const q = query(
    collection(db, 'entries'),
    where('user_id', '==', userId),
    orderBy('date', 'desc'),
    limit(200)
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.data() as ProgressEntry);
}

export async function deleteEntryFromFirestore(entryId: string): Promise<void> {
  await deleteDoc(doc(db, 'entries', entryId));
}

export async function getPublicEntriesByUid(uid: string): Promise<ProgressEntry[]> {
  const q = query(
    collection(db, 'entries'),
    where('user_id', '==', uid),
    orderBy('date', 'desc'),
    limit(100)
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.data() as ProgressEntry);
}

// ── Entry Map (date → entries[]) ──────────────────────────────

export function buildEntryMap(entries: ProgressEntry[]): Record<string, ProgressEntry[]> {
  return entries.reduce<Record<string, ProgressEntry[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});
}

// ── Streak ────────────────────────────────────────────────────

export function computeStreakData(entries: ProgressEntry[]): StreakData {
  const uniqueDates = [...new Set(entries.map((e) => e.date))];
  const current = calculateStreak(uniqueDates);

  const today = new Date();
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const thisWeek = uniqueDates.filter((d) => new Date(d + 'T00:00:00') >= thisWeekStart).length;
  const thisMonth = uniqueDates.filter((d) => new Date(d + 'T00:00:00') >= thisMonthStart).length;
  const sorted = [...uniqueDates].sort().reverse();

  return {
    current,
    longest: current,
    lastEntryDate: sorted[0] ?? null,
    totalDaysLogged: uniqueDates.length,
    thisWeek,
    thisMonth,
  };
}

// ── Friend Requests ───────────────────────────────────────────

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  fromDisplayName: string;
  fromPhotoURL: string;
  fromFriendTag: string;
  status: FriendRequestStatus;
  createdAt: string;
}

export async function sendFriendRequest(
  fromUid: string,
  toUid: string,
  fromProfile: { displayName: string; photoURL: string; friendTag: string }
): Promise<{ success: boolean; error?: string }> {
  // Check not already friends or pending
  const existingQ = query(
    collection(db, 'friend_requests'),
    where('fromUid', '==', fromUid),
    where('toUid', '==', toUid),
    where('status', '==', 'pending')
  );
  const existing = await getDocs(existingQ);
  if (!existing.empty) return { success: false, error: 'Request already sent.' };

  const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await setDoc(doc(db, 'friend_requests', id), {
    id,
    fromUid,
    toUid,
    fromDisplayName: fromProfile.displayName,
    fromPhotoURL: fromProfile.photoURL,
    fromFriendTag: fromProfile.friendTag,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  return { success: true };
}

export async function respondToFriendRequest(
  requestId: string,
  status: 'accepted' | 'declined',
  fromUid: string,
  toUid: string
): Promise<void> {
  await setDoc(doc(db, 'friend_requests', requestId), { status }, { merge: true });
  if (status === 'accepted') {
    // Add to both users' friends subcollection
    const now = new Date().toISOString();
    await setDoc(doc(db, 'friends', toUid, 'list', fromUid), { since: now, uid: fromUid });
    await setDoc(doc(db, 'friends', fromUid, 'list', toUid), { since: now, uid: toUid });
  }
}

export async function getIncomingRequests(uid: string): Promise<FriendRequest[]> {
  const q = query(
    collection(db, 'friend_requests'),
    where('toUid', '==', uid),
    where('status', '==', 'pending')
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.data() as FriendRequest);
}

export async function getFriends(uid: string): Promise<string[]> {
  const snaps = await getDocs(collection(db, 'friends', uid, 'list'));
  return snaps.docs.map((d) => d.data().uid as string);
}
