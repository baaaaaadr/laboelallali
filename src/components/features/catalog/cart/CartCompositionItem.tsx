"use client";

import React from 'react';
import { Check } from 'lucide-react';
import type { CompositionEntry } from '@/lib/cart/cartView';

interface CartCompositionItemProps {
  entry: CompositionEntry;
  /** Localized "déjà incluse dans X" template. Uses the SourceName from the entry. */
  duplicateTagTemplate?: string;
  /** Locale for price formatting. */
  locale: string;
  currencyLabel: string;
  /** Toggle this composition entry (called only when toggling is allowed). */
  onToggle: () => void;
}

/**
 * Une ligne de composition à l'intérieur d'un bilan expandé.
 * Visual states:
 *   - normal  : checkbox checked, name + price normal
 *   - excluded (user unchecked) : checkbox unchecked, greyed italic, price line-through
 *   - duplicate (other source) : checkbox checked + DISABLED (cannot toggle from here),
 *                                greyed italic, price line-through, "(déjà incluse dans X)" tag
 *   - duplicate + excluded     : same as excluded but tag also shown
 */
export function CartCompositionItem({
  entry,
  duplicateTagTemplate,
  locale,
  currencyLabel,
  onToggle,
}: CartCompositionItemProps) {
  const { name, price, isExcluded, isDuplicate, sourceName } = entry;

  // A duplicate "owned" by another item cannot be toggled from this bilan's view.
  // (the user must remove the other source or edit it directly)
  const isDisabled = isDuplicate;
  const isCheckedVisual = !isExcluded;
  const isGreyed = isExcluded || isDuplicate;

  const tag = isDuplicate && sourceName
    ? (duplicateTagTemplate
        ? duplicateTagTemplate.replace('{{source}}', sourceName)
        : `(déjà incluse dans ${sourceName})`)
    : null;

  return (
    <label
      className={`group flex items-center gap-3 py-2 pr-2 pl-1 rounded-lg ${
        isDisabled
          ? 'cursor-not-allowed'
          : 'cursor-pointer hover:bg-[var(--background-secondary)]'
      } transition-colors`}
    >
      {/* Checkbox */}
      <span
        className={`flex-shrink-0 h-5 w-5 rounded-md flex items-center justify-center transition-all border-2 ${
          isCheckedVisual
            ? isDisabled
              ? 'bg-[#E3004F]/40 border-[#E3004F]/40'
              : 'bg-[#E3004F] border-[#E3004F]'
            : 'bg-transparent border-[var(--border-default)] group-hover:border-[var(--text-secondary)]'
        }`}
      >
        {isCheckedVisual && (
          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        )}
      </span>
      {/* Real hidden input (a11y + click target) */}
      <input
        type="checkbox"
        checked={isCheckedVisual}
        disabled={isDisabled}
        onChange={() => { if (!isDisabled) onToggle(); }}
        className="sr-only"
        aria-label={name}
      />

      {/* Name + tag */}
      <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2">
        <span
          className={`text-sm ${
            isGreyed
              ? 'text-[var(--text-tertiary)] italic'
              : 'text-[var(--text-primary)]'
          }`}
        >
          {name}
        </span>
        {tag && (
          <span className="text-xs italic text-[var(--text-tertiary)]">
            {tag}
          </span>
        )}
      </div>

      {/* Price */}
      <span
        className={`text-sm flex-shrink-0 ${
          isGreyed
            ? 'text-[var(--text-tertiary)] italic line-through'
            : 'font-semibold text-[#E3004F]'
        }`}
      >
        {price.toLocaleString(locale)} {currencyLabel}
      </span>
    </label>
  );
}

export default CartCompositionItem;
