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

  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Pre-select all analyses that are not already in cart when modal opens
  useEffect(() => {
    if (bilan && isOpen) {
      const preSelected = new Set<string>(
        compositionAnalyses
          .filter(a => !selectedAnalysesInCart.has(a.id))
          .map(a => a.id)
      );
      setSelectedCodes(preSelected);
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md" />
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
                w-full max-w-2xl transform overflow-hidden rounded-lg
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
                    className="ml-4 rounded-lg p-2 text-[var(--text-secondary)] hover:text-[var(--color-bordeaux-primary)] hover:bg-[var(--color-bordeaux-pale)] transition-colors duration-200 focus:outline-none"
                    aria-label={t('close', 'Fermer')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Price section */}
                <div
                  className="mb-6 p-4 rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-bordeaux-pale)',
                    border: '1.5px solid rgba(128,0,32,0.2)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)] mb-0.5">
                        {t('bilan.total_selected', 'Total des analyses sélectionnées')}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {selectedCodes.size} {selectedCodes.size === 1 ? t('bilan.analysis', 'analyse') : t('bilan.analyses', 'analyses')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold" style={{ color: 'var(--color-bordeaux-primary)' }}>
                        {totalPrice.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')}
                      </span>
                      <span className="text-sm font-medium text-[var(--text-secondary)] ml-1">
                        {t('card.price_currency', 'MAD')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Composition section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-[var(--text-primary)]">
                      {t('bilan_includes', 'Inclus dans ce bilan')} ({selectedCodes.size}/{compositionAnalyses.length})
                    </h4>
                    {(() => {
                      const selectableIds = compositionAnalyses
                        .filter(a => !selectedAnalysesInCart.has(a.id))
                        .map(a => a.id);
                      const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedCodes.has(id));
                      return (
                        <button
                          onClick={() => {
                            setSelectedCodes(new Set(allSelected ? [] : selectableIds));
                          }}
                          className="text-sm font-medium px-3 py-1 rounded-lg border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1"
                          style={{
                            color: 'var(--color-bordeaux-primary)',
                            borderColor: 'var(--color-bordeaux-primary)',
                            backgroundColor: 'transparent',
                          }}
                        >
                          {allSelected
                            ? t('bilan.deselect_all', 'Tout décocher')
                            : t('bilan.select_all', 'Tout sélectionner')}
                        </button>
                      );
                    })()}
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {compositionAnalyses.map((analyse) => {
                      const analyseName = isArabic ? analyse.Nom_Patient_AR : analyse.Nom_Patient_FR;
                      const isInCart = selectedAnalysesInCart.has(analyse.id);
                      const isChecked = selectedCodes.has(analyse.id) || isInCart;

                      return (
                        <label
                          key={analyse.id}
                          className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-150 ${isInCart ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          style={{
                            backgroundColor: isChecked ? 'var(--color-bordeaux-pale)' : 'var(--background-default)',
                            border: isChecked
                              ? '1.5px solid rgba(128,0,32,0.25)'
                              : '1.5px solid transparent',
                          }}
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
                                  if (newSet.has(analyse.id)) newSet.delete(analyse.id);
                                  else newSet.add(analyse.id);
                                  return newSet;
                                });
                              }
                            }}
                            className={`mt-0.5 w-4 h-4 rounded ${isInCart ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            style={{ accentColor: '#800020' }}
                          />

                          {/* Analyse Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium leading-snug ${isInCart ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                              {analyseName}
                              {isInCart && (
                                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--status-success)' }}>
                                  ✓ Déjà dans le panier
                                </span>
                              )}
                            </p>
                            {analyse.Description_Patient_FR && (
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                                {isArabic ? analyse.Description_Patient_AR : analyse.Description_Patient_FR}
                              </p>
                            )}
                          </div>

                          {/* Prix */}
                          <span
                            className="text-sm font-semibold flex-shrink-0"
                            style={{ color: isChecked ? 'var(--color-bordeaux-primary)' : 'var(--text-secondary)' }}
                          >
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
                    className="flex-1 px-6 py-3 text-sm rounded-lg font-medium transition-colors duration-200 focus:outline-none"
                    style={{
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'transparent',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--background-secondary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    {t('close', 'Fermer')}
                  </button>

                  <button
                    onClick={() => {
                      const selectedAnalyses = compositionAnalyses.filter(analyse =>
                        selectedCodes.has(analyse.id) && !selectedAnalysesInCart.has(analyse.id)
                      );
                      if (selectedAnalyses.length === 0) {
                        showNotification(t('bilan.select_at_least_one', 'Veuillez sélectionner au moins une analyse'), 'error');
                        return;
                      }
                      onAddAnalysesToCart(selectedAnalyses);
                      showNotification(t('bilan.added_to_cart', `${selectedAnalyses.length} analyse(s) ajoutée(s) au panier`), 'success');
                      setTimeout(() => onClose(), 500);
                    }}
                    disabled={selectedCount === 0}
                    className="flex-1 px-6 py-3 text-sm rounded-lg font-semibold transition-all duration-200 shadow-md focus:outline-none"
                    style={{
                      backgroundColor: selectedCount === 0 ? 'var(--background-secondary)' : '#800020',
                      color: selectedCount === 0 ? 'var(--text-secondary)' : '#FFFFFF',
                      cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                      opacity: selectedCount === 0 ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (selectedCount > 0) (e.currentTarget as HTMLElement).style.backgroundColor = '#600018'; }}
                    onMouseLeave={e => { if (selectedCount > 0) (e.currentTarget as HTMLElement).style.backgroundColor = '#800020'; }}
                  >
                    {t('bilan.add_analyses', 'Ajouter')} {selectedCount > 0 ? `${selectedCount} analyse${selectedCount > 1 ? 's' : ''}` : ''}
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
            rounded-lg shadow-2xl
            border-2 ${toastType === 'success' ? 'border-green-500' : 'border-red-500'}
            p-4
            flex items-center gap-3
          `}>
            {toastType === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-[var(--status-success)] flex-shrink-0" />
            ) : (
              <X className="w-6 h-6 text-[var(--status-error)] flex-shrink-0" />
            )}
            <p className={`text-sm font-medium ${toastType === 'success' ? 'text-[var(--status-success)]' : 'text-red-700 dark:text-red-300'}`}>
              {toastMessage}
            </p>
          </div>
        </Transition>
      </Dialog>
    </Transition>
  );
}

export default BilanDetailsModal;
