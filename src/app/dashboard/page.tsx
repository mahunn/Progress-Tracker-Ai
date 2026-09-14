"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NavBar from "@/components/NavBar";
import LogInput from "@/components/LogInput";
import CalendarGrid from "@/components/CalendarGrid";
import EntryCard from "@/components/EntryCard";
import StreakPanel from "@/components/StreakPanel";
import { ProgressEntry, CalendarDay } from "@/lib/types";
import {
  getUserEntries,
  saveEntryToFirestore,
  buildEntryMap,
  computeStreakData,
} from "@/lib/firestore";
import { generateId } from "@/lib/store";
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
    refresh();
  };

  if (authLoading || dataLoading) {
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
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Loading your progress...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  const todayKey = toDateKey(new Date());
  const todayEntries = entryMap[todayKey] ?? [];
  const displayEntries = selectedDay ? selectedDay.entries : entries.slice(0, 10);
  const displayLabel = selectedDay ? formatDate(selectedDay.date) : "Recent Entries";

  return (
    <div style={{ minHeight: "100vh" }}>
      <NavBar streak={streak.current} user={profile} />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>

        {/* Hero */}
        <section className="animate-fade-up" style={{ marginBottom: "2.5rem" }}>
          <h1
            className="font-display"
            style={{ fontWeight: 900, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", marginBottom: "0.5rem" }}
          >
            <span style={{ color: "var(--text-secondary)", fontWeight: 500, fontSize: "clamp(0.9rem, 2vw, 1.1rem)", display: "block", marginBottom: "0.25rem", fontFamily: "'Inter', sans-serif" }}>
              Hey, {profile?.displayName?.split(" ")[0] ?? "there"} 👋
            </span>
            <span className="text-gradient">Track your path</span>{" "}
            <span style={{ color: "var(--text-primary)" }}>forward.</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem", maxWidth: 480 }}>
            Log what you learn in plain English — AI organizes it beautifully.
          </p>
        </section>

        {/* 3-col grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.6fr 1fr",
            gap: "1.25rem",
            alignItems: "start",
          }}
        >
          {/* LEFT: Streak + Log Input + Today summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <StreakPanel streak={streak} />
            <LogInput onEntryAdded={handleEntryAdded} />

            {todayEntries.length > 0 && (
              <div className="card animate-fade-up stagger-3" style={{ padding: "1.25rem" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--emerald-400)", boxShadow: "0 0 8px rgba(16,185,129,0.5)" }} />
                  <h4 className="font-display" style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                    Today · {todayEntries.length} {todayEntries.length === 1 ? "entry" : "entries"}
                  </h4>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {todayEntries.slice(0, 3).map((e) => (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      <BookOpen size={11} style={{ color: "var(--violet-400)", flexShrink: 0 }} />
                      <span className="truncate-2">{e.lesson || e.module || e.course || e.raw_text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CENTER: Calendar */}
          <div className="card animate-fade-up stagger-1" style={{ padding: "1.5rem" }}>
            <CalendarGrid
              entryMap={entryMap}
              onDayClick={setSelectedDay}
              selectedDateKey={selectedDay?.dateKey ?? null}
            />
          </div>

          {/* RIGHT: Entry Feed */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="flex items-center gap-2 animate-fade-up stagger-2" style={{ marginBottom: "0.25rem" }}>
              <h3 className="font-display" style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                {displayLabel}
              </h3>
              {selectedDay && (
                <button
                  onClick={() => setSelectedDay(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "auto", padding: "0.2rem 0.5rem", borderRadius: "var(--r-sm)" }}
                >
                  Clear ✕
                </button>
              )}
            </div>

            {displayEntries.length === 0 ? (
              <div className="card animate-fade-up stagger-3" style={{ padding: "2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📚</div>
                <p className="font-display" style={{ fontWeight: 600, fontSize: "0.92rem", marginBottom: "0.35rem" }}>
                  {selectedDay ? "No entries this day" : "Your journey starts here"}
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {selectedDay ? "Select a different day or log a new entry" : "Log your first study session above ↑"}
                </p>
              </div>
            ) : (
              displayEntries.map((entry, i) => (
                <div key={entry.id} className={`stagger-${Math.min(i + 1, 5)}`}>
                  <EntryCard entry={entry} />
                </div>
              ))
            )}

            {!selectedDay && entries.length > 10 && (
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: "0.5rem" }}>
                <ChevronRight size={14} />
                View all {entries.length} entries
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
