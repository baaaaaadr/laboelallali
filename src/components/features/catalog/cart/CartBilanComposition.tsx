"use client";

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CartCompositionItem } from './CartCompositionItem';
import type { CompositionEntry } from '@/lib/cart/cartView';

interface CartBilanCompositionProps {
  composition: CompositionEntry[];
  /** Bilan ID — passed to the toggle handler. */
  bilanId: string;
  onToggleComposition: (bilanId: string, code: string) => void;
  locale: string;
  currencyLabel: string;
}

/**
 * Bloc composition expandé d'un bilan. Liste les analyses avec checkbox.
 * Affiche un avertissement si toutes les analyses sont désélectionnées.
 */
export function CartBilanComposition({
  composition,
  bilanId,
  onToggleComposition,
  locale,
  currencyLabel,
}: CartBilanCompositionProps) {
  const { t: tc } = useTranslation('catalog');

  const allExcluded =
    composition.length > 0 && composition.every(c => c.isExcluded);
  const duplicateTagTemplate = tc(
    'cart.composition_duplicate_tag',
    '(déjà incluse dans {{source}})'
  );

  return (
    <div className="mt-2 ml-2 pl-3 border-l-2 border-[var(--border-default)] space-y-0.5">
      {composition.map(entry => (
        <CartCompositionItem
          key={entry.normalizedCode}
          entry={entry}
          duplicateTagTemplate={duplicateTagTemplate}
          locale={locale}
          currencyLabel={currencyLabel}
          onToggle={() => onToggleComposition(bilanId, entry.code)}
        />
      ))}

      {allExcluded && (
        <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/40">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-800 dark:text-orange-200">
            {tc(
              'cart.bilan_all_excluded',
              'Toutes les analyses sont désélectionnées — ce bilan ne sera pas effectué. Retirez-le ou cochez au moins une analyse.'
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export default CartBilanComposition;
