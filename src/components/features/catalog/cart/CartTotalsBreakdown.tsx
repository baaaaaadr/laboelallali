"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CartView } from '@/lib/cart/cartView';

interface CartTotalsBreakdownProps {
  cartView: CartView;
  locale: string;
  currencyLabel: string;
}

/**
 * Carte récap "Sous-total / Frais de prélèvement / Total".
 * Le sous-total reflète la dédup (somme des effective prices), pas la somme brute.
 */
export function CartTotalsBreakdown({
  cartView,
  locale,
  currencyLabel,
}: CartTotalsBreakdownProps) {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-xl border border-[#E3004F]/20 bg-[#E3004F]/5 dark:bg-[#E3004F]/10 px-4 py-3 space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="text-[var(--text-secondary)]">
          {t('analyses_catalog.selection.subtotal', 'Sous-total')}
        </span>
        <span className="font-medium text-[var(--text-primary)]">
          {cartView.itemsTotal.toLocaleString(locale)} {currencyLabel}
        </span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-[var(--text-secondary)]">
          {t('analyses_catalog.selection.sampling_fee', 'Frais de prélèvement')}
        </span>
        <span className="font-medium text-[var(--text-primary)]">
          {cartView.samplingFee} {currencyLabel}
        </span>
      </div>
      <div className="border-t border-[var(--border-default)] pt-2 flex justify-between items-center">
        <span className="text-base font-semibold text-[var(--text-primary)]">
          {t('analyses_catalog.selection.total', 'Total')}
        </span>
        <span className="text-xl font-bold text-[#E3004F]">
          {cartView.total.toLocaleString(locale)} {currencyLabel}
        </span>
      </div>
    </div>
  );
}

export default CartTotalsBreakdown;
