"use client";

import { useState, useEffect } from "react";
import { ScheduleCourse, DayOfWeek } from "@/lib/types";

const DAYS: DayOfWeek[] = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

const START_HOUR = 6; // 6:00 AM
const END_HOUR = 22;  // 10:00 PM
const MINUTES_IN_HOUR = 60;
const ROW_HEIGHT_PX = 60;

function parseTimeToMinutes(timeStr: string): number {
  // Try to match HH:MM or HH.MM or HH：MM
  let match = timeStr.match(/(\d+)\s*[:.：]\s*(\d+)\s*(AM|PM)?/i);
  
  if (!match) {
    // Fallback: Try to match just HH (e.g., "8 AM")
    match = timeStr.match(/(\d+)\s*(AM|PM)?/i);
    if (!match) return START_HOUR * 60;
    
    let hours = parseInt(match[1]);
    const modifier = match[2]?.toUpperCase();
    if (modifier) {
      if (modifier === "PM" && hours < 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;
    }
    return hours * 60;
  }
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const modifier = match[3]?.toUpperCase();

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

const PAW_PRINTS = [
  // Trail 1 (Bottom left to center top)
  { left: 10, top: 85, rot: 35, size: 35 },
  { left: 16, top: 72, rot: 40, size: 35 },
  { left: 23, top: 60, rot: 45, size: 35 },
  { left: 32, top: 48, rot: 40, size: 35 },
  { left: 42, top: 38, rot: 45, size: 35 },
  { left: 52, top: 28, rot: 50, size: 35 },

  // Trail 2 (Right side going down)
  { left: 85, top: 15, rot: 130, size: 28 },
  { left: 78, top: 25, rot: 135, size: 28 },
  { left: 87, top: 36, rot: 125, size: 28 },
  { left: 76, top: 46, rot: 130, size: 28 },
  { left: 85, top: 58, rot: 135, size: 28 },
  { left: 74, top: 69, rot: 130, size: 28 },
  
  // Trail 3 (Bottom center wandering right)
  { left: 40, top: 88, rot: -20, size: 45 },
  { left: 52, top: 82, rot: -10, size: 45 },
  { left: 66, top: 85, rot: -5, size: 45 },
];

function PawPrintIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" style={style} xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="40" r="11" />
      <circle cx="80" cy="40" r="11" />
      <circle cx="43" cy="20" r="12" />
      <circle cx="67" cy="20" r="12" />
      <path d="M 32 65 C 32 50, 43 45, 55 55 C 67 45, 78 50, 78 65 C 78 85, 65 95, 55 95 C 45 95, 32 85, 32 65 Z" />
    </svg>
  );
}

