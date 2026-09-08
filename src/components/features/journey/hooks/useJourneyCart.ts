"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnalyseItem, CartItem } from '@/components/features/catalog/AnalysisCard';
import { computeCartView, type CartView } from '@/lib/cart/cartView';
import { toggleBilanCompositionExclusion } from '@/lib/cart/cartItem';
import { readCart, writeCart, clearCartStorage } from '@/lib/cart/storage';
import { loadAnalysesCatalog, buildCodeMap } from '@/lib/analyses/catalog';
import { usePreparationRules, type PreparationRules } from '@/hooks/usePreparationRules';
import { SAMPLING_FEE } from '@/lib/journey/types';

/**
 * Le panier composé dans /analyses, récupéré par le parcours patient.
 *
 * Il voyage par `localStorage` et rien d'autre : /analyses y écrit à CHAQUE
 * modification, donc la clé est toujours à jour au moment du clic. Le mettre
 * dans l'URL serait pire à tous points de vue — plus de 8 Ko pour un panier de
 * 20 lignes, et surtout une intention médicale inscrite dans l'historique du
 * navigateur et dans les en-têtes `Referer`.
 *
 * ### La carte des analyses n'est PAS toujours nécessaire
 * `computeCartView` et `usePreparationRules` ne consultent
 * `normalizedAnalysesMap` que pour résoudre la composition des BILANS. Un panier
 * d'analyses individuelles — le cas normal, puisque `BILANS_ENABLED` est à false —
 * se calcule donc sans AUCUNE lecture Firestore : prix, `CPA_Jeune_H` et
 * `DRR_Jours` sont lus directement sur les objets stockés dans le navigateur.
 * La carte n'est chargée, en différé, que si un vieux panier contient un bilan.
 *
 * ⚠ Tant que cette carte manque, les compositions de bilan sont valorisées à 0.
 * `answerComplete` sert à masquer le total dans ce cas : mieux vaut un instant
 * de chargement qu'un devis sous-évalué affiché à un patient.
 */

/** Identité stable : une Map recréée à chaque rendu invaliderait tous les useMemo. */
const EMPTY_MAP: Map<string, AnalyseItem> = new Map();

/**
 * État de la carte des analyses, nécessaire aux seuls bilans.
 * `failed` existe parce que `loadAnalysesCatalog()` renvoie `[]` — et non une
 * erreur — quand Firestore est injoignable ou que `db` est nul. Sans cet état on
 * construisait une carte VIDE, on la prenait pour un succès, et les compositions
 * de bilan valorisées à 0 produisaient un devis sous-évalué présenté comme
 * définitif. C'est précisément ce qu'il ne faut jamais montrer à un patient.
 */
export type AnalysesMapStatus = 'not_needed' | 'loading' | 'ready' | 'failed';

export interface UseJourneyCartResult {
  cartItems: CartItem[];
  /** false tant que localStorage n'a pas été lu — afficher un squelette, pas « panier vide ». */
  hydrated: boolean;
  cartView: CartView;
  preparation: PreparationRules;
  hasCart: boolean;
  /** true quand le panier contient un bilan dont la composition n'est pas encore résolue. */
  mapPending: boolean;
  /** true quand la composition d'un bilan n'a PAS pu être résolue (catalogue injoignable). */
  mapFailed: boolean;
  /** false = le total affiché serait faux ; ne rien montrer. */
  answerComplete: boolean;
  analysesMap: Map<string, AnalyseItem>;
  removeItem: (item: CartItem) => void;
  toggleBilanComposition: (bilanId: string, code: string) => void;
  clear: () => void;
  /** Remet un panier tel quel (annulation du vidage après envoi). */
  restore: (items: CartItem[]) => void;
}

export function useJourneyCart(): UseJourneyCartResult {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [analysesMap, setAnalysesMap] = useState<Map<string, AnalyseItem> | null>(null);
  const [mapStatus, setMapStatus] = useState<AnalysesMapStatus>('not_needed');

  // Lecture APRÈS montage uniquement : lire localStorage pendant le rendu
  // provoquerait un décalage d'hydratation (la page est pré-rendue côté serveur).
  useEffect(() => {
    setCartItems(readCart());
    setHydrated(true);
  }, []);

  const hasBilan = useMemo(() => cartItems.some((i) => i.type === 'bilan'), [cartItems]);

  useEffect(() => {
    if (!hydrated || analysesMap || !hasBilan) return;
    let alive = true;
    setMapStatus('loading');
    loadAnalysesCatalog()
      .then((list) => {
        if (!alive) return;
        // ⚠ `loadAnalysesCatalog()` renvoie `[]` — jamais une erreur — quand
        // Firestore est injoignable ou que `db` est nul. Une liste vide n'est
        // donc PAS un succès : la prendre pour telle valoriserait à 0 toute la
        // composition du bilan et afficherait un devis sous-évalué.
        if (list.length === 0) {
          setMapStatus('failed');
          return;
        }
        setAnalysesMap(buildCodeMap(list));
        setMapStatus('ready');
      })
      .catch(() => {
        if (alive) setMapStatus('failed');
      });
    return () => {
      alive = false;
    };
  }, [hydrated, hasBilan, analysesMap]);

  const effectiveMap = analysesMap ?? EMPTY_MAP;

  const cartView = useMemo(
    () => computeCartView(cartItems, effectiveMap, SAMPLING_FEE),
    [cartItems, effectiveMap]
  );

  const preparation = usePreparationRules(cartItems, effectiveMap);

  const persist = useCallback((next: CartItem[]) => {
    setCartItems(next);
    writeCart(next);
  }, []);

  const removeItem = useCallback(
    (itemToRemove: CartItem) => {
      setCartItems((prev) => {
        const next = prev.filter((item) => {
          if (item.type === itemToRemove.type) return item.item.id !== itemToRemove.item.id;
          return true;
        });
        writeCart(next);
        return next;
      });
    },
    []
  );

  const toggleBilanComposition = useCallback((bilanId: string, code: string) => {
    setCartItems((prev) => {
      const next = toggleBilanCompositionExclusion(prev, bilanId, code);
      writeCart(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setCartItems([]);
    clearCartStorage();
  }, []);

  const restore = useCallback((items: CartItem[]) => persist(items), [persist]);

  return {
    cartItems,
    hydrated,
    cartView,
    preparation,
    hasCart: cartItems.length > 0,
    mapPending: mapStatus === 'loading',
    mapFailed: mapStatus === 'failed',
    answerComplete: !hasBilan || mapStatus === 'ready',
    analysesMap: effectiveMap,
    removeItem,
    toggleBilanComposition,
    clear,
    restore,
  };
}
