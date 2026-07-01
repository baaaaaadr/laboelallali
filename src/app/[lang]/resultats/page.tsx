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

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import { getClientFunctions } from '@/config/firebase';
import {
  FileText,
  Download,
  Eye,
  X,
  RefreshCw,
  Inbox,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

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

type Status = 'loading' | 'error' | 'empty' | 'ready';

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

  const isArabic = lang === 'ar';

  // Redirect unauthenticated visitors to login (same pattern as /profile).
  useEffect(() => {
    if (!authLoading && !user) router.push(`/${lang}/login`);
  }, [user, authLoading, router, lang]);

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
      // The Cloud Function already returns generic French messages; show a
      // profile-specific hint for failed-precondition, else a generic message.
      const backendMsg = (err as { message?: string })?.message;
      setErrorMsg(
        code === 'failed-precondition'
          ? backendMsg || t('resultats.error_profile', 'Profil patient incomplet. Veuillez contacter le laboratoire.')
          : t('resultats.error_generic', 'Impossible de récupérer vos résultats pour le moment. Veuillez réessayer plus tard.')
      );
      setStatus('error');
    }
  }, [t]);

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

  // ── Auth gate (spinner while resolving / before redirect) ────────────────────
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background-default)]">
        <div className="animate-spin rounded-lg h-12 w-12 border-4 border-[var(--color-bordeaux-primary)] border-t-transparent" />
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
          <div className="card p-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="animate-spin rounded-lg h-10 w-10 border-4 border-[var(--color-bordeaux-primary)] border-t-transparent" />
            <p className="text-[var(--text-secondary)]">{t('resultats.loading', 'Récupération de vos résultats…')}</p>
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
            <iframe
              src={viewer.url}
              title={t('resultats.viewer_title', 'Résultat — dossier {{id}}', { id: viewer.dossierId })}
              className="flex-1 w-full bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
