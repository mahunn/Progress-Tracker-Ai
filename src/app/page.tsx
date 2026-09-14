"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "@/components/auth/AuthModal";
import { Sparkles, Calendar, Users, TrendingUp, Flame, BookOpen } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "3px solid var(--border-subtle)",
            borderTopColor: "var(--violet-500)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", overflow: "hidden" }}>
      {/* ── Background orbs ── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 800,
            height: 500,
            background: "radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            right: "-10%",
            width: 600,
            height: 400,
            background: "radial-gradient(ellipse, rgba(245,158,11,0.1) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ── Nav ── */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 2rem",
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Pathly"
              style={{
                width: 38,
                height: 38,
                objectFit: "contain",
                filter: "drop-shadow(0 2px 8px rgba(139, 21, 27, 0.2))",
              }}
            />
            <span className="font-display text-gradient" style={{ fontWeight: 800, fontSize: "1.15rem" }}>
              Pathly
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <ThemeToggle />
            <button
              id="btn-landing-signin"
              onClick={() => setShowAuth(true)}
              className="btn btn-primary btn-sm"
            >
              Sign in
            </button>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section
          style={{
            maxWidth: 700,
            margin: "5rem auto 0",
            padding: "0 2rem",
            textAlign: "center",
          }}
        >
          <div
            className="animate-fade-up"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(139,92,246,0.1)",
              border: "1px solid var(--border-soft)",
              borderRadius: "var(--r-pill)",
              padding: "0.35rem 1rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--violet-400)",
              marginBottom: "1.5rem",
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            <Sparkles size={13} />
            AI-powered study tracker
          </div>

          <h1 className="animate-fade-up stagger-1" style={{ marginBottom: "1.25rem" }}>
            <span className="text-gradient">Log what you learn.</span>
            <br />
            <span style={{ color: "var(--text-primary)" }}>Watch yourself grow.</span>
          </h1>

          <p
            className="animate-fade-up stagger-2"
            style={{
              fontSize: "1.1rem",
              color: "var(--text-secondary)",
              lineHeight: 1.65,
              marginBottom: "2.5rem",
            }}
          >
            Just type what you studied today — in plain English.
            Pathly's AI parses it, organises it beautifully, tracks your streaks,
            and lets you see your friends' journeys.
          </p>

          <div className="flex gap-3 justify-center flex-wrap animate-fade-up stagger-3">
            <button
              id="btn-hero-getstarted"
              onClick={() => setShowAuth(true)}
              className="btn btn-primary"
              style={{ padding: "0.9rem 2rem", fontSize: "1rem" }}
            >
              <Sparkles size={17} />
              Get started — it&apos;s free
            </button>
          </div>
        </section>

        {/* ── Feature pills ── */}
        <section
          className="animate-fade-up stagger-4"
          style={{
            maxWidth: 900,
            margin: "4rem auto 0",
            padding: "0 2rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          {[
            { icon: Sparkles, title: "AI Parsing", desc: "Type naturally — AI extracts course, module, lesson automatically", color: "var(--violet-400)" },
            { icon: Calendar, title: "Calendar View", desc: "Color-coded days show exactly when you were productive", color: "var(--sky-400)" },
            { icon: Flame, title: "Streak Tracker", desc: "Daily streaks keep you accountable and motivated", color: "var(--amber-400)" },
            { icon: Users, title: "Friends & Buddies", desc: "Add friends, see their streaks, and cheer each other on", color: "var(--emerald-400)" },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="card"
              style={{ padding: "1.4rem", textAlign: "left" }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `${color}1a`,
                  border: `1px solid ${color}33`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "0.85rem",
                  color,
                }}
              >
                <Icon size={17} />
              </div>
              <h4 className="font-display" style={{ fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.95rem" }}>
                {title}
              </h4>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                {desc}
              </p>
            </div>
          ))}
        </section>

        {/* ── Demo entry preview ── */}
        <section
          className="animate-fade-up stagger-5"
          style={{ maxWidth: 600, margin: "3.5rem auto 6rem", padding: "0 2rem" }}
        >
          <div className="card" style={{ padding: "1.5rem" }}>
            <div className="flex items-center gap-2 mb-3">
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--emerald-400)", boxShadow: "0 0 8px rgba(16,185,129,0.5)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>JUST NOW · AI PARSED</span>
            </div>
            <div className="flex gap-2 flex-wrap mb-3">
              <span className="entry-tag entry-tag--subject">AI/ML</span>
              <span className="entry-tag entry-tag--status-done">✅ Completed</span>
            </div>
            <p className="font-display" style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.35rem" }}>
              Mathematics for Machine Learning
            </p>
            <div className="flex items-center gap-1.5">
              <BookOpen size={12} style={{ color: "var(--text-muted)" }} />
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Module 01 — Linear Equations{" "}
                <span style={{ color: "var(--text-muted)" }}>→ 1-7 Connecting Concepts to ML</span>
              </p>
            </div>
            <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--text-ghost)", fontStyle: "italic" }}>
              You typed: &quot;completed linear equation module 01, for ai ml&quot;
            </p>
          </div>
        </section>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
