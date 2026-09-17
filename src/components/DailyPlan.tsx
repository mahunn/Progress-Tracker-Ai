"use client";

import { useState } from "react";
import { Loader2, Plus, ListTodo } from "lucide-react";
import { ParsedEntry, ProgressEntry } from "@/lib/types";
import { generateId } from "@/lib/store";

interface DailyPlanProps {
  onEntriesAdded: (entries: ProgressEntry[]) => void | Promise<void>;
}

export default function DailyPlan({ onEntriesAdded }: DailyPlanProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlan = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/parse-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          clientDate: new Date().toISOString().split("T")[0],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to parse plan");
      }

      const parsedArray: ParsedEntry[] = data.parsed;
      const progressEntries: ProgressEntry[] = parsedArray.map((p) => ({
        id: generateId(),
        date: p.date,
        raw_text: p.notes,
        subject: p.subject,
        course: p.course,
        module: p.module,
        lesson: p.lesson,
        status: p.status,
        notes: p.notes,
        estimated_time: p.estimated_time,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      await onEntriesAdded(progressEntries);
      setText("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card animate-fade-up" style={{ padding: "1.25rem", marginTop: "1.25rem" }}>
      <div className="flex items-center gap-2 mb-3">
        <ListTodo size={16} style={{ color: "var(--brand-primary)" }} />
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Today's Plan</h3>
      </div>

      <textarea
        className="input-field subtle-placeholder"
        rows={3}
        placeholder="e.g. Learn Python for 1 hr..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            handlePlan();
          }
        }}
        style={{ marginBottom: "0.75rem", fontSize: "0.85rem", padding: "0.75rem" }}
      />

      {error && (
        <p style={{ color: "var(--rose-400)", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
          {error}
        </p>
      )}

      <button
        className="btn btn-primary"
        style={{ width: "100%", padding: "0.65rem", fontSize: "0.85rem" }}
        onClick={handlePlan}
        disabled={loading || !text.trim()}
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Generating Tasks...
          </>
        ) : (
          <>
            <Plus size={14} />
            Create Plan
          </>
        )}
      </button>
    </div>
  );
}
