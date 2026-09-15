/**
 * Local storage-based data store.
 * Temporary persistence until Supabase is wired in.
 */
import { ProgressEntry, StreakData } from "./types";
import { calculateStreak, toDateKey } from "./utils";

const STORAGE_KEY = "trackpath_entries";

// ── Read ──────────────────────────────────────────────────────
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
        // Step 2: Keep only the latest 30 entries without screenshots
        const trimmed = entries.slice(0, 30).map((e) => ({
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

// ── Write ─────────────────────────────────────────────────────
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

export function deleteEntry(id: string): void {
  if (typeof window === "undefined") return;
  const entries = getAllEntries().filter((e) => e.id !== id);
  safeSetEntries(entries);
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
    longest: current, // simplified; full longest streak calc would need more logic
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
