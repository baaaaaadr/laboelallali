"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, getClientAuth } from '@/config/firebase';

export interface UserProfile {
  uid: string;
  fullName: string;
  dateOfBirth: string;
  email: string | null;
  createdAt: string;
  phone?: string;
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

  const refreshProfile = async () => {
    if (user) {
      const profile = await fetchProfile(user.uid);
      setUserProfile(profile);
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
