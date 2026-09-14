"use client";

import { ProgressEntry } from "@/lib/types";
import { formatDateShort, truncate } from "@/lib/utils";
import { BookOpen, CheckCircle2, Clock, RefreshCw, Image as ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface EntryCardProps {
  entry: ProgressEntry;
  compact?: boolean;
}

const STATUS_CONFIG = {
  completed: {
    icon: CheckCircle2,
    color: "var(--emerald-400)",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.25)",
    label: "Completed",
  },
  in_progress: {
    icon: Clock,
    color: "var(--amber-400)",
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.25)",
    label: "In Progress",
  },
  revisit: {
    icon: RefreshCw,
    color: "var(--violet-400)",
    bg: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.25)",
    label: "Revisit",
  },
};

export default function EntryCard({ entry, compact = false }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.completed;
  const StatusIcon = cfg.icon;

  return (
    <article className="entry-card animate-fade-up">
      {/* Top row: subject tag + status + date */}
      <div className="flex items-center gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        {entry.subject && (
          <span className="entry-tag entry-tag--subject">{entry.subject}</span>
        )}
        <span
          className="entry-tag"
          style={{
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.border}`,
          }}
        >
          <StatusIcon size={10} />
          {cfg.label}
        </span>
        <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--text-muted)" }}>
          {formatDateShort(new Date(entry.date + "T00:00:00"))}
        </span>
      </div>

      {/* Course / Module / Lesson hierarchy */}
      <div style={{ marginBottom: entry.notes || entry.screenshot_url ? "0.75rem" : 0 }}>
        {entry.course && (
          <p
            className="font-display"
            style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.2rem" }}
          >
            {entry.course}
          </p>
        )}
        {entry.module && (
          <div className="flex items-center gap-1.5">
            <BookOpen size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {entry.module}
              {entry.lesson && (
                <span style={{ color: "var(--text-muted)" }}>
                  {" "}→ {entry.lesson}
                </span>
              )}
            </p>
          </div>
        )}
        {!entry.course && !entry.module && (
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            {truncate(entry.raw_text, 120)}
          </p>
        )}
      </div>

      {/* Expandable section */}
      {(entry.notes || entry.screenshot_url) && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              padding: "0.25rem 0",
              transition: "color 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? "Less" : "More details"}
            {entry.screenshot_url && (
              <span className="flex items-center gap-1 ml-1">
                <ImageIcon size={11} />
                screenshot
              </span>
            )}
          </button>

          {expanded && (
            <div className="animate-fade-up" style={{ marginTop: "0.75rem" }}>
              {entry.notes && (
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.65,
                    padding: "0.75rem",
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--r-md)",
                    marginBottom: entry.screenshot_url ? "0.75rem" : 0,
                  }}
                >
                  {entry.notes}
                </p>
              )}
              {entry.screenshot_url && (
                <img
                  src={entry.screenshot_url}
                  alt="Attached screenshot"
                  style={{
                    width: "100%",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--border-subtle)",
                    maxHeight: 300,
                    objectFit: "cover",
                  }}
                />
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}
