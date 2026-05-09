import { useMemo } from 'react';
import { CartItem, AnalyseItem } from '@/components/features/catalog/AnalysisCard';

export interface PreparationRules {
  maxJeune: number;
  maxDRR: number;
  sampleTypes: string[];
  specialInstructions: string[];
  uniqueAnalysisCount: number;
}

export function usePreparationRules(
  cartItems: CartItem[],
  analysesMap?: Map<string, AnalyseItem>
): PreparationRules {
  return useMemo(() => {
    const seen = new Set<string>();
    const analyses: AnalyseItem[] = [];

    for (const cartItem of cartItems) {
      if (cartItem.type === 'analyse') {
        if (!seen.has(cartItem.item.id)) {
          seen.add(cartItem.item.id);
          analyses.push(cartItem.item);
        }
      } else if (cartItem.type === 'bilan' && analysesMap) {
        for (const code of cartItem.item.Composition_Codes) {
          const key = code.replace(/\s+/g, '').toUpperCase();
          const analyse = analysesMap.get(key);
          if (analyse && !seen.has(analyse.id)) {
            seen.add(analyse.id);
            analyses.push(analyse);
          }
        }
      }
    }

    const maxJeune = analyses.reduce(
      (max, a) => Math.max(max, a.CPA_Jeune_H ?? 0),
      0
    );

    const maxDRR = analyses.reduce(
      (max, a) => Math.max(max, a.DRR_Jours ?? 0),
      0
    );

    const sampleTypes = [...new Set(
      analyses
        .map(a => a.CPA_Type)
        .filter((t): t is string => !!t && t.trim() !== '')
    )];

    const specialInstructions = [...new Set(
      analyses
        .map(a => a.CPA_Instructions)
        .filter((i): i is string => !!i && i.trim() !== '')
    )];

    return { maxJeune, maxDRR, sampleTypes, specialInstructions, uniqueAnalysisCount: analyses.length };
  }, [cartItems, analysesMap]);
}
