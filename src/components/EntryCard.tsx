"use client";

import { EntryStatus, ProgressEntry } from "@/lib/types";
import { formatDateShort, truncate } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  RefreshCw,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  Trash2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface EntryCardProps {
  entry: ProgressEntry;
  compact?: boolean;
  onStatusChange?: (id: string, newStatus: EntryStatus) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
}

const STATUS_CONFIG: Record<
  EntryStatus,
  {
    icon: typeof CheckCircle2;
    color: string;
    bg: string;
    border: string;
    label: string;
  }
> = {
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

const ALL_STATUSES: EntryStatus[] = ["completed", "in_progress", "revisit"];

export default function EntryCard({
  entry,
  compact = false,
  onStatusChange,
  onDelete,
}: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const cfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.completed;
  const StatusIcon = cfg.icon;

  // Close dropdown on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleStatusSelect = async (newStatus: EntryStatus) => {
    if (newStatus === entry.status || !onStatusChange || updating) {
      setMenuOpen(false);
      return;
    }
    setUpdating(true);
    setMenuOpen(false);
    try {
      await onStatusChange(entry.id, newStatus);
    } finally {
      setUpdating(false);
    }
  };

  const handleQuickComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onStatusChange || updating) return;
    setUpdating(true);
    try {
      await onStatusChange(entry.id, "completed");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete || deleting) return;
    if (window.confirm("Are you sure you want to delete this study log?")) {
      setDeleting(true);
      try {
        await onDelete(entry.id);
      } finally {
        setDeleting(false);
      }
    }
  };

  return (
    <article className="entry-card animate-fade-up">
      {/* Top row: subject tag + status + quick complete action + date */}
      <div className="flex items-center gap-2 mb-3" style={{ flexWrap: "wrap" }}>
        {entry.subject && (
          <span className="entry-tag entry-tag--subject">{entry.subject}</span>
        )}

        {/* Status Badge (clickable if onStatusChange provided) */}
        <div style={{ position: "relative" }} ref={menuRef}>
          {onStatusChange ? (
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="entry-status-badge-btn"
              style={{
                background: cfg.bg,
                color: cfg.color,
                border: `1px solid ${cfg.border}`,
              }}
              title="Click to change status"
            >
              {updating ? (
                <Loader2 size={10} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <StatusIcon size={10} />
              )}
              {cfg.label}
              <ChevronDown size={10} style={{ opacity: 0.7, marginLeft: 1 }} />
            </button>
          ) : (
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
          )}

          {/* Status Dropdown Menu */}
          {menuOpen && onStatusChange && (
            <div className="entry-status-dropdown animate-fade-up">
              <div
                style={{
                  fontSize: "0.68rem",
                  color: "var(--text-muted)",
                  padding: "0.25rem 0.5rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Set Status
              </div>
              {ALL_STATUSES.map((statusKey) => {
                const sCfg = STATUS_CONFIG[statusKey];
                const ItemIcon = sCfg.icon;
                const isActive = entry.status === statusKey;
                return (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => handleStatusSelect(statusKey)}
                    className={`entry-status-option ${isActive ? "entry-status-option--active" : ""}`}
                  >
                    <ItemIcon size={13} style={{ color: sCfg.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{sCfg.label}</span>
                    {isActive && <Check size={12} style={{ color: sCfg.color }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* High-visibility One-click "Mark done" button if not completed */}
        {entry.status !== "completed" && onStatusChange && (
          <button
            type="button"
            onClick={handleQuickComplete}
            disabled={updating}
            className="quick-complete-btn"
            title="Mark as completed"
          >
            {updating ? (
              <Loader2 size={11} style={{ animation: "spin 0.8s linear infinite" }} />
            ) : (
              <Check size={11} strokeWidth={2.5} />
            )}
            <span>Mark done</span>
          </button>
        )}

        {/* Date & optional actions */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            {formatDateShort(new Date(entry.date + "T00:00:00"))}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-ghost)",
                padding: "0.2rem",
                borderRadius: "var(--r-sm)",
                display: "flex",
                alignItems: "center",
                transition: "color 150ms",
              }}
              title="Delete entry"
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--rose-400)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-ghost)")}
            >
              {deleting ? (
                <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <Trash2 size={12} />
              )}
            </button>
          )}
        </div>
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
