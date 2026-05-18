"use client";

import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CartView as CartViewType } from '@/lib/cart/cartView';
import type { CartItem, AnalyseItem } from '../AnalysisCard';
import { CartLineRow } from './CartLineRow';
import { CartTotalsBreakdown } from './CartTotalsBreakdown';

interface CartViewProps {
  cartView: CartViewType;
  isRtl: boolean;
  locale: string;
  currencyLabel: string;
  onRemoveItem: (item: CartItem) => void;
  onToggleBilanComposition: (bilanId: string, code: string) => void;
  onViewAnalysisDetails?: (a: AnalyseItem) => void;
  /** Optional callback for the empty-state CTA (used by modal: closes modal). */
  onContinueShopping?: () => void;
}

/**
 * Body partagé de l'onglet "Mon Devis".
 * Affiche : breakdown totaux + sections bilans/analyses (chaque ligne via CartLineRow).
 * Gère l'état vide.
 */
export function CartView({
  cartView,
  isRtl,
  locale,
  currencyLabel,
  onRemoveItem,
  onToggleBilanComposition,
  onViewAnalysisDetails,
  onContinueShopping,
}: CartViewProps) {
  const { t } = useTranslation('common');

  if (cartView.lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ShoppingCart className="h-16 w-16 text-[var(--text-tertiary)] mb-4" />
        <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          {t('analyses_catalog.selection.cart_empty', 'Votre panier est vide')}
        </p>
        {onContinueShopping && (
          <button
            onClick={onContinueShopping}
            className="mt-4 px-6 py-2 bg-[#E3004F] text-white rounded-lg hover:bg-[#c20042] transition-colors"
          >
            {t('analyses_catalog.selection.continue_shopping', 'Continuer mes achats')}
          </button>
        )}
      </div>
    );
  }

  const bilanLines = cartView.lines.filter(l => l.type === 'bilan');
  const analyseLines = cartView.lines.filter(l => l.type === 'analyse');

  return (
    <div className="space-y-4" role="list">
      <CartTotalsBreakdown
        cartView={cartView}
        locale={locale}
        currencyLabel={currencyLabel}
      />

      {bilanLines.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
            {t('analyses_catalog.selection.bilans_section', 'Bilans')} ({bilanLines.length})
          </h4>
          <div>
            {bilanLines.map(line => (
              <CartLineRow
                key={line.itemKey}
                line={line}
                isRtl={isRtl}
                locale={locale}
                currencyLabel={currencyLabel}
                onRemove={onRemoveItem}
                onToggleBilanComposition={onToggleBilanComposition}
                onViewAnalysisDetails={onViewAnalysisDetails}
              />
            ))}
          </div>
        </div>
      )}

      {analyseLines.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
            {t('analyses_catalog.selection.analyses_section', 'Analyses')} ({analyseLines.length})
          </h4>
          <div>
            {analyseLines.map(line => (
              <CartLineRow
                key={line.itemKey}
                line={line}
                isRtl={isRtl}
                locale={locale}
                currencyLabel={currencyLabel}
                onRemove={onRemoveItem}
                onToggleBilanComposition={onToggleBilanComposition}
                onViewAnalysisDetails={onViewAnalysisDetails}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CartView;
