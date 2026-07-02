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
import { getClientFunctions } from '@/config/firebase';
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

// Mirrors the lab API response (functions/src/cyberlab/client.ts). For type
// "patient", patient_nom / patient_prenom come back empty (data minimisation).
interface CyberlabResult {
  dossier_id: string;
  patient_nom: string;
  patient_prenom: string;
  date_dossier: string;
  etat: string;
  analyses_summary: string;
  pdf_base64: string;
}
interface CyberlabResponse {
  type: string;
  requester_id: string;
  results: CyberlabResult[];
}

type Status = 'loading' | 'error' | 'empty' | 'ready' | 'need_access';

/** base64 → in-memory PDF Blob (never persisted to disk). */
function base64ToPdfBlob(b64: string): Blob {
  const clean = (b64 || '').replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
}

export default function ResultatsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [results, setResults] = useState<CyberlabResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ url: string; dossierId: string } | null>(null);
  const [accessStatus, setAccessStatus] = useState<'checking' | 'none' | 'pending' | 'rejected'>('checking');
  const [requesting, setRequesting] = useState(false);
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0);

  const isArabic = lang === 'ar';

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

  const loadResults = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      const functions = await getClientFunctions();
      if (!functions) throw new Error('functions-unavailable');
      const callFetchResults = httpsCallable<Record<string, never>, CyberlabResponse>(
        functions,
        'fetchResults'
      );
      const res = await callFetchResults();
      const list = Array.isArray(res.data?.results) ? res.data.results : [];
      setResults(list);
      setStatus(list.length ? 'ready' : 'empty');
    } catch (err: unknown) {
      const rawCode = (err as { code?: string })?.code || '';
      const code = rawCode.replace('functions/', '');
      // The backend maps "no results" to not-found → treat it as the empty state.
      if (code === 'not-found') {
        setResults([]);
        setStatus('empty');
        return;
      }
      // No requester_id yet → offer the patient to request online access.
      if (code === 'failed-precondition') {
        setStatus('need_access');
        loadAccessStatus();
        return;
      }
      setErrorMsg(
        t('resultats.error_generic', 'Impossible de récupérer vos résultats pour le moment. Veuillez réessayer plus tard.')
      );
      setStatus('error');
    }
  }, [t, loadAccessStatus]);

  const handleRequestAccess = useCallback(async () => {
    setRequesting(true);
    setErrorMsg(null);
    try {
      const functions = await getClientFunctions();
      if (!functions) throw new Error('functions-unavailable');
      const fn = httpsCallable<Record<string, never>, { status: string }>(functions, 'requestResultsAccess');
      const res = await fn();
      if (res.data?.status === 'already_granted') {
        loadResults();
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
  }, [t, loadResults]);

  // Fetch on the fly once we know the user is authenticated.
  useEffect(() => {
    if (!authLoading && user) loadResults();
  }, [authLoading, user, loadResults]);

  // Revoke the current blob: URL whenever it changes or the page unmounts —
  // no result PDF lingers in memory once the viewer is closed.
  useEffect(() => {
    return () => {
      if (viewer?.url) URL.revokeObjectURL(viewer.url);
    };
  }, [viewer?.url]);

  const openViewer = useCallback((r: CyberlabResult) => {
    const url = URL.createObjectURL(base64ToPdfBlob(r.pdf_base64));
    setPdfPage(1);
    setPdfPages(0);
    setPdfScale(1.0);
    setViewer({ url, dossierId: r.dossier_id });
  }, []);

  const closeViewer = useCallback(() => setViewer(null), []);

  const downloadPdf = useCallback((r: CyberlabResult) => {
    const url = URL.createObjectURL(base64ToPdfBlob(r.pdf_base64));
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultat-${r.dossier_id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser a moment to start the download before releasing memory.
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }, []);

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

  // Pinch-to-zoom + one-finger pan on the PDF. We take FULL manual control
  // (touch-action: none): letting the browser keep panning made it hijack the
  // two-finger gesture — pinch jumped ~1% then stalled. preventDefault requires
  // non-passive native listeners, so they're wired here in an effect.
  const pdfScrollRef = useRef<HTMLDivElement>(null);
  const pdfScaleRef = useRef(pdfScale);
  useEffect(() => {
    pdfScaleRef.current = pdfScale;
  }, [pdfScale]);

  useEffect(() => {
    const el = pdfScrollRef.current;
    if (!el || !viewer) return;
    let mode: 'none' | 'pan' | 'pinch' = 'none';
    let startDist = 0;
    let startScale = 1;
    let lastX = 0;
    let lastY = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        mode = 'pinch';
        startDist = dist(e.touches);
        startScale = pdfScaleRef.current;
      } else if (e.touches.length === 1) {
        mode = 'pan';
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'pinch' && e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const ratio = dist(e.touches) / startDist;
        setPdfScale(Math.min(3, Math.max(0.5, +(startScale * ratio).toFixed(2))));
      } else if (mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        el.scrollLeft -= e.touches[0].clientX - lastX;
        el.scrollTop -= e.touches[0].clientY - lastY;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };
    const onEnd = (e: TouchEvent) => {
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
            onClick={loadResults}
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

        {/* Loading */}
        {status === 'loading' && (
          <div className="card">
            <MedicalLoader label={t('resultats.loading', 'Récupération de vos résultats…')} />
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="card p-8 flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle size={40} className="text-[var(--status-error)]" />
            <p className="text-[var(--text-primary)] font-medium max-w-md">{errorMsg}</p>
            <button onClick={loadResults} className="button-bordeaux justify-center">
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

        {/* Ready — list of dossiers */}
        {status === 'ready' && (
          <>
            <p className="text-sm text-[var(--text-tertiary)] font-medium">
              {t('resultats.count', { count: results.length })}
            </p>
            <div className="space-y-4">
              {results.map((r) => (
                <div key={r.dossier_id} className="card p-6 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-lg bg-[var(--color-bordeaux-primary)]/10 text-[var(--color-bordeaux-primary)] flex items-center justify-center flex-shrink-0">
                        <FileText size={22} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--text-primary)] truncate">
                          {t('resultats.dossier', 'Dossier')} {r.dossier_id}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">{formatDate(r.date_dossier)}</p>
                      </div>
                    </div>
                    {r.etat && (
                      <span className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                        {r.etat}
                      </span>
                    )}
                  </div>

                  {r.analyses_summary && (
                    <div className="text-sm">
                      <span className="text-[var(--text-tertiary)] font-medium">
                        {t('resultats.analyses_label', 'Analyses')}:{' '}
                      </span>
                      <span className="text-[var(--text-primary)]">{r.analyses_summary}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      onClick={() => openViewer(r)}
                      className="button-bordeaux justify-center flex items-center gap-2"
                    >
                      <Eye size={18} />
                      {t('resultats.view', 'Voir')}
                    </button>
                    <button
                      onClick={() => downloadPdf(r)}
                      className="button-outline justify-center flex items-center gap-2"
                    >
                      <Download size={18} />
                      {t('resultats.download', 'Télécharger')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* PDF viewer modal — in-memory blob, revoked on close */}
      {viewer && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={closeViewer}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-[var(--background-card)] rounded-lg shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
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

            {/* Toolbar: page navigation + zoom */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--background-secondary)]">
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
                  onClick={() => setPdfScale((s) => Math.max(0.6, +(s - 0.2).toFixed(2)))}
                  aria-label={t('resultats.pdf_zoom_out', 'Dézoomer')}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)]"
                >
                  <ZoomOut size={18} />
                </button>
                <span className="text-xs text-[var(--text-secondary)] min-w-[42px] text-center">{Math.round(pdfScale * 100)}%</span>
                <button
                  onClick={() => setPdfScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))}
                  aria-label={t('resultats.pdf_zoom_in', 'Zoomer')}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)]"
                >
                  <ZoomIn size={18} />
                </button>
              </div>
            </div>

            {/* PDF rendered on a <canvas> via pdf.js — works on Android + iOS + desktop */}
            <div
              ref={pdfScrollRef}
              className="flex-1 overflow-auto p-4 bg-[var(--background-tertiary)]"
              style={{ touchAction: 'none' }}
            >
              {/* w-max + mx-auto: centers when the page fits, but stays fully
                  scrollable from the LEFT when it's wider than the viewport
                  (flex justify-center would clip the left side — unreachable). */}
              <div className="w-max mx-auto">
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
                  <LazyPage
                    pageNumber={pdfPage}
                    scale={pdfScale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="shadow-xl rounded-lg overflow-hidden"
                  />
                </LazyDocument>
              </Suspense>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
