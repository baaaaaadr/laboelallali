"use client";

import React from 'react';
import { Camera, PencilLine, ListChecks, FileCheck2, FileX2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChoiceCard } from '../SectionShell';
import type { PrescriptionAnswer, TransmissionMode, TransmissionState } from '@/lib/journey/types';

/**
 * Question 1 du parcours : "Avez-vous une ordonnance ?" puis les modes de
 * transmission.
 *
 * Les modes sont CUMULABLES (décision du propriétaire) : un patient peut
 * photographier son ordonnance ET ajouter deux analyses du catalogue. Ce sont
 * donc des cases à cocher déguisées en cartes, pas des boutons radio.
 *
 * ⚠ Le mot "symptômes" est proscrit sur toute la page : on parle des analyses
 * souhaitées, jamais de ce dont le patient souffre. Un laboratoire d'analyses ne
 * recueille pas de plainte médicale.
 */
export interface PrescriptionSectionProps {
  hasPrescription: PrescriptionAnswer;
  onAnswer: (answer: 'yes' | 'no') => void;
  transmission: TransmissionState;
  onToggleTransmission: (mode: TransmissionMode) => void;
  modesVisible: boolean;
}

export default function PrescriptionSection({
  hasPrescription,
  onAnswer,
  transmission,
  onToggleTransmission,
  modesVisible,
}: PrescriptionSectionProps) {
  const { t } = useTranslation('journey');

  const modes: Array<{ mode: TransmissionMode; icon: React.ReactNode; title: string; desc: string }> =
    [];

  if (hasPrescription === 'yes') {
    modes.push({
      mode: 'upload',
      icon: <Camera className="h-5 w-5" />,
      title: t('prescription.mode_upload_title'),
      desc: t('prescription.mode_upload_desc'),
    });
    modes.push({
      mode: 'freetext',
      icon: <PencilLine className="h-5 w-5" />,
      title: t('prescription.mode_freetext_title'),
      desc: t('prescription.mode_freetext_desc'),
    });
  } else if (hasPrescription === 'no') {
    modes.push({
      mode: 'freetext',
      icon: <PencilLine className="h-5 w-5" />,
      title: t('prescription.mode_freetext_title_no'),
      desc: t('prescription.mode_freetext_desc_no'),
    });
  }

  if (hasPrescription !== null) {
    modes.push({
      mode: 'catalog',
      icon: <ListChecks className="h-5 w-5" />,
      title: t('prescription.mode_catalog_title'),
      desc: t('prescription.mode_catalog_desc'),
    });
  }

  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label={t('prescription.question')} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ChoiceCard
          selected={hasPrescription === 'yes'}
          onSelect={() => onAnswer('yes')}
          title={t('prescription.yes')}
          icon={<FileCheck2 className="h-5 w-5" />}
        />
        <ChoiceCard
          selected={hasPrescription === 'no'}
          onSelect={() => onAnswer('no')}
          title={t('prescription.no')}
          icon={<FileX2 className="h-5 w-5" />}
        />
      </div>

      {modesVisible && modes.length > 0 && (
        <div className="pt-5 border-t border-[var(--border-default)]">
          <h3 className="font-semibold text-[var(--text-primary)]">
            {hasPrescription === 'yes'
              ? t('prescription.modes_title_yes')
              : t('prescription.modes_title_no')}
          </h3>
          <p className="mt-1 mb-4 text-sm text-[var(--text-secondary)]">
            {t('prescription.modes_help')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {modes.map(({ mode, icon, title, desc }) => (
              <ChoiceCard
                key={mode}
                role="checkbox"
                selected={transmission[mode]}
                onSelect={() => onToggleTransmission(mode)}
                title={title}
                description={desc}
                icon={icon}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
