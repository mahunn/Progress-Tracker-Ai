import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrackPath — AI Progress Tracker",
  description:
    "Log what you learn in plain English. TrackPath organizes your study progress, tracks daily streaks, and maps your journey toward your goals.",
  keywords: ["progress tracker", "study log", "AI learning", "streak tracker", "calendar"],
  authors: [{ name: "TrackPath" }],
  openGraph: {
    title: "TrackPath — AI Progress Tracker",
    description: "Log what you learn. Watch yourself grow.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
