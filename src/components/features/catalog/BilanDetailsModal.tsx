"use client";

import React, { Fragment, useMemo } from "react";
import { Dialog, Transition } from '@headlessui/react';
import { X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BilanItem, AnalyseItem } from './AnalysisCard';
import { getIconComponent } from '@/utils/iconMapper';

interface BilanDetailsModalProps {
  bilan: BilanItem | null;
  isOpen: boolean;
  onClose: () => void;
  analysesMap: Map<string, AnalyseItem>;
  lang: string;
  onAddToCart: (bilan: BilanItem) => void;
  isInCart?: boolean;
}

export function BilanDetailsModal({
  bilan,
  isOpen,
  onClose,
  analysesMap,
  lang,
  onAddToCart,
  isInCart = false
}: BilanDetailsModalProps) {
  const { t } = useTranslation('catalog');
  const isArabic = lang === "ar";

  // Get composition analyses with details
  const compositionAnalyses = useMemo(() => {
    if (!bilan) return [];

    return bilan.Composition_Codes
      .map(code => analysesMap.get(code))
      .filter((analyse): analyse is AnalyseItem => analyse !== undefined);
  }, [bilan, analysesMap]);

  // Calculate total of individual analyses
  const individualTotal = useMemo(() => {
    return compositionAnalyses.reduce((sum, analyse) => sum + analyse.Prix_Dhs, 0);
  }, [compositionAnalyses]);

  if (!bilan) return null;

  const IconComponent = getIconComponent(bilan.Icone);
  const bilanName = isArabic ? bilan.Nom_Bilan_AR : bilan.Nom_Bilan_FR;
  const bilanDescription = isArabic ? bilan.Description_AR : bilan.Description_FR;

  const savings = individualTotal - bilan.Prix_Affiche_Dhs;
  const savingsPercentage = individualTotal > 0 ? ((savings / individualTotal) * 100).toFixed(0) : '0';

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70" />
        </Transition.Child>

        {/* Modal container */}
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
              <Dialog.Panel className="
                w-full max-w-2xl transform overflow-hidden rounded-2xl
                bg-[var(--background-default)] dark:bg-[var(--background-secondary)]
                p-6 text-left align-middle shadow-xl transition-all
              ">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="
                      flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center
                      bg-[var(--color-bordeaux-primary)] text-white
                    ">
                      <IconComponent className="w-8 h-8" />
                    </div>

                    <div className="flex-1">
                      <Dialog.Title
                        as="h3"
                        className="text-2xl font-bold text-[var(--color-bordeaux-primary)] mb-2"
                      >
                        {bilanName}
                      </Dialog.Title>
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        {bilanDescription}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="
                      ml-4 rounded-lg p-2
                      text-[var(--text-secondary)] hover:text-[var(--color-bordeaux-primary)]
                      hover:bg-[var(--background-tertiary)]
                      transition-colors duration-200
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:ring-opacity-50
                    "
                    aria-label={t('close', 'Fermer')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Price section */}
                <div className="mb-6 p-4 rounded-xl bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {t('bilan_price_label', 'Prix du bilan')}
                    </span>
                    <span className="text-3xl font-bold text-[var(--color-fuchsia-accent)]">
                      {bilan.Prix_Affiche_Dhs.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} {t('card.price_currency', 'MAD')}
                    </span>
                  </div>

                  {savings > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">
                        {t('individual_total', 'Total analyses séparées')}
                      </span>
                      <div className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="line-through text-[var(--text-tertiary)]">
                          {individualTotal.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} {t('card.price_currency', 'MAD')}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                          -{savingsPercentage}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Composition section */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    {t('bilan_includes', 'Inclus dans ce bilan')} ({compositionAnalyses.length})
                  </h4>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {compositionAnalyses.map((analyse) => {
                      const analyseName = isArabic ? analyse.Nom_Patient_AR : analyse.Nom_Patient_FR;
                      return (
                        <div
                          key={analyse.id}
                          className="
                            flex items-start gap-3 p-3 rounded-lg
                            bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)]
                            border border-[var(--border-default)]
                          "
                        >
                          <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">
                              {analyseName}
                            </p>
                            {analyse.Description_Patient_FR && (
                              <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                                {isArabic ? analyse.Description_Patient_AR : analyse.Description_Patient_FR}
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-medium text-[var(--text-secondary)] flex-shrink-0">
                            {analyse.Prix_Dhs.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} {t('card.price_currency', 'MAD')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className={`flex gap-3 ${isArabic ? 'flex-row-reverse' : 'flex-row'}`}>
                  <button
                    onClick={onClose}
                    className="
                      flex-1 px-6 py-3 text-sm rounded-lg
                      border-2 border-[var(--border-default)]
                      text-[var(--text-primary)]
                      hover:bg-[var(--background-tertiary)]
                      transition-colors duration-200
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:ring-opacity-50
                      font-medium
                    "
                  >
                    {t('close', 'Fermer')}
                  </button>

                  <button
                    onClick={() => {
                      onAddToCart(bilan);
                      onClose();
                    }}
                    disabled={isInCart}
                    className={`
                      flex-1 px-6 py-3 text-sm rounded-lg font-medium
                      transition-all duration-200
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:ring-opacity-50
                      ${isInCart
                        ? 'bg-[var(--color-gray-soft)] text-[var(--text-primary)] border-2 border-[var(--border-default)] cursor-not-allowed'
                        : 'bg-[var(--color-fuchsia-accent)] text-white hover:bg-[var(--color-fuchsia-dark)]'
                      }
                    `}
                  >
                    {isInCart ? '✓ ' + t('card.selected', 'Sélectionné') : t('add_to_cart', 'Ajouter au panier')}
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

export default BilanDetailsModal;
