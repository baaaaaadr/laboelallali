"use client";

/**
 * /resultats — patient results viewer (CyberLab bridge).
 *
 * GOLDEN RULES (see docs/integrations/cyberlab-results-api.md):
 *  - The app is a VIEWER only. Results are fetched on the fly via the
 *    `fetchResults` callable and held in React state (memory) ONLY.
 *  - Nothing is written to Firestore, localStorage, or disk by this page.
 *  - Each PDF is decoded to an in-memory Blob when the user asks to view it,
 *    shown via a blob: URL, and that URL is revoked as soon as the viewer
 *    closes (or the component unmounts). "Download" is a user-initiated save.
 *  - The callable already responds with `Cache-Control: no-store`.
 */

import React, { useState, useEffect, useCallback, useRef, use, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import { useResults } from '@/contexts/ResultsContext';
import { getClientFunctions } from '@/config/firebase';
import type { CyberlabResult } from '@/types/cyberlab';
import AnalysesDetails from '@/components/features/results/AnalysesDetails';
import MedicalLoader from '@/components/ui/MedicalLoader';
import {
  FileText,
  Download,
  Eye,
  X,
  RefreshCw,
  Inbox,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  Send,
  Clock,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  Star,
  RotateCw,
  Share2,
} from 'lucide-react';

// PDF rendering via pdf.js (react-pdf): renders on a <canvas>, so "Voir" works on
// Android too — where the native <iframe> inline PDF view is unsupported (it only
// offers an "Open" button). Lazy-loaded to avoid SSR issues (no DOMMatrix on server).
const LazyDocument = lazy(() =>
  import('react-pdf').then((mod) => {
    mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`;
    return { default: mod.Document };
  })
);
const LazyPage = lazy(() => import('react-pdf').then((mod) => ({ default: mod.Page })));

/** base64 → in-memory PDF Blob (never persisted to disk). */
function base64ToPdfBlob(b64: string): Blob {
  const clean = (b64 || '').replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
}

/** PC heuristic (same idea used elsewhere in the app): not a mobile UA + wide viewport. */
function isDesktopViewer(): boolean {
  if (typeof window === 'undefined') return false;
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return !mobileUA && window.innerWidth >= 768;
}

// Lab statuses (`etat`) come from CyberLab in English (e.g. "Final"); map the known
// ones to i18n keys and pass through any unknown value verbatim.
const ETAT_LABEL_KEYS: Record<string, string> = {
  final: 'resultats.etat_final',
};

/**
 * Live "Actualisé il y a X" label. Shows the largest unit (sec → min → h → jour)
 * and ticks every second; grammar/locale handled by Intl.RelativeTimeFormat.
 */
function LastUpdatedLabel({ timestamp }: { timestamp: number }) {
  const { t, i18n } = useTranslation('common');
  const [now, setNow] = useState(() => Date.now());

  // Seconds aren't shown individually (just "quelques secondes"), so a slow tick
  // is enough to catch the minute/hour/day transitions without visual churn.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(id);
  }, []);

  const sec = Math.max(0, Math.floor((now - timestamp) / 1000));
  // Under a minute → a stable phrase (no jittery per-second counter).
  if (sec < 60) return <>{t('resultats.updated_seconds', 'Actualisé il y a quelques secondes')}</>;

  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;
  if (sec < 3600) {
    value = Math.floor(sec / 60);
    unit = 'minute';
  } else if (sec < 86400) {
    value = Math.floor(sec / 3600);
    unit = 'hour';
  } else {
    value = Math.floor(sec / 86400);
    unit = 'day';
  }

  const locale = i18n.language === 'ar' ? 'ar' : 'fr';
  let ago: string;
  try {
    ago = new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(-value, unit);
  } catch {
    ago = `${value}`;
  }
  return <>{t('resultats.updated_ago', { ago, defaultValue: 'Actualisé {{ago}}' })}</>;
}

export default function ResultatsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  // Results come from the shared context (prefetched in the background at login).
  // List loads first (fast); each PDF is fetched on demand (newest one auto-loads).
  const { results, status, lastUpdated, pdfState, loadPdf, newestDossierId, ensureLoaded, refresh } = useResults();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ url: string; dossierId: string } | null>(null);
  const [accessStatus, setAccessStatus] = useState<'checking' | 'none' | 'pending' | 'rejected'>('checking');
  const [requesting, setRequesting] = useState(false);
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  // zoom = 1 means "fit the PDF to the viewer width"; we open at 1.6 (160%) so the
  // left column (test names + results) is readable straight away.
  const [zoom, setZoom] = useState(1.6);
  const [containerWidth, setContainerWidth] = useState(0);
  // Web Share is offered on mobile only (on desktop it's redundant with download).
  const [canShare, setCanShare] = useState(false);

  const isArabic = lang === 'ar';

  useEffect(() => {
    setCanShare(!isDesktopViewer() && typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Redirect unauthenticated visitors to login (same pattern as /profile).
  useEffect(() => {
    if (!authLoading && !user) router.push(`/${lang}/login`);
  }, [user, authLoading, router, lang]);

  const loadAccessStatus = useCallback(async () => {
    setAccessStatus('checking');
    try {
      const functions = await getClientFunctions();
      if (!functions) throw new Error('functions-unavailable');
      const fn = httpsCallable<Record<string, never>, { status: string | null }>(functions, 'myAccessRequest');
      const s = (await fn()).data?.status;
      setAccessStatus(s === 'pending' ? 'pending' : s === 'rejected' ? 'rejected' : 'none');
    } catch {
      setAccessStatus('none');
    }
  }, []);

  // When the (prefetched) fetch reports no online access yet, check whether the
  // patient already has a pending / rejected access request to show the right UI.
  useEffect(() => {
    if (status === 'need_access') loadAccessStatus();
  }, [status, loadAccessStatus]);

  const handleRequestAccess = useCallback(async () => {
    setRequesting(true);
    setErrorMsg(null);
    try {
      const functions = await getClientFunctions();
      if (!functions) throw new Error('functions-unavailable');
      const fn = httpsCallable<Record<string, never>, { status: string }>(functions, 'requestResultsAccess');
      const res = await fn();
      if (res.data?.status === 'already_granted') {
        refresh();
        return;
      }
      setAccessStatus('pending');
    } catch (err: unknown) {
      const code = ((err as { code?: string })?.code || '').replace('functions/', '');
      const msg = (err as { message?: string })?.message;
      setErrorMsg(
        code === 'failed-precondition'
          ? msg || t('resultats.access_need_profile', "Complétez d'abord votre profil (nom et téléphone).")
          : t('resultats.error_generic', 'Impossible de récupérer vos résultats pour le moment. Veuillez réessayer plus tard.')
      );
    } finally {
      setRequesting(false);
    }
  }, [t, refresh]);

  // If the background prefetch hasn't run/finished, make sure we load once the page
  // is open and the user is known (idempotent — the context de-dupes).
  useEffect(() => {
    if (!authLoading && user) ensureLoaded();
  }, [authLoading, user, ensureLoaded]);

  // Revoke the current blob: URL whenever it changes or the page unmounts —
  // no result PDF lingers in memory once the viewer is closed.
  useEffect(() => {
    return () => {
      if (viewer?.url) URL.revokeObjectURL(viewer.url);
    };
  }, [viewer?.url]);

  const openViewerWithBase64 = useCallback((dossierId: string, base64: string) => {
    const url = URL.createObjectURL(base64ToPdfBlob(base64));
    setPdfPage(1);
    setPdfPages(0);
    // PC: near fit-to-width (105%) + horizontally centered.
    // Mobile: 160% pinned to the readable top-left column.
    const desktop = isDesktopViewer();
    setZoom(desktop ? 1.05 : 1.6);
    pendingScrollRef.current = desktop ? { centerX: true, top: 0 } : { left: 0, top: 0 };
    setViewer({ url, dossierId });
  }, []);

  const closeViewer = useCallback(() => setViewer(null), []);

  // "Voir": use the PDF if already loaded, otherwise fetch it on demand first
  // (the card shows a spinner while pdfState is 'loading'), then open the viewer.
  const handleView = useCallback(
    async (r: CyberlabResult) => {
      const st = pdfState(r.dossier_id);
      const ready = st.status === 'ready' && st.base64 ? st : await loadPdf(r.dossier_id);
      if (ready.status === 'ready' && ready.base64) openViewerWithBase64(r.dossier_id, ready.base64);
    },
    [pdfState, loadPdf, openViewerWithBase64]
  );

  const handleDownload = useCallback(
    async (r: CyberlabResult) => {
      const st = pdfState(r.dossier_id);
      const ready = st.status === 'ready' && st.base64 ? st : await loadPdf(r.dossier_id);
      if (ready.status !== 'ready' || !ready.base64) return;
      const url = URL.createObjectURL(base64ToPdfBlob(ready.base64));
      const a = document.createElement('a');
      a.href = url;
      a.download = `resultat-${r.dossier_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a moment to start the download before releasing memory.
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    },
    [pdfState, loadPdf]
  );

  // Mobile share via the Web Share API (email / WhatsApp / … chosen by the OS).
  // User-initiated, like a download — the PDF File is handed to the OS share sheet
  // and never persisted by us.
  const handleShare = useCallback(
    async (r: CyberlabResult) => {
      const st = pdfState(r.dossier_id);
      const ready = st.status === 'ready' && st.base64 ? st : await loadPdf(r.dossier_id);
      if (ready.status !== 'ready' || !ready.base64) return;
      const file = new File([base64ToPdfBlob(ready.base64)], `resultat-${r.dossier_id}.pdf`, {
        type: 'application/pdf',
      });
      try {
        const shareData = {
          title: t('resultats.share_title', "Résultat d'analyses"),
          text: t('resultats.share_text', "Mon résultat d'analyses — Labo El Allali"),
        };
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ ...shareData, files: [file] });
        } else {
          await navigator.share(shareData);
        }
      } catch {
        // User cancelled (AbortError) or the platform refused — nothing to do.
      }
    },
    [pdfState, loadPdf, t]
  );

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(isArabic ? 'ar-MA' : 'fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Localize a lab status if we know it; otherwise show it as-is.
  const etatLabel = (raw: string) => {
    const key = ETAT_LABEL_KEYS[raw.trim().toLowerCase()];
    return key ? t(key) : raw;
  };

  // Pinch-to-zoom + one-finger pan on the PDF (touch-action: none so the browser
  // never steals the gesture; preventDefault needs non-passive native listeners).
  const pdfScrollRef = useRef<HTMLDivElement>(null); // scroll viewport
  const pdfWrapRef = useRef<HTMLDivElement>(null);   // the page box we scale live
  const zoomRef = useRef(zoom);
  // Scroll position we want AFTER the next real (width) re-render — applied in the
  // Page's onRenderSuccess so it isn't clamped against the still-old canvas size.
  const pendingScrollRef = useRef<{ left?: number; top: number; centerX?: boolean } | null>(null);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Keep the "fit-to-width" base in sync with the viewer's real width
  // (initial open + rotation / resize).
  useEffect(() => {
    if (!viewer) return;
    const el = pdfScrollRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewer]);

  const applyPendingScroll = useCallback(() => {
    const el = pdfScrollRef.current;
    const p = pendingScrollRef.current;
    if (el && p) {
      el.scrollLeft = p.centerX
        ? Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
        : (p.left ?? 0);
      el.scrollTop = p.top;
      pendingScrollRef.current = null;
    }
  }, []);

  useEffect(() => {
    const el = pdfScrollRef.current;
    if (!el || !viewer) return;
    let mode: 'none' | 'pan' | 'pinch' = 'none';
    let startDist = 0;
    let startZoom = 1;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let originX = 0; // pinch focus, in the page box's own coordinates
    let originY = 0;
    let liveScale = 1;
    let lastX = 0;
    let lastY = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const beginPinch = (e: TouchEvent) => {
      const wrap = pdfWrapRef.current;
      if (!wrap) return;
      mode = 'pinch';
      startDist = dist(e.touches);
      startZoom = zoomRef.current;
      startScrollLeft = el.scrollLeft;
      startScrollTop = el.scrollTop;
      liveScale = 1;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const r = wrap.getBoundingClientRect();
      originX = midX - r.left;
      originY = midY - r.top;
      wrap.style.transformOrigin = `${originX}px ${originY}px`;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        beginPinch(e);
      } else if (e.touches.length === 1) {
        mode = 'pan';
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'pinch' && e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const wrap = pdfWrapRef.current;
        if (!wrap) return;
        // Clamp so the *committed* zoom will stay within [0.5, 5].
        const raw = dist(e.touches) / startDist;
        liveScale = Math.min(5 / startZoom, Math.max(0.5 / startZoom, raw));
        // Cheap GPU transform during the gesture — NO react-pdf re-render (that
        // redraws the canvas mid-pinch and cancels the touch sequence).
        wrap.style.transform = `scale(${liveScale})`;
      } else if (mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        el.scrollLeft -= e.touches[0].clientX - lastX;
        el.scrollTop -= e.touches[0].clientY - lastY;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };
    const commitPinch = () => {
      const wrap = pdfWrapRef.current;
      if (!wrap) return;
      wrap.style.transform = '';
      const next = +(startZoom * liveScale).toFixed(3);
      // Only when the committed zoom truly changes (else no re-render fires and a
      // stashed scroll would apply later by mistake).
      if (next !== startZoom) {
        // Keep the pinch focus point stationary AFTER the real (width) re-render:
        // stash the target scroll, applied in onRenderSuccess (see applyPendingScroll).
        pendingScrollRef.current = {
          left: startScrollLeft + originX * (liveScale - 1),
          top: startScrollTop + originY * (liveScale - 1),
        };
        setZoom(next);
      }
      liveScale = 1;
    };
    const onEnd = (e: TouchEvent) => {
      if (mode === 'pinch' && e.touches.length < 2) commitPinch();
      if (e.touches.length === 1) {
        mode = 'pan';
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      } else if (e.touches.length === 0) {
        mode = 'none';
      }
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [viewer]);

  // ── Auth gate (spinner while resolving / before redirect) ────────────────────
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background-default)]">
        <MedicalLoader />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] flex items-center gap-2">
              <FileText size={26} />
              {t('resultats.title', 'Mes Résultats')}
            </h1>
            <p className="text-[var(--text-secondary)] mt-1">
              {t('resultats.subtitle', "Consultez et téléchargez vos résultats d'analyses.")}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={status === 'loading'}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-[var(--border-default)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--background-tertiary)] hover:border-[var(--color-bordeaux-primary)] transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={status === 'loading' ? 'animate-spin' : ''} />
            {t('resultats.refresh', 'Actualiser')}
          </button>
        </div>

        {/* Privacy reassurance */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] text-sm">
          <ShieldCheck size={18} className="text-[var(--color-fuchsia-accent)] mt-0.5 flex-shrink-0" />
          <span>{t('resultats.privacy_note', "Vos résultats sont récupérés à la demande et ne sont jamais conservés par l'application.")}</span>
        </div>

        {/* Loading (idle = prefetch not resolved yet → also show the loader) */}
        {(status === 'loading' || status === 'idle') && (
          <div className="card">
            <MedicalLoader label={t('resultats.loading', 'Récupération de vos résultats…')} />
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="card p-8 flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle size={40} className="text-[var(--status-error)]" />
            <p className="text-[var(--text-primary)] font-medium max-w-md">
              {t('resultats.error_generic', 'Impossible de récupérer vos résultats pour le moment. Veuillez réessayer plus tard.')}
            </p>
            <button onClick={refresh} className="button-bordeaux justify-center">
              {t('resultats.retry', 'Réessayer')}
            </button>
          </div>
        )}

        {/* Need access — patient can request online access */}
        {status === 'need_access' && (
          <div className="card p-8 flex flex-col items-center justify-center gap-4 text-center">
            <div className="h-14 w-14 rounded-lg bg-[var(--color-bordeaux-primary)]/10 text-[var(--color-bordeaux-primary)] flex items-center justify-center">
              <KeyRound size={28} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {t('resultats.access_title', 'Accédez à vos résultats en ligne')}
            </h2>
            {accessStatus === 'pending' ? (
              <div className="flex flex-col items-center gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                  <Clock size={16} /> {t('resultats.access_pending_badge', 'Demande en attente')}
                </span>
                <p className="text-[var(--text-secondary)] max-w-md">
                  {t('resultats.access_pending_desc', 'Votre demande a bien été envoyée. Le laboratoire activera votre accès lors de votre prochain passage ou sous peu.')}
                </p>
              </div>
            ) : (
              <>
                <p className="text-[var(--text-secondary)] max-w-md">
                  {t('resultats.access_desc', "Demandez l'activation de l'accès à vos résultats. Un membre du laboratoire vérifiera votre identité avant de l'activer.")}
                </p>
                {accessStatus === 'rejected' && (
                  <p className="text-sm text-[var(--status-error)] max-w-md">
                    {t('resultats.access_rejected', "Votre précédente demande n'a pas été validée. Vous pouvez en renvoyer une ou contacter le laboratoire.")}
                  </p>
                )}
                {errorMsg && <p className="text-sm text-[var(--status-error)] max-w-md">{errorMsg}</p>}
                <button
                  onClick={handleRequestAccess}
                  disabled={requesting || accessStatus === 'checking'}
                  className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-60"
                >
                  <Send size={18} />
                  {requesting
                    ? t('resultats.access_requesting', 'Envoi…')
                    : t('resultats.access_request', "Demander l'accès à mes résultats")}
                </button>
              </>
            )}
          </div>
        )}

        {/* Empty */}
        {status === 'empty' && (
          <div className="card p-12 flex flex-col items-center justify-center gap-3 text-center">
            <Inbox size={44} className="text-[var(--text-tertiary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {t('resultats.empty_title', 'Aucun résultat disponible')}
            </h2>
            <p className="text-[var(--text-secondary)] max-w-md">
              {t('resultats.empty_desc', "Vous n'avez pas encore de résultats. Ils apparaîtront ici dès qu'ils seront prêts.")}
            </p>
          </div>
        )}

        {/* Ready — list of dossiers. The list appears immediately (fast "none"
            call); each PDF loads on demand, newest one auto-loads, with a small
            loading animation so things show up progressively. */}
        {status === 'ready' && (
          <>
            {/* Scoped animations: cards fade in with a slight stagger; the PDF
                loading bar slides indeterminately while a dossier is fetched. */}
            <style>{`
              @keyframes resFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
              @keyframes resBar { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
            `}</style>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[var(--text-tertiary)] font-medium">
              <span>{t('resultats.count', { count: results.length })}</span>
              {lastUpdated && (
                <>
                  <span aria-hidden="true">·</span>
                  <LastUpdatedLabel timestamp={lastUpdated} />
                </>
              )}
            </div>
            <div className="space-y-4">
              {results.map((r, index) => {
                const pdf = pdfState(r.dossier_id);
                const isNewest = r.dossier_id === newestDossierId;
                const loadingPdf = pdf.status === 'loading';
                const errorPdf = pdf.status === 'error';
                return (
                  <div
                    key={r.dossier_id}
                    className="card p-6 flex flex-col gap-4"
                    style={{ animation: 'resFadeUp 0.35s ease-out both', animationDelay: `${Math.min(index, 8) * 60}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-11 w-11 rounded-lg bg-[var(--color-bordeaux-primary)]/10 text-[var(--color-bordeaux-primary)] flex items-center justify-center flex-shrink-0">
                          <FileText size={22} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-x-2 gap-y-1.5 flex-wrap">
                            <p className="font-semibold text-[var(--text-primary)] truncate">
                              {t('resultats.dossier', 'Dossier')} {r.dossier_id}
                            </p>
                            {isNewest && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-[var(--color-fuchsia-accent)]/10 text-[var(--color-fuchsia-accent)]">
                                <Star size={11} className="fill-current" />
                                {t('resultats.latest_badge', 'Dernier résultat')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] mt-1.5">{formatDate(r.date_dossier)}</p>
                        </div>
                      </div>
                      {r.etat && (
                        <span className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                          {etatLabel(r.etat)}
                        </span>
                      )}
                    </div>

                    {r.analyses_summary && (
                      <AnalysesDetails summary={r.analyses_summary} isArabic={isArabic} />
                    )}

                    {/* Indeterminate loading bar while this dossier's PDF is fetched. */}
                    {loadingPdf && (
                      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <div className="relative h-1 flex-1 overflow-hidden rounded-lg bg-[var(--background-secondary)]">
                          <div
                            className="absolute inset-y-0 w-1/3 rounded-lg bg-[var(--color-bordeaux-primary)]"
                            style={{ animation: 'resBar 1.1s ease-in-out infinite' }}
                          />
                        </div>
                        <span className="flex-shrink-0">{t('resultats.pdf_loading', 'Chargement du PDF…')}</span>
                      </div>
                    )}

                    {errorPdf && (
                      <p className="text-sm text-[var(--status-error)]">
                        {t('resultats.pdf_load_error', 'Échec du chargement du PDF.')}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-3 pt-1">
                      <button
                        onClick={() => handleView(r)}
                        disabled={loadingPdf}
                        className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {loadingPdf ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
                        {loadingPdf ? t('resultats.pdf_loading_short', 'Chargement…') : t('resultats.view', 'Voir')}
                      </button>
                      <button
                        onClick={() => (errorPdf ? loadPdf(r.dossier_id) : handleDownload(r))}
                        disabled={loadingPdf}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg border-2 border-[var(--border-default)] text-[var(--text-primary)] font-medium hover:bg-[var(--background-tertiary)] hover:border-[var(--color-bordeaux-primary)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {errorPdf ? <RotateCw size={18} /> : <Download size={18} />}
                        {errorPdf ? t('resultats.retry', 'Réessayer') : t('resultats.download', 'Télécharger')}
                      </button>
                      {canShare && (
                        <button
                          onClick={() => handleShare(r)}
                          disabled={loadingPdf}
                          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg border-2 border-[var(--border-default)] text-[var(--text-primary)] font-medium hover:bg-[var(--background-tertiary)] hover:border-[var(--color-bordeaux-primary)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Share2 size={18} />
                          {t('resultats.share', 'Partager')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* PDF viewer modal — in-memory blob, revoked on close */}
      {viewer && (
        <div
          className="fixed inset-0 z-50 bg-[var(--background-card)] flex flex-col"
          role="dialog"
          aria-modal="true"
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-default)]">
              <p className="font-semibold text-[var(--text-primary)] truncate">
                {t('resultats.viewer_title', 'Résultat — dossier {{id}}', { id: viewer.dossierId })}
              </p>
              <button
                onClick={closeViewer}
                aria-label={t('resultats.close', 'Fermer')}
                className="p-2 rounded-lg hover:bg-[var(--background-tertiary)] text-[var(--text-secondary)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Toolbar: page navigation + zoom. Forced LTR: it's an icon toolbar, so
                "◀ prev / next ▶" and "− / +" must keep a fixed direction — under RTL
                (Arabic) the flex row reversed and the arrows looked inverted. */}
            <div dir="ltr" className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--background-secondary)]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                  disabled={pdfPage <= 1}
                  aria-label={t('resultats.pdf_prev', 'Page précédente')}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-[var(--text-secondary)] min-w-[70px] text-center">
                  {pdfPage} / {pdfPages || '…'}
                </span>
                <button
                  onClick={() => setPdfPage((p) => Math.min(pdfPages, p + 1))}
                  disabled={pdfPage >= pdfPages}
                  aria-label={t('resultats.pdf_next', 'Page suivante')}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] disabled:opacity-30"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                  aria-label={t('resultats.pdf_zoom_out', 'Dézoomer')}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)]"
                >
                  <ZoomOut size={18} />
                </button>
                <span className="text-xs text-[var(--text-secondary)] min-w-[42px] text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)))}
                  aria-label={t('resultats.pdf_zoom_in', 'Zoomer')}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)]"
                >
                  <ZoomIn size={18} />
                </button>
              </div>
            </div>

            {/* PDF rendered on a <canvas> via pdf.js — works on Android + iOS + desktop.
                touch-action:none must cover the <canvas> descendants too, else the
                browser hijacks the two-finger gesture and our preventDefault is ignored
                (pinch jumped ~1% then stalled). Hence the style rule below. */}
            <div
              ref={pdfScrollRef}
              dir="ltr"
              className="pdf-touch-surface flex-1 overflow-auto p-2 bg-[var(--background-tertiary)]"
              style={{ touchAction: 'none' }}
            >
              <style>{`.pdf-touch-surface, .pdf-touch-surface * { touch-action: none; }`}</style>
              {/* w-max (left-aligned, NOT centered) so the LEFT edge is always the
                  first thing reached when scrolled to 0 — the readable column the
                  patient wants. This box is the live-scale target during a pinch. */}
              <div ref={pdfWrapRef} className="w-max will-change-transform">
              <Suspense fallback={<div className="py-16"><MedicalLoader size="sm" /></div>}>
                <LazyDocument
                  file={viewer.url}
                  onLoadSuccess={({ numPages }: { numPages: number }) => setPdfPages(numPages)}
                  loading={<div className="py-16"><MedicalLoader size="sm" /></div>}
                  error={
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)] text-center px-6">
                      <FileText size={44} className="mb-3" />
                      <p className="text-sm">{t('resultats.pdf_error', "Impossible d'afficher le PDF ici. Utilisez le bouton « Télécharger ».")}</p>
                    </div>
                  }
                >
                  {/* width (not scale) so zoom=1 fits the viewer width; zoom scales from there. */}
                  <LazyPage
                    pageNumber={pdfPage}
                    width={Math.max(120, ((containerWidth || 360) - 16) * zoom)}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onRenderSuccess={applyPendingScroll}
                    className="shadow-xl rounded-lg overflow-hidden"
                  />
                </LazyDocument>
              </Suspense>
              </div>
            </div>
        </div>
      )}
    </div>
  );
}
