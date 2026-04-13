"use client";

import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Trash2, MessageCircle, ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CartItem, AnalyseItem, BilanItem } from './AnalysisCard';

interface CartDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: CartItem[];
  totalCost: number;
  onRemoveItem: (item: CartItem) => void;
  onClearCart: () => void;
  onWhatsAppSend: () => void;
  currencyLabel: string;
  isRtl?: boolean;
  onViewAnalysisDetails: (analysis: AnalyseItem) => void;
  onViewBilanDetails: (bilan: BilanItem) => void;
}

export function CartDetailsModal({
  isOpen,
  onClose,
  selectedItems,
  totalCost,
  onRemoveItem,
  onClearCart,
  onWhatsAppSend,
  currencyLabel,
  isRtl = false,
  onViewAnalysisDetails,
  onViewBilanDetails
}: CartDetailsModalProps) {
  const { t } = useTranslation('common');

  // Séparer bilans et analyses
  const bilans = selectedItems.filter(item => item.type === 'bilan');
  const analyses = selectedItems.filter(item => item.type === 'analyse');

  const handleItemClick = (item: CartItem) => {
    if (item.type === 'analyse') {
      onViewAnalysisDetails(item.item);
    } else {
      onViewBilanDetails(item.item);
    }
  };

  const getItemName = (item: CartItem) => {
    if (item.type === 'analyse') {
      const name = isRtl ? item.item.Nom_Patient_AR : item.item.Nom_Patient_FR;
      console.log('🔍 DEBUG getItemName - analyse:', {
        type: item.type,
        id: item.item.id,
        Nom_Patient_FR: item.item.Nom_Patient_FR,
        Nom_Patient_AR: item.item.Nom_Patient_AR,
        Categorie_FR: item.item.Categorie_FR,
        Categorie_AR: item.item.Categorie_AR,
        returnedName: name,
        isRtl
      });
      return name;
    } else {
      return isRtl ? item.item.Nom_Bilan_AR : item.item.Nom_Bilan_FR;
    }
  };

  const getItemCategory = (item: CartItem) => {
    if (item.type === 'analyse') {
      return isRtl ? item.item.Categorie_AR : item.item.Categorie_FR;
    } else {
      return t('analyses_catalog.selection.bilans_section', 'Bilan');
    }
  };

  const getItemPrice = (item: CartItem) => {
    return item.type === 'analyse' ? item.item.Prix_Dhs : item.item.Prix_Affiche_Dhs;
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose} dir={isRtl ? 'rtl' : 'ltr'}>
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
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-0 md:p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-full md:translate-y-0 md:scale-95"
              enterTo="opacity-100 translate-y-0 md:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 md:scale-100"
              leaveTo="opacity-0 translate-y-full md:translate-y-0 md:scale-95"
            >
              <Dialog.Panel className="w-full md:max-w-2xl transform overflow-hidden md:rounded-2xl rounded-t-3xl bg-[var(--background-card)] text-left align-middle shadow-2xl transition-all fixed md:relative bottom-0 md:bottom-auto max-h-[85vh] md:max-h-[90vh] flex flex-col border border-[var(--border-default)]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--background-card)] sticky top-0 z-10">
                  <Dialog.Title
                    as="h3"
                    className="text-xl font-bold text-gray-900 dark:text-white"
                  >
                    {t('analyses_catalog.selection.cart_details_title', 'Mon Panier')}
                  </Dialog.Title>

                  <div className="flex items-center gap-2">
                    {selectedItems.length > 0 && (
                      <button
                        onClick={onClearCart}
                        className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                        aria-label={t('analyses_catalog.selection.clear_all', 'Tout supprimer')}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                      aria-label="Fermer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {selectedItems.length === 0 ? (
                    /* État vide */
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <ShoppingCart className="h-16 w-16 text-[var(--text-tertiary)] mb-4" />
                      <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                        {t('analyses_catalog.selection.cart_empty', 'Votre panier est vide')}
                      </p>
                      <button
                        onClick={onClose}
                        className="mt-4 px-6 py-2 bg-[#E3004F] text-white rounded-lg hover:bg-[#c20042] transition-colors"
                      >
                        {t('analyses_catalog.selection.continue_shopping', 'Continuer mes achats')}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6" role="list">
                      {/* Section Bilans */}
                      {bilans.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                            {t('analyses_catalog.selection.bilans_section', 'Bilans')} ({bilans.length})
                          </h4>
                          <div className="space-y-2">
                            {bilans.map((item, index) => (
                              <div
                                key={`bilan-${item.item.ID_Bilan}-${index}`}
                                className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 group"
                              >
                                <button
                                  onClick={() => handleItemClick(item)}
                                  className="flex-1 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-colors"
                                >
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-900 dark:text-white group-hover:text-[#E3004F] transition-colors">
                                      {getItemName(item)}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      {getItemCategory(item)}
                                    </p>
                                  </div>
                                  <span className="text-lg font-bold text-[#E3004F] flex-shrink-0">
                                    {getItemPrice(item).toLocaleString(isRtl ? 'ar-MA' : 'fr-MA')} {currencyLabel}
                                  </span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveItem(item);
                                  }}
                                  className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors ml-2 flex-shrink-0"
                                  aria-label={t('analyses_catalog.selection.remove_item', 'Retirer')}
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section Analyses */}
                      {analyses.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                            {t('analyses_catalog.selection.analyses_section', 'Analyses')} ({analyses.length})
                          </h4>
                          <div className="space-y-2">
                            {analyses.map((item, index) => (
                              <div
                                key={`analyse-${item.item.ID_Analyse}-${index}`}
                                className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 group"
                              >
                                <button
                                  onClick={() => handleItemClick(item)}
                                  className="flex-1 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-colors"
                                >
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-900 dark:text-white group-hover:text-[#E3004F] transition-colors">
                                      {getItemName(item)}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      {getItemCategory(item)}
                                    </p>
                                  </div>
                                  <span className="text-lg font-bold text-[#E3004F] flex-shrink-0">
                                    {getItemPrice(item).toLocaleString(isRtl ? 'ar-MA' : 'fr-MA')} {currencyLabel}
                                  </span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveItem(item);
                                  }}
                                  className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors ml-2 flex-shrink-0"
                                  aria-label={t('analyses_catalog.selection.remove_item', 'Retirer')}
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer - Sticky */}
                {selectedItems.length > 0 && (
                  <div className="border-t border-[var(--border-default)] px-6 py-4 space-y-4 bg-[var(--background-card)] sticky bottom-0">
                    {/* Total */}
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {t('analyses_catalog.selection.total', 'Total')}:
                      </span>
                      <span className="text-2xl font-bold text-[#E3004F]">
                        {totalCost.toLocaleString(isRtl ? 'ar-MA' : 'fr-MA')} {currencyLabel}
                      </span>
                    </div>

                    {/* WhatsApp Button */}
                    <button
                      onClick={onWhatsAppSend}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors shadow-md"
                      aria-label={t('analyses_catalog.selection.send_whatsapp', 'Envoyer via WhatsApp')}
                    >
                      <MessageCircle className="h-5 w-5" />
                      {t('analyses_catalog.selection.send_whatsapp', 'Envoyer via WhatsApp')}
                    </button>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default CartDetailsModal;
