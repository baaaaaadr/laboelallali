/** Doublure de `@/contexts/AuthContext` : un patient connecté au profil complet. */
import React from 'react';

export interface StubProfile {
  uid: string;
  fullName: string;
  phone: string;
  email: string;
}

/** Modifiable depuis le pilote via `window.__profile` avant le montage. */
function profile(): StubProfile {
  const w = globalThis as unknown as { __profile?: Partial<StubProfile> };
  return {
    uid: 'uid-banc-essai',
    fullName: 'Fatima Zahra Benali',
    phone: '0612345678',
    email: 'fatima.benali@example.com',
    ...(w.__profile || {}),
  };
}

export function useAuth() {
  const p = profile();
  return {
    user: { uid: p.uid, email: p.email, displayName: p.fullName },
    userProfile: { uid: p.uid, fullName: p.fullName, phone: p.phone, email: p.email },
    loading: false,
    signOut: async () => undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
