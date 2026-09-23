"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, getClientAuth } from '@/config/firebase';
import type { LinkedRequester, PractitionerAccess, RequesterType } from '@/types/cyberlab';

export interface UserProfile {
  uid: string;
  fullName: string;
  dateOfBirth: string;
  email: string | null;
  createdAt: string;
  phone?: string;
  // Set by the admin space (adminSetRequester) — the CyberLab identity.
  requester_id?: string;
  type?: RequesterType;
  // Relatives' dossiers the lab attached to this account (ayant droit). Written
  // only by adminLinkRequester/adminUnlinkRequester, locked in firestore.rules.
  // Read through src/lib/results/identities.ts, never field by field.
  linkedRequesters?: LinkedRequester[];
  // The same ids, flattened — lets the lab answer "who else reads this dossier?"
  // with an indexed query instead of a full scan.
  linkedRequesterIds?: string[];
  // A prescribing doctor's access (« Mes patients »). Written only by
  // adminSetPractitioner, locked in firestore.rules. Read through
  // readPractitioner() — it is NEVER one of the patient identities above.
  practitioner?: PractitionerAccess;
  // 'admin' grants access to the /admin staff space.
  role?: string;
  // CNDP consent captured at registration.
  consentAccepted?: boolean;
  consentAcceptedAt?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  logout: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    if (!db) return null;
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  };

  // Who owns the session right now — read after an await, to drop a stale answer.
  const sessionUidRef = useRef<string | null>(null);

  /**
   * Re-read the profile, e.g. after the lab activated an access while the page
   * was open (the doctor's « Vérifier à nouveau »). The profile is a one-shot
   * read, not a live listener, so this is the only way such a change shows up
   * without a reload.
   *
   * ⚠ Two guards (23/09/2026):
   *  - a TRANSIENT read error keeps the current profile. Replacing it with null
   *    (what `fetchProfile` returns on error) made every consumer believe the
   *    account had no profile at all — the profile-completion form, the
   *    activation card — because of one flaky request;
   *  - an answer that lands after the session changed (shared family phone,
   *    One Tap sign-in in place) is dropped instead of writing account A's
   *    profile into account B's session.
   */
  const refreshProfile = async () => {
    if (!user || !db) return;
    const uid = user.uid;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (sessionUidRef.current !== uid) return;
      setUserProfile(snap.exists() ? (snap.data() as UserProfile) : null);
    } catch (error) {
      console.error('Error refreshing user profile:', error);
    }
  };

  useEffect(() => {
    let unsubscribe: () => void;

    const initAuth = async () => {
      const auth = await getClientAuth();
      if (!auth) {
        setLoading(false);
        return;
      }

      unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
        sessionUidRef.current = currentUser?.uid ?? null;
        setUser(currentUser);
        if (currentUser) {
          const profile = await fetchProfile(currentUser.uid);
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }
        setLoading(false);
      });
    };

    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const logout = async () => {
    const auth = await getClientAuth();
    if (auth) {
      await auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
