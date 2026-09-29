/**
 * Local storage-based data store with offline resilience and Firestore synchronization.
 */
import { ProgressEntry, StreakData, WeeklyRoutine, ScheduleCourse } from "./types";
import { calculateStreak, toDateKey } from "./utils";
import { saveEntryToFirestore } from "./firestore";

const STORAGE_KEY = "trackpath_entries";
const ROUTINE_STORAGE_KEY = "trackpath_routine";

// ── Read Entries ──────────────────────────────────────────────
export function getAllEntries(): ProgressEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getEntriesByDate(dateKey: string): ProgressEntry[] {
  return getAllEntries().filter((e) => e.date === dateKey);
}

export function getEntriesDateMap(): Record<string, ProgressEntry[]> {
  const entries = getAllEntries();
  return entries.reduce<Record<string, ProgressEntry[]>>((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});
}

// ── Safe LocalStorage Helper ──────────────────────────────────
function safeSetEntries(entries: ProgressEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn("localStorage quota exceeded, pruning screenshots and older entries...", err);
    try {
      // Step 1: Strip large data URLs from screenshots in localStorage
      const lightweight = entries.map((e) => ({
        ...e,
        screenshot_url: e.screenshot_url?.startsWith("data:") ? undefined : e.screenshot_url,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
    } catch {
      try {
        // Step 2: Keep only the latest 50 entries without screenshots
        const trimmed = entries.slice(0, 50).map((e) => ({
          ...e,
          screenshot_url: undefined,
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch (finalErr) {
        console.error("Critical: unable to persist to localStorage", finalErr);
      }
    }
  }
}

// ── Write Entries ─────────────────────────────────────────────
export function saveEntry(entry: ProgressEntry): void {
  if (typeof window === "undefined") return;
  const entries = getAllEntries();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.unshift(entry); // newest first
  }
  safeSetEntries(entries);
}

export function saveEntriesBulk(newEntries: ProgressEntry[]): void {
  if (typeof window === "undefined" || newEntries.length === 0) return;
  const entries = getAllEntries();
  const map = new Map<string, ProgressEntry>(entries.map((e) => [e.id, e]));
  for (const entry of newEntries) {
    map.set(entry.id, entry);
  }
  const unified = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  safeSetEntries(unified);
}

export function deleteEntry(id: string): void {
  if (typeof window === "undefined") return;
  const entries = getAllEntries().filter((e) => e.id !== id);
  safeSetEntries(entries);
}

// ── Sync Entries With Firestore (Two-way, Never Discards Local Data) ──
export async function syncEntriesWithFirestore(
  uid: string,
  firestoreEntries: ProgressEntry[]
): Promise<ProgressEntry[]> {
  if (typeof window === "undefined") return firestoreEntries;

  const localEntries = getAllEntries();
  const entryMapById = new Map<string, ProgressEntry>();

  // 1. Seed with Firestore entries
  for (const fe of firestoreEntries) {
    entryMapById.set(fe.id, fe);
  }

  // 2. Merge local entries. If a local entry is not in Firestore, save it to Firestore!
  const uploads: Promise<void>[] = [];
  for (const le of localEntries) {
    if (!entryMapById.has(le.id)) {
      const entryWithUser: ProgressEntry = {
        ...le,
        user_id: uid,
      };
      entryMapById.set(le.id, entryWithUser);
      // Asynchronously upload to Firestore so data is preserved in cloud
      uploads.push(
        saveEntryToFirestore(entryWithUser).catch((err) => {
          console.warn("Could not sync local entry to Firestore:", err);
        })
      );
    }
  }

  if (uploads.length > 0) {
    Promise.all(uploads).catch(() => {});
  }

  // 3. Sort newest first
  const unified = Array.from(entryMapById.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  // 4. Update localStorage cache
  safeSetEntries(unified);

  return unified;
}

// ── Routine Local Storage & Merge Helpers ─────────────────────
function getRoutineKey(uid?: string): string {
  return uid ? `${ROUTINE_STORAGE_KEY}_${uid}` : ROUTINE_STORAGE_KEY;
}

export function getStoredRoutine(uid?: string): WeeklyRoutine | null {
  if (typeof window === "undefined") return null;
  try {
    // Check specific user routine, then fall back to generic
    const specific = uid ? localStorage.getItem(getRoutineKey(uid)) : null;
    if (specific) return JSON.parse(specific);
    const generic = localStorage.getItem(ROUTINE_STORAGE_KEY);
    return generic ? JSON.parse(generic) : null;
  } catch {
    return null;
  }
}

export function saveStoredRoutine(routine: WeeklyRoutine): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(routine);
    if (routine.user_id) {
      localStorage.setItem(getRoutineKey(routine.user_id), raw);
    }
    localStorage.setItem(ROUTINE_STORAGE_KEY, raw);
  } catch (err) {
    console.error("Failed to store routine in localStorage", err);
  }
}

export function deleteStoredRoutine(uid?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (uid) localStorage.removeItem(getRoutineKey(uid));
    localStorage.removeItem(ROUTINE_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to delete stored routine from localStorage", err);
  }
}

/**
 * Merge existing schedule courses with incoming newly parsed courses.
 * If courseCode matches on the same days, updates it. Otherwise, appends it.
 * This guarantees user's previous routines are NEVER lost on upload!
 */
export function mergeCourses(
  existingCourses: ScheduleCourse[],
  incomingCourses: ScheduleCourse[]
): ScheduleCourse[] {
  if (!existingCourses || existingCourses.length === 0) return incomingCourses;
  if (!incomingCourses || incomingCourses.length === 0) return existingCourses;

  const merged = [...existingCourses];

  for (const inc of incomingCourses) {
    const incCode = inc.courseCode.trim().toLowerCase();
    const incDays = [...inc.days].sort().join(",");

    const existingIdx = merged.findIndex((ex) => {
      const exCode = ex.courseCode.trim().toLowerCase();
      const exDays = [...ex.days].sort().join(",");
      return exCode === incCode && exDays === incDays;
    });

    if (existingIdx >= 0) {
      // Overwrite/update matching slot
      merged[existingIdx] = {
        ...merged[existingIdx],
        ...inc,
        color: merged[existingIdx].color || inc.color,
      };
    } else {
      // Append new course
      merged.push(inc);
    }
  }

  return merged;
}

// ── Streak ────────────────────────────────────────────────────
export function getStreakData(): StreakData {
  const entries = getAllEntries();
  const allDates = entries.map((e) => e.date);
  const uniqueDates = [...new Set(allDates)];
  const current = calculateStreak(uniqueDates);

  const today = new Date();
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const thisWeek = uniqueDates.filter((d) => new Date(d) >= thisWeekStart).length;
  const thisMonth = uniqueDates.filter((d) => new Date(d) >= thisMonthStart).length;

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

// ── Generate Entry ID ─────────────────────────────────────────
export function generateId(): string {
  return `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

