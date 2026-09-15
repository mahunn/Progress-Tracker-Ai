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
  if (!userId) return [];
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
  if (!entryId) return;
  await deleteDoc(doc(db, 'entries', entryId));
}

export async function getPublicEntriesByUid(uid: string): Promise<ProgressEntry[]> {
  if (!uid) return [];
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
  if (!fromUid || !toUid) return { success: false, error: 'Invalid user IDs.' };

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
  if (!requestId || !fromUid || !toUid) return;
  await setDoc(doc(db, 'friend_requests', requestId), { status }, { merge: true });
  if (status === 'accepted') {
    // Add to both users' friends subcollection
    const now = new Date().toISOString();
    await setDoc(doc(db, 'friends', toUid, 'list', fromUid), { since: now, uid: fromUid });
    await setDoc(doc(db, 'friends', fromUid, 'list', toUid), { since: now, uid: toUid });
  }
}

export async function getIncomingRequests(uid: string): Promise<FriendRequest[]> {
  if (!uid) return [];
  const q = query(
    collection(db, 'friend_requests'),
    where('toUid', '==', uid),
    where('status', '==', 'pending')
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.data() as FriendRequest);
}

export async function getFriends(uid: string): Promise<string[]> {
  if (!uid) return [];
  const snaps = await getDocs(collection(db, 'friends', uid, 'list'));
  return snaps.docs
    .map((d) => (d.data()?.uid || d.id) as string)
    .filter((id): id is string => Boolean(id) && typeof id === 'string');
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

import { auth, cleanUsername } from './firebase';

export async function getLeaderboardUsers(): Promise<LeaderboardUser[]> {
  try {
    // 1. Fetch users from Firestore
    const usersSnap = await getDocs(query(collection(db, 'users'), limit(500)));
    const usersList: {
      uid: string;
      displayName?: string;
      username?: string;
      friendTag?: string;
      photoURL?: string;
      email?: string;
    }[] = usersSnap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        ...data,
      };
    });

    // 2. Fetch recent entries in bulk to calculate streak & completed tasks
    const entriesSnap = await getDocs(query(collection(db, 'entries'), limit(5000)));

    const userEntriesMap: Record<string, ProgressEntry[]> = {};
    for (const d of entriesSnap.docs) {
      const entry = d.data() as ProgressEntry;
      if (!entry.user_id) continue;
      if (!userEntriesMap[entry.user_id]) {
        userEntriesMap[entry.user_id] = [];
      }
      userEntriesMap[entry.user_id].push(entry);
    }

    // 3. Make sure any user with entries is also represented in the list
    const existingUids = new Set(usersList.map((u) => u.uid));
    for (const entryUserId of Object.keys(userEntriesMap)) {
      if (!existingUids.has(entryUserId)) {
        usersList.push({
          uid: entryUserId,
          displayName: 'Learner',
          username: `user_${entryUserId.slice(-4)}`,
        });
        existingUids.add(entryUserId);
      }
    }

    // 4. Ensure current user account is always represented
    if (auth.currentUser && !existingUids.has(auth.currentUser.uid)) {
      usersList.push({
        uid: auth.currentUser.uid,
        displayName: auth.currentUser.displayName || 'You',
        username: cleanUsername(auth.currentUser.displayName || 'user'),
        photoURL: auth.currentUser.photoURL || undefined,
        email: auth.currentUser.email || undefined,
      });
      existingUids.add(auth.currentUser.uid);
    }

    // 5. Calculate metrics for all accounts
    const participants: Omit<LeaderboardUser, 'rank'>[] = [];

    for (const u of usersList) {
      const uid = u.uid;
      if (!uid) continue;
      const entries = userEntriesMap[uid] ?? [];
      const streakData = computeStreakData(entries);
      const completedTasks = entries.filter((e) => e.status === 'completed').length;
      
      const rawUsername =
        u.username ||
        (u.friendTag ? u.friendTag.replace(/^[#@]/, '').replace(/^pathly-/, '') : '') ||
        (u.displayName ? cleanUsername(u.displayName.split(' ')[0]) : '') ||
        (u.email ? cleanUsername(u.email.split('@')[0]) : '') ||
        `user_${uid.slice(-4)}`;

      const displayName =
        u.displayName ||
        (u.email ? u.email.split('@')[0] : '') ||
        rawUsername ||
        'Learner';

      participants.push({
        uid,
        displayName,
        username: rawUsername,
        photoURL: u.photoURL,
        streak: streakData.current,
        completedTasks,
        totalEntries: entries.length,
        lastSubject: entries[0]?.subject || '',
      });
    }

    // 6. Sort: Priority 1 = streak (desc), Priority 2 = completedTasks (desc), Priority 3 = totalEntries (desc)
    participants.sort((a, b) => {
      if (b.streak !== a.streak) {
        return b.streak - a.streak;
      }
      if (b.completedTasks !== a.completedTasks) {
        return b.completedTasks - a.completedTasks;
      }
      return b.totalEntries - a.totalEntries;
    });

    // 7. Assign 1-indexed ranks (1, 2, 3...)
    return participants.map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));
  } catch (err) {
    console.error('Failed to get leaderboard users:', err);
    return [];
  }
}


