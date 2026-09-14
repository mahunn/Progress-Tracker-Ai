// ──────────────────────────────────────────────────────────────
//  CORE TYPES for TrackPath Progress Tracker
// ──────────────────────────────────────────────────────────────

export type EntryStatus = "completed" | "in_progress" | "revisit";

export interface ParsedEntry {
  date: string;           // ISO date string: "2026-09-14"
  subject: string;        // e.g. "AI/ML"
  course: string;         // e.g. "Mathematics for Machine Learning"
  module: string;         // e.g. "Module 01 — Linear Equations"
  lesson: string;         // e.g. "1-7 Connecting the Concepts to ML"
  status: EntryStatus;
  notes: string;
  confidence: number;     // 0–100, how confident the AI is in parsing
}

export interface ProgressEntry {
  id: string;
  user_id?: string;
  date: string;                // "2026-09-14"
  raw_text: string;            // original input from user
  subject: string;
  course: string;
  module: string;
  lesson: string;
  status: EntryStatus;
  notes: string;
  screenshot_url?: string;
  screenshot_caption?: string; // AI-extracted text from screenshot
  created_at: string;
  updated_at: string;
}

export type DayStatus = "completed" | "partial" | "missed" | "empty" | "future" | "today";

export interface CalendarDay {
  date: Date;
  dateKey: string;          // "2026-09-14"
  status: DayStatus;
  entryCount: number;
  entries: ProgressEntry[];
  isToday: boolean;
  isFuture: boolean;
}

export interface StreakData {
  current: number;
  longest: number;
  lastEntryDate: string | null;
  totalDaysLogged: number;
  thisWeek: number;
  thisMonth: number;
}

export interface WeeklySummary {
  weekNumber: number;
  startDate: string;
  endDate: string;
  totalEntries: number;
  completedDays: number;
  subjects: string[];
  summary: string;         // AI-generated text summary
  generatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  is_public: boolean;
  created_at: string;
  streak: StreakData;
}

// For the AI parse API response
export interface ParseApiResponse {
  success: boolean;
  parsed?: ParsedEntry;
  error?: string;
  raw_response?: string;
}
