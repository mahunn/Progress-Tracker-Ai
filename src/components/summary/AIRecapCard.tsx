"use client";

import { useState } from "react";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { ProgressEntry } from "@/lib/types";

interface AIRecapCardProps {
  entries: ProgressEntry[];
  timeframe: string;
}

export default function AIRecapCard({ entries, timeframe }: AIRecapCardProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    if (entries.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, timeframe }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate summary");
      }
      
      setSummary(data.summary);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Simple Markdown to HTML parser for basic formatting (bold, italics, bullets)
  const renderMarkdown = (text: string) => {
    const html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 style="font-size: 1.1rem; font-weight: 700; margin-top: 1rem; color: var(--text-primary);">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="font-size: 1.25rem; font-weight: 700; margin-top: 1.25rem; color: var(--text-primary);">$1</h2>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary);">$1</strong>')
      // Italics
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Unordered Lists
      .replace(/^\s*-\s+(.*)/gim, '<li style="margin-left: 1.5rem; list-style-type: disc;">$1</li>')
      // Ordered Lists
      .replace(/^\s*\d+\.\s+(.*)/gim, '<li style="margin-left: 1.5rem; list-style-type: decimal;">$1</li>')
      // Newlines to br (only if not inside a list, but this is a simple approximation)
      .replace(/\n(?!(<\/li>|<h))/g, '<br/>');

    // Clean up excessive breaks after block elements
    const cleanHtml = html.replace(/<br\/><li/g, '<li').replace(/<\/li><br\/>/g, '</li>').replace(/<br\/><h/g, '<h');

    return { __html: cleanHtml };
  };

  return (
    <div className="card" style={{ padding: "1.5rem", position: "relative", overflow: "hidden" }}>
      {/* Glow Effect Background */}
      <div 
        style={{ 
          position: "absolute", 
          top: "-50px", 
          right: "-50px", 
          width: "150px", 
          height: "150px", 
          background: "var(--grad-brand)", 
          filter: "blur(60px)", 
          opacity: 0.2,
          borderRadius: "50%",
          pointerEvents: "none"
        }} 
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", position: "relative", zIndex: 1 }}>
        <div>
          <h2 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Sparkles size={18} style={{ color: "var(--violet-400)" }} />
            AI Progress Recap
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Get a personalized review of your recent study sessions.
          </p>
        </div>
        
        {summary && !loading && (
          <button 
            onClick={generateSummary}
            className="btn btn-ghost btn-sm"
            style={{ padding: "0.4rem" }}
            title="Regenerate"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem 0", gap: "1rem" }}>
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--violet-400)" }} />
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", animation: "pulse 2s infinite" }}>
              Analyzing your learning patterns...
            </p>
          </div>
        ) : error ? (
          <div style={{ padding: "1rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "var(--r-sm)", border: "1px solid var(--rose-400)" }}>
            <p style={{ color: "var(--rose-400)", fontSize: "0.85rem", fontWeight: 500 }}>{error}</p>
            <button onClick={generateSummary} className="btn btn-outline btn-sm" style={{ marginTop: "0.75rem", borderColor: "var(--rose-400)", color: "var(--rose-400)" }}>
              Try Again
            </button>
          </div>
        ) : summary ? (
          <div 
            className="ai-content animate-fade-in"
            style={{ 
              fontSize: "0.95rem", 
              lineHeight: 1.6, 
              color: "var(--text-secondary)",
              padding: "1rem",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border-subtle)"
            }}
            dangerouslySetInnerHTML={renderMarkdown(summary)}
          />
        ) : (
          <div style={{ display: "flex", justifyContent: "center", padding: "1.5rem 0" }}>
            <button 
              onClick={generateSummary}
              className="btn btn-primary"
              disabled={entries.length === 0}
              style={{ padding: "0.6rem 1.5rem", borderRadius: "var(--r-pill)" }}
            >
              <Sparkles size={16} />
              {entries.length === 0 ? "No entries to summarize" : "Generate AI Recap"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
