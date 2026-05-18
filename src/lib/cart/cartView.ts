import type {
  AnalyseItem,
  CartItem,
} from '@/components/features/catalog/AnalysisCard';
import { normalizeCode } from './cartItem';

const DEFAULT_SAMPLING_FEE = 20;

// ──────────────────────────────────────────────────────────────────────────────
// Types publics
// ──────────────────────────────────────────────────────────────────────────────

export interface CompositionEntry {
  /** Code brut tel qu'il apparaît dans Composition_Codes (ex. "C HBA1"). */
  code: string;
  /** Code normalisé (strip whitespace + uppercase) — clé de comparaison. */
  normalizedCode: string;
  /** Nom à afficher (Nom_Patient_FR depuis l'analyse résolue, ou fallback = code). */
  name: string;
  /** Prix unitaire de l'analyse (0 si non résolue dans la map). */
  price: number;
  /** L'utilisateur a explicitement décoché la case de cette analyse dans la composition. */
  isExcluded: boolean;
  /** Une occurrence non-exclue de cette analyse a déjà été vue plus tôt dans le panier. */
  isDuplicate: boolean;
  /** Nom du bilan/analyse qui fournit cette analyse (renseigné si `isDuplicate`). */
  sourceName?: string;
}

export interface CartLineView {
  cartItem: CartItem;
  /** Clé React stable ("bilan:ID" ou "analyse:ID"). */
  itemKey: string;
  type: 'bilan' | 'analyse';
  /** Nom à afficher (FR par défaut — l'AR est géré côté composant via cartItem.item). */
  displayName: string;
  /** Composition résolue avec flags (bilan uniquement). */
  composition?: CompositionEntry[];
  /**
   * Prix réellement facturé pour cet item après dédup et exclusions :
   * - analyse non doublon : son Prix_Dhs
   * - analyse doublon    : 0
   * - bilan              : somme des compositions non-exclues non-doublons
   */
  effectivePrice: number;
  /** True si l'analyse individuelle est un doublon d'un item antérieur. */
  isDuplicate?: boolean;
  /** Nom de l'item antérieur qui fournit cette analyse (si doublon). */
  duplicateSourceName?: string;
}

export interface CartView {
  lines: CartLineView[];
  /** Nombre d'analyses uniques effectivement facturées. */
  uniqueAnalysesCount: number;
  /** Somme dédupliquée des prix d'analyse (sans les frais de prélèvement). */
  itemsTotal: number;
  samplingFee: number;
  /** itemsTotal + samplingFee si non-vide, sinon 0. */
  total: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Fonction principale
// ──────────────────────────────────────────────────────────────────────────────

const getItemKey = (item: CartItem): string =>
  item.type === 'analyse'
    ? `analyse:${item.item.id}`
    : `bilan:${item.item.id}`;

/**
 * Source de vérité unique pour le panier.
 *
 * Itère les items dans l'ordre d'ajout, construit pour chacun :
 *   - sa composition résolue avec exclusions/doublons marqués
 *   - son prix effectif (ce qui est réellement facturé)
 *
 * Le total agrégé est garanti cohérent avec la somme des `effectivePrice` + samplingFee.
 *
 * Règle de dédup : la PREMIÈRE occurrence non-exclue d'un code (dans l'ordre du panier)
 * devient sa source. Les occurrences suivantes sont marquées `isDuplicate` avec
 * `sourceName` pointant vers la première. Si la première occurrence est plus tard
 * exclue par l'utilisateur, l'ownership transfère automatiquement à l'occurrence
 * suivante (parce que cartView est recalculée à chaque mutation).
 */
export function computeCartView(
  items: CartItem[],
  normalizedAnalysesMap: Map<string, AnalyseItem>,
  samplingFee: number = DEFAULT_SAMPLING_FEE
): CartView {
  /** Map<normalizedCode, displayName-du-fournisseur> — alimentée au fil de l'itération. */
  const ownership = new Map<string, string>();

  const lines: CartLineView[] = [];
  let itemsTotal = 0;

  for (const item of items) {
    const itemKey = getItemKey(item);

    if (item.type === 'analyse') {
      const code = normalizeCode(item.item.id);
      const sourceName = ownership.get(code);
      const isDuplicate = sourceName !== undefined;
      const name = item.item.Nom_Patient_FR;
      const price = item.item.Prix_Dhs;

      if (!isDuplicate) {
        ownership.set(code, name);
        itemsTotal += price;
      }

      lines.push({
        cartItem: item,
        itemKey,
        type: 'analyse',
        displayName: name,
        effectivePrice: isDuplicate ? 0 : price,
        isDuplicate,
        duplicateSourceName: sourceName,
      });
      continue;
    }

    // bilan
    const excludedSet = new Set((item.excludedCodes ?? []).map(normalizeCode));
    const bilanName = item.item.Nom_Bilan_FR;

    const composition: CompositionEntry[] = item.item.Composition_Codes.map(rawCode => {
      const norm = normalizeCode(rawCode);
      const isExcluded = excludedSet.has(norm);
      const analyse = normalizedAnalysesMap.get(norm);
      const name = analyse?.Nom_Patient_FR ?? rawCode;
      const price = analyse?.Prix_Dhs ?? 0;

      const existingSource = ownership.get(norm);
      const isDuplicate = !isExcluded && existingSource !== undefined;

      // Si non-exclu et non-doublon → ce bilan devient propriétaire et son prix compte
      if (!isExcluded && !isDuplicate) {
        ownership.set(norm, bilanName);
        itemsTotal += price;
      }

      return {
        code: rawCode,
        normalizedCode: norm,
        name,
        price,
        isExcluded,
        isDuplicate,
        sourceName: existingSource,
      };
    });

    const effectivePrice = composition.reduce(
      (sum, c) => sum + (c.isExcluded || c.isDuplicate ? 0 : c.price),
      0
    );

    lines.push({
      cartItem: item,
      itemKey,
      type: 'bilan',
      displayName: bilanName,
      composition,
      effectivePrice,
    });
  }

  const hasItems = items.length > 0;
  return {
    lines,
    uniqueAnalysesCount: ownership.size,
    itemsTotal,
    samplingFee,
    total: hasItems ? itemsTotal + samplingFee : 0,
  };
}
