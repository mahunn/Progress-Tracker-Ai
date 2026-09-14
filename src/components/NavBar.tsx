"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Calendar, BarChart2, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Log", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/weekly", label: "Summary", icon: BarChart2 },
];

interface NavBarProps {
  streak?: number;
}

export default function NavBar({ streak = 0 }: NavBarProps) {
  const pathname = usePathname();

  return (
    <nav className="nav-bar">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mr-auto" id="nav-logo">
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "var(--grad-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--glow-brand-sm)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 12L6 6L9 9L12 4"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="4" r="1.5" fill="white" />
          </svg>
        </div>
        <span
          className="font-display text-gradient"
          style={{ fontWeight: 700, fontSize: "1.05rem" }}
        >
          TrackPath
        </span>
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

      {/* Streak Badge */}
      {streak > 0 && (
        <div className="streak-badge ml-4" style={{ fontSize: "0.82rem" }}>
          <Flame size={15} className="streak-flame" />
          <span>{streak} day streak</span>
        </div>
      )}
    </nav>
  );
}
