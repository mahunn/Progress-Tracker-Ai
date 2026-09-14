"use client";

import { useState, useRef, useCallback } from "react";
import { Sparkles, Upload, X, Loader2, CheckCircle, Image as ImageIcon } from "lucide-react";
import { ParsedEntry, ProgressEntry } from "@/lib/types";
import { generateId, saveEntry } from "@/lib/store";
import { formatDateShort } from "@/lib/utils";

interface LogInputProps {
  onEntryAdded: (entry: ProgressEntry) => void;
}

type Phase = "idle" | "parsing" | "confirming" | "saving" | "done";

export default function LogInput({ onEntryAdded }: LogInputProps) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [parsed, setParsed] = useState<ParsedEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleImageSelect = useCallback((file: File) => {
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handleImageSelect(file);
    },
    [handleImageSelect]
  );

  const clearImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleParse = async () => {
    if (!text.trim() && !image) return;
    setError(null);
    setPhase("parsing");

    try {
      const formData = new FormData();
      if (text.trim()) formData.append("text", text);
      if (image) formData.append("image", image);

      const res = await fetch("/api/parse-entry", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.success || !data.parsed) {
        // Fallback: create a basic entry from raw text
        const fallback: ParsedEntry = {
          date: new Date().toISOString().split("T")[0],
          subject: "General",
          course: "",
          module: "",
          lesson: "",
          status: "completed",
          notes: text,
          confidence: 0,
        };
        setParsed(fallback);
      } else {
        setParsed(data.parsed);
      }

      setPhase("confirming");
    } catch {
      setError("Failed to parse. Check your API key or connection.");
      setPhase("idle");
    }
  };

  const handleConfirm = () => {
    if (!parsed) return;
    setPhase("saving");

    const entry: ProgressEntry = {
      id: generateId(),
      date: parsed.date,
      raw_text: text,
      subject: parsed.subject || "General",
      course: parsed.course || "",
      module: parsed.module || "",
      lesson: parsed.lesson || "",
      status: parsed.status || "completed",
      notes: parsed.notes || "",
      screenshot_url: imagePreview ?? undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveEntry(entry);
    onEntryAdded(entry);

    // Reset
    setTimeout(() => {
      setText("");
      clearImage();
      setParsed(null);
      setPhase("done");
      setTimeout(() => setPhase("idle"), 2000);
    }, 400);
  };

  const handleEdit = (field: keyof ParsedEntry, value: string) => {
    if (!parsed) return;
    setParsed({ ...parsed, [field]: value });
  };

  if (phase === "done") {
    return (
      <div
        className="card animate-scale-in"
        style={{ padding: "2.5rem", textAlign: "center" }}
      >
        <CheckCircle
          size={48}
          style={{ color: "var(--emerald-400)", margin: "0 auto 1rem" }}
        />
        <p className="font-display" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
          Entry saved! 🎉
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
          Keep going — every day gets you closer.
        </p>
      </div>
    );
  }

  if (phase === "confirming" && parsed) {
    return (
      <div className="card animate-scale-in" style={{ padding: "1.75rem" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: "var(--violet-400)" }} />
            <span
              className="font-display"
              style={{ fontWeight: 600, fontSize: "0.92rem" }}
            >
              AI Parsed — Review &amp; Confirm
            </span>
          </div>
          <span
            className="entry-tag entry-tag--subject"
            style={{ opacity: parsed.confidence >= 70 ? 1 : 0.6 }}
          >
            {parsed.confidence}% confidence
          </span>
        </div>

        {/* Fields */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          {(
            [
              { label: "Date", key: "date" },
              { label: "Subject", key: "subject" },
              { label: "Course", key: "course" },
              { label: "Module", key: "module" },
              { label: "Lesson", key: "lesson" },
            ] as { label: string; key: keyof ParsedEntry }[]
          ).map(({ label, key }) => (
            <div key={key} style={{ gridColumn: key === "lesson" ? "span 2" : "span 1" }}>
              <label
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "block",
                  marginBottom: "0.3rem",
                }}
              >
                {label}
              </label>
              <input
                className="input-field"
                style={{ padding: "0.6rem 0.85rem", fontSize: "0.88rem" }}
                value={String(parsed[key] ?? "")}
                onChange={(e) => handleEdit(key, e.target.value)}
              />
            </div>
          ))}

          <div style={{ gridColumn: "span 2" }}>
            <label
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "block",
                marginBottom: "0.3rem",
              }}
            >
              Notes
            </label>
            <textarea
              className="input-field"
              rows={2}
              style={{ padding: "0.6rem 0.85rem", fontSize: "0.88rem" }}
              value={parsed.notes}
              onChange={(e) => handleEdit("notes", e.target.value)}
            />
          </div>

          {/* Status select */}
          <div style={{ gridColumn: "span 2" }}>
            <label
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "block",
                marginBottom: "0.3rem",
              }}
            >
              Status
            </label>
            <div className="flex gap-2">
              {(["completed", "in_progress", "revisit"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleEdit("status", s)}
                  className="btn btn-sm"
                  style={{
                    background:
                      parsed.status === s
                        ? s === "completed"
                          ? "var(--grad-success)"
                          : s === "in_progress"
                          ? "rgba(251,191,36,0.2)"
                          : "rgba(139,92,246,0.2)"
                        : "var(--bg-elevated)",
                    color:
                      parsed.status === s
                        ? s === "completed"
                          ? "white"
                          : s === "in_progress"
                          ? "var(--amber-400)"
                          : "var(--violet-400)"
                        : "var(--text-secondary)",
                    border: `1px solid ${
                      parsed.status === s ? "transparent" : "var(--border-subtle)"
                    }`,
                    borderRadius: "var(--r-md)",
                  }}
                >
                  {s === "completed" ? "✅ Completed" : s === "in_progress" ? "🔄 In Progress" : "🔁 Revisit"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Screenshot preview */}
        {imagePreview && (
          <div style={{ marginBottom: "1rem" }}>
            <img
              src={imagePreview}
              alt="Screenshot"
              style={{
                width: "100%",
                maxHeight: 180,
                objectFit: "cover",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border-subtle)",
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            id="btn-confirm-entry"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleConfirm}
          >
            <CheckCircle size={16} />
            Save Entry
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { setPhase("idle"); setParsed(null); }}
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card animate-fade-up" style={{ padding: "1.75rem" }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--grad-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={13} color="white" />
        </div>
        <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>
          What did you learn today?
        </h3>
        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: "auto" }}>
          {formatDateShort(new Date())}
        </span>
      </div>

      {/* Textarea */}
      <textarea
        ref={textRef}
        id="log-input-textarea"
        className="input-field"
        rows={4}
        placeholder={`Type naturally, e.g.\n"completed linear equations module 1 for AI/ML"\n"today i finished 1-7 connecting concepts to ML, phitron math for ML"`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleParse();
        }}
        style={{ marginBottom: "0.75rem", lineHeight: 1.6 }}
      />

      {/* Image Upload */}
      {!imagePreview ? (
        <div
          className={`upload-zone ${isDragging ? "drag-over" : ""}`}
          style={{ marginBottom: "1rem" }}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageSelect(file);
            }}
          />
          <Upload size={20} style={{ color: "var(--text-muted)", margin: "0 auto 0.5rem" }} />
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Drop a screenshot or <span style={{ color: "var(--violet-400)" }}>browse</span>
          </p>
          <p style={{ fontSize: "0.72rem", color: "var(--text-ghost)", marginTop: "0.2rem" }}>
            AI will read it to fill in course details
          </p>
        </div>
      ) : (
        <div style={{ position: "relative", marginBottom: "1rem" }}>
          <img
            src={imagePreview}
            alt="Attached screenshot"
            style={{
              width: "100%",
              maxHeight: 160,
              objectFit: "cover",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border-soft)",
            }}
          />
          <button
            onClick={clearImage}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "rgba(0,0,0,0.7)",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "white",
            }}
          >
            <X size={14} />
          </button>
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              background: "rgba(0,0,0,0.7)",
              borderRadius: "var(--r-sm)",
              padding: "0.2rem 0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.72rem",
              color: "var(--emerald-400)",
            }}
          >
            <ImageIcon size={11} />
            Screenshot attached
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p
          style={{
            color: "var(--rose-400)",
            fontSize: "0.82rem",
            marginBottom: "0.75rem",
            padding: "0.6rem 1rem",
            background: "rgba(239,68,68,0.08)",
            borderRadius: "var(--r-md)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        id="btn-log-progress"
        className="btn btn-primary"
        style={{ width: "100%", padding: "0.85rem" }}
        onClick={handleParse}
        disabled={phase === "parsing" || (!text.trim() && !image)}
      >
        {phase === "parsing" ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            AI is parsing your entry...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Log Progress
            <span style={{ marginLeft: "auto", fontSize: "0.75rem", opacity: 0.6 }}>
              ⌘↵
            </span>
          </>
        )}
      </button>
    </div>
  );
}
