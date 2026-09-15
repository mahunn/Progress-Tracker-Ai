# TrackPath AI (Progress Tracker AI) — System Memory & Architecture

> **MANDATORY OPERATIONAL DIRECTIVE FOR ALL AI ASSISTANTS:**
> 1. **START EVERY TASK**: Read this file first to immediately get the complete context of how the system is set up and working without needing redundant analysis across the workspace.
> 2. **FINISH EVERY TASK**: Update this file immediately upon completing any change or addition so the system memory is always 100% current and authoritative.

---

## 1. Project Overview & Purpose

**Pathly / TrackPath AI** is an AI-powered daily study and skill progression tracker.
- **Core Value Proposition**: Users can quickly log what they learned in plain conversational English or paste/upload lecture slides/screenshots. AI (Google Gemini) parses the note into structured subjects, courses, modules, lessons, and completion status.
- **Visual Feedback**: Real-time GitHub-style calendar heatmap, dynamic streaks, weekly breakdown, and friend accountability system.

---

## 2. Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16.3.5 (App Router)** | React 19.2.8, TypeScript 5, Turbopack |
| **Styling** | **Tailwind CSS v4 + Vanilla CSS** | `@tailwindcss/postcss`, `src/app/globals.css` with custom CSS tokens, glassmorphism, animations |
| **Authentication** | **Firebase Auth 12.19.0** | Google Sign-in Popup (`signInWithPopup`), auto user profile creation |
| **Database** | **Firebase Firestore 12.19.0** | Collections: `users`, `entries`, `friend_requests`, `friends` |
| **Local Cache** | **Browser LocalStorage** | Temporary offline fallback & quick hydration (`trackpath_entries` key) |
| **AI Parsing** | **Google Generative AI SDK** | `@google/generative-ai` 0.24.1 calling Gemini (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.6-flash`) |
| **Icons & Utilities**| **lucide-react**, **date-fns** | Modern SVG icons, lightweight date formatting & calculations |

---

## 3. Directory Structure

```
├── AGENTS.md                   # Agent system rules & pointer to SYSTEM_MEMORY.md
├── CLAUDE.md                   # Agent configuration & memory pointers
├── SYSTEM_MEMORY.md            # THIS FILE - comprehensive system working memory
├── package.json
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout wrapping AuthProvider & metadata
│   │   ├── globals.css         # Complete design system tokens, themes, component classes
│   │   ├── page.tsx            # Public landing page with live demo preview & auth CTA
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Main authenticated dashboard (streak, input, calendar, feed)
│   │   ├── friends/
│   │   │   └── page.tsx        # Friends directory, search by friend tag, incoming requests
│   │   ├── u/[friendTag]/
│   │   │   └── page.tsx        # Public friend profile page (streak, calendar heatmap, entries)
│   │   └── api/
│   │       └── parse-entry/
│   │           └── route.ts    # POST endpoint: AI multimodal prompt parsing (text + image)
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthModal.tsx   # Google sign-in modal with feature highlights
│   │   ├── CalendarGrid.tsx    # Interactive month grid heatmap with status indicators & tooltips
│   │   ├── EntryCard.tsx       # Entry display card with status dropdown & "Mark as completed" action
│   │   ├── LogInput.tsx        # Natural language input + screenshot drop/paste + AI review modal
│   │   ├── NavBar.tsx          # Top navigation, streak counter, links, theme toggle, profile menu
│   │   ├── StreakPanel.tsx     # Streak stats cards (Current, Longest, This Week, This Month)
│   │   └── ThemeToggle.tsx     # Light/Dark mode switcher modifying data-theme on <html>
│   ├── context/
│   │   └── AuthContext.tsx     # Firebase onAuthStateChanged provider supplying user, profile, loading
│   └── lib/
│       ├── firebase.ts         # Firebase initialization, Google auth provider, user profile helpers
│       ├── firestore.ts        # Firestore CRUD: entries, friend requests, friendships, streak computation
│       ├── store.ts            # Client-side localStorage backup for entries & offline support
│       ├── types.ts            # Core TypeScript interfaces & types
│       └── utils.ts            # Date formatting, streak calculation, image compression helper
```

---

## 4. Data Models & TypeScript Interfaces (`src/lib/types.ts`)

### `EntryStatus`
```ts
export type EntryStatus = "completed" | "in_progress" | "revisit";
```

### `ProgressEntry`
```ts
export interface ProgressEntry {
  id: string;
  user_id?: string;
  date: string;                // ISO date "YYYY-MM-DD"
  raw_text: string;            // Original input from user
  subject: string;             // e.g. "AI/ML", "Mathematics", "Programming"
  course: string;              // e.g. "Mathematics for Machine Learning"
  module: string;              // e.g. "Module 02"
  lesson: string;              // e.g. "2-7 Vector Operations"
  status: EntryStatus;         // "completed" | "in_progress" | "revisit"
  notes: string;
  screenshot_url?: string;     // Compressed image DataURL or remote storage URL
  screenshot_caption?: string;
  created_at: string;
  updated_at: string;
}
```

### `CalendarDay` & `DayStatus`
- `DayStatus`: `"completed" | "partial" | "missed" | "empty" | "future" | "today"`
- `CalendarDay`: Holds `date`, `dateKey`, `status`, `entryCount`, `entries[]`, `isToday`, `isFuture`.
- **Day status logic in `CalendarGrid.tsx`**:
  - All entries on date completed $\rightarrow$ `"completed"` (Green)
  - Mixed or in-progress entries $\rightarrow$ `"partial"` (Amber)
  - Past day with 0 entries logged $\rightarrow$ `"missed"` (Red outline)
  - Today with 0 entries $\rightarrow$ `"today"` (Purple outline)

### `StreakData`
```ts
export interface StreakData {
  current: number;
  longest: number;
  lastEntryDate: string | null;
  totalDaysLogged: number;
  thisWeek: number;
  thisMonth: number;
}
```

### `UserProfile`
```ts
export interface UserProfile {
  id?: string;
  uid: string;
  email: string;
  username: string;            // Unique clean username without prefixes (e.g. "mahin")
  displayName: string;
  photoURL?: string;
  friendTag?: string;          // Kept in sync with username for legacy lookup
  isPublic?: boolean;
  createdAt?: string;
  streak?: StreakData;
}
```

---

## 5. Core Application Flows

### 1. Logging an Entry
1. User enters text or pastes/uploads a screenshot into `LogInput.tsx`.
2. Image is compressed on client (`compressImage` in `src/lib/utils.ts`) to ~40-80KB to avoid Firestore/localStorage limits.
3. Client posts to `/api/parse-entry` with `FormData` (`text`, `image`, `clientDate`).
4. API calls Gemini with a strict schema prompt to extract `subject`, `course`, `module`, `lesson`, `status`, `notes`.
5. User reviews the AI-extracted fields in a confirmation card, edits if needed, and clicks "Confirm & Save".
6. `handleConfirm()` calls `saveEntry(entry)` (localStorage) and `onEntryAdded(entry)` $\rightarrow$ `saveEntryToFirestore(entry)`.
7. Dashboard state refreshes optimistically.

### 2. Marking as Completed & Changing Status
1. `EntryCard.tsx` displays the entry status badge (`Completed`, `In Progress`, `Revisit`).
2. When the entry is not completed (`in_progress` or `revisit`), a high-visibility **"Mark as completed"** button is displayed directly on the card header.
3. The status badge is interactive with a dropdown menu allowing the user to select between `Completed`, `In Progress`, and `Revisit`.
4. On status change, `onStatusChange(entryId, newStatus)` is called:
   - `DashboardPage` updates the entry optimistically in `entries`, `entryMap`, and `streak`.
   - Persists to Firestore (`saveEntryToFirestore`) and localStorage (`saveEntry`).
   - `CalendarGrid` automatically updates the day's status (e.g. turning a partial day into a green completed day when all items are done).

### 3. Unique Username & Friends System
1. **Default Username Generation on Google Login**:
   - `ensureUserProfile` generates a clean, unique username upon login:
     - 1st attempt: First name in lowercase (e.g. `"mahin"`).
     - 2nd attempt (if taken): First name + Last name (e.g. `"mahinkhan"`).
     - 3rd attempt (if taken): First name + number (`"mahin2"`, `"mahin3"`...).
   - No `pathly` or `#` prefixes are stored or used.
   - Automatically migrates existing accounts without clean usernames.
2. **Username Modification & Availability**:
   - On `/friends`, users can view their current `@username` and click "Change" to edit it.
   - `isUsernameAvailable` verifies uniqueness in Firestore before updating (`updateUsername`).
   - Includes 1-click "Copy" username button.
3. **Friend Search & Requests**:
   - Search input in `/friends` searches by clean username (`searchUserByUsername`) with no prefix.
   - User cards, pending requests, and buddy lists all display clean `@username`.
   - Requests are sent with `fromUsername` via `sendFriendRequest`.
4. **Public Profiles**:
   - Accessed at `/u/[username]` (e.g. `/u/mahin`). Displays `@username`, streak counter, and calendar heatmap.

### 4. Community Leaderboard Ranking
1. **Ranking Metrics & Priority**:
   - `getLeaderboardUsers()` in `src/lib/firestore.ts` aggregates all registered participants and their entries.
   - **Priority 1**: `streak` (current streak, descending).
   - **Priority 2**: `completedTasks` (number of completed modules/lessons, descending).
   - **Tie-breaker**: `totalEntries` (descending).
2. **UI Presentation in `/friends`**:
   - Segmented tab control toggles between **"🏆 Leaderboard"** and **"👥 My Buddies"**.
   - Current user's personal standing is spotlighted in a header card ("Your Current Rank: #X of Y").
   - Top 3 participants receive glowing gold 🥇, silver 🥈, and bronze 🥉 badges.
   - Ranks 4+ receive numbered badges (`#4`, `#5`, etc.).
   - Rows display avatar, display name, `@username`, "You" indicator, `🔥 X days` streak, and `✅ Y completed` tasks.
   - Direct links to `/u/[username]` and 1-click `[+ Add]` friend buttons for other participants.



---

## 6. Design System & Theme Conventions

- **Theme Mode**: Supported via `data-theme="dark"` (default) or `data-theme="light"` on `<html>`. Controlled by `ThemeToggle.tsx`.
- **Theme Variables**: Defined in `src/app/globals.css`:
  - Surfaces: `--bg-base`, `--bg-surface`, `--bg-elevated`, `--bg-card`
  - Text: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-ghost`
  - Borders: `--border-subtle`, `--border-soft`, `--border-focus`
  - Brand Gradients: `--grad-brand`, `--grad-glow`, `--grad-success`
  - Status Colors: Emerald (`--emerald-400`), Amber (`--amber-400`), Violet (`--violet-400`), Rose (`--rose-400`), Sky (`--sky-400`)
- **Typography**:
  - Headings: `'Outfit', sans-serif`
  - Body: `'Inter', sans-serif`
  - Code/Tags: `'JetBrains Mono', monospace`

---

## 7. Rules for AI Developers Modifying This Repository

1. **Mandatory Workflow**:
   - **At Start**: Read `SYSTEM_MEMORY.md` to immediately get full context on the architecture and data flows.
   - **At Finish**: Update `SYSTEM_MEMORY.md` to document new features, bug fixes, or changed behaviors.
2. **Preserve Next.js 16 & React 19 Invariants**:
   - Keep Next.js 16 conventions (async params/searchParams, server/client boundaries).
   - In React 19, never mix shorthand and longhand style properties (e.g. do not mix `border` with `borderColor`/`borderWidth`). Use distinct longhand properties (`borderWidth`, `borderStyle`, `borderColor`).
3. **Optimistic Updates**: Any mutation to entries, statuses, or streaks in the dashboard must update React state immediately before awaiting Firebase Firestore network calls to ensure a snappy user experience.
4. **Data Size Awareness**: Any screenshot storage must use client-side compression (`compressImage`) or external storage URLs to avoid exceeding Firestore's 1MB document limit.
