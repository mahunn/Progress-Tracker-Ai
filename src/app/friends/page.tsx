"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NavBar from "@/components/NavBar";
import {
  sendFriendRequest,
  getIncomingRequests,
  respondToFriendRequest,
  getFriends,
  FriendRequest,
  computeStreakData,
  getUserEntries,
  getLeaderboardUsers,
  LeaderboardUser,
} from "@/lib/firestore";
import {
  getUserProfile,
  searchUserByUsername,
  updateUsername,
  cleanUsername,
} from "@/lib/firebase";
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  Flame,
  BookOpen,
  Loader2,
  Clock,
  ExternalLink,
  Edit3,
  Copy,
  Trophy,
  Award,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

interface FriendProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  username: string;
  friendTag: string;
  streak?: number;
  lastSubject?: string;
}

export default function FriendsPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();

  // Active Tab: "leaderboard" or "buddies"
  const [activeTab, setActiveTab] = useState<"leaderboard" | "buddies">("leaderboard");

  // Username edit states
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Search friend states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<{
    uid: string;
    displayName: string;
    photoURL: string;
    username?: string;
    friendTag?: string;
  } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Friends, requests & leaderboard states
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [friendUidsSet, setFriendUidsSet] = useState<Set<string>>(new Set());
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [addingFriendUid, setAddingFriendUid] = useState<string | null>(null);
  const [addedSuccessMap, setAddedSuccessMap] = useState<Record<string, boolean>>({});

  const currentUsername =
    profile?.username || profile?.friendTag?.replace(/^#pathly-/, "") || "";

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  const loadData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const [requests, friendUids, lbUsers] = await Promise.all([
        getIncomingRequests(user.uid),
        getFriends(user.uid),
        getLeaderboardUsers(),
      ]);

      setIncomingRequests(requests || []);
      const validFriendUids = (friendUids || []).filter((id): id is string => Boolean(id) && typeof id === "string");
      setFriendUidsSet(new Set(validFriendUids));
      setLeaderboard(lbUsers || []);

      // Load friend profiles + streaks
      const profiles = await Promise.all(
        validFriendUids.map(async (uid) => {
          if (!uid) return null;
          const p = (await getUserProfile(uid)) as {

            uid: string;
            displayName: string;
            photoURL: string;
            username?: string;
            friendTag?: string;
          } | null;
          if (!p) return null;
          const entries = await getUserEntries(uid);
          const streak = computeStreakData(entries);
          const lastEntry = entries[0];
          const uName =
            p.username || p.friendTag?.replace(/^#pathly-/, "") || "user";
          return {
            uid: p.uid,
            displayName: p.displayName,
            photoURL: p.photoURL,
            username: uName,
            friendTag: uName,
            streak: streak.current,
            lastSubject: lastEntry?.subject || "",
          } as FriendProfile;
        })
      );
      setFriends(profiles.filter(Boolean) as FriendProfile[]);
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // Handle changing username
  const handleSaveUsername = async () => {
    if (!user) return;
    const clean = cleanUsername(usernameInput);
    if (!clean) {
      setUsernameError("Please enter a username.");
      return;
    }
    if (clean === currentUsername) {
      setIsEditingUsername(false);
      return;
    }

    setSavingUsername(true);
    setUsernameError(null);
    setUsernameSuccess(false);

    try {
      const res = await updateUsername(user.uid, clean);
      if (res.success) {
        await refreshProfile();
        setIsEditingUsername(false);
        setUsernameSuccess(true);
        loadData();
        setTimeout(() => setUsernameSuccess(false), 4000);
      } else {
        setUsernameError(res.error || "Failed to update username.");
      }
    } catch (err: unknown) {
      console.error(err);
      setUsernameError("An error occurred while saving. Please try again.");
    } finally {
      setSavingUsername(false);
    }
  };

  const handleCopyUsername = () => {
    if (!currentUsername) return;
    navigator.clipboard.writeText(currentUsername);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Handle searching for a friend by username
  const handleSearch = async () => {
    const clean = cleanUsername(searchQuery.replace(/^[#@]/, ""));
    if (!clean) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);
    setSentSuccess(false);

    try {
      const result = (await searchUserByUsername(clean)) as {
        uid: string;
        displayName: string;
        photoURL: string;
        username?: string;
        friendTag?: string;
      } | null;

      if (!result) {
        setSearchError(`No user found with username "${clean}".`);
      } else if (result.uid === user?.uid) {
        setSearchError("That's your own username!");
      } else {
        setSearchResult(result);
      }
    } catch {
      setSearchError("Search failed. Please check your connection.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async (targetUid?: string, targetUsername?: string) => {
    if (!user || !profile) return;
    const toUid = targetUid || searchResult?.uid;
    if (!toUid) return;

    if (targetUid) setAddingFriendUid(targetUid);
    else setSendingRequest(true);

    const result = await sendFriendRequest(user.uid, toUid, {
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      username: currentUsername,
      friendTag: currentUsername,
    });

    if (targetUid) setAddingFriendUid(null);
    else setSendingRequest(false);

    if (result.success) {
      if (targetUid) {
        setAddedSuccessMap((prev) => ({ ...prev, [targetUid]: true }));
      } else {
        setSentSuccess(true);
        setSearchResult(null);
        setSearchQuery("");
      }
    } else {
      if (!targetUid) setSearchError(result.error ?? "Failed to send request.");
    }
  };

  const handleRespond = async (
    req: FriendRequest,
    status: "accepted" | "declined"
  ) => {
    await respondToFriendRequest(req.id, status, req.fromUid, req.toUid);
    loadData();
  };

  const userRankEntry = leaderboard.find((lb) => lb.uid === user?.uid);

  if (authLoading || pageLoading) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <NavBar streak={0} user={profile} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
          }}
        >
          <Loader2
            size={32}
            style={{
              color: "var(--violet-400)",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <NavBar streak={userRankEntry?.streak ?? 0} user={profile} />
      <main
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "1.5rem 1rem 6rem",
        }}
      >
        {/* Header with Username & Edit */}
        <div className="animate-fade-up" style={{ marginBottom: "1.75rem" }}>
          <h1
            className="font-display"
            style={{
              fontWeight: 800,
              fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
              marginBottom: "0.5rem",
            }}
          >
            <span className="text-gradient">Community &amp; Friends</span>
          </h1>

          {/* Username Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.6rem",
              marginTop: "0.25rem",
            }}
          >
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.95rem",
                fontWeight: 500,
              }}
            >
              My username:
            </span>

            {isEditingUsername ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "var(--r-md)",
                    padding: "0.2rem 0.65rem",
                  }}
                >
                  <span
                    style={{
                      color: "var(--violet-400)",
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      marginRight: "0.2rem",
                    }}
                  >
                    @
                  </span>
                  <input
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, "")
                      );
                      setUsernameError(null);
                      setUsernameSuccess(false);
                    }}
                    maxLength={20}
                    placeholder="username"
                    autoFocus
                    disabled={savingUsername}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveUsername()}
                    style={{
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "var(--text-primary)",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.88rem",
                      width: 140,
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveUsername}
                  disabled={savingUsername || !usernameInput.trim()}
                  className="btn btn-primary btn-sm"
                  style={{ padding: "0.3rem 0.75rem" }}
                >
                  {savingUsername ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingUsername(false);
                    setUsernameInput(currentUsername);
                    setUsernameError(null);
                  }}
                  disabled={savingUsername}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "0.3rem 0.6rem" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="font-mono"
                  style={{
                    color: "var(--violet-400)",
                    background: "rgba(139,92,246,0.12)",
                    border: "1px solid rgba(139,92,246,0.25)",
                    padding: "0.2rem 0.65rem",
                    borderRadius: "var(--r-pill)",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                  }}
                >
                  @{currentUsername || "..."}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setUsernameInput(currentUsername);
                    setIsEditingUsername(true);
                    setUsernameError(null);
                    setUsernameSuccess(false);
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{
                    padding: "0.2rem 0.55rem",
                    fontSize: "0.78rem",
                    borderRadius: "var(--r-sm)",
                    gap: "0.3rem",
                  }}
                  title="Change your username"
                >
                  <Edit3 size={12} />
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleCopyUsername}
                  className="btn btn-ghost btn-sm"
                  style={{
                    padding: "0.2rem 0.55rem",
                    fontSize: "0.78rem",
                    borderRadius: "var(--r-sm)",
                    gap: "0.3rem",
                  }}
                  title="Copy username to clipboard"
                >
                  {copied ? (
                    <Check size={12} style={{ color: "var(--emerald-400)" }} />
                  ) : (
                    <Copy size={12} />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>

          {/* Feedback messages */}
          {usernameError && (
            <p
              style={{
                color: "var(--rose-400)",
                fontSize: "0.82rem",
                marginTop: "0.4rem",
                padding: "0.35rem 0.65rem",
                background: "rgba(239,68,68,0.08)",
                borderRadius: "var(--r-sm)",
                border: "1px solid rgba(239,68,68,0.2)",
                display: "inline-block",
              }}
            >
              {usernameError}
            </p>
          )}

          {usernameSuccess && (
            <p
              style={{
                color: "var(--emerald-400)",
                fontSize: "0.82rem",
                marginTop: "0.4rem",
                padding: "0.35rem 0.65rem",
                background: "rgba(16,185,129,0.08)",
                borderRadius: "var(--r-sm)",
                border: "1px solid rgba(16,185,129,0.2)",
                display: "inline-block",
              }}
            >
              ✅ Username updated to @{currentUsername}!
            </p>
          )}
        </div>

        {/* Tab Switcher: Leaderboard vs My Buddies */}
        <div className="tab-pill-group animate-fade-up">
          <button
            type="button"
            onClick={() => setActiveTab("leaderboard")}
            className={`tab-pill-btn ${activeTab === "leaderboard" ? "active" : ""}`}
          >
            <Trophy size={14} />
            Leaderboard
            <span
              style={{
                background: activeTab === "leaderboard" ? "rgba(255,255,255,0.25)" : "var(--bg-elevated)",
                padding: "0.1rem 0.45rem",
                borderRadius: "var(--r-pill)",
                fontSize: "0.72rem",
                marginLeft: "0.15rem",
              }}
            >
              {leaderboard.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("buddies")}
            className={`tab-pill-btn ${activeTab === "buddies" ? "active" : ""}`}
          >
            <Users size={14} />
            My Buddies
            <span
              style={{
                background: activeTab === "buddies" ? "rgba(255,255,255,0.25)" : "var(--bg-elevated)",
                padding: "0.1rem 0.45rem",
                borderRadius: "var(--r-pill)",
                fontSize: "0.72rem",
                marginLeft: "0.15rem",
              }}
            >
              {friends.length}
            </span>
            {incomingRequests.length > 0 && (
              <span
                style={{
                  background: "var(--rose-500)",
                  color: "white",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "var(--r-pill)",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                }}
              >
                {incomingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* ─── TAB 1: LEADERBOARD RANKING ─── */}
        {activeTab === "leaderboard" && (
          <div className="animate-fade-up">
            {/* User Standing Callout Card */}
            {userRankEntry && (
              <div
                className="card"
                style={{
                  padding: "1rem 1.25rem",
                  marginBottom: "1.25rem",
                  background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(124,58,237,0.04) 100%)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--violet-500)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "0.9rem",
                    }}
                  >
                    {userRankEntry.rank}
                  </div>
                  <div>
                    <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      Your Current Rank: {userRankEntry.rank} of {leaderboard.length}
                    </p>
                    <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                      Keep logging daily to climb the leaderboard!
                    </p>
                  </div>

                </div>

                <div className="flex items-center gap-3">
                  <div className="streak-badge" style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}>
                    <Flame size={12} className="streak-flame" />
                    {userRankEntry.streak} day streak
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      background: "rgba(16,185,129,0.12)",
                      border: "1px solid rgba(16,185,129,0.25)",
                      color: "var(--emerald-400)",
                      borderRadius: "var(--r-pill)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "0.25rem 0.65rem",
                    }}
                  >
                    <CheckCircle2 size={12} />
                    {userRankEntry.completedTasks} completed
                  </div>
                </div>
              </div>
            )}

            {/* Ranking Header Info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
                padding: "0 0.5rem",
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Active Participants ({leaderboard.length})
              </span>
              <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                Ranked by: 1st <Flame size={11} style={{ display: "inline", color: "var(--amber-400)" }} /> Streak · 2nd <CheckCircle2 size={11} style={{ display: "inline", color: "var(--emerald-400)" }} /> Completed Tasks
              </span>
            </div>

            {/* Leaderboard Table / Rows */}
            {leaderboard.length === 0 ? (
              <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🏆</div>
                <p className="font-display" style={{ fontWeight: 600, fontSize: "0.92rem" }}>
                  No participants on the leaderboard yet
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  Log your study sessions in the Dashboard to appear here!
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                {leaderboard.map((p, idx) => {
                  const isSelf = p.uid === user?.uid;
                  const isFriend = friendUidsSet.has(p.uid);
                  const isAdded = addedSuccessMap[p.uid];
                  const rankClass =
                    p.rank === 1
                      ? "rank-badge--1"
                      : p.rank === 2
                      ? "rank-badge--2"
                      : p.rank === 3
                      ? "rank-badge--3"
                      : "rank-badge--other";

                  return (
                    <div
                      key={p.uid}
                      className={`leaderboard-row ${isSelf ? "leaderboard-row--self" : ""} stagger-${Math.min(idx + 1, 6)}`}
                    >
                      {/* Rank Badge */}
                      <div className={`rank-badge ${rankClass}`}>
                        {p.rank}
                      </div>


                      {/* Avatar */}
                      {p.photoURL ? (
                        <img
                          src={p.photoURL}
                          alt=""
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            flexShrink: 0,
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            background: "var(--grad-brand)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: 700,
                            flexShrink: 0,
                            fontSize: "0.85rem",
                          }}
                        >
                          {p.displayName?.[0] ?? "?"}
                        </div>
                      )}

                      {/* Name + Username */}
                      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                        <div className="flex items-center gap-2">
                          <p
                            style={{
                              fontWeight: 600,
                              fontSize: "0.88rem",
                              color: "var(--text-primary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.displayName}
                          </p>
                          {isSelf && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                background: "var(--violet-500)",
                                color: "white",
                                padding: "0.1rem 0.45rem",
                                borderRadius: "var(--r-pill)",
                              }}
                            >
                              You
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            fontSize: "0.74rem",
                            color: "var(--violet-400)",
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          @{p.username}
                        </p>
                      </div>

                      {/* Streak Pill */}
                      <div
                        className="streak-badge"
                        style={{
                          fontSize: "0.74rem",
                          padding: "0.25rem 0.65rem",
                          flexShrink: 0,
                        }}
                        title={`${p.streak} day active streak`}
                      >
                        <Flame size={12} className={p.streak > 0 ? "streak-flame" : ""} />
                        <span>{p.streak} <span className="mobile-hide-text">days</span></span>
                      </div>

                      {/* Completed Tasks Pill */}
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          background: "rgba(16,185,129,0.1)",
                          border: "1px solid rgba(16,185,129,0.22)",
                          color: "var(--emerald-400)",
                          borderRadius: "var(--r-pill)",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                          padding: "0.25rem 0.65rem",
                          flexShrink: 0,
                        }}
                        title={`${p.completedTasks} completed lessons/modules`}
                      >
                        <CheckCircle2 size={12} />
                        <span>{p.completedTasks} <span className="mobile-hide-text">completed</span></span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5" style={{ flexShrink: 0 }}>
                        <Link
                          href={`/u/${encodeURIComponent(p.username)}`}
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: "0.3rem 0.55rem",
                            borderRadius: "var(--r-md)",
                          }}
                          title="View public profile"
                        >
                          <ExternalLink size={12} />
                        </Link>

                        {!isSelf && !isFriend && (
                          <button
                            type="button"
                            onClick={() => handleSendRequest(p.uid, p.username)}
                            disabled={addingFriendUid === p.uid || isAdded}
                            className="btn btn-primary btn-sm"
                            style={{
                              padding: "0.25rem 0.55rem",
                              fontSize: "0.72rem",
                              borderRadius: "var(--r-md)",
                            }}
                            title="Add as buddy"
                          >
                            {addingFriendUid === p.uid ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : isAdded ? (
                              <Check size={11} />
                            ) : (
                              <UserPlus size={11} />
                            )}
                            <span className="mobile-hide-text">
                              {isAdded ? "Sent" : "Add"}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: MY BUDDIES & REQUESTS ─── */}
        {activeTab === "buddies" && (
          <div className="friends-grid animate-fade-up">
            {/* LEFT — Search + Add Friend */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {/* Add Friend Card */}
              <div className="card animate-fade-up" style={{ padding: "1.5rem" }}>
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus size={16} style={{ color: "var(--violet-400)" }} />
                  <h3
                    className="font-display"
                    style={{ fontWeight: 700, fontSize: "1rem" }}
                  >
                    Add a Friend
                  </h3>
                </div>
                <div className="flex gap-2 mb-3">
                  <input
                    id="input-friend-username"
                    className="input-field"
                    style={{ fontSize: "0.88rem", padding: "0.65rem 0.9rem" }}
                    placeholder="Enter username (e.g. mahin)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <button
                    id="btn-search-friend"
                    className="btn btn-primary btn-sm"
                    onClick={handleSearch}
                    disabled={searchLoading}
                    style={{ flexShrink: 0 }}
                    title="Search user"
                  >
                    {searchLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Search size={14} />
                    )}
                  </button>
                </div>

                {searchError && (
                  <p
                    style={{
                      color: "var(--rose-400)",
                      fontSize: "0.8rem",
                      padding: "0.5rem 0.75rem",
                      background: "rgba(239,68,68,0.08)",
                      borderRadius: "var(--r-md)",
                      border: "1px solid rgba(239,68,68,0.2)",
                    }}
                  >
                    {searchError}
                  </p>
                )}

                {sentSuccess && (
                  <p
                    style={{
                      color: "var(--emerald-400)",
                      fontSize: "0.8rem",
                      padding: "0.5rem 0.75rem",
                      background: "rgba(16,185,129,0.08)",
                      borderRadius: "var(--r-md)",
                      border: "1px solid rgba(16,185,129,0.2)",
                    }}
                  >
                    ✅ Friend request sent!
                  </p>
                )}

                {searchResult && (
                  <div
                    className="animate-scale-in"
                    style={{
                      padding: "0.85rem",
                      background: "var(--bg-elevated)",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--border-soft)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    {searchResult.photoURL ? (
                      <img
                        src={searchResult.photoURL}
                        alt=""
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          background: "var(--grad-brand)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: 700,
                        }}
                      >
                        {searchResult.displayName?.[0]}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontWeight: 600,
                          fontSize: "0.9rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {searchResult.displayName}
                      </p>
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--violet-400)",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        @
                        {searchResult.username ||
                          searchResult.friendTag?.replace(/^#pathly-/, "")}
                      </p>
                    </div>
                    <button
                      id="btn-send-friend-request"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSendRequest()}
                      disabled={sendingRequest}
                    >
                      {sendingRequest ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <UserPlus size={13} />
                      )}
                      {sendingRequest ? "Sending..." : "Add"}
                    </button>
                  </div>
                )}
              </div>

              {/* Incoming Requests Card */}
              {incomingRequests.length > 0 && (
                <div
                  className="card animate-fade-up stagger-2"
                  style={{ padding: "1.5rem" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={15} style={{ color: "var(--amber-400)" }} />
                    <h3
                      className="font-display"
                      style={{ fontWeight: 700, fontSize: "0.95rem" }}
                    >
                      Pending Requests
                      <span
                        style={{
                          marginLeft: "0.5rem",
                          background: "var(--amber-400)",
                          color: "#000",
                          borderRadius: "var(--r-pill)",
                          padding: "0.1rem 0.45rem",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                        }}
                      >
                        {incomingRequests.length}
                      </span>
                    </h3>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                    }}
                  >
                    {incomingRequests.map((req) => {
                      const reqUser =
                        req.fromUsername ||
                        req.fromFriendTag?.replace(/^#pathly-/, "") ||
                        "user";
                      return (
                        <div
                          key={req.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.65rem",
                            padding: "0.65rem",
                            background: "var(--bg-elevated)",
                            borderRadius: "var(--r-md)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          {req.fromPhotoURL ? (
                            <img
                              src={req.fromPhotoURL}
                              alt=""
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: "var(--grad-brand)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontWeight: 700,
                                fontSize: "0.8rem",
                              }}
                            >
                              {req.fromDisplayName?.[0]}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {req.fromDisplayName}
                            </p>
                            <p
                              style={{
                                fontSize: "0.72rem",
                                color: "var(--violet-400)",
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              @{reqUser}
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              id={`btn-accept-${req.id}`}
                              onClick={() => handleRespond(req, "accepted")}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: "rgba(16,185,129,0.15)",
                                border: "1px solid rgba(16,185,129,0.3)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--emerald-400)",
                              }}
                              title="Accept request"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              id={`btn-decline-${req.id}`}
                              onClick={() => handleRespond(req, "declined")}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: "rgba(239,68,68,0.1)",
                                border: "1px solid rgba(239,68,68,0.2)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--rose-400)",
                              }}
                              title="Decline request"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — Buddies List */}
            <div className="animate-fade-up stagger-1">
              <div className="flex items-center gap-2 mb-3">
                <Users size={15} style={{ color: "var(--violet-400)" }} />
                <h3
                  className="font-display"
                  style={{
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Your Buddies ({friends.length})
                </h3>
              </div>

              {friends.length === 0 ? (
                <div
                  className="card"
                  style={{ padding: "2.5rem", textAlign: "center" }}
                >
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>
                    👥
                  </div>
                  <p
                    className="font-display"
                    style={{
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    No buddies yet
                  </p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Share your username{" "}
                    <span
                      style={{
                        color: "var(--violet-400)",
                        fontWeight: 600,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      @{currentUsername}
                    </span>{" "}
                    or check the Leaderboard to discover other learners!
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  {friends.map((friend, i) => (
                    <div
                      key={friend.uid}
                      className={`card animate-fade-up stagger-${Math.min(
                        i + 1,
                        5
                      )}`}
                      style={{ padding: "1rem 1.25rem" }}
                    >
                      <div className="flex items-center gap-3">
                        {friend.photoURL ? (
                          <img
                            src={friend.photoURL}
                            alt=""
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              flexShrink: 0,
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              background: "var(--grad-brand)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {friend.displayName?.[0]}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontWeight: 600,
                              fontSize: "0.9rem",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {friend.displayName}
                          </p>
                          <p
                            style={{
                              fontSize: "0.74rem",
                              color: "var(--violet-400)",
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            @{friend.username}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(friend.streak ?? 0) > 0 && (
                            <div
                              className="streak-badge"
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.25rem 0.65rem",
                              }}
                            >
                              <Flame size={12} className="streak-flame" />
                              {friend.streak}
                            </div>
                          )}
                          <Link
                            href={`/u/${encodeURIComponent(friend.username)}`}
                            className="btn btn-ghost btn-sm"
                            style={{
                              padding: "0.3rem 0.6rem",
                              borderRadius: "var(--r-md)",
                            }}
                            id={`btn-view-profile-${friend.uid}`}
                            title="View profile"
                          >
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      </div>
                      {friend.lastSubject && (
                        <div
                          className="flex items-center gap-1.5 mt-2"
                          style={{ paddingLeft: "52px" }}
                        >
                          <BookOpen
                            size={11}
                            style={{ color: "var(--text-muted)" }}
                          />
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            Last studied:{" "}
                            <span style={{ color: "var(--text-secondary)" }}>
                              {friend.lastSubject}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
