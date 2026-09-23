"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, cleanUsername, ensureUserProfile, getUserProfile, signOut } from "@/lib/firebase";

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  username?: string;
  friendTag: string;
  isPublic: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (auth.currentUser) {
      try {
        const p = await getUserProfile(auth.currentUser.uid);
        if (p) setProfile(p as UserProfile);
      } catch (err) {
        console.warn("Failed to refresh user profile:", err);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: loading must never hang forever regardless of network or storage state
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 2500);

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!isMounted) return;
        setUser(firebaseUser);

        if (firebaseUser) {
          // Immediately provide baseline profile so UI hydrates instantly
          const defaultName = firebaseUser.displayName || "User";
          const defaultTag = cleanUsername(defaultName.split(/\s+/)[0] || "user") || "user";
          const baselineProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: defaultName,
            email: firebaseUser.email || "",
            photoURL: firebaseUser.photoURL || "",
            username: defaultTag,
            friendTag: defaultTag,
            isPublic: true,
            createdAt: new Date().toISOString(),
          };
          setProfile(baselineProfile);

          // Asynchronously ensure profile exists and sync with Firestore in background
          try {
            await ensureUserProfile(firebaseUser);
            const p = await getUserProfile(firebaseUser.uid);
            if (p && isMounted) {
              setProfile(p as UserProfile);
            }
          } catch (profileErr) {
            console.warn("Could not sync profile with Firestore:", profileErr);
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Error in onAuthStateChanged handler:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          clearTimeout(timeoutId);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      unsub();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  return useContext(AuthContext);
}
