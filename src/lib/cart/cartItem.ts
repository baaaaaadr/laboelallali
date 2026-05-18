import type { CartItem } from '@/components/features/catalog/AnalysisCard';

/**
 * Normalise un code d'analyse (strip whitespace + uppercase).
 * Source unique de la normalisation — à utiliser partout où on compare des codes.
 */
export const normalizeCode = (code: string): string =>
  code.replace(/\s+/g, '').toUpperCase();

/**
 * Bascule l'état d'exclusion d'un code d'analyse à l'intérieur d'un bilan du panier.
 * Retourne un nouveau tableau (immutable).
 */
export function toggleBilanCompositionExclusion(
  items: CartItem[],
  bilanId: string,
  rawCode: string
): CartItem[] {
  const target = normalizeCode(rawCode);
  return items.map(item => {
    if (item.type !== 'bilan' || item.item.id !== bilanId) return item;
    const excluded = new Set((item.excludedCodes ?? []).map(normalizeCode));
    if (excluded.has(target)) excluded.delete(target);
    else excluded.add(target);
    return { ...item, excludedCodes: Array.from(excluded) };
  });
}

/**
 * Indique si un code donné est actuellement exclu d'un bilan du panier.
 */
export function isBilanCompositionExcluded(
  item: CartItem,
  rawCode: string
): boolean {
  if (item.type !== 'bilan') return false;
  const target = normalizeCode(rawCode);
  return (item.excludedCodes ?? []).map(normalizeCode).includes(target);
}