function CatPeekingIcon() {
  return (
    <svg
      width="90"
      height="63"
      viewBox="0 0 100 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: "absolute",
        bottom: "100%", 
        left: "50%",
        transform: "translateX(-50%)",
        animation: "cat-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        color: "var(--amber-500)",
        pointerEvents: "none",
        zIndex: 10,
        overflow: "visible", 
      }}
    >
      <defs>
        <linearGradient id="cat-body" x1="0" y1="0" x2="0" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--amber-400)" />
          <stop offset="100%" stopColor="var(--amber-600)" />
        </linearGradient>
        <filter id="head-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" floodColor="#000" />
        </filter>
        <filter id="paw-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodOpacity="0.6" floodColor="#000" />
        </filter>
        <clipPath id="eye-clip">
          <rect x="0" y="0" width="100" height="100" style={{ transformOrigin: "center 54px", animation: "cat-blink-slow 3s infinite" }} />
        </clipPath>
      </defs>

      {/* Whiskers Left (2) */}
      <path d="M 18,55 Q 8,52 3,56" stroke="#292524" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 19,63 Q 9,61 4,66" stroke="#292524" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      
      {/* Whiskers Right (3) */}
      <path d="M 82,48 Q 92,45 97,49" stroke="#292524" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 82,56 Q 92,54 96,59" stroke="#292524" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 82,64 Q 92,62 95,67" stroke="#292524" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Head Silhouette */}
      <path d="M 20,70 C 18,50 16,30 18,10 Q 30,35 38,35 Q 50,38 62,35 Q 70,35 82,10 C 84,30 82,50 80,70 Z" fill="url(#cat-body)" filter="url(#head-shadow)" />

      {/* Eyes Group with Blink ClipPath */}
      <g clipPath="url(#eye-clip)">
        {/* Whites of eyes (Huge, slightly tilted) */}
        <ellipse cx="36" cy="54" rx="14" ry="18" fill="#ffffff" transform="rotate(10 36 54)" />
        <ellipse cx="64" cy="54" rx="14" ry="18" fill="#ffffff" transform="rotate(-10 64 54)" />
        
        {/* Pupils */}
        <ellipse cx="38" cy="52" rx="7" ry="11" fill="#292524" transform="rotate(10 38 52)" />
        <ellipse cx="62" cy="52" rx="7" ry="11" fill="#292524" transform="rotate(-10 62 52)" />
        
        {/* Pupil Highlights (Catchlights on top-left of pupils) */}
        <circle cx="35" cy="46" r="2.5" fill="#ffffff" />
        <circle cx="59" cy="46" r="2.5" fill="#ffffff" />
      </g>

      {/* Paws (overlapping the white eyes) */}
      <g fill="url(#cat-body)" filter="url(#paw-shadow)">
        {/* Left Paw */}
        <circle cx="28" cy="73" r="4.5" />
        <circle cx="35" cy="76" r="5.5" />
        <circle cx="42" cy="73" r="4.5" />
        <path d="M 24 70 L 46 70 L 35 77 Z" />
        
        {/* Right Paw */}
        <circle cx="58" cy="73" r="4.5" />
        <circle cx="65" cy="76" r="5.5" />
        <circle cx="72" cy="73" r="4.5" />
        <path d="M 54 70 L 76 70 L 65 77 Z" />
      </g>
    </svg>
  );
}

