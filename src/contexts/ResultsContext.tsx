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
 *
 * ── Multiple identities ("ayant droit") ─────────────────────────────────────
 * An account can now consult several lab dossiers: its own, plus relatives' the
 * lab attached to it. Results are therefore stored per BUCKET, keyed
 * `${uid}::${requesterId}`, and two hooks read them:
 *
 *   useResults()              → the PRIMARY identity. Signature unchanged, so the
 *                               home hero, CheckupReminder and ShareAccessCard are
 *                               untouched — and can never accidentally show a
 *                               relative's bilan under "VOTRE dernier bilan".
 *   useResultsFor(requesterId)→ one specific identity. Used by /resultats only.
 *
 * The SELECTION lives in the page, not here: a selection held in this provider
 * would leak to the home page, and on a shared family phone "I was looking at
 * Dad's results" is a risk to forget, not a convenience to remember.
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
import { primaryIdentity } from '@/lib/results/identities';
import type {
  CyberlabResult,
  CyberlabResponse,
  IncludePdf,
  PdfState,
  ResultsStatus,
} from '@/types/cyberlab';

type FetchArgs = { include_pdf?: IncludePdf; dossier_id?: string; requester_id?: string };

const IDLE_PDF: PdfState = { status: 'idle' };

/** Everything known about one identity's results. */
interface Bucket {
  results: CyberlabResult[];
  status: ResultsStatus;
  errorCode: string | null;
  lastUpdated: number | null;
}

const EMPTY_BUCKET: Bucket = {
  results: [],
  status: 'idle',
  errorCode: null,
  lastUpdated: null,
};

/**
 * `${uid}::${requesterId}`.
 *
 * The uid is in the KEY, not just in the race guards. Belt and braces: even if
 * the session check below ever slipped, a late response from account A would land
 * in a bucket nobody is reading rather than in account B's screen.
 */
type BucketKey = string;
const bucketKey = (uid: string, requesterId: string): BucketKey => `${uid}::${requesterId}`;

/**
 * `${requesterId}::${dossierId}`.
 *
 * Dossier numbering belongs to the lab; we do not get to assume it is globally
 * unique. And even if it were today, the failure mode would be showing patient
 * A's medical PDF under patient B's card — so the cache is keyed defensively.
 * Same reasoning as the id-only match in `loadPdf` (never fall back to results[0]).
 */
const pdfKey = (requesterId: string, dossierId: string): string => `${requesterId}::${dossierId}`;

/** What both hooks expose. Identical to the pre-multi-identity contract. */
interface ResultsView {
  results: CyberlabResult[];
  status: ResultsStatus;
  /**
   * Cleaned HttpsError code of the last list failure ('resource-exhausted',
   * 'unavailable', 'permission-denied', 'internal', …) — only meaningful while
   * status === 'error'; null otherwise.
   */
  errorCode: string | null;
  /** Epoch ms of the last successful list load (null until the first success). */
  lastUpdated: number | null;
  /** PDF fetch state per dossier id (defaults to idle when absent). */
  pdfState: (dossierId: string) => PdfState;
  /** Fetch one dossier's PDF on demand (idempotent, de-duped). */
  loadPdf: (dossierId: string) => Promise<PdfState>;
  /** Most recent dossier (by date_dossier) — auto-loaded first. */
  newestDossierId: string | null;
  /** Load if we don't already have valid data for this identity. */
  ensureLoaded: () => void;
  /** Force a fresh fetch (the "Actualiser" button). */
  refresh: () => void;
}

interface ResultsContextValue {
  /** The identity the home page and the default tab show. null = no access. */
  primaryRequesterId: string | null;
  getBucket: (requesterId: string | null) => Bucket;
  pdfStateFor: (requesterId: string | null, dossierId: string) => PdfState;
  loadPdfFor: (requesterId: string | null, dossierId: string) => Promise<PdfState>;
  ensureLoadedFor: (requesterId: string | null) => void;
  refreshFor: (requesterId: string | null) => void;
}

