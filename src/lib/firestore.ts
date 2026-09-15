import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  limit,
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
    limit(200)
  );
  const snaps = await getDocs(q);
  // Sort client-side to avoid requiring a composite Firestore index
  return snaps.docs
    .map((d) => d.data() as ProgressEntry)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function deleteEntryFromFirestore(entryId: string): Promise<void> {
  await deleteDoc(doc(db, 'entries', entryId));
}

export async function getPublicEntriesByUid(uid: string): Promise<ProgressEntry[]> {
  const q = query(
    collection(db, 'entries'),
    where('user_id', '==', uid),
    limit(100)
  );
  const snaps = await getDocs(q);
  return snaps.docs
    .map((d) => d.data() as ProgressEntry)
    .sort((a, b) => b.date.localeCompare(a.date));
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
  fromFriendTag?: string;
  fromUsername?: string;
  status: FriendRequestStatus;
  createdAt: string;
}

export async function sendFriendRequest(
  fromUid: string,
  toUid: string,
  fromProfile: { displayName: string; photoURL: string; friendTag?: string; username?: string }
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
  const username = fromProfile.username || fromProfile.friendTag?.replace(/^#pathly-/, "") || "";
  await setDoc(doc(db, 'friend_requests', id), {
    id,
    fromUid,
    toUid,
    fromDisplayName: fromProfile.displayName,
    fromPhotoURL: fromProfile.photoURL,
    fromFriendTag: username,
    fromUsername: username,
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

// ── Leaderboard Ranking ───────────────────────────────────────

export interface LeaderboardUser {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
  streak: number;
  completedTasks: number;
  totalEntries: number;
  rank: number;
  lastSubject?: string;
}

export async function getLeaderboardUsers(): Promise<LeaderboardUser[]> {
  try {
    // 1. Fetch users from Firestore
    const usersSnap = await getDocs(query(collection(db, 'users'), limit(100)));
    const usersList = usersSnap.docs.map((d) => d.data());

    // 2. Fetch recent entries in bulk to calculate streak & completed tasks
    const entriesSnap = await getDocs(query(collection(db, 'entries'), limit(2000)));

    const userEntriesMap: Record<string, ProgressEntry[]> = {};
    for (const d of entriesSnap.docs) {
      const entry = d.data() as ProgressEntry;
      if (!entry.user_id) continue;
      if (!userEntriesMap[entry.user_id]) {
        userEntriesMap[entry.user_id] = [];
      }
      userEntriesMap[entry.user_id].push(entry);
    }

    // 3. Calculate metrics for each participant
    const participants: Omit<LeaderboardUser, 'rank'>[] = [];

    for (const u of usersList) {
      if (!u.uid) continue;
      const entries = userEntriesMap[u.uid] ?? [];
      const streakData = computeStreakData(entries);
      const completedTasks = entries.filter((e) => e.status === 'completed').length;
      const rawUsername = u.username || (u.friendTag ? u.friendTag.replace(/^[#@]/, '').replace(/^pathly-/, '') : '') || 'user';

      participants.push({
        uid: u.uid,
        displayName: u.displayName || rawUsername,
        username: rawUsername,
        photoURL: u.photoURL,
        streak: streakData.current,
        completedTasks,
        totalEntries: entries.length,
        lastSubject: entries[0]?.subject || '',
      });
    }

    // 4. Sort: Priority 1 = streak (descending), Priority 2 = completedTasks (descending), Priority 3 = totalEntries (descending)
    participants.sort((a, b) => {
      if (b.streak !== a.streak) {
        return b.streak - a.streak;
      }
      if (b.completedTasks !== a.completedTasks) {
        return b.completedTasks - a.completedTasks;
      }
      return b.totalEntries - a.totalEntries;
    });

    // 5. Assign 1-indexed ranks
    return participants.map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));
  } catch (err) {
    console.error('Failed to get leaderboard users:', err);
    return [];
  }
}