export default function WeeklyCalendar({ courses }: { courses: ScheduleCourse[] }) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // update every minute
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const gridStartMinutes = START_HOUR * MINUTES_IN_HOUR;

  // Generate hours for the Y axis
  const hours: string[] = [];
  for (let i = START_HOUR; i <= END_HOUR; i++) {
    const ampm = i >= 12 ? "PM" : "AM";
    const h = i > 12 ? i - 12 : i === 0 ? 12 : i;
    hours.push(`${h}:00 ${ampm}`);
  }

  const todayIndex = new Date().getDay();
  const dayMapping: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayString = dayMapping[todayIndex];

  return (
    <div className="schedule-card">
      <div className="schedule-grid-wrapper">
        <div className="schedule-grid-container" style={{ position: "relative" }}>
          {/* Current Time Indicator */}
          {currentTime && (() => {
            const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
            
            // Allow showing up to the end of the last hour block (END_HOUR + 1)
            const isWithinHours = currentMinutes >= gridStartMinutes && currentMinutes < ((END_HOUR + 1) * 60);
            
            if (!isWithinHours) return null;
            
            const topPx = ((currentMinutes - gridStartMinutes) / 60) * ROW_HEIGHT_PX;
            
            return (
              <div
                style={{
                  position: "absolute",
                  top: `${topPx}px`,
                  left: "45px", // skip time column
                  right: 0,
                  height: "2px",
                  background: "var(--rose-500)",
                  zIndex: 35,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <div style={{ 
                  width: "8px", 
                  height: "8px", 
                  borderRadius: "50%", 
                  background: "var(--rose-500)", 
                  transform: "translateX(-4px)",
                  boxShadow: "0 0 8px rgba(244, 63, 94, 0.6)",
                  position: "relative"
                }}>
                  <div style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    color: "var(--rose-500)",
                    background: "var(--bg-base)",
                    padding: "2px 4px",
                    borderRadius: "4px"
                  }}>
                    {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Watermark Paw Prints */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5, overflow: "hidden", opacity: 0.1, color: "var(--text-primary)" }}>
            {PAW_PRINTS.map((paw, i) => (
              <PawPrintIcon
                key={i}
                style={{
                  position: "absolute",
                  left: `${paw.left}%`,
                  top: `${paw.top}%`,
                  transform: `rotate(${paw.rot}deg)`,
                  width: paw.size,
                  height: paw.size,
                }}
              />
            ))}
          </div>

          <div className="schedule-header" style={{ borderRight: "1px solid var(--border-subtle)", zIndex: 60 }}>Time</div>
        {DAYS.map((day, i) => {
          const isToday = day === todayString;

          return (
            <div
              key={day}
              className="schedule-header"
              style={{
                background: "var(--bg-elevated)",
                color: isToday ? "var(--violet-500)" : "var(--text-secondary)",
                fontWeight: isToday ? 700 : 600,
                borderBottom: isToday ? "2px solid var(--violet-500)" : "1px solid var(--border-subtle)",
                transition: "color 0.3s ease, border-bottom 0.3s ease",
                zIndex: 60,
              }}
            >
              {isToday && (
                <div style={{ position: "absolute", inset: 0, opacity: isScrolled ? 0 : 1, transition: "opacity 0.3s ease", pointerEvents: "none" }}>
                  <CatPeekingIcon />
                </div>
              )}
              <span style={{ position: "relative", zIndex: 10 }}>{day[0]}</span>
              <span className="day-name" style={{ position: "relative", zIndex: 10 }}>{day.slice(1)}</span>
            </div>
          );
        })}

        {/* Time Grid */}
        <div style={{ display: "contents" }}>
          <div style={{ gridColumn: 1, display: "flex", flexDirection: "column" }}>
            {hours.map((hour, i) => (
              <div key={i} className="schedule-time-label">
                <span style={{ transform: "translateY(-50%)" }}>{hour}</span>
              </div>
            ))}
          </div>

          {/* Days Columns */}
          {DAYS.map((day, dayIndex) => {
            const dayCourses = courses.filter((c) => c.days.includes(day));
            const isToday = day === todayString;

            return (
              <div
                key={day}
                className="schedule-cell"
                style={{
                  gridColumn: dayIndex + 2, // +2 because column 1 is time
                  borderRight: dayIndex < 6 ? "1px dashed var(--border-subtle)" : "none",
                  background: isToday ? "rgba(124, 58, 237, 0.03)" : "var(--bg-surface)",
                }}
              >
                {/* Horizontal grid lines */}
                {hours.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: ROW_HEIGHT_PX,
                      borderBottom: "1px solid var(--border-subtle)",
                      opacity: 0.5,
                    }}
                  />
                ))}

                {/* Courses */}
                {dayCourses.map((course) => {
                  const startMin = parseTimeToMinutes(course.startTime);
                  const endMin = parseTimeToMinutes(course.endTime);
                  
                  // Calculate absolute position based on start time
                  const topPx = ((startMin - gridStartMinutes) / MINUTES_IN_HOUR) * ROW_HEIGHT_PX;
                  const heightPx = ((endMin - startMin) / MINUTES_IN_HOUR) * ROW_HEIGHT_PX;

                  // Make sure we don't render before start hour (though visually it will just clip)
                  const top = Math.max(0, topPx);

                  return (
                    <div
                      key={course.id}
                      className="schedule-course-block"
                      style={{
                        top: `${top}px`,
                        height: `${heightPx}px`,
                        background: course.color || "var(--grad-brand)",
                      }}
                      title={`${course.courseCode}\n${course.startTime} - ${course.endTime}`}
                    >
                      <div className="course-block-title truncate-2">{course.courseCode}</div>
                      <div className="course-block-time" style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                        <span>{course.startTime}</span>
                        <span style={{ opacity: 0.7 }}>{course.endTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
