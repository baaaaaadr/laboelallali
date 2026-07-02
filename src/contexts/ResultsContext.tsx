'use client';

/**
 * Prefetches the patient's CyberLab results in the background as soon as they log
 * in (Aziz's idea): the slow ~10s fetch starts before they ever open /resultats, so
 * the page usually shows them instantly.
 *
 * Privacy: results (PDF base64) are held in memory ONLY — never persisted to
 * localStorage / IndexedDB / the service worker (the CyberLab bridge is no-store,
 * data is medical). They are cleared on logout / account switch.
 *
 * This does NOT reduce the total load (everything is still fetched at once); it only
 * moves it earlier. The real speed-up will come once the API can return "latest PDF
 * + list first, the rest on demand".
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { httpsCallable } from 'firebase/functions';
import { getClientFunctions } from '@/config/firebase';
import { useAuth } from './AuthContext';
import type { CyberlabResult, CyberlabResponse, ResultsStatus } from '@/types/cyberlab';

interface ResultsContextValue {
  results: CyberlabResult[];
  status: ResultsStatus;
  /** Load if we don't already have valid data for this user (used by the page on mount). */
  ensureLoaded: () => void;
  /** Force a fresh fetch (the "Actualiser" button). */
  refresh: () => void;
}

const ResultsContext = createContext<ResultsContextValue>({
  results: [],
  status: 'idle',
  ensureLoaded: () => {},
  refresh: () => {},
});

export const useResults = () => useContext(ResultsContext);

export function ResultsProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const [results, setResults] = useState<CyberlabResult[]>([]);
  const [status, setStatus] = useState<ResultsStatus>('idle');

  // Only set on a successful ready/empty fetch → lets us skip a redundant reload
  // while still retrying after an error / need_access.
  const loadedForUidRef = useRef<string | null>(null);
  const loadingRef = useRef(false); // reliable concurrent-call guard (state is async)
  const currentUidRef = useRef<string | null>(null); // the signed-in uid, for stale-timer guards
  const bgRetryRef = useRef(0); // background prefetch auto-retries used so far

  const load = useCallback(
    async (force: boolean) => {
      const current = user;
      if (!current) return;
      if (loadingRef.current) return;
      if (!force && loadedForUidRef.current === current.uid) return;

      loadingRef.current = true;
      setStatus('loading');
      try {
        const functions = await getClientFunctions();
        if (!functions) throw new Error('functions-unavailable');
        const call = httpsCallable<Record<string, never>, CyberlabResponse>(functions, 'fetchResults');
        const res = await call();
        const list = Array.isArray(res.data?.results) ? res.data.results : [];
        loadedForUidRef.current = current.uid;
        bgRetryRef.current = 0;
        setResults(list);
        setStatus(list.length ? 'ready' : 'empty');
      } catch (err: unknown) {
        const code = ((err as { code?: string })?.code || '').replace('functions/', '');
        if (code === 'not-found') {
          // Backend maps "no results" to not-found → treat as the empty state.
          loadedForUidRef.current = current.uid;
          bgRetryRef.current = 0;
          setResults([]);
          setStatus('empty');
        } else if (code === 'failed-precondition') {
          // No requester_id yet → the page offers the online-access request.
          setResults([]);
          setStatus('need_access');
        } else {
          setStatus('error');
          // At app launch the network is often not ready yet — self-heal a couple
          // of times so a cold-start blip doesn't leave the prefetch stuck.
          if (!force && bgRetryRef.current < 2) {
            bgRetryRef.current += 1;
            const uidAtCall = current.uid;
            setTimeout(() => {
              if (
                currentUidRef.current === uidAtCall &&
                loadedForUidRef.current !== uidAtCall &&
                !loadingRef.current
              ) {
                void load(false);
              }
            }, 4000 * bgRetryRef.current);
          }
        }
      } finally {
        loadingRef.current = false;
      }
    },
    [user]
  );

  // Reset everything on login / logout / account switch.
  useEffect(() => {
    const uid = user?.uid ?? null;
    if (currentUidRef.current !== uid) {
      currentUidRef.current = uid;
      loadedForUidRef.current = null;
      loadingRef.current = false;
      bgRetryRef.current = 0;
      setResults([]);
      setStatus('idle');
    }
  }, [user?.uid]);

  // Background prefetch — fires the moment the app has an authenticated user (any
  // screen, restored session included) AND they already have access (requester_id),
  // so results are usually ready before the patient opens /resultats. We keep the
  // requester_id gate so we never fire pointless calls for staff / not-yet-granted
  // users on every launch.
  useEffect(() => {
    if (user && userProfile?.requester_id && status === 'idle') {
      void load(false);
    }
  }, [user, userProfile?.requester_id, status, load]);

  const ensureLoaded = useCallback(() => void load(false), [load]);
  const refresh = useCallback(() => {
    bgRetryRef.current = 0;
    void load(true);
  }, [load]);

  const value = useMemo<ResultsContextValue>(
    () => ({ results, status, ensureLoaded, refresh }),
    [results, status, ensureLoaded, refresh]
  );

  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
}
