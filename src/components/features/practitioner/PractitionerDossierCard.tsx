'use client';

/**
 * One report of one patient, on the doctor's « Mes patients » page.
 *
 * A doctor-side counterpart of the patient page's dossier card, written apart on
 * purpose (voice, density, texts) so that the patient page — used every day —
 * is not touched by this feature. For a doctor the DATE is the headline: it is
 * how he tells two reports of the same patient apart.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Eye, FileText, Loader2, RotateCw, Share2, Star } from 'lucide-react';
import AnalysesDetails from '@/components/features/results/AnalysesDetails';
import { etatLabelKey, formatDossierDate } from '@/lib/results/format';
import type { CyberlabResult, PdfState } from '@/types/cyberlab';

interface Props {
  dossier: CyberlabResult;
  pdf: PdfState;
  isNewest: boolean;
  lang: string;
  canShare: boolean;
  onView: (dossierId: string) => void;
  onDownload: (dossierId: string) => void;
  onShare: (dossierId: string) => void;
  onRetry: (dossierId: string) => void;
}

export default function PractitionerDossierCard({
  dossier,
  pdf,
  isNewest,
  lang,
  canShare,
  onView,
  onDownload,
  onShare,
  onRetry,
}: Props) {
  const { t } = useTranslation('common');
  const isArabic = lang === 'ar';
  const loading = pdf.status === 'loading';
  const failed = pdf.status === 'error';
  const unavailable = pdf.status === 'unavailable';
  const retry = failed || unavailable;
  const etatKey = dossier.etat ? etatLabelKey(dossier.etat) : null;

  const secondaryButton =
    'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-[var(--border-default)] text-[var(--text-primary)] font-medium hover:bg-[var(--background-tertiary)] hover:border-[var(--color-bordeaux-primary)] transition-all disabled:opacity-60 disabled:cursor-not-allowed';

  return (
    <div className="card p-5 flex flex-col gap-3" data-testid="mp-dossier" data-dossier-id={dossier.dossier_id}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-[var(--color-bordeaux-primary)]/10 text-[var(--color-bordeaux-primary)] flex items-center justify-center flex-shrink-0">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
              <p className="font-semibold text-[var(--text-primary)]">
                {formatDossierDate(dossier.date_dossier, lang) || t('resultats.year_unknown', 'Sans date')}
              </p>
              {isNewest && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-[var(--color-fuchsia-accent)]/10 text-[var(--color-fuchsia-accent)]">
                  <Star size={11} className="fill-current" />
                  {t('mes_patients.latest_badge', 'Dernier bilan')}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {t('mes_patients.dossier', 'Dossier {{id}}', { id: dossier.dossier_id })}
            </p>
          </div>
        </div>
        {dossier.etat && (
          <span className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)]">
            {etatKey ? t(etatKey) : dossier.etat}
          </span>
        )}
      </div>

      {dossier.analyses_summary && <AnalysesDetails summary={dossier.analyses_summary} isArabic={isArabic} />}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]" role="status">
          <div className="relative h-1 flex-1 overflow-hidden rounded-lg bg-[var(--background-secondary)]">
            <div
              className="absolute inset-y-0 w-1/3 rounded-lg bg-[var(--color-bordeaux-primary)]"
              style={{ animation: 'mpBar 1.1s ease-in-out infinite' }}
            />
          </div>
          <span className="flex-shrink-0">{t('resultats.pdf_loading', 'Chargement du PDF…')}</span>
        </div>
      )}
      {failed && (
        <p className="text-sm text-[var(--status-error)]">{t('resultats.pdf_load_error', 'Échec du chargement du PDF.')}</p>
      )}
      {unavailable && (
        <p className="text-sm text-[var(--status-warning)]">
          {t('mes_patients.pdf_unavailable', "Le laboratoire n'a pas encore joint le PDF de ce bilan. Réessayez plus tard.")}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onView(dossier.dossier_id)}
          disabled={loading}
          className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
          {loading ? t('resultats.pdf_loading_short', 'Chargement…') : t('resultats.view', 'Voir')}
        </button>
        <button
          type="button"
          onClick={() => (retry ? onRetry(dossier.dossier_id) : onDownload(dossier.dossier_id))}
          disabled={loading}
          className={secondaryButton}
        >
          {retry ? <RotateCw size={18} /> : <Download size={18} />}
          {retry ? t('resultats.retry', 'Réessayer') : t('resultats.download', 'Télécharger')}
        </button>
        {canShare && (
          <button type="button" onClick={() => onShare(dossier.dossier_id)} disabled={loading} className={secondaryButton}>
            <Share2 size={18} />
            {t('resultats.share', 'Partager')}
          </button>
        )}
      </div>
    </div>
  );
}
