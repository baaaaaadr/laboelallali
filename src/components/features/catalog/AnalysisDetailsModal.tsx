"use client";

import React from "react";
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, TestTube, Clock, CalendarClock, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AnalyseItem } from './AnalysisCard';

interface AnalysisDetailsModalProps {
  analysis: AnalyseItem | null;
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

  const name = isArabic ? analysis.Nom_Patient_AR : analysis.Nom_Patient_FR;
  const category = isArabic ? analysis.Categorie_AR : analysis.Categorie_FR;
  const description = isArabic ? analysis.Description_Patient_AR : analysis.Description_Patient_FR;
  const technicalName = analysis.Nom_Technique;

  const fastingHours = analysis.CPA_Jeune_H ?? 0;
  const deliveryDays = analysis.DRR_Jours ?? 0;
  const requiresFasting = fastingHours > 0;

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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md" />
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
                      {analysis.Prix_Dhs === 0
                        ? t('on_quote', 'Sur Devis')
                        : `${analysis.Prix_Dhs.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} MAD`
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

                {/* Pre-Analytics Grid */}
                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
                    {t('preanalytic.section_label', 'Conditions pré-analytiques')}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    {/* Sample type */}
                    {analysis.CPA_Type && (
                      <div className="flex items-center gap-3 p-3 bg-[var(--background-default)] rounded-lg border border-[var(--border-default)]">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <TestTube className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-xs text-[var(--text-secondary)] font-medium">
                            {t('preanalytic.type_label', 'Type de prélèvement')}
                          </p>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {analysis.CPA_Type}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Fasting */}
                    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                      requiresFasting
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                        : 'bg-[var(--background-default)] border-[var(--border-default)]'
                    }`}>
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                        requiresFasting
                          ? 'bg-orange-100 dark:bg-orange-900/40'
                          : 'bg-[var(--background-secondary)]'
                      }`}>
                        <Clock className={`h-4 w-4 ${
                          requiresFasting
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-[var(--text-secondary)]'
                        }`} />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-secondary)] font-medium">
                          {t('preanalytic.fasting_label', 'Condition de jeûne')}
                        </p>
                        <p className={`text-sm font-semibold ${
                          requiresFasting
                            ? 'text-orange-700 dark:text-orange-300'
                            : 'text-[var(--text-primary)]'
                        }`}>
                          {requiresFasting
                            ? t('preanalytic.fasting_required', 'Jeûne strict requis : {{hours}}h', { hours: fastingHours })
                            : t('preanalytic.fasting_not_required', 'Jeûne non obligatoire')
                          }
                        </p>
                      </div>
                    </div>

                    {/* Delivery time */}
                    <div className="flex items-center gap-3 p-3 bg-[var(--background-default)] rounded-lg border border-[var(--border-default)]">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--background-secondary)] flex items-center justify-center">
                        <CalendarClock className="h-4 w-4 text-[var(--text-secondary)]" />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-secondary)] font-medium">
                          {t('preanalytic.delay_label', 'Délai de rendu')}
                        </p>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {deliveryDays === 0
                            ? t('preanalytic.delay_same_day', 'Résultat le jour même')
                            : t('preanalytic.delay_days', 'Résultat sous {{days}} jour(s)', { days: deliveryDays })
                          }
                        </p>
                      </div>
                    </div>

                    {/* Special instructions */}
                    {analysis.CPA_Instructions && analysis.CPA_Instructions.trim() && (
                      <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 sm:col-span-2">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                            {t('preanalytic.special_instructions_label', 'Consignes spéciales')}
                          </p>
                          <p className="text-sm text-[var(--text-primary)] mt-0.5 whitespace-pre-line leading-relaxed">
                            {analysis.CPA_Instructions}
                          </p>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* Close Button */}
                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-[var(--border-default)]">
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-lg font-bold bg-[var(--color-fuchsia-accent)] text-white hover:bg-[var(--color-fuchsia-bright)] transition-all shadow-md active:scale-95"
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
