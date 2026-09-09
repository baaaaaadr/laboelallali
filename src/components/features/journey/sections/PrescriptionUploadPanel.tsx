"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import MultiFileUploader from '@/components/ui/MultiFileUploader';
import type { UsePrescriptionUploadResult } from '../hooks/usePrescriptionUpload';

/**
 * Le téléversement d'ordonnance : le bandeau « ordonnance déjà transmise » (des
 * URL restaurées d'un brouillon) suivi du sélecteur de fichiers.
 *
 * Extrait pour être partagé par les deux mises en page du parcours. Le bandeau
 * est la partie qu'on ne peut PAS laisser diverger : les objets `File` ne
 * survivent pas au `sessionStorage`, donc après un aller-retour vers le
 * catalogue ou `/login`, le patient n'a plus ses fichiers en main — seulement
 * les URL déjà téléversées. Sans ce bandeau, l'écran affiche un sélecteur vide
 * et le patient renvoie une seconde fois la même ordonnance, en croyant que la
 * première a été perdue.
 *
 * « Remplacer » n'efface QUE les URL restaurées. Les fichiers en cours de
 * sélection appartiennent au sélecteur et lui restent.
 */
export interface PrescriptionUploadPanelProps {
  upload: UsePrescriptionUploadResult;
  /** URL d'ordonnances restaurées d'un brouillon. */
  restoredUrls: string[];
  onDiscardRestored: () => void;
}

export default function PrescriptionUploadPanel({
  upload,
  restoredUrls,
  onDiscardRestored,
}: PrescriptionUploadPanelProps) {
  const { t } = useTranslation('journey');

  return (
    <>
      {restoredUrls.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[var(--status-success)]/40 bg-[var(--status-success)]/5 px-3 py-2">
          <span className="text-sm text-[var(--text-primary)]">
            {t('cart.count', { count: restoredUrls.length })} — {t('prescription.already_sent')}
          </span>
          <button
            type="button"
            onClick={onDiscardRestored}
            className="text-sm font-medium text-[var(--color-bordeaux-primary)] underline flex-shrink-0"
          >
            {t('prescription.replace')}
          </button>
        </div>
      )}
      <MultiFileUploader
        files={upload.files}
        filePreviews={upload.filePreviews}
        setFiles={upload.setFiles}
        setFilePreviews={upload.setFilePreviews}
        error={upload.fileError}
        setError={upload.setFileError}
        fileUploadStates={upload.fileUploadStates}
      />
    </>
  );
}
