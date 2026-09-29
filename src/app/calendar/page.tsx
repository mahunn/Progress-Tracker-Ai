"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NavBar from "@/components/NavBar";
import WeeklyCalendar from "@/components/WeeklyCalendar";
import ScheduleEditor from "@/components/ScheduleEditor";
import { ScheduleCourse, WeeklyRoutine } from "@/lib/types";
import { getWeeklyRoutine, saveWeeklyRoutine, deleteWeeklyRoutine } from "@/lib/firestore";
import { getStoredRoutine, saveStoredRoutine, deleteStoredRoutine, mergeCourses } from "@/lib/store";
import { Calendar, UploadCloud, Edit3, Trash2, Loader2, Plus, Sparkles } from "lucide-react";
import { compressImage } from "@/lib/utils";

type ViewState = "loading" | "empty" | "preview" | "saved" | "editing";

const COLORS = [
  "var(--grad-brand)",
  "var(--grad-ember)",
  "var(--grad-success)",
  "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)", // sky
  "linear-gradient(135deg, #f472b6 0%, #db2777 100%)", // pink
];

export default function CalendarPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [courses, setCourses] = useState<ScheduleCourse[]>([]);
  const [parsedIncomingCourses, setParsedIncomingCourses] = useState<ScheduleCourse[]>([]);
  const [mergeMode, setMergeMode] = useState<"merge" | "replace">("merge");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  const loadRoutine = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Immediately hydrate from local storage so previous routine is NEVER blanked out
      const local = getStoredRoutine(user.uid);
      if (local && local.courses.length > 0) {
        setCourses(local.courses);
        setViewState("saved");
      }

      // 2. Fetch from Firestore
      const remote = await getWeeklyRoutine(user.uid);
      if (remote && remote.courses.length > 0) {
        // Merge with any local courses to be completely safe against data loss
        const unifiedCourses = local && local.courses.length > 0
          ? mergeCourses(local.courses, remote.courses)
          : remote.courses;
        setCourses(unifiedCourses);
        saveStoredRoutine({ ...remote, courses: unifiedCourses });
        setViewState("saved");
      } else if (local && local.courses.length > 0) {
        // Firestore was empty but local has it -> back up to Firestore
        await saveWeeklyRoutine(user.uid, local);
        setCourses(local.courses);
        setViewState("saved");
      } else {
        if (!local || local.courses.length === 0) {
          setViewState("empty");
        }
      }
    } catch (err) {
      console.error("Failed to load routine", err);
      const local = getStoredRoutine(user.uid);
      if (local && local.courses.length > 0) {
        setCourses(local.courses);
        setViewState("saved");
      } else {
        setViewState("empty");
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) loadRoutine();
  }, [user, loadRoutine]);

  const handleFileUpload = async (file: File) => {
    if (!file || !user) return;
    setIsProcessing(true);

    try {
      const formData = new FormData();
      if (file.type.startsWith("image/")) {
        const compressedBase64 = await compressImage(file, 800, 0.7);
        const res = await fetch(compressedBase64);
        const blob = await res.blob();
        formData.append("image", blob, file.name);
      } else {
        alert("Please upload an image of your schedule.");
        setIsProcessing(false);
        return;
      }

      const res = await fetch("/api/parse-schedule", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.courses) {
        // Assign colors and IDs
        const existingCount = courses.length;
        const newCourses: ScheduleCourse[] = data.courses.map((c: any, i: number) => ({
          ...c,
          id: `course_${Date.now()}_${i}`,
          color: COLORS[(existingCount + i) % COLORS.length],
        }));

        setParsedIncomingCourses(newCourses);
        // Default to MERGING: keep old data and add new
        const merged = mergeCourses(courses, newCourses);
        setCourses(merged);
        setMergeMode("merge");
        setViewState("preview");
      } else {
        alert(data.error || "Failed to parse schedule");
      }
    } catch (err) {
      console.error(err);
      alert("Error processing schedule");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveRoutine = async (updatedCourses?: ScheduleCourse[]) => {
    if (!user) return;
    const finalCourses = updatedCourses || courses;
    setCourses(finalCourses);
    
    const routine: WeeklyRoutine = {
      id: "default",
      user_id: user.uid,
      courses: finalCourses,
      updated_at: new Date().toISOString(),
    };

    // Save locally first for instant persistence
    saveStoredRoutine(routine);

    try {
      await saveWeeklyRoutine(user.uid, routine);
      setViewState("saved");
    } catch (err) {
      console.error(err);
      alert("Saved locally! Cloud backup may be synced when online.");
      setViewState("saved");
    }
  };

  const handleDeleteRoutine = async () => {
    if (!user || !confirm("Are you sure you want to delete your routine?")) return;
    try {
      deleteStoredRoutine(user.uid);
      await deleteWeeklyRoutine(user.uid);
      setCourses([]);
      setViewState("empty");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDiscardPreview = () => {
    // Restore the user's previously saved routine, NEVER wipe it
    const stored = getStoredRoutine(user?.uid);
    if (stored && stored.courses.length > 0) {
      setCourses(stored.courses);
      setViewState("saved");
    } else {
      setCourses([]);
      setViewState("empty");
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <Loader2 size={32} style={{ color: "var(--violet-400)", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Authenticating...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <NavBar user={profile} />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1rem 6rem" }}>
        <section className="animate-fade-up" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 className="font-display" style={{ fontWeight: 800, fontSize: "clamp(1.5rem, 3vw, 2.2rem)", marginBottom: "0.25rem" }}>
              Weekly <span className="text-gradient">Planner</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Your visual productive times — courses and weekly routines.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            {viewState === "empty" && !isProcessing && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewState("editing")}>
                  <Edit3 size={14} /> Add Manually
                </button>
                <label className="btn btn-primary btn-sm" style={{ cursor: "pointer", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <UploadCloud size={14} /> Upload Image (AI)
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                    }}
                    disabled={isProcessing}
                  />
                </label>
              </>
            )}
            
            {viewState === "saved" && !isProcessing && (
              <>
                <label className="btn btn-primary btn-sm" style={{ cursor: "pointer", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <UploadCloud size={14} /> Upload New / More (AI)
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                    }}
                    disabled={isProcessing}
                  />
                </label>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewState("editing")}>
                  <Edit3 size={14} /> Edit Courses
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteRoutine()} style={{ color: "var(--rose-400)" }}>
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
            
            {isProcessing && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--violet-400)", fontSize: "0.9rem", fontWeight: 500 }}>
                <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
                Preparing your schedule...
              </div>
            )}
          </div>
        </section>

        <div className="animate-fade-up stagger-1">
          {viewState === "loading" ? (
             <div className="card" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
                <Loader2 size={32} style={{ color: "var(--violet-400)", animation: "spin 0.8s linear infinite", margin: "0 auto 1rem" }} />
                <h3 className="font-display" style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>Loading your schedule...</h3>
             </div>
          ) : isProcessing ? (
             <div className="card" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
                <Loader2 size={32} style={{ color: "var(--violet-400)", animation: "spin 0.8s linear infinite", margin: "0 auto 1rem" }} />
                <h3 className="font-display" style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>Preparing your schedule...</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>AI is extracting your courses while keeping your existing routine intact.</p>
             </div>
          ) : (
            <>
              {viewState === "preview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  <div className="card-glass" style={{ padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                      <h3 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Sparkles size={18} style={{ color: "var(--violet-400)" }} />
                        Review Updated Routine
                      </h3>
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
                        {courses.length > parsedIncomingCourses.length ? (
                          <>
                            ✨ Keeping your <strong>{courses.length - parsedIncomingCourses.length}</strong> previous course(s) and adding <strong>{parsedIncomingCourses.length}</strong> new. Total: <strong>{courses.length}</strong> courses.
                          </>
                        ) : (
                          `Extracted ${parsedIncomingCourses.length} course(s).`
                        )}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                      {/* Merge vs Replace Toggle when previous courses exist */}
                      {getStoredRoutine(user?.uid)?.courses && (getStoredRoutine(user?.uid)?.courses.length ?? 0) > 0 && (
                        <div style={{ display: "flex", gap: "0.25rem", background: "var(--bg-elevated)", padding: "0.25rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border-subtle)" }}>
                          <button
                            type="button"
                            className={`btn btn-xs ${mergeMode === "merge" ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => {
                              const previous = getStoredRoutine(user?.uid)?.courses || [];
                              setCourses(mergeCourses(previous, parsedIncomingCourses));
                              setMergeMode("merge");
                            }}
                          >
                            Keep Old & Add New
                          </button>
                          <button
                            type="button"
                            className={`btn btn-xs ${mergeMode === "replace" ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => {
                              setCourses(parsedIncomingCourses);
                              setMergeMode("replace");
                            }}
                          >
                            Replace Old
                          </button>
                        </div>
                      )}

                      <button className="btn btn-ghost btn-sm" onClick={handleDiscardPreview}>
                        Cancel
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleSaveRoutine()}>
                        Save Routine
                      </button>
                    </div>
                  </div>
                  <WeeklyCalendar courses={courses} />
                </div>
              )}

              {(viewState === "empty" || viewState === "saved") && (
                <WeeklyCalendar courses={courses} />
              )}

              {viewState === "editing" && (
                <ScheduleEditor
                  initialCourses={courses}
                  onSave={(updated) => handleSaveRoutine(updated)}
                  onCancel={() => setViewState(courses.length > 0 ? "saved" : "empty")}
                />
              )}
            </>
          )}
        </div>
      </main>

    </div>
  );
}
