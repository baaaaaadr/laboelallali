/**
 * Doublure de `@/contexts/AuthContext` pour les bancs « résultats » et
 * « médecin » (`scripts/test-results-ui.js`, `scripts/test-practitioner-ui.js`).
 *
 * Deux différences avec `stub-auth.tsx` (bancs du parcours), qui reste inchangé :
 *
 * 1. Le profil est COMPLET (`requester_id`, `type`, `linkedRequesters`,
 *    `practitioner`, `role`…) et MODIFIABLE en cours d'essai via
 *    `window.__setAuth(profil | null)` — c'est ce qui permet de rejouer un
 *    changement de compte, une déconnexion, ou un accès posé par l'admin.
 *
 * 2. Les références sont STABLES d'un rendu à l'autre, comme dans le vrai
 *    contexte : `user` et `userProfile` ne changent que lorsqu'on appelle
 *    `__setAuth`. Une doublure qui recréerait `user` à chaque rendu relancerait
 *    tous les effets qui en dépendent et inventerait des boucles d'appels qui
 *    n'existent pas en production — or ce banc COMPTE les appels.
 */
import React, { useSyncExternalStore } from 'react';

type StubProfile = Record<string, unknown> & { uid: string };

interface StubUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthState {
  user: StubUser | null;
  userProfile: StubProfile | null;
  loading: boolean;
}

interface AuthWindow {
  __setAuth?: (profile: StubProfile | null) => void;
  /** Profil à appliquer au prochain `refreshProfile()` (accès posé par l'admin). */
  __profileOnRefresh?: StubProfile | null;
  __refreshCount?: number;
  __logoutCount?: number;
}

const w = globalThis as unknown as AuthWindow;
w.__refreshCount = 0;
w.__logoutCount = 0;

let state: AuthState = { user: null, userProfile: null, loading: true };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function stateFor(profile: StubProfile | null): AuthState {
  if (!profile) return { user: null, userProfile: null, loading: false };
  return {
    user: {
      uid: profile.uid,
      email: typeof profile.email === 'string' ? profile.email : null,
      displayName: typeof profile.fullName === 'string' ? profile.fullName : null,
    },
    userProfile: profile,
    loading: false,
  };
}

w.__setAuth = (profile) => {
  state = stateFor(profile);
  emit();
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

async function refreshProfile() {
  w.__refreshCount = (w.__refreshCount ?? 0) + 1;
  if (w.__profileOnRefresh !== undefined) {
    const next = w.__profileOnRefresh;
    w.__profileOnRefresh = undefined;
    w.__setAuth?.(next);
  }
}

async function logout() {
  w.__logoutCount = (w.__logoutCount ?? 0) + 1;
  w.__setAuth?.(null);
}

export function useAuth() {
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  return {
    user: s.user,
    userProfile: s.userProfile,
    loading: s.loading,
    refreshProfile,
    logout,
    signOut: logout,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
