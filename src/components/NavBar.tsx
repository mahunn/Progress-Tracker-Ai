"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Calendar, BarChart2, Flame, Users, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Log", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/weekly", label: "Summary", icon: BarChart2 },
];

interface NavBarProps {
  streak?: number;
  user?: { displayName: string; photoURL: string; friendTag: string } | null;
}

export default function NavBar({ streak = 0, user }: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <nav className="nav-bar">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center mr-auto" id="nav-logo" title="Pathly">
        <img
          src="/logo.png"
          alt="Pathly"
          className="brand-logo"
          style={{
            height: 38,
            width: "auto",
            objectFit: "contain",
          }}
        />
      </Link>

      {/* Nav Links */}
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            id={`nav-${label.toLowerCase()}`}
            className={cn("nav-link", pathname === href && "active")}
          >
            <Icon size={15} />
            {label}
          </Link>
        ))}
      </div>

      {/* Streak badge */}
      {streak > 0 && (
        <div className="streak-badge ml-4" style={{ fontSize: "0.82rem" }}>
          <Flame size={15} className="streak-flame" />
          <span>{streak} day streak</span>
        </div>
      )}

      {/* Theme Toggle */}
      <div style={{ marginLeft: streak > 0 ? "0.75rem" : "auto" }}>
        <ThemeToggle />
      </div>

      {/* User avatar + dropdown */}
      {user && (
        <div style={{ position: "relative", marginLeft: "1rem" }}>
          <button
            id="nav-user-menu"
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-pill)",
              padding: "0.3rem 0.75rem 0.3rem 0.35rem",
              cursor: "pointer",
              transition: "all 150ms",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-soft)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)")}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "var(--grad-brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {user.displayName?.[0] ?? "?"}
              </div>
            )}
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.displayName?.split(" ")[0]}
            </span>
            <ChevronDown size={13} style={{ color: "var(--text-muted)", transform: menuOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 150ms" }} />
          </button>

          {menuOpen && (
            <div
              className="card animate-scale-in"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: 180,
                padding: "0.5rem",
                zIndex: 60,
              }}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <div style={{ padding: "0.5rem 0.75rem 0.75rem", borderBottom: "1px solid var(--border-subtle)", marginBottom: "0.25rem" }}>
                <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>{user.displayName}</p>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>{user.friendTag}</p>
              </div>
              <button
                id="btn-signout"
                onClick={handleSignOut}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--rose-400)",
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  borderRadius: "var(--r-sm)",
                  transition: "background 150ms",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
