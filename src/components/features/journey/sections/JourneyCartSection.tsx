"use client";

import React from 'react';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CartView } from '@/components/features/catalog/cart/CartView';
import type { CartItem } from '@/components/features/catalog/AnalysisCard';
import type { CartView as CartViewType } from '@/lib/cart/cartView';
import AnalysisExplanations from './AnalysisExplanations';

/**
 * Le panier composé dans /analyses, affiché tel quel dans le parcours.
 *
 * Réutilise `<CartView>` (le corps partagé de l'onglet "Mon Devis" du
 * catalogue) : mêmes lignes, mêmes totaux, même traitement visuel des doublons.
 * Une seconde implémentation de l'affichage du panier aurait divergé, et une
 * seconde implémentation du CALCUL est formellement interdite — `computeCartView`
 * est la source de vérité unique des prix.
 *
 * ⚠ Avant hydratation (`hydrated === false`) on affiche un SQUELETTE et jamais
 * "votre panier est vide" : `localStorage` n'est lisible qu'après le montage, et
 * le patient verrait sinon "vide" clignoter avant ses six analyses.
 *
 * ⚠ Le squelette couvre AUSSI `mapPending`. `<CartView>` embarque son propre
 * `<CartTotalsBreakdown>` : tant que la composition d'un bilan n'est pas résolue,
 * `computeCartView` la valorise à 0 et ce bloc afficherait un total sous-évalué.
 * Un devis faux, même une seconde, est pire qu'une seconde d'attente. Le cas est
 * rare (`BILANS_ENABLED` est à false, seuls de vieux paniers contiennent encore
 * un bilan) mais c'est exactement le genre de détail qu'on ne revoit jamais.
 */
export interface JourneyCartSectionProps {
  lang: string;
  isRtl: boolean;
  hydrated: boolean;
  /** true tant que la composition d'un bilan du panier n'est pas résolue. */
  mapPending: boolean;
  /** true quand cette composition n'a PAS pu être résolue (catalogue injoignable). */
  mapFailed: boolean;
  hasCart: boolean;
  cartView: CartViewType;
  cartItems: CartItem[];
  onRemoveItem: (item: CartItem) => void;
  onToggleBilanComposition: (bilanId: string, code: string) => void;
  onOpenCatalog: () => void;
  onClearCart: () => void;
}

export default function JourneyCartSection({
  lang,
  isRtl,
  hydrated,
  mapPending,
  mapFailed,
  hasCart,
  cartView,
  cartItems,
  onRemoveItem,
  onToggleBilanComposition,
  onOpenCatalog,
  onClearCart,
}: JourneyCartSectionProps) {
  const { t } = useTranslation(['journey', 'catalog']);
  const isArabic = lang === 'ar';
  const locale = isArabic ? 'ar-MA' : 'fr-MA';
  const currencyLabel = t('catalog:card.price_currency', 'DH');

  if (!hydrated || mapPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label={t('cart.loading')}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-[var(--background-secondary)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Composition d'un bilan non résolue : on montre les lignes par leur NOM, sans
  // aucun prix ni total. `<CartView>` est écarté ici parce qu'il embarque son
  // propre bloc de totaux, qui afficherait un montant sous-évalué.
  if (mapFailed && hasCart) {
    return (
      <div>
        <ul className="space-y-2 mb-4">
          {cartItems.map((entry) => (
            <li
              key={`${entry.type}:${entry.item.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] px-3 py-2.5"
            >
              <span className="min-w-0 truncate text-sm text-[var(--text-primary)]">
                {entry.type === 'analyse'
                  ? (isArabic ? entry.item.Nom_Patient_AR : entry.item.Nom_Patient_FR) || entry.item.id
                  : (isArabic ? entry.item.Nom_Bilan_AR : entry.item.Nom_Bilan_FR) || entry.item.id}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-[var(--status-warning)]">{t('cart.price_unavailable')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={onOpenCatalog} className="button-bordeaux-outline text-sm">
            {t('cart.add_more')}
          </button>
          <button
            type="button"
            onClick={onClearCart}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--status-error)] hover:bg-[var(--background-secondary)] transition-colors"
          >
            {t('cart.clear')}
          </button>
        </div>
      </div>
    );
  }

  if (!hasCart) {
    return (
      <div className="text-center py-8">
        <ShoppingCart
          className="h-12 w-12 mx-auto mb-3 text-[var(--text-tertiary)]"
          aria-hidden="true"
        />
        <p className="font-medium text-[var(--text-primary)]">{t('cart.empty')}</p>
        <p className="mt-1 mb-5 text-sm text-[var(--text-secondary)]">{t('cart.empty_help')}</p>
        <button type="button" onClick={onOpenCatalog} className="button-bordeaux">
          {t('cart.open_catalog')}
        </button>
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">{t('cart.return_note')}</p>
      </div>
    );
  }

  return (
    <div>
      <CartView
        cartView={cartView}
        isRtl={isRtl}
        locale={locale}
        currencyLabel={currencyLabel}
        onRemoveItem={onRemoveItem}
        onToggleBilanComposition={onToggleBilanComposition}
      />

      <AnalysisExplanations cartItems={cartItems} isArabic={isArabic} />

      <div className="mt-5 pt-4 border-t border-[var(--border-default)] flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenCatalog}
          className="button-bordeaux-outline flex items-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('cart.add_more')}
        </button>
        <button
          type="button"
          onClick={onClearCart}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--status-error)] hover:bg-[var(--background-secondary)] transition-colors"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {t('cart.clear')}
        </button>
      </div>
    </div>
  );
}
