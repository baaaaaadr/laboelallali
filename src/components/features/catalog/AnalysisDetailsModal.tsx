"use client";

import React from "react";
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, AlertCircle, Clock } from 'lucide-react';
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
  const delay = isArabic ? analysis.delay_ar : analysis.delay_fr;

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
                className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all"
                dir={isArabic ? 'rtl' : 'ltr'}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <Dialog.Title
                      as="h3"
                      className="text-2xl font-bold text-gray-900 dark:text-white mb-2"
                    >
                      {name}
                    </Dialog.Title>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('card.category_label')} {category}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="ml-4 rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label={t('close', 'Fermer')}
                  >
                    <X className="h-6 w-6 text-gray-500" />
                  </button>
                </div>

                {/* Price */}
                <div className="mb-6 p-4 bg-gradient-to-r from-pink-50 to-fuchsia-50 dark:from-pink-900/20 dark:to-fuchsia-900/20 rounded-lg border border-pink-100 dark:border-pink-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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

                {/* Delay */}
                {delay && delay.trim() && (
                  <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {t('card.delay_label', 'Délai')}
                      </h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                        {delay}
                      </p>
                    </div>
                  </div>
                )}

                {/* Preparation Instructions */}
                {preparation && preparation.trim() && (
                  <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {t('card.preparation_label', 'Préparation')}
                      </h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                        {preparation}
                      </p>
                    </div>
                  </div>
                )}

                {/* No preparation message */}
                {(!preparation || !preparation.trim()) && (
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      {t('card.no_preparation', 'Aucune préparation spécifique requise')}
                    </p>
                  </div>
                )}

                {/* Close Button */}
                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
