'use client';

/**
 * One patient, on the doctor's « Mes patients » page: his reports, newest first.
 *
 * Opening a patient loads the PDF of HIS most recent report — once, like the
 * patient page does for its own newest report — so « Voir » is instant. Older
 * PDFs load when the doctor asks. Never more: one PDF is ~2.5 s and ~260 KB of a
 * medical record (measured 23/09/2026), and the lab server rate-limits.
 *
 * The component is keyed by the patient in the workspace, so switching patient
 * remounts it: the one-shot guard below is per opening, and a failed load is
 * retried when the doctor comes back to that patient.
 */
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { displayName, type PatientGroup } from '@/lib/practitioner/patients';
import PractitionerDossierCard from './PractitionerDossierCard';
import type { PdfState } from '@/types/cyberlab';

interface Props {
  group: PatientGroup;
  lang: string;
  pdfState: (dossierId: string) => PdfState;
  loadPdf: (dossierId: string) => Promise<PdfState>;
  canShare: boolean;
  onView: (dossierId: string) => void;
  onDownload: (dossierId: string) => void;
  onShare: (dossierId: string) => void;
  /** Mobile: back to the list. Absent on large screens (list stays visible). */
  onBack: () => void;
}

export default function PatientDetail({
  group,
  lang,
  pdfState,
  loadPdf,
  canShare,
  onView,
  onDownload,
  onShare,
  onBack,
}: Props) {
  const { t } = useTranslation('common');
  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;
  const autoLoaded = useRef(false);

  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    void loadPdf(group.newestDossierId);
  }, [group.newestDossierId, loadPdf]);

  const name = group.nameless
    ? t('mes_patients.nameless', 'Patient sans nom — dossier {{id}}', { id: group.newestDossierId })
    : displayName(group);

  return (
    <section className="space-y-4" data-testid="mp-patient-detail" aria-labelledby="mp-patient-title">
      <button
        type="button"
        onClick={onBack}
        className="lg:hidden flex items-center gap-2 min-h-[44px] text-sm font-medium text-[var(--color-bordeaux-primary)]"
        data-testid="mp-back"
      >
        <BackIcon size={18} />
        {t('mes_patients.back', 'Mes patients')}
      </button>

      <div>
        <h2 id="mp-patient-title" className="text-xl font-bold text-[var(--text-primary)]">
          {name}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t('mes_patients.bilans_count', { count: group.dossiers.length, defaultValue: '{{count}} bilans' })}
        </p>
      </div>

      <div className="space-y-3">
        {group.dossiers.map((d) => (
          <PractitionerDossierCard
            key={d.dossier_id}
            dossier={d}
            pdf={pdfState(d.dossier_id)}
            isNewest={d.dossier_id === group.newestDossierId}
            lang={lang}
            canShare={canShare}
            onView={onView}
            onDownload={onDownload}
            onShare={onShare}
            onRetry={(id) => void loadPdf(id)}
          />
        ))}
      </div>
    </section>
  );
}
