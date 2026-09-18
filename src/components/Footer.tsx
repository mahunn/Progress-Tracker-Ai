"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="site-footer"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2.5rem 1rem",
        marginTop: "auto",
        borderTop: "1px solid var(--border-subtle)",
        background: "var(--bg-base)",
      }}
    >
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: "0.15em",
          marginBottom: "0.6rem",
        }}
      >
        DEVELOPED BY
      </span>
      <Link
        href="https://websy.bd"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textDecoration: "none",
          transition: "opacity 0.2s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <img
          src="/websy-logo.png"
          alt="Websy"
          className="footer-logo"
          style={{ height: 48, objectFit: "contain", marginBottom: "0.4rem" }}
        />
        <span
          style={{
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
          }}
        >
          websy.bd
        </span>
      </Link>
    </footer>
  );
}