const ResultsContext = createContext<ResultsContextValue>({
  primaryRequesterId: null,
  getBucket: () => EMPTY_BUCKET,
  pdfStateFor: () => IDLE_PDF,
  loadPdfFor: async () => IDLE_PDF,
  ensureLoadedFor: () => {},
  refreshFor: () => {},
});

function newestOf(list: CyberlabResult[]): string | null {
  if (!list.length) return null;
  return list.reduce((m, x) => (!m || x.date_dossier > m.date_dossier ? x : m), list[0]).dossier_id;
}

/** Turn the raw context into the stable per-identity view both hooks return. */
function useView(requesterId: string | null): ResultsView {
  const ctx = useContext(ResultsContext);
  const bucket = ctx.getBucket(requesterId);

  const pdfState = useCallback(
    (dossierId: string) => ctx.pdfStateFor(requesterId, dossierId),
    [ctx, requesterId]
  );
  const loadPdf = useCallback(
    (dossierId: string) => ctx.loadPdfFor(requesterId, dossierId),
    [ctx, requesterId]
  );
  const ensureLoaded = useCallback(() => ctx.ensureLoadedFor(requesterId), [ctx, requesterId]);
  const refresh = useCallback(() => ctx.refreshFor(requesterId), [ctx, requesterId]);
  const newestDossierId = useMemo(() => newestOf(bucket.results), [bucket.results]);

  return {
    results: bucket.results,
    status: bucket.status,
    errorCode: bucket.errorCode,
    lastUpdated: bucket.lastUpdated,
    pdfState,
    loadPdf,
    newestDossierId,
    ensureLoaded,
    refresh,
  };
}

/**
 * The PRIMARY identity's results — the account holder's own dossier, or, for an
 * account that has none of its own, the first relative attached to it.
 *
 * Signature unchanged from the single-identity version, so every existing
 * consumer keeps working untouched.
 */
export const useResults = (): ResultsView => useView(null);

/** One specific identity's results. `null` means the primary one. */
export const useResultsFor = (requesterId: string | null): ResultsView => useView(requesterId);

/** The identity the home page shows. Lets a page label it without recomputing. */
export const usePrimaryRequesterId = (): string | null =>
  useContext(ResultsContext).primaryRequesterId;

