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
} from "@/lib/firestore";
import { getUserProfile, searchUserByTag } from "@/lib/firebase";
import { computeStreakData, getUserEntries } from "@/lib/firestore";
import {
  Users, UserPlus, Search, Check, X, Flame, BookOpen,
  Loader2, Clock, ExternalLink
} from "lucide-react";
import Link from "next/link";

interface FriendProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  friendTag: string;
  streak?: number;
  lastSubject?: string;
}

export default function FriendsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [searchTag, setSearchTag] = useState("");
  const [searchResult, setSearchResult] = useState<{ uid: string; displayName: string; photoURL: string; friendTag: string } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  const loadFriendsData = useCallback(async () => {
    if (!user) return;
    const [requests, friendUids] = await Promise.all([
      getIncomingRequests(user.uid),
      getFriends(user.uid),
    ]);
    setIncomingRequests(requests);

    // Load friend profiles + their streaks
    const profiles = await Promise.all(
      friendUids.map(async (uid) => {
        const p = await getUserProfile(uid) as { uid: string; displayName: string; photoURL: string; friendTag: string } | null;
        if (!p) return null;
        const entries = await getUserEntries(uid);
        const streak = computeStreakData(entries);
        const lastEntry = entries[0];
        return {
          uid: p.uid,
          displayName: p.displayName,
          photoURL: p.photoURL,
          friendTag: p.friendTag,
          streak: streak.current,
          lastSubject: lastEntry?.subject || "",
        } as FriendProfile;
      })
    );
    setFriends(profiles.filter(Boolean) as FriendProfile[]);
    setPageLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) loadFriendsData();
  }, [user, loadFriendsData]);

  const handleSearch = async () => {
    if (!searchTag.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);
    setSentSuccess(false);
    try {
      const result = await searchUserByTag(searchTag.trim());
      if (!result) {
        setSearchError("No user found with that tag. Check the spelling.");
      } else if (result.uid === user?.uid) {
        setSearchError("That's your own tag!");
      } else {
        setSearchResult(result as { uid: string; displayName: string; photoURL: string; friendTag: string });
      }
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult || !user || !profile) return;
    setSendingRequest(true);
    const result = await sendFriendRequest(user.uid, searchResult.uid, {
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      friendTag: profile.friendTag,
    });
    setSendingRequest(false);
    if (result.success) {
      setSentSuccess(true);
      setSearchResult(null);
      setSearchTag("");
    } else {
      setSearchError(result.error ?? "Failed to send request.");
    }
  };

  const handleRespond = async (req: FriendRequest, status: "accepted" | "declined") => {
    await respondToFriendRequest(req.id, status, req.fromUid, req.toUid);
    loadFriendsData();
  };

  if (authLoading || pageLoading) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <NavBar streak={0} user={profile} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <Loader2 size={32} style={{ color: "var(--violet-400)", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <NavBar streak={0} user={profile} />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1rem 6rem" }}>

        {/* Header */}
        <div className="animate-fade-up" style={{ marginBottom: "2rem" }}>
          <h1 className="font-display" style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.2rem)", marginBottom: "0.4rem" }}>
            <span className="text-gradient">Friends</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Your tag:{" "}
            <span
              className="font-mono"
              style={{
                color: "var(--violet-400)",
                background: "rgba(139,92,246,0.1)",
                border: "1px solid var(--border-soft)",
                padding: "0.15rem 0.6rem",
                borderRadius: "var(--r-sm)",
                fontSize: "0.85rem",
              }}
            >
              {profile?.friendTag}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", display: "inline-block", marginTop: "0.25rem", marginLeft: "0.5rem" }}>
              Share this with friends so they can add you
            </span>
          </p>
        </div>

        <div className="friends-grid">

          {/* LEFT — Search + Add */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Add Friend */}
            <div className="card animate-fade-up" style={{ padding: "1.5rem" }}>
              <div className="flex items-center gap-2 mb-4">
                <UserPlus size={16} style={{ color: "var(--violet-400)" }} />
                <h3 className="font-display" style={{ fontWeight: 700, fontSize: "1rem" }}>Add a Friend</h3>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  id="input-friend-tag"
                  className="input-field"
                  style={{ fontSize: "0.88rem", padding: "0.65rem 0.9rem" }}
                  placeholder="#pathly-username"
                  value={searchTag}
                  onChange={(e) => setSearchTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button
                  id="btn-search-friend"
                  className="btn btn-primary btn-sm"
                  onClick={handleSearch}
                  disabled={searchLoading}
                  style={{ flexShrink: 0 }}
                >
                  {searchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
              </div>

              {searchError && (
                <p style={{ color: "var(--rose-400)", fontSize: "0.8rem", padding: "0.5rem 0.75rem", background: "rgba(239,68,68,0.08)", borderRadius: "var(--r-md)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  {searchError}
                </p>
              )}

              {sentSuccess && (
                <p style={{ color: "var(--emerald-400)", fontSize: "0.8rem", padding: "0.5rem 0.75rem", background: "rgba(16,185,129,0.08)", borderRadius: "var(--r-md)", border: "1px solid rgba(16,185,129,0.2)" }}>
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
                    <img src={searchResult.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--grad-brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700 }}>
                      {searchResult.displayName?.[0]}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{searchResult.displayName}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{searchResult.friendTag}</p>
                  </div>
                  <button
                    id="btn-send-friend-request"
                    className="btn btn-primary btn-sm"
                    onClick={handleSendRequest}
                    disabled={sendingRequest}
                  >
                    {sendingRequest ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                    {sendingRequest ? "Sending..." : "Add"}
                  </button>
                </div>
              )}
            </div>

            {/* Incoming Requests */}
            {incomingRequests.length > 0 && (
              <div className="card animate-fade-up stagger-2" style={{ padding: "1.5rem" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={15} style={{ color: "var(--amber-400)" }} />
                  <h3 className="font-display" style={{ fontWeight: 700, fontSize: "0.95rem" }}>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {incomingRequests.map((req) => (
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
                        <img src={req.fromPhotoURL} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--grad-brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "0.8rem" }}>
                          {req.fromDisplayName?.[0]}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.fromDisplayName}</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{req.fromFriendTag}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          id={`btn-accept-${req.id}`}
                          onClick={() => handleRespond(req, "accepted")}
                          style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--emerald-400)" }}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          id={`btn-decline-${req.id}`}
                          onClick={() => handleRespond(req, "declined")}
                          style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--rose-400)" }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Friends List */}
          <div className="animate-fade-up stagger-1">
            <div className="flex items-center gap-2 mb-3">
              <Users size={15} style={{ color: "var(--violet-400)" }} />
              <h3 className="font-display" style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-secondary)" }}>
                Your Buddies ({friends.length})
              </h3>
            </div>

            {friends.length === 0 ? (
              <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>👥</div>
                <p className="font-display" style={{ fontWeight: 600, fontSize: "0.92rem", marginBottom: "0.35rem" }}>No friends yet</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Share your tag <span style={{ color: "var(--violet-400)" }}>{profile?.friendTag}</span> or search for a friend above
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {friends.map((friend, i) => (
                  <div
                    key={friend.uid}
                    className={`card animate-fade-up stagger-${Math.min(i + 1, 5)}`}
                    style={{ padding: "1rem 1.25rem" }}
                  >
                    <div className="flex items-center gap-3">
                      {friend.photoURL ? (
                        <img src={friend.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--grad-brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, flexShrink: 0 }}>
                          {friend.displayName?.[0]}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{friend.displayName}</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{friend.friendTag}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(friend.streak ?? 0) > 0 && (
                          <div className="streak-badge" style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}>
                            <Flame size={12} className="streak-flame" />
                            {friend.streak}
                          </div>
                        )}
                        <Link
                          href={`/u/${encodeURIComponent(friend.friendTag.replace("#", ""))}`}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "0.3rem 0.6rem", borderRadius: "var(--r-md)" }}
                          id={`btn-view-profile-${friend.uid}`}
                        >
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    </div>
                    {friend.lastSubject && (
                      <div className="flex items-center gap-1.5 mt-2" style={{ paddingLeft: "52px" }}>
                        <BookOpen size={11} style={{ color: "var(--text-muted)" }} />
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Last studied: <span style={{ color: "var(--text-secondary)" }}>{friend.lastSubject}</span>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
