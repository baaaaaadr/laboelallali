"use client";

import React, { Fragment, useMemo, useState, useEffect } from "react";
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
  normalizedAnalysesMap: Map<string, AnalyseItem>;
  lang: string;
  onAddAnalysesToCart: (analyses: AnalyseItem[]) => void;
  selectedAnalysesInCart: Set<string>;
}

export function BilanDetailsModal({
  bilan,
  isOpen,
  onClose,
  analysesMap,
  normalizedAnalysesMap,
  lang,
  onAddAnalysesToCart,
  selectedAnalysesInCart
}: BilanDetailsModalProps) {
  const { t } = useTranslation('catalog');
  const isArabic = lang === "ar";

  // Normalize ID helper - removes all spaces and converts to uppercase
  const normalizeId = (id: string) => id.replace(/\s+/g, '').toUpperCase();

  // State for selected analysis codes
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(() => {
    return new Set(bilan?.Composition_Codes || []);
  });

  // Reset selection when bilan changes
  useEffect(() => {
    if (bilan) {
      setSelectedCodes(new Set(bilan.Composition_Codes));
    }
  }, [bilan]);

  // Get composition analyses with details using normalized matching
  const compositionAnalyses = useMemo(() => {
    if (!bilan) return [];

    return bilan.Composition_Codes
      .map(code => {
        const normalizedCode = normalizeId(code);
        const analyse = normalizedAnalysesMap.get(normalizedCode);

        if (!analyse) {
          console.warn(`⚠️ Analyse non trouvée pour code: "${code}" (normalisé: "${normalizedCode}")`);
        }

        return analyse;
      })
      .filter((analyse): analyse is AnalyseItem => analyse !== undefined);
  }, [bilan, normalizedAnalysesMap]);

  // Calculate total price dynamically based on selected analyses
  const totalPrice = useMemo(() => {
    return compositionAnalyses
      .filter(analyse => selectedCodes.has(analyse.id))
      .reduce((sum, analyse) => sum + analyse.Prix_Dhs, 0);
  }, [compositionAnalyses, selectedCodes]);

  const selectedCount = selectedCodes.size;

  if (!bilan) return null;

  const IconComponent = getIconComponent(bilan.Icone);
  const bilanName = isArabic ? bilan.Nom_Bilan_AR : bilan.Nom_Bilan_FR;
  const bilanDescription = isArabic ? bilan.Description_AR : bilan.Description_FR;
  const bilanCategory = bilan.Categorie;

  // Debug logging when modal opens (only once per modal open)
  useEffect(() => {
    if (bilan && isOpen) {
      console.group(`📊 Bilan Modal Opened: "${bilanName}"`);
      console.log('Composition_Codes:', bilan.Composition_Codes);
      console.log('Analyses trouvées:', compositionAnalyses.length);
      console.log('Analyses manquantes:', bilan.Composition_Codes.length - compositionAnalyses.length);

      if (compositionAnalyses.length < bilan.Composition_Codes.length) {
        const foundIds = new Set(compositionAnalyses.map(a => normalizeId(a.id)));
        const missingCodes = bilan.Composition_Codes.filter(code =>
          !foundIds.has(normalizeId(code))
        );
        console.error('❌ Codes manquants:', missingCodes);
      }

      // Calculate total at this moment
      const currentTotal = compositionAnalyses
        .filter(analyse => selectedCodes.has(analyse.id))
        .reduce((sum, analyse) => sum + analyse.Prix_Dhs, 0);
      console.log('Prix total initial:', currentTotal, 'MAD');
      console.groupEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bilan?.id, isOpen]);

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
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        {bilanCategory}
                      </p>
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
                <div className="mb-6 p-4 rounded-xl bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)] border-2 border-[var(--color-fuchsia-accent)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)] mb-1">
                        {t('bilan.total_selected', 'Total des analyses sélectionnées')}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {selectedCount} {selectedCount === 1 ? t('bilan.analysis', 'analyse') : t('bilan.analyses', 'analyses')}
                      </p>
                    </div>
                    <span className="text-3xl font-bold text-[var(--color-fuchsia-accent)]">
                      {totalPrice.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} {t('card.price_currency', 'MAD')}
                    </span>
                  </div>
                </div>

                {/* Composition section */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    {t('bilan_includes', 'Inclus dans ce bilan')} ({selectedCount}/{compositionAnalyses.length})
                  </h4>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {compositionAnalyses.map((analyse) => {
                      const analyseName = isArabic ? analyse.Nom_Patient_AR : analyse.Nom_Patient_FR;
                      const isChecked = selectedCodes.has(analyse.id);
                      const isInCart = selectedAnalysesInCart.has(analyse.id);

                      return (
                        <label
                          key={analyse.id}
                          className={`
                            flex items-start gap-3 p-3 rounded-lg cursor-pointer
                            transition-colors duration-200
                            ${isChecked
                              ? 'bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)] border-2 border-[var(--color-fuchsia-accent)]'
                              : 'bg-gray-50 dark:bg-gray-800 border-2 border-transparent hover:border-gray-300'
                            }
                          `}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedCodes(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(analyse.id)) {
                                  newSet.delete(analyse.id);
                                } else {
                                  newSet.add(analyse.id);
                                }
                                return newSet;
                              });
                            }}
                            className="mt-1 w-5 h-5 text-[var(--color-fuchsia-accent)] rounded
                              focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:ring-offset-2"
                          />

                          {/* Analyse Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">
                              {analyseName}
                            </p>
                            {analyse.Description_Patient_FR && (
                              <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                                {isArabic ? analyse.Description_Patient_AR : analyse.Description_Patient_FR}
                              </p>
                            )}
                            {isInCart && (
                              <span className="inline-block mt-1 text-xs text-green-600 dark:text-green-400">
                                ✓ {t('card.selected', 'Déjà dans le panier')}
                              </span>
                            )}
                          </div>

                          {/* Prix */}
                          <span className={`text-sm font-medium flex-shrink-0 ${isChecked ? 'text-[var(--color-fuchsia-accent)]' : 'text-[var(--text-secondary)]'}`}>
                            {analyse.Prix_Dhs.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} {t('card.price_currency', 'MAD')}
                          </span>
                        </label>
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
                      // Get selected analyses
                      const selectedAnalyses = compositionAnalyses.filter(analyse =>
                        selectedCodes.has(analyse.id)
                      );

                      if (selectedAnalyses.length === 0) {
                        alert(t('bilan.select_at_least_one', 'Veuillez sélectionner au moins une analyse'));
                        return;
                      }

                      // Add to cart
                      onAddAnalysesToCart(selectedAnalyses);

                      // Success notification
                      alert(t('bilan.added_to_cart', `${selectedAnalyses.length} analyse(s) ajoutée(s) au panier`));

                      // Close modal
                      onClose();
                    }}
                    disabled={selectedCount === 0}
                    className={`
                      flex-1 px-6 py-3 text-sm rounded-lg font-medium
                      transition-all duration-200
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:ring-opacity-50
                      ${selectedCount === 0
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-[var(--color-fuchsia-accent)] text-white hover:bg-[var(--color-fuchsia-dark)]'
                      }
                    `}
                  >
                    {t('bilan.add_selected', `Ajouter ${selectedCount} analyse(s)`)}
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
