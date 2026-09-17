"use client";

import { StreakData } from "@/lib/types";
import { Flame, Trophy, Calendar, TrendingUp, Target } from "lucide-react";

interface StreakPanelProps {
  streak: StreakData;
}

interface StatItemProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color?: string;
  glow?: string;
  delay?: string;
  isLast?: boolean;
}

function StatItem({ icon, value, label, color = "var(--violet-400)", delay = "0ms", isLast }: StatItemProps) {
  return (
    <div
      className="flex items-center justify-between animate-fade-up"
      style={{
        padding: "0.85rem 0",
        animationDelay: delay,
        borderBottom: isLast ? "none" : "1px solid var(--border-soft)",
      }}
    >
      <div className="flex items-center gap-3">
        <div style={{ color, display: "flex", alignItems: "center" }}>{icon}</div>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>
          {label}
        </div>
      </div>
      <div className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

export default function StreakPanel({ streak }: StreakPanelProps) {
  const flameSize = Math.min(28 + streak.current * 2, 48);

  return (
    <div>
      {/* Hero Streak */}
      {streak.current > 0 && (
        <div
          className="card animate-scale-in glow-pulse"
          style={{
            padding: "1.5rem",
            marginBottom: "1rem",
            background:
              "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(239,68,68,0.08) 100%)",
            border: "1px solid rgba(245,158,11,0.25)",
            textAlign: "center",
          }}
        >
          <div
            className="streak-flame"
            style={{
              fontSize: flameSize,
              lineHeight: 1,
              marginBottom: "0.25rem",
            }}
          >
            🔥
          </div>
          <div
            className="font-display text-ember"
            style={{ fontSize: "2.5rem", fontWeight: 900, lineHeight: 1 }}
          >
            {streak.current}
          </div>
          <div
            style={{
              fontSize: "0.85rem",
              color: "var(--amber-400)",
              fontWeight: 600,
              marginTop: "0.25rem",
            }}
          >
            {streak.current === 1 ? "Day Streak" : "Day Streak"} 🎯
          </div>
        </div>
      )}
    </div>
  );
}
