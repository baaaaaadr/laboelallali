"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CartLineView } from '@/lib/cart/cartView';
import type { CartItem, AnalyseItem } from '../AnalysisCard';
import { CartBilanComposition } from './CartBilanComposition';

interface CartLineRowProps {
  line: CartLineView;
  isRtl: boolean;
  locale: string;
  currencyLabel: string;
  onRemove: (item: CartItem) => void;
  onToggleBilanComposition: (bilanId: string, code: string) => void;
  /** Called when user clicks an individual analysis name — opens AnalysisDetailsModal. */
  onViewAnalysisDetails?: (a: AnalyseItem) => void;
}

/**
 * Une ligne du panier :
 *  - Pour un bilan : clic = toggle expand inline (composition + checkboxes)
 *  - Pour une analyse : clic = ouvre AnalysisDetailsModal (si callback fourni)
 *  - Si doublon (analyse individuelle) : grisé + barré + tag (déjà incluse dans X)
 */
export function CartLineRow({
  line,
  isRtl,
  locale,
  currencyLabel,
  onRemove,
  onToggleBilanComposition,
  onViewAnalysisDetails,
}: CartLineRowProps) {
  const { t } = useTranslation('common');
  const { t: tc } = useTranslation('catalog');
  const [expanded, setExpanded] = useState(false);

  const item = line.cartItem;

  // ── ANALYSE INDIVIDUELLE ────────────────────────────────────────────────────
  if (line.type === 'analyse' && item.type === 'analyse') {
    const isDup = line.isDuplicate;
    const name = isRtl ? item.item.Nom_Patient_AR : item.item.Nom_Patient_FR;
    const category = isRtl ? item.item.Categorie_AR : item.item.Categorie_FR;
    const tag = isDup && line.duplicateSourceName
      ? tc('cart.composition_duplicate_tag', '(déjà incluse dans {{source}})').replace(
          '{{source}}',
          line.duplicateSourceName
        )
      : null;

    return (
      <div className="flex items-center justify-between gap-2 py-2 border-b border-[var(--border-default)] last:border-b-0">
        <button
          onClick={() => onViewAnalysisDetails?.(item.item)}
          className="flex-1 min-w-0 text-left p-2 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <p
              className={`font-semibold text-sm truncate ${
                isDup
                  ? 'text-[var(--text-tertiary)] italic'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {name}
            </p>
            {tag && (
              <span className="text-xs italic text-[var(--text-tertiary)]">
                {tag}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] truncate">
            {category}
          </p>
        </button>
        <span
          className={`text-sm flex-shrink-0 ${
            isDup
              ? 'text-[var(--text-tertiary)] italic line-through'
              : 'font-bold text-[#E3004F]'
          }`}
        >
          {item.item.Prix_Dhs.toLocaleString(locale)} {currencyLabel}
        </span>
        <button
          onClick={() => onRemove(item)}
          className="p-2 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--status-error)] transition-colors flex-shrink-0"
          aria-label={t('analyses_catalog.selection.remove_item', 'Retirer')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── BILAN (expandable) ──────────────────────────────────────────────────────
  if (line.type !== 'bilan' || item.type !== 'bilan') return null;

  const bilanName = isRtl ? item.item.Nom_Bilan_AR : item.item.Nom_Bilan_FR;
  const allExcluded =
    !!line.composition &&
    line.composition.length > 0 &&
    line.composition.every(c => c.isExcluded);

  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="border-b border-[var(--border-default)] last:border-b-0">
      <div className="flex items-center gap-1 py-2">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left p-2 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
          aria-expanded={expanded}
        >
          <ChevronIcon className="h-4 w-4 text-[var(--text-secondary)] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p
              className={`font-semibold text-sm truncate ${
                allExcluded
                  ? 'text-[var(--text-tertiary)] italic'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {bilanName}
            </p>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {tc('analyses_catalog.selection.bilans_section', 'Bilan')}
              {' · '}
              {line.composition?.length ?? 0}{' '}
              {tc('cart.analyses_count', 'analyses')}
            </p>
          </div>
          <span
            className={`text-sm flex-shrink-0 ${
              allExcluded
                ? 'text-[var(--text-tertiary)] italic line-through'
                : 'font-bold text-[#E3004F]'
            }`}
          >
            {line.effectivePrice.toLocaleString(locale)} {currencyLabel}
          </span>
        </button>
        <button
          onClick={() => onRemove(item)}
          className="p-2 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--status-error)] transition-colors flex-shrink-0"
          aria-label={t('analyses_catalog.selection.remove_item', 'Retirer')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && line.composition && line.composition.length > 0 && (
        <CartBilanComposition
          composition={line.composition}
          bilanId={item.item.id}
          onToggleComposition={onToggleBilanComposition}
          locale={locale}
          currencyLabel={currencyLabel}
        />
      )}
    </div>
  );
}

export default CartLineRow;
