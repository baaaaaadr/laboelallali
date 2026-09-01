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

import React, { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import { useResults } from '@/contexts/ResultsContext';
import { getClientFunctions } from '@/config/firebase';
import type { CyberlabResult } from '@/types/cyberlab';
import AnalysesDetails from '@/components/features/results/AnalysesDetails';
import CheckupReminder from '@/components/features/results/CheckupReminder';
// Shared with the home hero panel — one viewer, not two (see its header).
import PdfViewerModal from '@/components/features/results/PdfViewerModal';
import ResultsIndicators from '@/components/features/results/ResultsIndicators';
import ShareAccessCard from '@/components/features/results/ShareAccessCard';
import OutageOptIn, { useOutageStatus } from '@/components/features/results/OutageOptIn';
import MedicalLoader from '@/components/ui/MedicalLoader';
import VerdictPanel from '@/components/ui/VerdictPanel';
import { LAB_CONTACT } from '@/constants/contact';
import { base64ToPdfBlob, isDesktopViewer } from '@/lib/results/pdfBlob';
import {
  FileText,
  Download,
  Eye,
  RefreshCw,
  Inbox,
  ShieldCheck,
  KeyRound,
  Send,
  Clock,
  ChevronDown,
  Loader2,
  Star,
  RotateCw,
  Share2,
  Copy,
  Check,
  MessageCircle,
} from 'lucide-react';


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
  const { user, userProfile, loading: authLoading } = useAuth();
  // Results come from the shared context (prefetched in the background at login).
  // List loads first (fast); each PDF is fetched on demand (newest one auto-loads).
  const { results, status, errorCode, lastUpdated, pdfState, loadPdf, newestDossierId, ensureLoaded, refresh } =
    useResults();

  // On a real error (not the rate-limit case), check the monitor's health doc:
  // if it confirms an outage we enrich the message ("le labo est déjà alerté")
  // and offer the "notify me when it's back" opt-in. Never breaks the page.
  const outage = useOutageStatus(status === 'error' && errorCode !== 'resource-exhausted');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Which "ready-made message" was just copied ('unknown' or a dossier id) — drives
  // the 2 s "Copié !" feedback (same pattern as ContactModal).
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Only the id: the base64 stays in the results context, so the modal closes
  // by itself if that context resets (logout, account switch) instead of
  // showing another account's PDF, and we keep no second copy of the payload.
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<'checking' | 'none' | 'pending' | 'rejected'>('checking');
  const [requesting, setRequesting] = useState(false);
  // Web Share is offered on mobile only (on desktop it's redundant with download).
  const [canShare, setCanShare] = useState(false);
  // Collapsible year sections: we only remember the sections the user explicitly
  // toggled; every other section follows the default (most-recent year open).
  const [yearOverrides, setYearOverrides] = useState<Record<string, boolean>>({});

  const isArabic = lang === 'ar';

  // Read through to the context rather than storing a copy (see viewerId).
  const viewerBase64 = viewerId ? pdfState(viewerId).base64 : undefined;

  useEffect(() => {
    setCanShare(!isDesktopViewer() && typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Redirect unauthenticated visitors to login, and tell login to bring them back
  // HERE after they sign in (?redirect=/…/resultats) — otherwise they land on
  // /profile and don't know how to reach the results they came for.
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${lang}/login?redirect=${encodeURIComponent(`/${lang}/resultats`)}`);
    }
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
      // `source` distinguishes this explicit request from the automatic one sent
      // at signup — the staff alert email shows it, the callable whitelists it.
      const fn = httpsCallable<{ source: string }, { status: string }>(functions, 'requestResultsAccess');
      const res = await fn({ source: 'results_page' });
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

  const closeViewer = useCallback(() => setViewerId(null), []);

  // "Voir": use the PDF if already loaded, otherwise fetch it on demand first
  // (the card shows a spinner while pdfState is 'loading'), then open the viewer.
  const handleView = useCallback(
    async (r: CyberlabResult) => {
      const st = pdfState(r.dossier_id);
      const ready = st.status === 'ready' && st.base64 ? st : await loadPdf(r.dossier_id);
      if (ready.status === 'ready' && ready.base64) setViewerId(r.dossier_id);
    },
    [pdfState, loadPdf]
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

  // ── "Ready-made message" actions (unknown id / missing PDF) ──────────────────
  // When the blockage is lab-side, the patient used to face a dead end: nothing to
  // read, nobody warned. These hand him the exact sentence to send the lab — the
  // one signal that makes an invisible failure visible. The messages carry only
  // metadata (requester id, dossier number, date), NEVER a medical value.
  const copyMessage = useCallback((text: string, key: string) => {
    try {
      // Unavailable on http:// origins and old browsers — WhatsApp stays the main route.
      void navigator.clipboard?.writeText(text);
    } catch {
      /* ignore */
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  /** Opens WhatsApp on the LAB's own number, prefilled (unlike ShareAccessCard's number-less link). */
  const openWhatsApp = useCallback((text: string) => {
    window.open(
      `https://wa.me/${LAB_CONTACT.WHATSAPP_ID}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }, []);

  // The profile may not carry requester_id client-side yet (staff attached it after
  // this session's profile load) → fall back to a message without the number.
  const unknownIdMessage = useMemo(() => {
    const id = (userProfile?.requester_id || '').trim();
    return id
      ? t('resultats.unknown_id_message', {
          id,
          defaultValue:
            "Bonjour, je n'arrive pas à consulter mes résultats sur l'application du laboratoire. Mon identifiant patient ({{id}}) n'est pas reconnu. Pouvez-vous vérifier l'activation de mon accès aux résultats en ligne ? Merci.",
        })
      : t('resultats.unknown_id_message_no_id', {
          defaultValue:
            "Bonjour, je n'arrive pas à consulter mes résultats sur l'application du laboratoire : mon identifiant patient n'est pas reconnu. Pouvez-vous vérifier l'activation de mon accès aux résultats en ligne ? Merci.",
        });
  }, [userProfile?.requester_id, t]);

  const pdfUnavailableMessage = (r: CyberlabResult) =>
    t('resultats.pdf_unavailable_message', {
      id: r.dossier_id,
      date: formatDate(r.date_dossier),
      defaultValue:
        "Bonjour, le PDF de mon dossier {{id}} (du {{date}}) n'apparaît pas dans l'application du laboratoire. Pouvez-vous vérifier qu'il a bien été publié en ligne ? Merci.",
    });

  /** Copy + WhatsApp pair shown under a verdict; `compact` fits inside a dossier card. */
  const renderMessageActions = (text: string, key: string, compact = false) => {
    const cls = compact
      ? 'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--color-bordeaux-primary)] transition-colors'
      : '';
    const size = compact ? 15 : 18;
    return (
      <>
        <button
          type="button"
          onClick={() => openWhatsApp(text)}
          className={compact ? cls : 'button-bordeaux justify-center flex items-center gap-2'}
        >
          <MessageCircle size={size} />
          {t('resultats.action_whatsapp', 'Envoyer au laboratoire')}
        </button>
        <button
          type="button"
          onClick={() => copyMessage(text, key)}
          className={compact ? cls : 'button-bordeaux-outline justify-center flex items-center gap-2'}
        >
          {copiedKey === key ? <Check size={size} /> : <Copy size={size} />}
          {copiedKey === key ? t('copy_success', 'Copié !') : t('copy', 'Copier')}
        </button>
      </>
    );
  };

  // ── Group results into collapsible sections by year ──────────────────────────
  // Only years that actually have results get a section; within a year the newest
  // dossier comes first, and years are ordered most-recent first. Results whose
  // date can't be parsed fall into a dateless section (so none are ever dropped).
  const grouped = useMemo(() => {
    const byYear = new Map<number, CyberlabResult[]>();
    const noDate: CyberlabResult[] = [];
    for (const r of results) {
      const d = new Date(r.date_dossier);
      if (r.date_dossier && !Number.isNaN(d.getTime())) {
        const y = d.getFullYear();
        const arr = byYear.get(y);
        if (arr) arr.push(r);
        else byYear.set(y, [r]);
      } else {
        noDate.push(r);
      }
    }
    const years = Array.from(byYear.keys()).sort((a, b) => b - a);
    for (const y of years) {
      byYear
        .get(y)!
        .sort((a, b) => new Date(b.date_dossier).getTime() - new Date(a.date_dossier).getTime());
    }
    return { years, byYear, noDate };
  }, [results]);

  // Default-open section = most recent year with results (else the dateless one).
  const defaultOpenKey =
    grouped.years.length > 0
      ? String(grouped.years[0])
      : grouped.noDate.length > 0
        ? 'no-date'
        : null;
  const isSectionOpen = (key: string) =>
    key in yearOverrides ? yearOverrides[key] : key === defaultOpenKey;
  const toggleSection = (key: string) =>
    setYearOverrides((o) => ({ ...o, [key]: !(key in o ? o[key] : key === defaultOpenKey) }));

  // Year label localized so its digits match the dates shown on the cards
  // (Arabic-Indic under ar, Latin under fr); no thousands separator.
  const formatYear = (year: number) => {
    try {
      return new Intl.NumberFormat(isArabic ? 'ar-MA' : 'fr-FR', { useGrouping: false }).format(year);
    } catch {
      return String(year);
    }
  };



  // Collapsible header for one year section (reused by the dateless section too).
  const renderSectionHeader = (key: string, label: string, count: number) => {
    const open = isSectionOpen(key);
    return (
      <button
        type="button"
        onClick={() => toggleSection(key)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[var(--background-secondary)] border border-[var(--border-default)] hover:border-[var(--color-bordeaux-primary)] transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
          <ChevronDown
            size={18}
            className={`text-[var(--color-bordeaux-primary)] transition-transform ${
              open ? '' : isArabic ? 'rotate-90' : '-rotate-90'
            }`}
          />
          {label}
        </span>
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {t('resultats.count', { count })}
        </span>
      </button>
    );
  };

  // One dossier card. `index` only drives the staggered fade-in animation.
  const renderResultCard = (r: CyberlabResult, index: number) => {
    const pdf = pdfState(r.dossier_id);
    const isNewest = r.dossier_id === newestDossierId;
    const loadingPdf = pdf.status === 'loading';
    const errorPdf = pdf.status === 'error';
    // 'unavailable' = fetch OK but no PDF from the lab yet (calmer message, still retryable).
    const unavailablePdf = pdf.status === 'unavailable';
    const retryPdf = errorPdf || unavailablePdf;
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

        {r.analyses_summary && <AnalysesDetails summary={r.analyses_summary} isArabic={isArabic} />}

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

        {/* The call succeeded but the lab sent no PDF for this dossier: the document
            exists at the lab yet was never published online. Nothing the patient can
            fix alone → hand him the sentence to send, with the dossier number. */}
        {unavailablePdf && (
          <VerdictPanel
            tone="warning"
            title={t('resultats.pdf_unavailable_title', 'Ce résultat n’est pas encore consultable en ligne')}
            body={t(
              'resultats.pdf_unavailable',
              "Le laboratoire n'a pas encore joint le PDF de ce dossier. Réessayez plus tard ou contactez le laboratoire."
            )}
            todo={t(
              'resultats.pdf_unavailable_todo',
              'Envoyez ce message au laboratoire : il permettra de publier votre résultat.'
            )}
            actions={renderMessageActions(pdfUnavailableMessage(r), r.dossier_id, true)}
          />
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
            onClick={() => (retryPdf ? loadPdf(r.dossier_id) : handleDownload(r))}
            disabled={loadingPdf}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg border-2 border-[var(--border-default)] text-[var(--text-primary)] font-medium hover:bg-[var(--background-tertiary)] hover:border-[var(--color-bordeaux-primary)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {retryPdf ? <RotateCw size={18} /> : <Download size={18} />}
            {retryPdf ? t('resultats.retry', 'Réessayer') : t('resultats.download', 'Télécharger')}
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
  };

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
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <button
              onClick={refresh}
              disabled={status === 'loading'}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-[var(--border-default)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--background-tertiary)] hover:border-[var(--color-bordeaux-primary)] transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw size={18} className={status === 'loading' ? 'animate-spin' : ''} />
              {t('resultats.refresh', 'Actualiser')}
            </button>
            {/* Freshness sits right under the button — it qualifies the refresh action. */}
            {lastUpdated && (
              <span className="text-xs text-[var(--text-tertiary)] font-medium">
                <LastUpdatedLabel timestamp={lastUpdated} />
              </span>
            )}
          </div>
        </div>

        {/* At-a-glance indicators (count / last bilan / follow-up since) — ready only */}
        {status === 'ready' && <ResultsIndicators results={results} lang={lang} />}

        {/* Checkup reminder — always shown for linked patients once results are ready */}
        <CheckupReminder lang={lang} />

        {/* Loading (idle = prefetch not resolved yet → also show the loader) */}
        {(status === 'loading' || status === 'idle') && (
          <div className="card">
            <MedicalLoader label={t('resultats.loading', 'Récupération de vos résultats…')} />
          </div>
        )}

        {/* Error — three shades:
            · 'resource-exhausted' (too many calls in a row) → wait-a-minute, not an outage;
            · CONFIRMED outage (the monitor flipped systemStatus/cyberlab.up=false) → say the
              lab is already alerted + offer the "notify me when it's back" opt-in;
            · anything else → the plain generic error.
            The opt-in only shows on a confirmed outage, because only then is a
            down→up recovery coming to fulfill the email promise. */}
        {status === 'error' && (
          <VerdictPanel
            tone={errorCode === 'resource-exhausted' ? 'warning' : 'error'}
            title={
              errorCode === 'resource-exhausted'
                ? t('resultats.rate_limited_title', 'Trop de demandes en peu de temps')
                : t('resultats.error_title', 'Panne temporaire')
            }
            body={
              errorCode === 'resource-exhausted'
                ? t(
                    'resultats.rate_limited_body',
                    "La liaison avec le laboratoire limite le nombre de demandes rapprochées. Vos résultats ne sont pas perdus."
                  )
                : outage.down
                ? t('resultats.outage_confirmed_body', {
                    time: outage.downSince
                      ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(outage.downSince)
                      : '',
                    defaultValue:
                      'Panne confirmée du serveur de résultats du laboratoire (détectée à {{time}}). Notre équipe est déjà alertée automatiquement et intervient. Vos résultats ne sont pas perdus.',
                  })
                : t(
                    'resultats.error_generic',
                    'Impossible de récupérer vos résultats pour le moment. Veuillez réessayer plus tard.'
                  )
            }
            todo={
              errorCode === 'resource-exhausted'
                ? t('resultats.rate_limited_todo', 'Patientez une minute, puis appuyez sur « Réessayer ».')
                : outage.down
                ? t(
                    'resultats.outage_confirmed_todo',
                    'Inutile de réessayer sans arrêt : laissez-nous vous prévenir par email dès le rétablissement.'
                  )
                : t(
                    'resultats.error_todo',
                    "Réessayez dans quelques minutes. Si le message revient, contactez le laboratoire — cela ne vient pas de votre dossier."
                  )
            }
            actions={
              <>
                <button onClick={refresh} className="button-bordeaux justify-center flex items-center gap-2">
                  <RotateCw size={18} />
                  {t('resultats.retry', 'Réessayer')}
                </button>
                {errorCode !== 'resource-exhausted' && outage.down && <OutageOptIn lang={lang} />}
              </>
            }
          />
        )}

        {/* Unknown id — the lab server does not know this requester_id (404). The app
            works; the patient's CyberLab account was simply never created lab-side.
            Until this state existed he saw "Aucun résultat" and believed the app was
            broken (or that the lab lied), and usually never called back. */}
        {status === 'unknown_id' && (
          <VerdictPanel
            tone="warning"
            title={t('resultats.unknown_id_title', "Votre accès n'est pas encore activé au laboratoire")}
            body={t(
              'resultats.unknown_id_body',
              "Votre compte fonctionne, mais votre identifiant patient n'est pas encore reconnu par le laboratoire. Ce n'est pas une panne, et vos résultats ne sont pas perdus : il manque une activation à faire au laboratoire."
            )}
            todo={t(
              'resultats.unknown_id_todo',
              'Envoyez ce message au laboratoire : il contient tout ce qu’il faut pour activer votre accès.'
            )}
            actions={
              <>
                <p
                  dir="auto"
                  className="w-full text-sm text-[var(--text-secondary)] rounded-lg border border-[var(--border-default)] bg-[var(--background-default)] p-3"
                >
                  {unknownIdMessage}
                </p>
                {renderMessageActions(unknownIdMessage, 'unknown')}
              </>
            }
          />
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
            {/* Count → indicators bar (top); freshness → under the Actualiser button. */}
            <div className="space-y-3">
              {grouped.years.map((year) => {
                const key = String(year);
                const list = grouped.byYear.get(year)!;
                return (
                  <section key={key} className="space-y-4">
                    {renderSectionHeader(key, formatYear(year), list.length)}
                    {isSectionOpen(key) && (
                      <div className="space-y-4">{list.map((r, i) => renderResultCard(r, i))}</div>
                    )}
                  </section>
                );
              })}
              {grouped.noDate.length > 0 && (
                <section className="space-y-4">
                  {renderSectionHeader('no-date', t('resultats.year_unknown', 'Sans date'), grouped.noDate.length)}
                  {isSectionOpen('no-date') && (
                    <div className="space-y-4">{grouped.noDate.map((r, i) => renderResultCard(r, i))}</div>
                  )}
                </section>
              )}
            </div>
          </>
        )}

        {/* Refer a relative to the online-results service (self-gated to patients) */}
        <ShareAccessCard lang={lang} />

        {/* Privacy reassurance — kept at the very bottom, below all results */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] text-sm">
          <ShieldCheck size={18} className="text-[var(--color-fuchsia-accent)] mt-0.5 flex-shrink-0" />
          <span>{t('resultats.privacy_note', "Vos résultats sont récupérés à la demande et ne sont jamais conservés par l'application.")}</span>
        </div>
      </div>

      {/* PDF viewer modal — in-memory blob, revoked on close */}
      {viewerId && viewerBase64 && (
        <PdfViewerModal base64={viewerBase64} dossierId={viewerId} onClose={closeViewer} />
      )}
    </div>
  );
}
