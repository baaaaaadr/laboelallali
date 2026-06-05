"use client";

import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Download, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Object URL (blob) du PDF généré. */
  pdfUrl: string | null;
  /** Déclenche le téléchargement du PDF affiché. */
  onDownload: () => void;
  isRtl?: boolean;
}

/**
 * Grande modale d'aperçu PDF (PC uniquement).
 * Affiche le devis dans un <iframe> via le visionneur PDF natif du navigateur,
 * avec un bouton « Télécharger » explicite. Sur mobile, le téléchargement reste
 * direct et cette modale n'est jamais montée.
 */
export function PdfPreviewModal({
  isOpen,
  onClose,
  pdfUrl,
  onDownload,
  isRtl = false,
}: PdfPreviewModalProps) {
  const { t: tc } = useTranslation('catalog');

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={onClose} dir={isRtl ? 'rtl' : 'ltr'}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
            leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-5xl h-[92vh] flex flex-col bg-[var(--background-card)] shadow-2xl rounded-2xl overflow-hidden border border-[var(--border-default)]">

              {/* ── Header ── */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border-default)] bg-[var(--background-card)] flex-shrink-0">
                <Dialog.Title className="flex items-center gap-2 text-base font-bold font-heading text-[var(--color-bordeaux-primary)] truncate">
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{tc('cart.pdf_preview_title', 'Aperçu de votre devis')}</span>
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--text-secondary)] transition-colors flex-shrink-0"
                  aria-label={tc('cart.close', 'Fermer')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* ── Aperçu PDF ── */}
              <div className="flex-1 min-h-0 bg-[var(--background-secondary)]">
                {pdfUrl && (
                  <iframe
                    src={pdfUrl}
                    title={tc('cart.pdf_preview_title', 'Aperçu de votre devis')}
                    className="w-full h-full border-0"
                  />
                )}
              </div>

              {/* ── Footer : Télécharger ── */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)] bg-[var(--background-card)] flex-shrink-0">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)] border border-[var(--border-default)] transition-all"
                >
                  {tc('cart.close', 'Fermer')}
                </button>
                <button
                  onClick={onDownload}
                  className="button-bordeaux flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                  aria-label={tc('cart.download', 'Télécharger')}
                >
                  <Download className="h-4 w-4 flex-shrink-0" />
                  <span>{tc('cart.download', 'Télécharger')}</span>
                </button>
              </div>

            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

export default PdfPreviewModal;
