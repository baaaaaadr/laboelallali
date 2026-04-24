"use client";

import React from "react";
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Analysis } from './AnalysisCard';

interface AnalysisDetailsModalProps {
  analysis: Analysis | null;
  isOpen: boolean;
  onClose: () => void;
  lang: string;
}

export function AnalysisDetailsModal({
  analysis,
  isOpen,
  onClose,
  lang
}: AnalysisDetailsModalProps) {
  const { t } = useTranslation('catalog');
  const isArabic = lang === "ar";

  if (!analysis) return null;

  const name = isArabic ? analysis.name_ar : analysis.name_fr;
  const category = isArabic ? analysis.category_ar : analysis.category_fr;
  const preparation = isArabic ? analysis.preparation_ar : analysis.preparation_fr;
  const description = isArabic ? analysis.description_ar : analysis.description_fr;
  const technicalName = analysis.technical_name;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-[var(--background-card)] p-6 text-left align-middle shadow-xl transition-all border border-[var(--border-default)]"
                dir={isArabic ? 'rtl' : 'ltr'}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <Dialog.Title
                      as="h3"
                      className="text-2xl font-bold text-[var(--text-primary)] mb-2"
                    >
                      {name}
                    </Dialog.Title>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {t('card.category_label')} {category}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="ml-4 rounded-lg p-2 hover:bg-[var(--background-hover)] transition-colors"
                    aria-label={t('close', 'Fermer')}
                  >
                    <X className="h-6 w-6 text-[var(--text-secondary)]" />
                  </button>
                </div>

                {/* Price */}
                <div className="mb-6 p-4 bg-gradient-to-r from-pink-50 to-fuchsia-50 dark:from-[var(--background-secondary)] dark:to-[var(--background-secondary)] rounded-lg border border-pink-100 dark:border-[var(--border-default)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">
                      {t('card.price_currency', 'Prix')}
                    </span>
                    <span className="text-3xl font-bold text-[#E3004F]">
                      {analysis.price === 0
                        ? t('on_quote', 'Sur Devis')
                        : `${analysis.price.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} MAD`
                      }
                    </span>
                  </div>
                </div>

                {/* Description */}
                {description && description.trim() && (
                  <div className="mb-6 p-4 bg-[var(--background-default)] rounded-lg border border-[var(--border-default)]">
                    <h4 className="font-semibold text-[var(--text-primary)] mb-2">
                      {t('card.description_label', 'Description')}
                    </h4>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      {description}
                    </p>
                  </div>
                )}

                {/* Technical Name */}
                {technicalName && technicalName.trim() && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1 uppercase tracking-wide">
                      {t('card.technical_name_label', 'Nom Technique')}
                    </h4>
                    <p className="text-sm text-[var(--text-primary)] font-mono">
                      {technicalName}
                    </p>
                  </div>
                )}

                {/* Preparation Instructions */}
                {preparation && preparation.trim() && (
                  <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-[var(--text-primary)] mb-1">
                        {t('card.preparation_label', 'Préparation')}
                      </h4>
                      <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">
                        {preparation}
                      </p>
                    </div>
                  </div>
                )}

                {/* No preparation message */}
                {(!preparation || !preparation.trim()) && (
                  <div className="mb-6 p-4 bg-[var(--background-default)] rounded-lg border border-[var(--border-default)]">
                    <p className="text-sm text-[var(--text-secondary)] text-center">
                      {t('card.no_preparation', 'Aucune préparation spécifique requise')}
                    </p>
                  </div>
                )}

                {/* Close Button */}
                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-[var(--border-default)]">
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-lg font-medium bg-[var(--background-secondary)] text-[var(--text-primary)] hover:bg-[var(--background-hover)] transition-colors"
                  >
                    {t('close', 'Fermer')}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default AnalysisDetailsModal;
