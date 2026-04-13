"use client";

import React, { Fragment, useMemo, useState, useEffect } from "react";
import { Dialog, Transition } from '@headlessui/react';
import { X, Check, CheckCircle2 } from 'lucide-react';
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

  // State for selected analysis codes - start empty, user must check manually
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(() => {
    return new Set();
  });

  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Reset selection when bilan changes - clear selections
  useEffect(() => {
    if (bilan && isOpen) {
      setSelectedCodes(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bilan?.id, isOpen]);

  // Get composition analyses with details using normalized matching
  const compositionAnalyses = useMemo(() => {
    if (!bilan) return [];

    return bilan.Composition_Codes
      .map(code => {
        const normalizedCode = normalizeId(code);
        return normalizedAnalysesMap.get(normalizedCode);
      })
      .filter((analyse): analyse is AnalyseItem => analyse !== undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bilan?.id, normalizedAnalysesMap]);

  // Calculate total price dynamically based on selected analyses
  const totalPrice = useMemo(() => {
    return compositionAnalyses
      .filter(analyse => selectedCodes.has(analyse.id))
      .reduce((sum, analyse) => sum + analyse.Prix_Dhs, 0);
  }, [compositionAnalyses, selectedCodes]);

  // Count only NEW selections (exclude those already in cart)
  const selectedCount = useMemo(() => {
    return Array.from(selectedCodes).filter(id => !selectedAnalysesInCart.has(id)).length;
  }, [selectedCodes, selectedAnalysesInCart]);

  // Toast notification helper
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000); // Hide after 3 seconds
  };

  // Early return AFTER all hooks - React rules
  if (!bilan) {
    return null;
  }

  // These can only be accessed after we confirm bilan is not null
  const IconComponent = getIconComponent(bilan.Icone);
  const bilanName = isArabic ? bilan.Nom_Bilan_AR : bilan.Nom_Bilan_FR;
  const bilanDescription = isArabic ? bilan.Description_AR : bilan.Description_FR;
  const bilanCategory = bilan.Categorie;

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
                bg-[var(--background-card)]
                p-6 text-left align-middle shadow-xl transition-all
                border border-[var(--border-default)]
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
                      <p className="text-sm text-[var(--text-secondary)] mb-1">
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
                    {t('bilan_includes', 'Inclus dans ce bilan')} ({selectedCodes.size}/{compositionAnalyses.length})
                  </h4>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {compositionAnalyses.map((analyse) => {
                      const analyseName = isArabic ? analyse.Nom_Patient_AR : analyse.Nom_Patient_FR;
                      const isInCart = selectedAnalysesInCart.has(analyse.id);
                      const isChecked = selectedCodes.has(analyse.id) || isInCart;

                      return (
                        <label
                          key={analyse.id}
                          className={`
                            flex items-start gap-3 p-3 rounded-lg
                            transition-colors duration-200
                            ${isInCart ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                            ${isChecked
                              ? 'bg-[var(--background-secondary)] border-2 border-[var(--border-accent)]'
                              : 'bg-[var(--background-default)] border-2 border-transparent hover:border-[var(--border-default)]'
                            }
                          `}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isInCart}
                            onChange={() => {
                              if (!isInCart) {
                                setSelectedCodes(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(analyse.id)) {
                                    newSet.delete(analyse.id);
                                  } else {
                                    newSet.add(analyse.id);
                                  }
                                  return newSet;
                                });
                              }
                            }}
                            className={`mt-1 w-5 h-5 rounded
                              focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:ring-offset-2
                              ${isInCart
                                ? 'text-green-600 cursor-not-allowed'
                                : 'text-[var(--color-fuchsia-accent)] cursor-pointer'
                              }`}
                          />

                          {/* Analyse Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium leading-snug ${isInCart ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                              {analyseName}
                              {isInCart && (
                                <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">
                                  (Déjà dans le panier)
                                </span>
                              )}
                            </p>
                            {analyse.Description_Patient_FR && (
                              <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                                {isArabic ? analyse.Description_Patient_AR : analyse.Description_Patient_FR}
                              </p>
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
                      // Get selected analyses (exclude those already in cart)
                      const selectedAnalyses = compositionAnalyses.filter(analyse =>
                        selectedCodes.has(analyse.id) && !selectedAnalysesInCart.has(analyse.id)
                      );

                      if (selectedAnalyses.length === 0) {
                        showNotification(t('bilan.select_at_least_one', 'Veuillez sélectionner au moins une analyse'), 'error');
                        return;
                      }

                      // Add to cart
                      onAddAnalysesToCart(selectedAnalyses);

                      // Success notification
                      showNotification(t('bilan.added_to_cart', `${selectedAnalyses.length} analyse(s) ajoutée(s) au panier`), 'success');

                      // Close modal after a short delay
                      setTimeout(() => onClose(), 500);
                    }}
                    disabled={selectedCount === 0}
                    style={{
                      backgroundColor: selectedCount === 0 ? '#D1D5DB' : '#800020',
                      color: selectedCount === 0 ? '#6B7280' : '#FFFFFF',
                      opacity: selectedCount === 0 ? 0.6 : 1,
                      cursor: selectedCount === 0 ? 'not-allowed' : 'pointer'
                    }}
                    className="flex-1 px-6 py-3 text-base rounded-lg font-bold tracking-wide
                      transition-all duration-200 shadow-lg
                      focus:outline-none focus:ring-2 focus:ring-offset-2"
                    onMouseEnter={(e) => {
                      if (selectedCount > 0) {
                        e.currentTarget.style.opacity = '0.85';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCount > 0) {
                        e.currentTarget.style.opacity = '1';
                      }
                    }}
                  >
                    Ajouter {selectedCount} analyse{selectedCount > 1 ? 's' : ''}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>

        {/* Toast Notification */}
        <Transition
          show={showToast}
          as={Fragment}
          enter="transform ease-out duration-300 transition"
          enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
          enterTo="translate-y-0 opacity-100 sm:translate-x-0"
          leave="transition ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className={`
            fixed bottom-20 ${isArabic ? 'left-4' : 'right-4'} z-[60]
            max-w-sm w-full
            bg-[var(--background-card)]
            rounded-xl shadow-2xl
            border-2 ${toastType === 'success' ? 'border-green-500' : 'border-red-500'}
            p-4
            flex items-center gap-3
          `}>
            {toastType === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
            ) : (
              <X className="w-6 h-6 text-red-500 flex-shrink-0" />
            )}
            <p className={`text-sm font-medium ${toastType === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {toastMessage}
            </p>
          </div>
        </Transition>
      </Dialog>
    </Transition>
  );
}

export default BilanDetailsModal;
