"use client";

import { useState } from "react";
import { ScheduleCourse, DayOfWeek } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

const ALL_DAYS: DayOfWeek[] = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const COLORS = [
  "var(--grad-brand)",
  "var(--grad-ember)",
  "var(--grad-success)",
  "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)", // sky
  "linear-gradient(135deg, #f472b6 0%, #db2777 100%)", // pink
];

interface ScheduleEditorProps {
  initialCourses: ScheduleCourse[];
  onSave: (courses: ScheduleCourse[]) => void;
  onCancel: () => void;
}

export default function ScheduleEditor({ initialCourses, onSave, onCancel }: ScheduleEditorProps) {
  const [courses, setCourses] = useState<ScheduleCourse[]>(
    initialCourses.length > 0 ? initialCourses : []
  );

  const handleAddCourse = () => {
    setCourses([
      ...courses,
      {
        id: `course_${Date.now()}`,
        courseCode: "",
        startTime: "08:00 AM",
        endTime: "09:30 AM",
        days: ["Sun", "Tue"],
        color: COLORS[courses.length % COLORS.length],
      },
    ]);
  };

  const handleUpdate = (id: string, field: keyof ScheduleCourse, value: any) => {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleRemove = (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleDay = (id: string, day: DayOfWeek) => {
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const hasDay = c.days.includes(day);
        const newDays = hasDay ? c.days.filter((d) => d !== day) : [...c.days, day];
        return { ...c, days: newDays };
      })
    );
  };

  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <h3 className="font-display" style={{ marginBottom: "1.5rem" }}>Edit Routine</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        {courses.map((course) => (
          <div key={course.id} className="surface" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <input
                className="input-field"
                style={{ fontWeight: 600, maxWidth: "300px" }}
                value={course.courseCode}
                onChange={(e) => handleUpdate(course.id, "courseCode", e.target.value)}
                placeholder="Course Code (e.g. CSE332.2)"
              />
              <button
                className="btn btn-ghost"
                style={{ color: "var(--rose-400)", padding: "0.4rem" }}
                onClick={() => handleRemove(course.id)}
                title="Remove course"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Start:</label>
                <input
                  className="input-field"
                  style={{ padding: "0.4rem 0.6rem" }}
                  value={course.startTime}
                  onChange={(e) => handleUpdate(course.id, "startTime", e.target.value)}
                  placeholder="01:00 PM"
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>End:</label>
                <input
                  className="input-field"
                  style={{ padding: "0.4rem 0.6rem" }}
                  value={course.endTime}
                  onChange={(e) => handleUpdate(course.id, "endTime", e.target.value)}
                  placeholder="02:30 PM"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              {ALL_DAYS.map((day) => {
                const isActive = course.days.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(course.id, day)}
                    style={{
                      background: isActive ? course.color || "var(--violet-500)" : "var(--bg-hover)",
                      color: isActive ? "#fff" : "var(--text-secondary)",
                      border: "none",
                      padding: "0.25rem 0.6rem",
                      borderRadius: "var(--r-sm)",
                      fontSize: "0.75rem",
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {courses.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "1rem 0" }}>
            No courses in your routine.
          </p>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-subtle)", paddingTop: "1.5rem" }}>
        <button className="btn btn-ghost" onClick={handleAddCourse}>
          <Plus size={16} /> Add Course
        </button>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(courses)}>Save Routine</button>
        </div>
      </div>
    </div>
  );
}
