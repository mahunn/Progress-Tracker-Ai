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
  id?: string;
  uid: string;
  email: string;
  username: string;
  displayName: string;
  display_name?: string;
  photoURL?: string;
  avatar_url?: string;
  friendTag?: string;
  isPublic?: boolean;
  is_public?: boolean;
  createdAt?: string;
  created_at?: string;
  streak?: StreakData;
}


// For the AI parse API response
export interface ParseApiResponse {
  success: boolean;
  parsed?: ParsedEntry;
  error?: string;
  raw_response?: string;
}

export type DayOfWeek = "Sat" | "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

export interface ScheduleCourse {
  id: string;
  courseCode: string; // e.g. "CSE332.2"
  startTime: string; // "01:00 PM"
  endTime: string; // "02:30 PM"
  days: DayOfWeek[];
  color?: string; // Hex color or CSS variable
}

export interface WeeklyRoutine {
  id: string;
  user_id: string;
  courses: ScheduleCourse[];
  updated_at: string;
}

export interface ParseScheduleResponse {
  success: boolean;
  courses?: Omit<ScheduleCourse, "id" | "color">[];
  error?: string;
}
