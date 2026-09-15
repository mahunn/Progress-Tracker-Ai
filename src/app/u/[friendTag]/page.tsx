"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { searchUserByUsername } from "@/lib/firebase";
import { getPublicEntriesByUid, buildEntryMap, computeStreakData } from "@/lib/firestore";
import CalendarGrid from "@/components/CalendarGrid";
import EntryCard from "@/components/EntryCard";
import { ProgressEntry, CalendarDay } from "@/lib/types";
import { Flame, BookOpen, Loader2, ArrowLeft } from "lucide-react";

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
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
      setEntryMap(buildEntryMap(userEntries));
      setLoading(false);
    })();
  }, [cleanTag]);

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

        {/* Grid: calendar + entries */}
        <div className="friend-profile-grid">
          <div className="card animate-fade-up stagger-1" style={{ padding: "1.5rem" }}>
            <CalendarGrid entryMap={entryMap} onDayClick={setSelectedDay} selectedDateKey={selectedDay?.dateKey ?? null} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="flex items-center justify-between animate-fade-up stagger-2" style={{ marginBottom: "0.25rem" }}>
              <h3 className="font-display" style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                {selectedDay ? selectedDay.dateKey : "Recent Entries"}
              </h3>
              {selectedDay && (
                <button onClick={() => setSelectedDay(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  Clear ✕
                </button>
              )}
            </div>
            {displayEntries.length === 0 ? (
              <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No entries {selectedDay ? "this day" : "yet"}</p>
              </div>
            ) : (
              displayEntries.map((entry, i) => (
                <div key={entry.id} className={`stagger-${Math.min(i + 1, 5)}`}>
                  <EntryCard entry={entry} />
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
