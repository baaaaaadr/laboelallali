'use client';

/**
 * Prefetches the patient's CyberLab results the moment they log in, then loads
 * PDFs progressively so the page feels instant:
 *
 *   1. Fetch the LIST only (`include_pdf: "none"`) — tiny + fast (~0.2s). The page
 *      can render every dossier immediately.
 *   2. Auto-fetch the MOST RECENT dossier's PDF (`dossier_id`) in the background,
 *      with a per-card loading animation.
 *   3. Every other PDF is fetched on demand (one call per dossier) when the patient
 *      taps "Voir" / "Télécharger".
 *
 * Privacy: PDF base64 is held in memory ONLY — never persisted to localStorage /
 * IndexedDB / the service worker (medical data, the bridge is no-store). Everything
 * is cleared on logout / account switch.
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
import type {
  CyberlabResult,
  CyberlabResponse,
  IncludePdf,
  PdfState,
  ResultsStatus,
} from '@/types/cyberlab';

type FetchArgs = { include_pdf?: IncludePdf; dossier_id?: string };

const IDLE_PDF: PdfState = { status: 'idle' };

interface ResultsContextValue {
  results: CyberlabResult[];
  status: ResultsStatus;
  /** PDF fetch state per dossier id (defaults to idle when absent). */
  pdfState: (dossierId: string) => PdfState;
  /** Fetch one dossier's PDF on demand (idempotent, de-duped). Resolves to the final state. */
  loadPdf: (dossierId: string) => Promise<PdfState>;
  /** Most recent dossier (by date_dossier) — auto-loaded first. */
  newestDossierId: string | null;
  /** Load if we don't already have valid data for this user (used by the page on mount). */
  ensureLoaded: () => void;
  /** Force a fresh fetch (the "Actualiser" button). */
  refresh: () => void;
}

const ResultsContext = createContext<ResultsContextValue>({
  results: [],
  status: 'idle',
  pdfState: () => IDLE_PDF,
  loadPdf: async () => IDLE_PDF,
  newestDossierId: null,
  ensureLoaded: () => {},
  refresh: () => {},
});

export const useResults = () => useContext(ResultsContext);

function newestOf(list: CyberlabResult[]): string | null {
  if (!list.length) return null;
  return list.reduce((m, x) => (!m || x.date_dossier > m.date_dossier ? x : m), list[0]).dossier_id;
}

export function ResultsProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const [results, setResults] = useState<CyberlabResult[]>([]);
  const [status, setStatus] = useState<ResultsStatus>('idle');
  const [pdfById, setPdfById] = useState<Record<string, PdfState>>({});

  // Only set on a successful ready/empty fetch → lets us skip a redundant reload
  // while still retrying after an error / need_access.
  const loadedForUidRef = useRef<string | null>(null);
  const loadingRef = useRef(false); // reliable concurrent-call guard (state is async)
  const currentUidRef = useRef<string | null>(null); // the signed-in uid, for stale-timer guards
  const bgRetryRef = useRef(0); // background prefetch auto-retries used so far

  // Source-of-truth mirror for PDF state (state is async; loadPdf reads this).
  const pdfByIdRef = useRef<Record<string, PdfState>>({});
  const pdfPromisesRef = useRef<Record<string, Promise<PdfState>>>({});

  const setPdfState = useCallback((id: string, st: PdfState) => {
    setPdfById((prev) => {
      const next = { ...prev, [id]: st };
      pdfByIdRef.current = next;
      return next;
    });
  }, []);

  const resetPdfs = useCallback(() => {
    pdfByIdRef.current = {};
    pdfPromisesRef.current = {};
    setPdfById({});
  }, []);

  const callFetch = useCallback(async (args: FetchArgs): Promise<CyberlabResponse> => {
    const functions = await getClientFunctions();
    if (!functions) throw new Error('functions-unavailable');
    const call = httpsCallable<FetchArgs, CyberlabResponse>(functions, 'fetchResults');
    return (await call(args)).data;
  }, []);

  /** Fetch a single dossier's PDF on demand (de-duped per id). */
  const loadPdf = useCallback(
    (dossierId: string): Promise<PdfState> => {
      const existing = pdfByIdRef.current[dossierId];
      if (existing?.status === 'ready') return Promise.resolve(existing);
      const inflight = pdfPromisesRef.current[dossierId];
      if (inflight) return inflight;

      const p = (async (): Promise<PdfState> => {
        setPdfState(dossierId, { status: 'loading' });
        try {
          const data = await callFetch({ dossier_id: dossierId });
          // Match by id (the new API returns just this dossier; be defensive in
          // case a build still returns the full list).
          const match = data?.results?.find((x) => x.dossier_id === dossierId) ?? data?.results?.[0];
          const base64 = match?.pdf_base64 || '';
          const next: PdfState = base64 ? { status: 'ready', base64 } : { status: 'error' };
          setPdfState(dossierId, next);
          return next;
        } catch {
          const next: PdfState = { status: 'error' };
          setPdfState(dossierId, next);
          return next;
        } finally {
          delete pdfPromisesRef.current[dossierId];
        }
      })();

      pdfPromisesRef.current[dossierId] = p;
      return p;
    },
    [callFetch, setPdfState]
  );

  const load = useCallback(
    async (force: boolean) => {
      const current = user;
      if (!current) return;
      if (loadingRef.current) return;
      if (!force && loadedForUidRef.current === current.uid) return;

      loadingRef.current = true;
      setStatus('loading');
      resetPdfs();
      try {
        // Phase 1 — list only (fast, no PDFs embedded).
        const data = await callFetch({ include_pdf: 'none' });
        const list = Array.isArray(data?.results) ? data.results : [];
        loadedForUidRef.current = current.uid;
        bgRetryRef.current = 0;
        setResults(list);
        setStatus(list.length ? 'ready' : 'empty');

        // Phase 2 — auto-load the most recent dossier's PDF in the background.
        const newest = newestOf(list);
        if (newest) void loadPdf(newest);
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
    [user, callFetch, loadPdf, resetPdfs]
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
      resetPdfs();
    }
  }, [user?.uid, resetPdfs]);

  // Background prefetch — fires the moment the app has an authenticated user (any
  // screen, restored session included) AND they already have access (requester_id),
  // so the list + newest PDF are usually ready before the patient opens /resultats.
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

  const pdfState = useCallback((dossierId: string): PdfState => pdfById[dossierId] ?? IDLE_PDF, [pdfById]);
  const newestDossierId = useMemo(() => newestOf(results), [results]);

  const value = useMemo<ResultsContextValue>(
    () => ({ results, status, pdfState, loadPdf, newestDossierId, ensureLoaded, refresh }),
    [results, status, pdfState, loadPdf, newestDossierId, ensureLoaded, refresh]
  );

  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
}
