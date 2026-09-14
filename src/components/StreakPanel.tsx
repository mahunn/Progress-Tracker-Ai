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
}

function StatItem({ icon, value, label, color = "var(--violet-400)", glow, delay = "0ms" }: StatItemProps) {
  return (
    <div
      className="card animate-fade-up"
      style={{
        padding: "1.25rem",
        textAlign: "center",
        animationDelay: delay,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle glow background */}
      {glow && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: glow,
            opacity: 0.05,
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "0.6rem",
          color,
        }}
      >
        {icon}
      </div>

      <div
        className="font-display"
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color,
          lineHeight: 1,
          marginBottom: "0.3rem",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.72rem",
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
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
            padding: "1.75rem",
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
              marginBottom: "0.5rem",
            }}
          >
            🔥
          </div>
          <div
            className="font-display text-ember"
            style={{ fontSize: "3rem", fontWeight: 900, lineHeight: 1 }}
          >
            {streak.current}
          </div>
          <div
            style={{
              fontSize: "0.82rem",
              color: "var(--amber-400)",
              fontWeight: 600,
              marginTop: "0.25rem",
            }}
          >
            {streak.current === 1 ? "Day Streak" : "Day Streak"} 🎯
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginTop: "0.5rem",
            }}
          >
            {streak.current >= 7
              ? "You're on fire! Keep it up 💪"
              : streak.current >= 3
              ? "Building momentum!"
              : "Great start — keep going!"}
          </div>
        </div>
      )}

      {/* Stat Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "0.6rem",
        }}
      >
        <StatItem
          icon={<Trophy size={20} />}
          value={streak.longest}
          label="Best Streak"
          color="var(--amber-400)"
          glow="linear-gradient(135deg, #f59e0b, #ef4444)"
          delay="60ms"
        />
        <StatItem
          icon={<Calendar size={20} />}
          value={streak.totalDaysLogged}
          label="Days Logged"
          color="var(--sky-400)"
          glow="linear-gradient(135deg, #0ea5e9, #6366f1)"
          delay="120ms"
        />
        <StatItem
          icon={<TrendingUp size={20} />}
          value={streak.thisWeek}
          label="This Week"
          color="var(--emerald-400)"
          glow="linear-gradient(135deg, #10b981, #34d399)"
          delay="180ms"
        />
        <StatItem
          icon={<Target size={20} />}
          value={streak.thisMonth}
          label="This Month"
          color="var(--violet-400)"
          glow="linear-gradient(135deg, #8b5cf6, #c084fc)"
          delay="240ms"
        />
      </div>
    </div>
  );
}
