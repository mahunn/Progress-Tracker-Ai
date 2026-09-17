"use client";

import { useCallback, useEffect, useState } from "react";
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
import { generateId, saveEntry, deleteEntry } from "@/lib/store";
import { formatDate, toDateKey } from "@/lib/utils";
import { BookOpen, ChevronRight, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [entryMap, setEntryMap] = useState<Record<string, ProgressEntry[]>>({});
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [streak, setStreak] = useState(computeStreakData([]));
  const [dataLoading, setDataLoading] = useState(true);

  // Redirect unauthenticated users to landing
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const all = await getUserEntries(user.uid);
      setEntries(all);
      setEntryMap(buildEntryMap(all));
      setStreak(computeStreakData(all));
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
    await saveEntryToFirestore(withUser);
    await refresh();
  };

  const handleEntriesAdded = async (newEntries: ProgressEntry[]) => {
    if (!user) return;
    const savePromises = newEntries.map(async (entry) => {
      const withUser = { ...entry, user_id: user.uid };
      return saveEntryToFirestore(withUser);
    });
    await Promise.all(savePromises);
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
  const displayEntries = selectedDay ? (entryMap[selectedDay.dateKey] ?? []) : todayEntries;
  const displayLabel = selectedDay ? formatDate(selectedDay.date) : "Today's Tasks";

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
                onDayClick={setSelectedDay}
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

        {/* BOTTOM: Completed Tasks Feed */}
        <section style={{ marginTop: "2rem" }}>
          <div className="flex items-center gap-2 animate-fade-up stagger-2" style={{ marginBottom: "1rem" }}>
            <h3 className="font-display" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-secondary)" }}>
              {displayLabel}
            </h3>
            {selectedDay && (
              <button
                onClick={() => setSelectedDay(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", marginLeft: "auto", padding: "0.2rem 0.5rem", borderRadius: "var(--r-sm)" }}
              >
                Clear ✕
              </button>
            )}
          </div>

          {dataLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--violet-400)" }} />
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="card animate-fade-up stagger-3" style={{ padding: "2rem", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📚</div>
              <p className="font-display" style={{ fontWeight: 600, fontSize: "0.92rem", marginBottom: "0.35rem" }}>
                {selectedDay ? "No entries this day" : "No tasks completed today"}
              </p>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {selectedDay ? "Select a different day or log a new entry" : "Log your first study session today ↑"}
              </p>
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

          {!selectedDay && entries.length > todayEntries.length && (
            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <button className="btn btn-ghost btn-sm">
                <ChevronRight size={14} />
                View all past entries
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
