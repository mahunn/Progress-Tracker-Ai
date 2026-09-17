"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { searchUserByUsername } from "@/lib/firebase";
import { getPublicEntriesByUid, buildEntryMap, computeStreakData, checkIfFriends, getWeeklyRoutine } from "@/lib/firestore";
import CalendarGrid from "@/components/CalendarGrid";
import EntryCard from "@/components/EntryCard";
import WeeklyCalendar from "@/components/WeeklyCalendar";
import { ProgressEntry, CalendarDay, ScheduleCourse } from "@/lib/types";
import { Flame, BookOpen, Loader2, ArrowLeft, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function PublicProfilePage() {
  const params = useParams();
  const rawTag = decodeURIComponent(params.friendTag as string);
  const cleanTag = rawTag.replace(/^[#@]/, "");

  const [profile, setProfile] = useState<{
    uid: string;
    displayName: string;
    photoURL: string;
    username?: string;
    friendTag: string;
  } | null>(null);
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [entryMap, setEntryMap] = useState<Record<string, ProgressEntry[]>>({});
  const [courses, setCourses] = useState<ScheduleCourse[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  
  const { user: currentUser } = useAuth();

  useEffect(() => {
    (async () => {
      const p = await searchUserByUsername(cleanTag);
      if (!p) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(p as { uid: string; displayName: string; photoURL: string; username?: string; friendTag: string });
      
      const userEntries = await getPublicEntriesByUid(p.uid as string);
      setEntries(userEntries);
      const eMap = buildEntryMap(userEntries);
      setEntryMap(eMap);
      
      const d = new Date();
      const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setSelectedDay({
        dateKey: todayKey,
        entries: eMap[todayKey] || []
      });
      
      const routine = await getWeeklyRoutine(p.uid as string);
      if (routine && routine.courses) {
        setCourses(routine.courses);
      }
      
      if (currentUser) {
        const friendStatus = await checkIfFriends(currentUser.uid, p.uid);
        setIsFriend(friendStatus);
      } else {
        setIsFriend(false);
      }
      
      setLoading(false);
    })();
  }, [cleanTag, currentUser]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} style={{ color: "var(--violet-400)", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <div style={{ fontSize: "3rem" }}>🔍</div>
        <h2 className="font-display" style={{ fontWeight: 700 }}>Profile not found</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          No user with username <span style={{ color: "var(--violet-400)" }}>@{cleanTag}</span>
        </p>
        <Link href="/friends" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Back to Friends</Link>
      </div>
    );
  }


  const streak = computeStreakData(entries);
  const displayEntries = selectedDay ? selectedDay.entries : entries.slice(0, 8);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Minimal nav */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 2rem",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-nav)",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="flex items-center">
          <img src="/logo.png" alt="Pathly" className="brand-logo" style={{ height: 34, width: "auto", objectFit: "contain" }} />
        </div>
        <Link href="/" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Back</Link>
      </nav>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "1.5rem 1rem 5rem" }}>

        {/* Profile header */}
        <div
          className="card animate-fade-up"
          style={{
            padding: "1.5rem",
            marginBottom: "1.5rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "1.25rem",
            background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(124,58,237,0.04) 100%)",
            border: "1px solid var(--border-soft)",
          }}
        >
          {profile.photoURL ? (
            <img
              src={profile.photoURL}
              alt={profile.displayName}
              style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid var(--border-soft)", flexShrink: 0 }}
            />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--grad-brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: "1.6rem", flexShrink: 0 }}>
              {profile.displayName?.[0]}
            </div>
          )}
          <div style={{ flex: "1 1 200px" }}>
            <h1 className="font-display" style={{ fontWeight: 800, fontSize: "1.5rem", marginBottom: "0.2rem" }}>
              {profile.displayName}
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--violet-400)", fontFamily: "'JetBrains Mono', monospace" }}>
              @{profile.username || profile.friendTag?.replace(/^#pathly-/, "")}
            </p>
          </div>
          <div className="flex gap-3" style={{ flexWrap: "wrap" }}>
            {[
              { value: streak.current, label: "Streak", icon: "🔥", color: "var(--amber-400)" },
              { value: streak.totalDaysLogged, label: "Days Logged", icon: "📅", color: "var(--sky-400)" },
              { value: streak.thisMonth, label: "This Month", icon: "📈", color: "var(--emerald-400)" },
            ].map(({ value, label, color }) => (
              <div key={label} style={{ textAlign: "center", minWidth: 58 }}>
                <div className="font-display" style={{ fontSize: "1.35rem", fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "0.1rem" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grid: calendar + planner */}
        <div className="friend-profile-grid">
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Monthly Log */}
            <div className="animate-fade-up stagger-1">
              <h3 className="font-display" style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>Monthly Log</h3>
              <div className="card" style={{ padding: "1.5rem" }}>
                <CalendarGrid entryMap={entryMap} onDayClick={setSelectedDay} selectedDateKey={selectedDay?.dateKey ?? null} />
              </div>
            </div>

            {/* Selected Date Entries (Below) */}
            {selectedDay && (
              <div className="animate-fade-up stagger-3">
                <div className="flex items-center justify-between" style={{ marginBottom: "1rem" }}>
                  <h3 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                    Entries for {selectedDay.dateKey}
                  </h3>
                  <button onClick={() => setSelectedDay(null)} className="btn btn-ghost btn-sm">
                    Clear ✕
                  </button>
                </div>
                
                {!isFriend && currentUser?.uid !== profile.uid ? (
                  <div className="card" style={{ padding: "2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", background: "var(--bg-elevated)", border: "1px dashed var(--border-soft)" }}>
                    <Lock size={28} style={{ color: "var(--text-muted)" }} />
                    <div>
                      <h4 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>Private Entries</h4>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: 240, margin: "0 auto" }}>Only friends can see {profile.displayName}'s detailed tasks and study logs.</p>
                    </div>
                  </div>
                ) : displayEntries.length === 0 ? (
                  <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No entries this day.</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
                    {displayEntries.map((entry, i) => (
                      <EntryCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Weekly Planner */}
          <div className="animate-fade-up stagger-2" style={{ display: "flex", flexDirection: "column" }}>
            {!isFriend && currentUser?.uid !== profile.uid ? (
              <div className="card" style={{ padding: "2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", background: "var(--bg-elevated)", border: "1px dashed var(--border-soft)", flex: 1, minHeight: 300 }}>
                <Lock size={28} style={{ color: "var(--text-muted)" }} />
                <div>
                  <h4 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>Private Weekly Planner</h4>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: 240, margin: "0 auto" }}>Only friends can see {profile.displayName}'s weekly planner.</p>
                </div>
              </div>
            ) : courses.length === 0 ? (
              <div className="card" style={{ padding: "2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 300 }}>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{profile.displayName} hasn't set up a weekly planner yet.</p>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <h3 className="font-display" style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>Weekly Routine</h3>
                <WeeklyCalendar courses={courses} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