export function ResultsProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const [buckets, setBuckets] = useState<Record<BucketKey, Bucket>>({});
  const [pdfById, setPdfById] = useState<Record<string, PdfState>>({});

  // The identity the home page reads and /resultats defaults to. Recomputed from
  // the profile, so attaching or revoking a relative is reflected on the next
  // profile refresh without any extra plumbing.
  const primaryRequesterId = useMemo(
    () => primaryIdentity(userProfile, '')?.requester_id ?? null,
    [userProfile]
  );

  // Buckets that reached a DEFINITIVE answer (ready / empty / unknown_id).
  const loadedRef = useRef<Set<BucketKey>>(new Set());
  // Buckets with a list fetch in flight. A Set, not a boolean: two identities may
  // legitimately load at once (primary prefetch + an immediate switch), and a
  // boolean would silently drop one of them.
  const loadingRef = useRef<Set<BucketKey>>(new Set());
  // The signed-in uid. Deliberately uid-only: this tracks who owns the SESSION,
  // which is the whole point of the guard explained on `load` below. The identity
  // lives in the bucket key instead.
  const currentUidRef = useRef<string | null>(null);
  // Background auto-retries, per bucket.
  const bgRetryRef = useRef<Record<BucketKey, number>>({});

  // Source-of-truth mirror for PDF state (state is async; loadPdf reads this).
  const pdfByIdRef = useRef<Record<string, PdfState>>({});
  const pdfPromisesRef = useRef<Record<string, Promise<PdfState>>>({});
  // Mirror of `buckets`, for the same reason.
  const bucketsRef = useRef<Record<BucketKey, Bucket>>({});

  const patchBucket = useCallback((key: BucketKey, patch: Partial<Bucket>) => {
    setBuckets((prev) => {
      const next = { ...prev, [key]: { ...(prev[key] ?? EMPTY_BUCKET), ...patch } };
      bucketsRef.current = next;
      return next;
    });
  }, []);

  const setPdfState = useCallback((key: string, st: PdfState) => {
    setPdfById((prev) => {
      const next = { ...prev, [key]: st };
      pdfByIdRef.current = next;
      return next;
    });
  }, []);

  /** Drop every PDF belonging to one identity (on reload of its list). */
  const resetPdfsFor = useCallback((requesterId: string) => {
    const prefix = `${requesterId}::`;
    const nextState: Record<string, PdfState> = {};
    for (const [k, v] of Object.entries(pdfByIdRef.current)) {
      if (!k.startsWith(prefix)) nextState[k] = v;
    }
    for (const k of Object.keys(pdfPromisesRef.current)) {
      if (k.startsWith(prefix)) delete pdfPromisesRef.current[k];
    }
    pdfByIdRef.current = nextState;
    setPdfById(nextState);
  }, []);

  const callFetch = useCallback(async (args: FetchArgs): Promise<CyberlabResponse> => {
    const functions = await getClientFunctions();
    if (!functions) throw new Error('functions-unavailable');
    const call = httpsCallable<FetchArgs, CyberlabResponse>(functions, 'fetchResults');
    return (await call(args)).data;
  }, []);

  /**
   * Resolve a possibly-null identity to a concrete requester id.
   * `null` means "the primary one", which is what every legacy consumer wants.
   */
  const resolve = useCallback(
    (requesterId: string | null): string | null => requesterId ?? primaryRequesterId,
    [primaryRequesterId]
  );

  /**
   * Build the call arguments for an identity.
   *
   * The PRIMARY identity sends NO `requester_id`: the server resolves it from the
   * profile, which keeps today's exact behaviour and stays correct even if the
   * client's cached profile is stale (staff can change an id at the counter).
   * A non-primary identity MUST send it — otherwise the server would answer with
   * the primary dossier and we would render someone else's PDF under this card.
   */
  const argsFor = useCallback(
    (requesterId: string, base: FetchArgs): FetchArgs =>
      requesterId === primaryRequesterId ? base : { ...base, requester_id: requesterId },
    [primaryRequesterId]
  );

  /** Fetch a single dossier's PDF on demand (de-duped per identity + dossier). */
  const loadPdfFor = useCallback(
    (requesterIdOrNull: string | null, dossierId: string): Promise<PdfState> => {
      const requesterId = resolve(requesterIdOrNull);
      if (!requesterId) return Promise.resolve(IDLE_PDF);
      const key = pdfKey(requesterId, dossierId);

      const existing = pdfByIdRef.current[key];
      if (existing?.status === 'ready') return Promise.resolve(existing);
      const inflight = pdfPromisesRef.current[key];
      if (inflight) return inflight;

      // Whose session asked for this. Everything committed after the await is
      // checked against it — see the block comment on `load`.
      const uidAtCall = currentUidRef.current;

      const p = (async (): Promise<PdfState> => {
        setPdfState(key, { status: 'loading' });
        try {
          const data = await callFetch(argsFor(requesterId, { dossier_id: dossierId }));
          if (currentUidRef.current !== uidAtCall) return IDLE_PDF;
          // Match by id ONLY. The server returns just this dossier, but if a build
          // ever ignored `dossier_id` and answered with the full list, falling back
          // to results[0] would show the patient ANOTHER dossier's PDF under this
          // card's date — on a medical document, showing nothing beats showing the
          // wrong one.
          const match = data?.results?.find((x) => x.dossier_id === dossierId);
          const base64 = match?.pdf_base64 || '';
          // The call SUCCEEDED but the lab server sent no PDF bytes → 'unavailable'
          // (not 'error'): the document isn't attached in CyberLab yet, which the
          // card surfaces with a calmer message than a hard failure.
          const next: PdfState = base64 ? { status: 'ready', base64 } : { status: 'unavailable' };
          setPdfState(key, next);
          return next;
        } catch {
          if (currentUidRef.current !== uidAtCall) return IDLE_PDF;
          const next: PdfState = { status: 'error' };
          setPdfState(key, next);
          return next;
        } finally {
          // ⚠ The COMPOSITE key, not the bare dossier id: otherwise an in-flight
          // promise for identity A would be deleted by identity B's completion,
          // and a duplicate call would go out. Invisible in testing.
          delete pdfPromisesRef.current[key];
        }
      })();

      pdfPromisesRef.current[key] = p;
      return p;
    },
    [argsFor, callFetch, resolve, setPdfState]
  );

  const load = useCallback(
    async (requesterIdOrNull: string | null, force: boolean) => {
      const current = user;
      if (!current) return;
      const requesterId = resolve(requesterIdOrNull);
      if (!requesterId) return;

      const key = bucketKey(current.uid, requesterId);
      if (loadingRef.current.has(key)) return;
      if (!force && loadedRef.current.has(key)) return;

      // ⚠ WHOSE session this load belongs to. Every commit below happens AFTER an
      // await, and this provider lives in the ROOT layout: it survives logout and
      // a One Tap sign-in happens in place, with no reload. So on a shared family
      // phone — the documented normal case for this lab — patient A's slow
      // in-flight call (the lab server has a 20s timeout and is down often enough
      // to justify a monitoring subsystem) could land AFTER patient B signed in,
      // and write A's dossiers into B's context with status 'ready'. Nothing
      // recomputed it afterwards: the prefetch effect only fires on 'idle'.
      // The error branches matter just as much — a stale 'need_access' would lock
      // B out of their own results.
      //
      // The identity is carried by `key`, so a late response also cannot land in
      // the wrong TAB of the right account.
      const uidAtCall = current.uid;

      loadingRef.current.add(key);
      patchBucket(key, { status: 'loading', errorCode: null });
      resetPdfsFor(requesterId);
      try {
        // Phase 1 — list only (fast, no PDFs embedded).
        const data = await callFetch(argsFor(requesterId, { include_pdf: 'none' }));
        if (currentUidRef.current !== uidAtCall) return;
        const list = Array.isArray(data?.results) ? data.results : [];
        loadedRef.current.add(key);
        bgRetryRef.current[key] = 0;
        patchBucket(key, {
          results: list,
          status: list.length ? 'ready' : 'empty',
          lastUpdated: Date.now(),
        });

        // Phase 2 — auto-load the most recent dossier's PDF in the background.
        const newest = newestOf(list);
        if (newest) void loadPdfFor(requesterId, newest);
      } catch (err: unknown) {
        const code = ((err as { code?: string })?.code || '').replace('functions/', '');
        if (currentUidRef.current !== uidAtCall) return;
        if (code === 'not-found') {
          // The lab server answered 404 requester_not_found: the id on the profile
          // is unknown lab-side (account never created/published in CyberLab, or a
          // wrong number). A DEFINITIVE answer, not a failure — same dedupe/no-retry
          // handling as a success, but its own status so the page can explain it
          // instead of showing the misleading "no results yet" screen.
          // (A valid id with no dossier comes back as 200 + empty list → 'empty'.)
          loadedRef.current.add(key);
          bgRetryRef.current[key] = 0;
          patchBucket(key, { results: [], status: 'unknown_id', lastUpdated: Date.now() });
        } else if (code === 'failed-precondition') {
          // No identity at all → the page offers the online-access request.
          patchBucket(key, { results: [], status: 'need_access' });
        } else if (code === 'permission-denied') {
          // This dossier is not (or no longer) attached to the account — the lab
          // revoked the link while the tab was open. Definitive: never retry, and
          // drop anything already held for it. /resultats reacts by dropping the
          // identity from its list and falling back to the primary one.
          loadedRef.current.add(key);
          resetPdfsFor(requesterId);
          patchBucket(key, {
            results: [],
            status: 'error',
            errorCode: 'permission-denied',
            lastUpdated: Date.now(),
          });
        } else {
          patchBucket(key, { status: 'error', errorCode: code || null });
          // At app launch the network is often not ready yet — self-heal a couple
          // of times so a cold-start blip doesn't leave the prefetch stuck. ONLY
          // for the primary identity: three tabs each retrying three doomed calls
          // at cold start would triple the load on a lab server that is already
          // fragile enough to justify a monitoring subsystem.
          const retries = bgRetryRef.current[key] ?? 0;
          if (!force && requesterId === primaryRequesterId && retries < 2) {
            bgRetryRef.current[key] = retries + 1;
            setTimeout(() => {
              if (
                currentUidRef.current === uidAtCall &&
                !loadedRef.current.has(key) &&
                !loadingRef.current.has(key)
              ) {
                void load(requesterIdOrNull, false);
              }
            }, 4000 * (retries + 1));
          }
        }
      } finally {
        // Release only if this load still owns the session. A late load from the
        // previous account must not clear the guard while the new account's load
        // is in flight — that would let a third concurrent load start.
        if (currentUidRef.current === uidAtCall) loadingRef.current.delete(key);
      }
    },
    [user, callFetch, argsFor, loadPdfFor, patchBucket, primaryRequesterId, resetPdfsFor, resolve]
  );

  // Reset everything on login / logout / account switch.
  useEffect(() => {
    const uid = user?.uid ?? null;
    if (currentUidRef.current !== uid) {
      currentUidRef.current = uid;
      loadedRef.current = new Set();
      loadingRef.current = new Set();
      bgRetryRef.current = {};
      bucketsRef.current = {};
      pdfByIdRef.current = {};
      pdfPromisesRef.current = {};
      setBuckets({});
      setPdfById({});
    }
  }, [user?.uid]);

  // Background prefetch — fires the moment the app has an authenticated user (any
  // screen, restored session included) AND the account has access, so the list +
  // newest PDF are usually ready before the patient opens /resultats.
  //
  // ONLY the primary identity is prefetched. A relative's dossier loads lazily on
  // first selection (~0.2s of loader), which is honest: prefetching three
  // identities on every app launch would triple the calls for a tab most patients
  // never open.
  const primaryStatus = primaryRequesterId
    ? (buckets[bucketKey(user?.uid ?? '', primaryRequesterId)] ?? EMPTY_BUCKET).status
    : 'idle';
  useEffect(() => {
    if (user && primaryRequesterId && primaryStatus === 'idle') {
      void load(null, false);
    }
  }, [user, primaryRequesterId, primaryStatus, load]);

  const getBucket = useCallback(
    (requesterIdOrNull: string | null): Bucket => {
      const requesterId = resolve(requesterIdOrNull);
      if (!user || !requesterId) {
        // No identity at all: report `need_access` rather than a permanent
        // spinner, but only once the profile has actually arrived — otherwise the
        // access-request card flashes on every cold start.
        return userProfile ? { ...EMPTY_BUCKET, status: 'need_access' } : EMPTY_BUCKET;
      }
      return buckets[bucketKey(user.uid, requesterId)] ?? EMPTY_BUCKET;
    },
    [buckets, resolve, user, userProfile]
  );

  const pdfStateFor = useCallback(
    (requesterIdOrNull: string | null, dossierId: string): PdfState => {
      const requesterId = resolve(requesterIdOrNull);
      if (!requesterId) return IDLE_PDF;
      return pdfById[pdfKey(requesterId, dossierId)] ?? IDLE_PDF;
    },
    [pdfById, resolve]
  );

  const ensureLoadedFor = useCallback(
    (requesterId: string | null) => void load(requesterId, false),
    [load]
  );

  const refreshFor = useCallback(
    (requesterIdOrNull: string | null) => {
      const requesterId = resolve(requesterIdOrNull);
      if (user && requesterId) bgRetryRef.current[bucketKey(user.uid, requesterId)] = 0;
      void load(requesterIdOrNull, true);
    },
    [load, resolve, user]
  );

  const value = useMemo<ResultsContextValue>(
    () => ({
      primaryRequesterId,
      getBucket,
      pdfStateFor,
      loadPdfFor,
      ensureLoadedFor,
      refreshFor,
    }),
    [primaryRequesterId, getBucket, pdfStateFor, loadPdfFor, ensureLoadedFor, refreshFor]
  );

  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
}
