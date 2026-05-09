"use client";

import React from "react";
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  X, FileText, Stethoscope, CalendarCheck,
  AlertCircle, CheckCircle2, MessageCircle, TestTube
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CartItem, AnalyseItem } from './AnalysisCard';
import { usePreparationRules } from '@/hooks/usePreparationRules';

interface PreparationSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  totalCost: number;
  lang: string;
  analysesMap: Map<string, AnalyseItem>;
}

export function PreparationSummary({
  isOpen,
  onClose,
  cartItems,
  totalCost,
  lang,
  analysesMap
}: PreparationSummaryProps) {
  const { t } = useTranslation('catalog');
  const isArabic = lang === 'ar';
  const locale = isArabic ? 'ar-MA' : 'fr-MA';

  const { maxJeune, maxDRR, sampleTypes, specialInstructions, uniqueAnalysisCount } =
    usePreparationRules(cartItems, analysesMap);

  const handleWhatsApp = () => {
    console.log('[PreparationSummary] WhatsApp CTA clicked', {
      maxJeune,
      maxDRR,
      sampleTypes,
      specialInstructions,
      totalCost,
    });
  };

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
          <div className="flex min-h-full items-center justify-center p-4">
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
                className="w-full max-w-2xl transform rounded-2xl bg-[var(--background-default)] shadow-2xl transition-all border border-[var(--border-default)] overflow-hidden"
                dir={isArabic ? 'rtl' : 'ltr'}
              >
                {/* Boarding-pass header */}
                <div className="bg-[#800020] px-6 py-5 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        {t('preparation_summary.subtitle', 'Fiche de préparation')}
                      </p>
                      <Dialog.Title as="h2" className="text-xl font-bold text-white">
                        {t('preparation_summary.title', 'Votre visite au laboratoire')}
                      </Dialog.Title>
                      <p className="text-sm text-white/70 mt-1">
                        {t('preparation_summary.analyses_count', '{{count}} analyse(s) sélectionnée(s)', { count: uniqueAnalysisCount })}
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="rounded-lg p-2 hover:bg-white/10 transition-colors ml-4 flex-shrink-0"
                      aria-label={t('close', 'Fermer')}
                    >
                      <X className="h-5 w-5 text-white" />
                    </button>
                  </div>
                </div>

                {/* Tear-off perforation */}
                <div className="flex items-center bg-[var(--background-default)]">
                  <div className="w-5 h-5 rounded-full bg-[var(--background-default)] border-2 border-[var(--border-default)] -ml-2.5 flex-shrink-0" />
                  <div className="flex-1 border-t-2 border-dashed border-[var(--border-default)] mx-1" />
                  <div className="w-5 h-5 rounded-full bg-[var(--background-default)] border-2 border-[var(--border-default)] -mr-2.5 flex-shrink-0" />
                </div>

                {/* Scrollable body */}
                <div className="px-6 py-5 space-y-4 max-h-[62vh] overflow-y-auto">

                  {/* Card 1 — Documents Administratifs */}
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--background-card)] overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-[var(--border-default)]">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="font-bold text-[var(--text-primary)]">
                        {t('preparation_summary.card_documents_title', 'Documents Administratifs')}
                      </h3>
                    </div>
                    <ul className="px-5 py-4 space-y-3">
                      {[
                        t('preparation_summary.cin', "Carte d'Identité Nationale (CIN)"),
                        t('preparation_summary.mutuelle', "Carte de Mutuelle / Assurance"),
                        t('preparation_summary.ordonnance', "Ordonnance médicale (si vous en avez une)"),
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-[0.45rem] flex-shrink-0" />
                          <span className="text-sm text-[var(--text-primary)]">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card 2 — Prélèvements & Préparation */}
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--background-card)] overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 bg-teal-50 dark:bg-teal-900/20 border-b border-[var(--border-default)]">
                      <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <h3 className="font-bold text-[var(--text-primary)]">
                        {t('preparation_summary.card_samples_title', 'Vos Prélèvements & Préparation')}
                      </h3>
                    </div>
                    <div className="px-5 py-4 space-y-4">

                      {/* Sample type badges */}
                      {sampleTypes.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {sampleTypes.map((type, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-700"
                            >
                              <TestTube className="h-3.5 w-3.5" />
                              {type}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Tubes note */}
                      <p className="text-xs text-[var(--text-secondary)] italic leading-relaxed">
                        {t('preparation_summary.tubes_provided', 'Les flacons et tubes nécessaires sont fournis directement par le laboratoire.')}
                      </p>

                      {/* Fasting alert */}
                      {maxJeune > 0 ? (
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700">
                          <span className="text-xl flex-shrink-0 leading-none mt-0.5">⚠️</span>
                          <p className="text-sm font-semibold text-orange-800 dark:text-orange-200 leading-relaxed">
                            {t('preparation_summary.fasting_warning', 'Jeûne strict de {{hours}} heures requis avant votre prise de sang.', { hours: maxJeune })}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            {t('preparation_summary.fasting_ok', 'Aucun jeûne obligatoire pour vos analyses.')}
                          </p>
                        </div>
                      )}

                      {/* Special instructions */}
                      {specialInstructions.length > 0 && (
                        <div className="space-y-2">
                          {specialInstructions.map((instr, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700"
                            >
                              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{instr}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 3 — Délai & Devis */}
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--background-card)] overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 bg-green-50 dark:bg-green-900/20 border-b border-[var(--border-default)]">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                        <CalendarCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="font-bold text-[var(--text-primary)]">
                        {t('preparation_summary.card_delay_title', 'Délai & Devis')}
                      </h3>
                    </div>
                    <div className="px-5 py-4 space-y-4">
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                        {maxDRR === 0
                          ? t('preparation_summary.delay_same_day', 'Résultats partiels ou complets disponibles le jour même.')
                          : t('preparation_summary.delay_days', 'Vos résultats seront disponibles sous {{days}} jour(s).', { days: maxDRR })
                        }
                      </p>
                      <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--background-default)] border border-[var(--border-default)]">
                        <span className="text-sm font-medium text-[var(--text-secondary)]">
                          {t('preparation_summary.total_label', 'Montant estimé de votre bilan')}
                        </span>
                        <span className="text-2xl font-bold text-[#E3004F]">
                          {totalCost === 0
                            ? t('on_quote', 'Sur Devis')
                            : `${totalCost.toLocaleString(locale)} MAD`
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer — WhatsApp CTA */}
                <div className="px-6 py-5 border-t border-[var(--border-default)] bg-[var(--background-card)]">
                  <button
                    onClick={handleWhatsApp}
                    className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-[var(--status-success)] hover:brightness-95 active:scale-[0.98] text-white font-bold text-base transition-all shadow-lg"
                  >
                    <MessageCircle className="h-5 w-5 flex-shrink-0" />
                    {t('preparation_summary.whatsapp_cta', 'Envoyer mon récapitulatif sur WhatsApp')}
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

export default PreparationSummary;
