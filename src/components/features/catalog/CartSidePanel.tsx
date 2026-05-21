"use client";

import React, { useState } from 'react';
import { Trash2, FileText, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CartItem, AnalyseItem } from './AnalysisCard';
import { usePreparationRules } from '@/hooks/usePreparationRules';
import { CartView } from './cart/CartView';
import { CartPreparation } from './cart/CartPreparation';
import { CartActions } from './cart/CartActions';
import type { CartView as CartViewType } from '@/lib/cart/cartView';

type TabId = 'devis' | 'preparation';

interface CartSidePanelProps {
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
}

/**
 * Sidebar desktop. Shell mince :
 *   - tabs (Devis / Préparation) + bouton clear
 *   - body : <CartView /> ou <CartPreparation />
 *   - footer : <CartActions />
 */
export function CartSidePanel({
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
}: CartSidePanelProps) {
  const { t } = useTranslation('common');
  const { t: tc } = useTranslation('catalog');
  const locale = isRtl ? 'ar-MA' : 'fr-MA';
  const [activeTab, setActiveTab] = useState<TabId>('devis');
  const preparationRules = usePreparationRules(selectedItems, normalizedAnalysesMap);

  return (
    <div
      className={`flex flex-col h-full bg-[var(--background-card)] ${
        isRtl ? 'border-r' : 'border-l'
      } border-[var(--border-default)] shadow-xl`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* ── Sticky header: tabs + clear ── */}
      <div className="sticky top-0 z-10 bg-[var(--background-card)] border-b border-[var(--border-default)] flex-shrink-0">
        <div className="flex items-center">
          {([
            { id: 'devis' as TabId, Icon: FileText },
            { id: 'preparation' as TabId, Icon: ClipboardList },
          ] as const).map(({ id, Icon }) => {
            const baseLabel = id === 'devis'
              ? tc('cart.tab_devis', 'Mon Devis')
              : tc('cart.tab_preparation', 'Ma Préparation');
            const label = id === 'devis' && selectedItems.length > 0
              ? `${baseLabel} (${selectedItems.length})`
              : baseLabel;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 text-xs font-semibold transition-colors border-b-2 ${
                  activeTab === id
                    ? 'border-[var(--color-fuchsia-accent)] text-[var(--color-fuchsia-accent)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
          {selectedItems.length > 0 && (
            <button
              onClick={onClearCart}
              className="p-2 mx-1 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--status-error)] transition-colors flex-shrink-0"
              aria-label={t('analyses_catalog.selection.clear_all', 'Tout supprimer')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === 'devis' ? (
          <CartView
            cartView={cartView}
            isRtl={isRtl}
            locale={locale}
            currencyLabel={currencyLabel}
            onRemoveItem={onRemoveItem}
            onToggleBilanComposition={onToggleBilanComposition}
            onViewAnalysisDetails={onViewAnalysisDetails}
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
          compact
        />
      )}
    </div>
  );
}

export default CartSidePanel;
