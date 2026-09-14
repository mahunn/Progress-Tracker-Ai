import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Pathly — AI Progress Tracker",
  description:
    "Log what you learn in plain English. Pathly organizes your study progress, tracks daily streaks, and maps your journey toward your goals.",
  keywords: ["progress tracker", "study log", "AI learning", "streak tracker", "calendar", "pathly"],
  authors: [{ name: "Pathly" }],
  openGraph: {
    title: "Pathly — AI Progress Tracker",
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
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
