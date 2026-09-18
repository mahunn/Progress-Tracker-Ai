"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NavBar from "@/components/NavBar";
import { ProgressEntry } from "@/lib/types";
import { getUserEntries, computeStreakData } from "@/lib/firestore";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import AIRecapCard from "@/components/summary/AIRecapCard";
import CourseProgressStats from "@/components/summary/CourseProgressStats";
import { subDays, isAfter, parseISO } from "date-fns";

type Timeframe = "7days" | "30days" | "all";

export default function SummaryPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [streak, setStreak] = useState(computeStreakData([]));
  const [dataLoading, setDataLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>("7days");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchEntries = async () => {
      if (!user) return;
      try {
        const all = await getUserEntries(user.uid);
        setEntries(all);
        setStreak(computeStreakData(all));
      } finally {
        setDataLoading(false);
      }
    };
    if (user) fetchEntries();
  }, [user]);

  const filteredEntries = useMemo(() => {
    if (timeframe === "all") return entries;
    
    const now = new Date();
    const cutoffDate = timeframe === "7days" ? subDays(now, 7) : subDays(now, 30);
    
    return entries.filter(entry => {
      const entryDate = parseISO(entry.date);
      return isAfter(entryDate, cutoffDate);
    });
  }, [entries, timeframe]);

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <Loader2 size={32} style={{ color: "var(--violet-400)", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Authenticating...</p>
      </div>
    );
  }

  if (!user) return null;

  const totalCompleted = filteredEntries.filter(e => e.status === "completed").length;
  const totalInProgress = filteredEntries.filter(e => e.status !== "completed").length;

  return (
    <div style={{ minHeight: "100vh" }}>
      <NavBar streak={streak.current} user={profile} />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1rem 6rem" }}>
        {/* Header Section */}
        <section className="animate-fade-up" style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <h1 className="font-display" style={{ fontWeight: 900, fontSize: "clamp(1.6rem, 4vw, 2.8rem)", marginBottom: "0.25rem" }}>
              Your <span className="text-gradient">Progress</span> Summary.
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Analyze your learning patterns and get AI-driven insights.
            </p>
          </div>
          
          {/* Timeframe Filter */}
          <div style={{ display: "flex", gap: "0.5rem", background: "var(--bg-elevated)", padding: "0.25rem", borderRadius: "var(--r-md)", width: "fit-content", border: "1px solid var(--border-subtle)" }}>
            {(Object.keys({ "7days": "Past 7 Days", "30days": "Past 30 Days", "all": "All Time" }) as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  padding: "0.4rem 1rem",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  borderRadius: "var(--r-sm)",
                  background: timeframe === tf ? "var(--bg-surface)" : "transparent",
                  color: timeframe === tf ? "var(--text-primary)" : "var(--text-muted)",
                  border: "none",
                  boxShadow: timeframe === tf ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                  transition: "all 150ms"
                }}
              >
                {tf === "7days" ? "Past 7 Days" : tf === "30days" ? "Past 30 Days" : "All Time"}
              </button>
            ))}
          </div>
        </section>

        {dataLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--violet-400)" }} />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem", WebkitBoxOrient: "vertical" }}>
            
            {/* Top Stats Row */}
            <div className="animate-fade-up stagger-1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <div className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ background: "rgba(167, 139, 250, 0.1)", padding: "0.75rem", borderRadius: "var(--r-md)", color: "var(--violet-400)" }}>
                  <CalendarIcon size={24} />
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>Total Entries</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{filteredEntries.length}</div>
                </div>
              </div>
              
              <div className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ background: "rgba(52, 211, 153, 0.1)", padding: "0.75rem", borderRadius: "var(--r-md)", color: "var(--emerald-400)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>Completed Tasks</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{totalCompleted}</div>
                </div>
              </div>

              <div className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ background: "rgba(251, 191, 36, 0.1)", padding: "0.75rem", borderRadius: "var(--r-md)", color: "var(--amber-400)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>In Progress</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{totalInProgress}</div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)", gap: "1.5rem", alignItems: "start" }} className="dashboard-grid">
              
              {/* Left Column: AI Recap */}
              <div className="animate-fade-up stagger-2" style={{ width: "100%" }}>
                <AIRecapCard 
                  entries={filteredEntries} 
                  timeframe={timeframe === "7days" ? "Past 7 Days" : timeframe === "30days" ? "Past 30 Days" : "All Time"} 
                />
              </div>

              {/* Right Column: Course Stats */}
              <div className="animate-fade-up stagger-3" style={{ width: "100%" }}>
                {filteredEntries.length > 0 ? (
                  <CourseProgressStats entries={filteredEntries} />
                ) : (
                  <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    <p>No study entries in this timeframe.</p>
                  </div>
                )}
              </div>
              
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
