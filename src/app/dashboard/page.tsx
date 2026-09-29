"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NavBar from "@/components/NavBar";
import LogInput from "@/components/LogInput";
import CalendarGrid from "@/components/CalendarGrid";
import EntryCard from "@/components/EntryCard";
import StreakPanel from "@/components/StreakPanel";
import DailyPlan from "@/components/DailyPlan";
import { ProgressEntry, CalendarDay, EntryStatus } from "@/lib/types";
import {
  getUserEntries,
  saveEntryToFirestore,
  deleteEntryFromFirestore,
  buildEntryMap,
  computeStreakData,
} from "@/lib/firestore";
import { generateId, saveEntry, saveEntriesBulk, deleteEntry, getAllEntries, syncEntriesWithFirestore } from "@/lib/store";
import { formatDate, toDateKey } from "@/lib/utils";
import { BookOpen, ChevronRight, Loader2, CheckCircle2, Clock, List } from "lucide-react";

type FeedTab = "today" | "completed" | "all";

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [entryMap, setEntryMap] = useState<Record<string, ProgressEntry[]>>({});
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [streak, setStreak] = useState(computeStreakData([]));
  const [dataLoading, setDataLoading] = useState(true);
  const [feedTab, setFeedTab] = useState<FeedTab>("today");

  // Redirect unauthenticated users to landing
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Immediately hydrate with any local entries so UI is never blank
      const local = getAllEntries();
      if (local.length > 0) {
        setEntries((prev) => (prev.length === 0 ? local : prev));
        setEntryMap((prev) => (Object.keys(prev).length === 0 ? buildEntryMap(local) : prev));
        setStreak((prev) => (prev.totalDaysLogged === 0 ? computeStreakData(local) : prev));
      }

      // 2. Fetch remote and sync with local (keeps all past completed data)
      const remote = await getUserEntries(user.uid);
      const unified = await syncEntriesWithFirestore(user.uid, remote);
      setEntries(unified);
      setEntryMap(buildEntryMap(unified));
      setStreak(computeStreakData(unified));
    } catch (err) {
      console.warn("Failed fetching entries from Firestore, relying on local storage cache:", err);
      const local = getAllEntries();
      setEntries(local);
      setEntryMap(buildEntryMap(local));
      setStreak(computeStreakData(local));
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const handleEntryAdded = async (entry: ProgressEntry) => {
    if (!user) return;
    const withUser = { ...entry, user_id: user.uid };
    saveEntry(withUser);
    try {
      await saveEntryToFirestore(withUser);
    } catch (err) {
      console.warn("Could not save entry to Firestore, saved locally:", err);
    }
    await refresh();
  };

  const handleEntriesAdded = async (newEntries: ProgressEntry[]) => {
    if (!user) return;
    const withUser = newEntries.map((e) => ({ ...e, user_id: user.uid }));
    saveEntriesBulk(withUser);
    try {
      await Promise.all(withUser.map((entry) => saveEntryToFirestore(entry)));
    } catch (err) {
      console.warn("Could not save entries to Firestore, saved locally:", err);
    }
    await refresh();
  };

  const handleStatusChange = async (entryId: string, newStatus: EntryStatus) => {
    const target = entries.find((e) => e.id === entryId);
    if (!target) return;
    const updatedEntry: ProgressEntry = {
      ...target,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Optimistic UI updates
    const updatedEntries = entries.map((e) => (e.id === entryId ? updatedEntry : e));
    setEntries(updatedEntries);
    setEntryMap(buildEntryMap(updatedEntries));
    setStreak(computeStreakData(updatedEntries));

    // Update local cache
    saveEntry(updatedEntry);

    // Persist to Firestore
    if (user) {
      try {
        await saveEntryToFirestore(updatedEntry);
      } catch (err) {
        console.error("Failed to update status in Firestore:", err);
      }
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    const updatedEntries = entries.filter((e) => e.id !== entryId);
    setEntries(updatedEntries);
    setEntryMap(buildEntryMap(updatedEntries));
    setStreak(computeStreakData(updatedEntries));

    deleteEntry(entryId);

    if (user) {
      try {
        await deleteEntryFromFirestore(entryId);
      } catch (err) {
        console.error("Failed to delete entry from Firestore:", err);
      }
    }
  };

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
        }}
      >
        <Loader2 size={32} style={{ color: "var(--violet-400)", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Authenticating...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  const todayKey = toDateKey(new Date());
  const todayEntries = entryMap[todayKey] ?? [];
  const completedEntries = entries.filter((e) => e.status === "completed");

  let displayEntries: ProgressEntry[];
  let displayLabel: string;

  if (selectedDay) {
    displayEntries = entryMap[selectedDay.dateKey] ?? [];
    displayLabel = `Entries for ${formatDate(selectedDay.date)}`;
  } else if (feedTab === "completed") {
    displayEntries = completedEntries;
    displayLabel = "All Completed Tasks";
  } else if (feedTab === "all") {
    displayEntries = entries;
    displayLabel = "All Entries";
  } else {
    displayEntries = todayEntries;
    displayLabel = "Today's Tasks";
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <NavBar streak={streak.current} user={profile} />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1rem 6rem" }}>

        {/* Hero */}
        <section className="dashboard-hero animate-fade-up" style={{ marginBottom: "2rem" }}>
          <h1
            className="font-display"
            style={{ fontWeight: 900, fontSize: "clamp(1.6rem, 4vw, 2.8rem)", marginBottom: "0.5rem" }}
          >
            <span style={{ color: "var(--text-secondary)", fontWeight: 500, fontSize: "clamp(0.85rem, 2vw, 1.1rem)", display: "block", marginBottom: "0.25rem", fontFamily: "'Inter', sans-serif" }}>
              Hey, {profile?.displayName?.split(" ")[0] ?? "there"} 👋
            </span>
            <span className="text-gradient">Track your path</span>{" "}
            <span style={{ color: "var(--text-primary)" }}>forward.</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", maxWidth: 480 }}>
            Log what you learn in plain English — AI organizes it beautifully.
          </p>
        </section>

        {/* Responsive Dashboard Grid */}
        <div className="dashboard-grid">
          {/* LEFT: Streak & Daily Plan */}
          <div className="dashboard-col-left" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="dashboard-streak-panel">
              <StreakPanel streak={streak} />
            </div>
            <DailyPlan onEntriesAdded={handleEntriesAdded} />
          </div>

          {/* CENTER: Calendar */}
          <div className="dashboard-col-calendar card animate-fade-up stagger-1" style={{ padding: "1.5rem" }}>
            {dataLoading ? (
              <div className="flex justify-center items-center h-full min-h-[200px]">
                <Loader2 size={24} className="animate-spin" style={{ color: "var(--violet-400)" }} />
              </div>
            ) : (
              <CalendarGrid
                entryMap={entryMap}
                onDayClick={(day) => {
                  setSelectedDay(day);
                  setFeedTab("today");
                }}
                selectedDateKey={selectedDay?.dateKey ?? null}
              />
            )}
          </div>

          {/* RIGHT: Task Uploading */}
          <div className="dashboard-col-feed" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="dashboard-upload-section">
              <LogInput onEntryAdded={handleEntryAdded} />
            </div>
          </div>
        </div>

        {/* BOTTOM: Tasks Feed */}
        <section style={{ marginTop: "2.5rem" }}>
          <div className="flex items-center justify-between animate-fade-up stagger-2" style={{ marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div className="flex items-center gap-2">
              <h3 className="font-display" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {displayLabel}
              </h3>
              {selectedDay && (
                <button
                  onClick={() => setSelectedDay(null)}
                  className="btn btn-ghost btn-xs"
                  style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}
                >
                  Clear Selection ✕
                </button>
              )}
            </div>

            {/* Filter Tabs when not viewing a specific calendar day */}
            {!selectedDay && (
              <div style={{ display: "flex", gap: "0.25rem", background: "var(--bg-elevated)", padding: "0.25rem", borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)" }}>
                <button
                  onClick={() => setFeedTab("today")}
                  className={`btn btn-xs ${feedTab === "today" ? "btn-primary" : "btn-ghost"}`}
                  style={{ gap: "0.35rem" }}
                >
                  <Clock size={12} />
                  Today ({todayEntries.length})
                </button>
                <button
                  onClick={() => setFeedTab("completed")}
                  className={`btn btn-xs ${feedTab === "completed" ? "btn-primary" : "btn-ghost"}`}
                  style={{ gap: "0.35rem" }}
                >
                  <CheckCircle2 size={12} />
                  Completed ({completedEntries.length})
                </button>
                <button
                  onClick={() => setFeedTab("all")}
                  className={`btn btn-xs ${feedTab === "all" ? "btn-primary" : "btn-ghost"}`}
                  style={{ gap: "0.35rem" }}
                >
                  <List size={12} />
                  All ({entries.length})
                </button>
              </div>
            )}
          </div>

          {dataLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--violet-400)" }} />
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="card animate-fade-up stagger-3" style={{ padding: "2.5rem 1.5rem", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📚</div>
              <p className="font-display" style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "0.35rem" }}>
                {selectedDay
                  ? `No entries on ${formatDate(selectedDay.date)}`
                  : feedTab === "today"
                  ? "No tasks logged for today yet"
                  : feedTab === "completed"
                  ? "No tasks completed yet"
                  : "No entries logged yet"}
              </p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                {selectedDay
                  ? "Select another day on the calendar or log what you did today ↑"
                  : feedTab === "today" && completedEntries.length > 0
                  ? `You have ${completedEntries.length} completed task(s) in your history.`
                  : "Log what you learn or plan your day to start tracking your streak."}
              </p>

              {feedTab === "today" && completedEntries.length > 0 && !selectedDay && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setFeedTab("completed")}
                  style={{ margin: "0 auto" }}
                >
                  <CheckCircle2 size={14} />
                  View {completedEntries.length} Completed Task(s)
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
              {displayEntries.map((entry, i) => (
                <div key={entry.id} className={`stagger-${Math.min(i + 1, 5)}`}>
                  <EntryCard
                    entry={entry}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteEntry}
                  />
                </div>
              ))}
            </div>
          )}

          {!selectedDay && feedTab === "today" && entries.length > todayEntries.length && (
            <div style={{ marginTop: "1.5rem", textAlign: "center", display: "flex", justifyContent: "center", gap: "0.75rem" }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setFeedTab("all")}
                style={{ color: "var(--violet-400)" }}
              >
                <ChevronRight size={14} />
                View all {entries.length} past entries
              </button>
              {completedEntries.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setFeedTab("completed")}
                  style={{ color: "var(--emerald-400)" }}
                >
                  <CheckCircle2 size={14} />
                  View {completedEntries.length} completed tasks
                </button>
              )}
            </div>
          )}

          {!selectedDay && feedTab !== "today" && (
            <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setFeedTab("today")}>
                ← Back to Today's Tasks
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

