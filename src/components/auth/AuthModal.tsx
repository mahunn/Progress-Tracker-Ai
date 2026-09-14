"use client";

import { useState } from "react";
import { Loader2, Chrome, Sparkles, X } from "lucide-react";
import { loginWithGoogle } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface AuthModalProps {
  onClose?: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (user) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(7, 7, 15, 0.85)",
        backdropFilter: "blur(12px)",
        padding: "1rem",
      }}
    >
      <div
        className="card animate-scale-in"
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "2.5rem 2rem",
          textAlign: "center",
          position: "relative",
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              padding: "0.25rem",
              borderRadius: "var(--r-sm)",
              transition: "color 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <X size={16} />
          </button>
        )}

        {/* Logo mark */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "var(--grad-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
            boxShadow: "var(--glow-brand)",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 18L9 9L13 13L18 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="18" cy="5" r="2" fill="white" />
          </svg>
        </div>

        <h2
          className="font-display"
          style={{ fontWeight: 800, marginBottom: "0.5rem" }}
        >
          Welcome to{" "}
          <span className="text-gradient">Pathly</span>
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "2rem", lineHeight: 1.55 }}>
          Log what you learn, track your streak,<br />
          and grow alongside your friends.
        </p>

        {/* Google Sign In */}
        <button
          id="btn-google-signin"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="btn"
          style={{
            width: "100%",
            padding: "0.9rem 1.5rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-soft)",
            color: "var(--text-primary)",
            borderRadius: "var(--r-lg)",
            fontSize: "0.95rem",
            fontWeight: 600,
            gap: "0.75rem",
            transition: "all 220ms var(--ease-smooth)",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-soft)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
          }}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
          )}
          {loading ? "Signing in..." : "Continue with Google"}
        </button>

        {error && (
          <p
            style={{
              marginTop: "1rem",
              padding: "0.65rem 1rem",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "var(--r-md)",
              color: "var(--rose-400)",
              fontSize: "0.82rem",
            }}
          >
            {error}
          </p>
        )}

        <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "var(--text-ghost)" }}>
          Free forever · No spam · Your data stays yours
        </p>
      </div>
    </div>
  );
}
