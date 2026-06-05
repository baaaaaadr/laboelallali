"use client";

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Trash2, FileText, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CartItem, AnalyseItem } from './AnalysisCard';
import { usePreparationRules } from '@/hooks/usePreparationRules';
import { CartView } from './cart/CartView';
import { CartPreparation } from './cart/CartPreparation';
import { CartActions } from './cart/CartActions';
import type { CartView as CartViewType } from '@/lib/cart/cartView';

type TabId = 'devis' | 'preparation';

interface CartDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: CartItem[];
  cartView: CartViewType;
  onRemoveItem: (item: CartItem) => void;
  onClearCart: () => void;
  onWhatsAppSend: () => void;
  onToggleBilanComposition: (bilanId: string, code: string) => void;
  currencyLabel: string;
  isRtl?: boolean;
  normalizedAnalysesMap?: Map<string, AnalyseItem>;
  onViewAnalysisDetails: (analysis: AnalyseItem) => void;
  initialTab?: TabId;
}

/**
 * Modale mobile (bottom-sheet) + desktop centered.
 * Shell mince autour des mêmes building blocks que CartSidePanel.
 */
export function CartDetailsModal({
  isOpen,
  onClose,
  selectedItems,
  cartView,
  onRemoveItem,
  onClearCart,
  onWhatsAppSend,
  onToggleBilanComposition,
  currencyLabel,
  isRtl = false,
  normalizedAnalysesMap,
  onViewAnalysisDetails,
  initialTab,
}: CartDetailsModalProps) {
  const { t } = useTranslation('common');
  const { t: tc } = useTranslation('catalog');
  const locale = isRtl ? 'ar-MA' : 'fr-MA';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'devis');
  const preparationRules = usePreparationRules(selectedItems, normalizedAnalysesMap);

  // Reset to initialTab whenever the modal opens
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab ?? 'devis');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose} dir={isRtl ? 'rtl' : 'ltr'}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-end md:items-center justify-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-full md:translate-y-0 md:scale-95"
            enterTo="opacity-100 translate-y-0 md:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 md:scale-100"
            leaveTo="opacity-0 translate-y-full md:translate-y-0 md:scale-95"
          >
            <Dialog.Panel className="w-full h-[100dvh] md:h-auto md:max-w-2xl md:max-h-[92vh] flex flex-col bg-[var(--background-card)] shadow-2xl md:rounded-2xl overflow-hidden border border-[var(--border-default)]">

              {/* ── Header: tabs + actions ── */}
              <div className="flex items-center border-b border-[var(--border-default)] bg-[var(--background-card)] flex-shrink-0">
                <div className="flex flex-1 min-w-0">
                  {([
                    { id: 'devis' as TabId, label: tc('cart.tab_devis', 'Mon Devis'), Icon: FileText },
                    { id: 'preparation' as TabId, label: tc('cart.tab_preparation', 'Ma Préparation'), Icon: ClipboardList },
                  ] as const).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-4 px-2 text-sm font-semibold transition-colors border-b-2 ${
                        activeTab === id
                          ? 'border-[var(--color-fuchsia-accent)] text-[var(--color-fuchsia-accent)]'
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate max-[360px]:hidden">{label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 px-2 border-b-2 border-transparent py-4 flex-shrink-0">
                  {selectedItems.length > 0 && (
                    <button
                      onClick={onClearCart}
                      className="p-2 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--status-error)] transition-colors"
                      aria-label={t('analyses_catalog.selection.clear_all', 'Tout supprimer')}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--text-secondary)] transition-colors"
                    aria-label="Fermer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {activeTab === 'devis' ? (
                  <CartView
                    cartView={cartView}
                    isRtl={isRtl}
                    locale={locale}
                    currencyLabel={currencyLabel}
                    onRemoveItem={onRemoveItem}
                    onToggleBilanComposition={onToggleBilanComposition}
                    onViewAnalysisDetails={onViewAnalysisDetails}
                    onContinueShopping={onClose}
                  />
                ) : (
                  <CartPreparation
                    preparation={preparationRules}
                    total={cartView.total}
                    locale={locale}
                    currencyLabel={currencyLabel}
                  />
                )}
              </div>

              {/* ── Footer: WhatsApp + PDF ── */}
              {selectedItems.length > 0 && (
                <CartActions
                  cartView={cartView}
                  preparationRules={preparationRules}
                  currencyLabel={currencyLabel}
                  onWhatsAppSend={onWhatsAppSend}
                  onAuthFail={onClose}
                  isRtl={isRtl}
                  compact
                />
              )}

            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

export default CartDetailsModal;
