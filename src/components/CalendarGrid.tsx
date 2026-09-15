"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarDay, DayStatus, ProgressEntry } from "@/lib/types";
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  isToday,
  isFuture,
  toDateKey,
} from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface CalendarGridProps {
  entryMap: Record<string, ProgressEntry[]>;
  onDayClick?: (day: CalendarDay) => void;
  selectedDateKey?: string | null;
}

function getDayStatus(
  entries: ProgressEntry[],
  isToday_: boolean,
  isFuture_: boolean
): DayStatus {
  if (isFuture_ && entries.length === 0) return "future";
  if (entries.length === 0) return isToday_ ? "today" : "empty";

  const allDone = entries.every((e) => e.status === "completed");
  if (allDone) return "completed";
  return "partial";
}

const STATUS_STYLES: Record<DayStatus, React.CSSProperties> = {
  completed: { background: "linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(5,150,105,0.06) 100%)", color: "var(--emerald-400)", borderColor: "rgba(16,185,129,0.3)" },
  partial:   { background: "linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(217,119,6,0.06) 100%)", color: "var(--amber-400)", borderColor: "rgba(245,158,11,0.3)" },
  missed:    { background: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(225,29,72,0.05) 100%)", color: "var(--rose-400)", borderColor: "rgba(239,68,68,0.25)" },
  today:     { background: "rgba(124,58,237,0.08)", color: "var(--violet-400)", borderColor: "var(--violet-500)" },
  empty:     { background: "var(--bg-elevated)", color: "var(--text-ghost)", borderColor: "transparent" },
  future:    { background: "rgba(15,23,42,0.02)", color: "var(--text-ghost)", borderColor: "transparent", cursor: "default" },
};

export default function CalendarGrid({
  entryMap,
  onDayClick,
  selectedDateKey,
}: CalendarGridProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const days = useMemo<CalendarDay[]>(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const result: CalendarDay[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dateKey = toDateKey(date);
      const entries = entryMap[dateKey] ?? [];
      const today_ = isToday(date);
      const future_ = isFuture(date) && !today_;

      // Compute missed: past day (not today) with no entries
      let status: DayStatus = getDayStatus(entries, today_, future_);
      if (!future_ && !today_ && entries.length === 0) {
        // Check if it's a past day — mark as missed
        const dayDate = new Date(viewYear, viewMonth, d);
        dayDate.setHours(0, 0, 0, 0);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (dayDate < todayStart) status = "missed";
      }

      result.push({ date, dateKey, status, entryCount: entries.length, entries, isToday: today_, isFuture: future_ });
    }
    return result;
  }, [viewYear, viewMonth, entryMap]);

  const firstDayOffset = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const completedCount = days.filter((d) => d.status === "completed").length;
  const missedCount    = days.filter((d) => d.status === "missed").length;
  const totalLogged    = days.filter((d) => d.entryCount > 0).length;

  return (
    <div>
      {/* Month Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={prevMonth}
          className="btn btn-ghost btn-sm"
          style={{ padding: "0.4rem", borderRadius: "var(--r-md)" }}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>

        <div style={{ flex: 1, textAlign: "center" }}>
          <h2 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
            {totalLogged} days logged · {completedCount} completed · {missedCount} missed
          </p>
        </div>

        <button
          onClick={nextMonth}
          className="btn btn-ghost btn-sm"
          style={{ padding: "0.4rem", borderRadius: "var(--r-md)" }}
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Today button */}
      {(viewYear !== today.getFullYear() || viewMonth !== today.getMonth()) && (
        <button
          onClick={goToday}
          className="btn btn-ghost btn-sm"
          style={{ display: "block", margin: "0 auto 1rem", fontSize: "0.78rem" }}
        >
          Back to Today
        </button>
      )}

      {/* Weekday Headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          marginBottom: "4px",
        }}
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: "0.68rem",
              fontWeight: 700,
              color: "var(--text-ghost)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "0.4rem 0",
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
        }}
      >
        {/* Empty cells before month starts */}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const isSelected = selectedDateKey === day.dateKey;
          const styles = STATUS_STYLES[day.status];

          return (
            <button
              key={day.dateKey}
              id={`cal-day-${day.dateKey}`}
              className="cal-day"
              onClick={() => !day.isFuture && onDayClick?.(day)}
              aria-label={`${day.dateKey}: ${day.status}, ${day.entryCount} entries`}
              style={{
                ...styles,
                borderWidth: day.isToday ? 2 : 1,
                borderStyle: "solid",
                borderColor: day.isToday
                  ? "var(--violet-500)"
                  : (styles.borderColor ?? "transparent"),
                outline: isSelected ? `2px solid var(--violet-500)` : "none",
                outlineOffset: 2,
                boxShadow: day.isToday
                  ? "0 0 16px rgba(139,92,246,0.35)"
                  : day.status === "completed"
                  ? "0 0 12px rgba(16,185,129,0.2)"
                  : "none",
              }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                {day.date.getDate()}
              </span>
              {/* Entry count dots */}
              {day.entryCount > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {Array.from({ length: Math.min(day.entryCount, 3) }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: "currentColor",
                        opacity: 0.8,
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className="flex gap-4 flex-wrap justify-center"
        style={{ marginTop: "1.25rem", fontSize: "0.72rem", color: "var(--text-muted)" }}
      >
        {[
          { color: "var(--emerald-400)", label: "Completed" },
          { color: "var(--amber-400)",   label: "Partial" },
          { color: "var(--rose-400)",    label: "Missed" },
          { color: "var(--violet-400)",  label: "Today" },
          { color: "var(--text-ghost)",  label: "No entry" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "3px",
                background: color,
                opacity: 0.85,
              }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
