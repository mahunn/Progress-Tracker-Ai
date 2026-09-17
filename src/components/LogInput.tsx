"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, Upload, X, Loader2, CheckCircle, Image as ImageIcon, FolderOpen, ClipboardPaste } from "lucide-react";
import { ParsedEntry, ProgressEntry } from "@/lib/types";
import { generateId, saveEntry } from "@/lib/store";
import { formatDateShort, compressImage, toDateKey } from "@/lib/utils";

interface LogInputProps {
  onEntryAdded: (entry: ProgressEntry) => void | Promise<void>;
}

type Phase = "idle" | "parsing" | "confirming" | "saving" | "done";

export default function LogInput({ onEntryAdded }: LogInputProps) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [parsed, setParsed] = useState<ParsedEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleImageSelect = useCallback(async (file: File) => {
    setImage(file);
    try {
      // Compress image client-side to prevent localStorage/Firestore quota limits (~40-80KB vs 5-10MB)
      const compressedDataUrl = await compressImage(file, 1024, 0.75);
      setImagePreview(compressedDataUrl);
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageSelect(file);
            break;
          }
        }
      }
    },
    [handleImageSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handleImageSelect(file);
    },
    [handleImageSelect]
  );

  const handlePasteClipboardClick = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setClipboardError(null);
    try {
      if (!navigator.clipboard?.read) {
        setClipboardError("Press Ctrl+V to paste your image directly.");
        setTimeout(() => setClipboardError(null), 4000);
        return;
      }
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `screenshot_${Date.now()}.png`, { type: imageType });
          await handleImageSelect(file);
          found = true;
          break;
        }
      }
      if (!found) {
        setClipboardError("No image found in clipboard. Copy or snip an image first, then paste.");
        setTimeout(() => setClipboardError(null), 4000);
      }
    } catch (err) {
      console.warn("Clipboard access warning:", err);
      setClipboardError("Clipboard permission required, or just press Ctrl+V to paste.");
      setTimeout(() => setClipboardError(null), 4000);
    }
  };

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (phase !== "idle") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleImageSelect(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [phase, handleImageSelect]);

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
      if (imagePreview) {
        // Send the compressed lightweight blob (~40KB) for instant upload & fast AI processing
        const blob = await fetch(imagePreview).then((r) => r.blob());
        formData.append("image", blob, "screenshot.jpg");
      } else if (image) {
        formData.append("image", image);
      }
      formData.append("clientDate", toDateKey(new Date()));

      const res = await fetch("/api/parse-entry", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.success || !data.parsed) {
        // Fallback: create a basic entry from raw text
        const fallback: ParsedEntry = {
          date: toDateKey(new Date()),
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

  const handleConfirm = async () => {
    if (!parsed) return;
    setPhase("saving");
    setError(null);

    try {
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
      await onEntryAdded(entry);

      // Reset
      setTimeout(() => {
        setText("");
        clearImage();
        setParsed(null);
        setPhase("done");
        setTimeout(() => setPhase("idle"), 2000);
      }, 400);
    } catch (err: unknown) {
      console.error("Failed to save entry:", err);
      const message = err instanceof Error ? err.message : "Failed to save entry. Please try again.";
      setError(message);
      setPhase("confirming");
    }
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

  if ((phase === "confirming" || phase === "saving") && parsed) {
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
                style={{
                  padding: "0.6rem 0.85rem",
                  fontSize: "0.88rem",
                  ...(key === "date" ? { background: "var(--bg-base)", cursor: "not-allowed", opacity: 0.8 } : {})
                }}
                value={String(parsed[key] ?? "")}
                onChange={(e) => key !== "date" && handleEdit(key, e.target.value)}
                readOnly={key === "date"}
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

        {/* Error message */}
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

        {/* Actions */}
        <div className="flex gap-3">
          <button
            id="btn-confirm-entry"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleConfirm}
            disabled={phase === "saving"}
          >
            {phase === "saving" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Save Entry
              </>
            )}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { setPhase("idle"); setParsed(null); setError(null); }}
            disabled={phase === "saving"}
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
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleParse();
        }}
        style={{ marginBottom: "0.75rem", lineHeight: 1.6 }}
      />

      {/* Image Upload Box */}
      {!imagePreview ? (
        <div
          className={`upload-zone ${isDragging ? "drag-over" : ""}`}
          style={{
            marginBottom: "1rem",
            padding: "1.5rem 1rem",
            outline: "none",
            cursor: "pointer",
            position: "relative",
          }}
          tabIndex={0}
          role="button"
          aria-label="Upload, drag & drop, or paste screenshot"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onPaste={handlePaste}
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
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: isDragging ? "rgba(124,58,237,0.2)" : "rgba(124,58,237,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 0.6rem",
              color: "var(--violet-400)",
              transition: "transform 0.2s ease",
              transform: isDragging ? "scale(1.15)" : "scale(1)",
            }}
          >
            <Upload size={20} />
          </div>

          <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.2rem" }}>
            {isDragging ? "Drop your screenshot here!" : "Drag & drop, paste, or upload screenshot"}
          </p>
          <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: "0.85rem" }}>
            AI extracts lesson, module &amp; topics from lecture slides, code, or whiteboards
          </p>

          {/* Action options */}
          <div
            className="flex items-center justify-center gap-2 flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => fileRef.current?.click()}
              style={{
                fontSize: "0.78rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border-soft)",
                background: "var(--bg-elevated)",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                color: "var(--text-primary)",
              }}
            >
              <FolderOpen size={14} style={{ color: "var(--violet-400)" }} />
              Upload file
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={handlePasteClipboardClick}
              style={{
                fontSize: "0.78rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border-soft)",
                background: "var(--bg-elevated)",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                color: "var(--text-primary)",
              }}
            >
              <ClipboardPaste size={14} style={{ color: "var(--emerald-400)" }} />
              Paste image
            </button>

            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--text-ghost)",
                padding: "0.35rem 0.55rem",
                borderRadius: "var(--r-sm)",
                background: "rgba(255,255,255,0.03)",
                border: "1px dashed var(--border-subtle)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <kbd style={{ fontFamily: "inherit", fontWeight: 700, color: "var(--violet-300)" }}>Ctrl</kbd> + <kbd style={{ fontFamily: "inherit", fontWeight: 700, color: "var(--violet-300)" }}>V</kbd>
            </span>
          </div>

          {clipboardError && (
            <p
              style={{
                fontSize: "0.76rem",
                color: "var(--amber-400)",
                marginTop: "0.65rem",
              }}
            >
              {clipboardError}
            </p>
          )}
        </div>
      ) : (
        <div
          style={{ position: "relative", marginBottom: "1rem" }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onPaste={handlePaste}
        >
          <img
            src={imagePreview}
            alt="Attached screenshot"
            style={{
              width: "100%",
              maxHeight: 180,
              objectFit: "cover",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border-soft)",
              display: "block",
            }}
          />
          <button
            onClick={clearImage}
            title="Remove screenshot"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "rgba(0,0,0,0.75)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "white",
              transition: "background 0.2s",
            }}
          >
            <X size={14} />
          </button>
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              right: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                background: "rgba(0,0,0,0.75)",
                backdropFilter: "blur(4px)",
                borderRadius: "var(--r-sm)",
                padding: "0.25rem 0.55rem",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.74rem",
                color: "var(--emerald-400)",
                fontWeight: 600,
                border: "1px solid rgba(16,185,129,0.3)",
              }}
            >
              <ImageIcon size={12} />
              Screenshot attached
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  background: "rgba(0,0,0,0.75)",
                  backdropFilter: "blur(4px)",
                  borderRadius: "var(--r-sm)",
                  padding: "0.25rem 0.55rem",
                  fontSize: "0.72rem",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                }}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handlePasteClipboardClick}
                style={{
                  background: "rgba(0,0,0,0.75)",
                  backdropFilter: "blur(4px)",
                  borderRadius: "var(--r-sm)",
                  padding: "0.25rem 0.55rem",
                  fontSize: "0.72rem",
                  color: "var(--violet-300)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  cursor: "pointer",
                }}
              >
                Paste new (Ctrl+V)
              </button>
            </div>
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
