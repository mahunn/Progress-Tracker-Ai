"use client";

import { useMemo } from "react";
import { ProgressEntry } from "@/lib/types";

interface CourseProgressStatsProps {
  entries: ProgressEntry[];
}

export default function CourseProgressStats({ entries }: CourseProgressStatsProps) {
  const stats = useMemo(() => {
    const courseMap: Record<string, { subject: string; total: number; completed: number; inProgress: number }> = {};
    
    entries.forEach((entry) => {
      const key = `${entry.subject}::${entry.course}`;
      if (!courseMap[key]) {
        courseMap[key] = { subject: entry.subject, total: 0, completed: 0, inProgress: 0 };
      }
      
      courseMap[key].total++;
      if (entry.status === "completed") {
        courseMap[key].completed++;
      } else {
        courseMap[key].inProgress++;
      }
    });
    
    return Object.entries(courseMap)
      .map(([key, data]) => ({ course: key.split("::")[1], ...data }))
      .sort((a, b) => b.total - a.total); // Sort by most active
  }, [entries]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <h3 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem", color: "var(--text-primary)" }}>
        Course Breakdown
      </h3>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {stats.map((stat, i) => {
          const percent = Math.round((stat.completed / stat.total) * 100);
          
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--violet-400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.1rem" }}>
                    {stat.subject}
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--text-secondary)" }}>
                    {stat.course}
                  </div>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
                  <span style={{ color: "var(--emerald-400)" }}>{stat.completed}</span> / {stat.total}
                </div>
              </div>
              
              {/* Progress Bar */}
              <div style={{ width: "100%", height: "8px", background: "var(--bg-elevated)", borderRadius: "var(--r-pill)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                <div 
                  style={{ 
                    height: "100%", 
                    width: `${percent}%`, 
                    background: percent === 100 ? "var(--emerald-400)" : "var(--grad-brand)",
                    borderRadius: "var(--r-pill)",
                    transition: "width 0.5s ease-out"
                  }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
