import { useMemo } from 'react';
import { CartItem, AnalyseItem } from '@/components/features/catalog/AnalysisCard';
import { normalizeCode } from '@/lib/cart/cartItem';

/**
 * Contraintes agregees d'un panier.
 *
 * ⚠ DEUX champs de "consignes", et ils ne s'adressent PAS a la meme personne.
 * Verifie sur les 304 documents de la collection `analyses` (08/09/2026) :
 *
 * | champ                  | rempli  | arabe | contenu                                        |
 * |------------------------|---------|-------|------------------------------------------------|
 * | `Pre_Analytique_FR/AR` | 304/304 | OUI   | "Non a jeun.", "Urines du matin, flacon sterile,|
 * |                        |         |       |  toilette intime.", "Apporter le calcul."       |
 * | `CPA_Instructions`     | 153/304 | NON   | "Congeler plasma citrate rapidement", "Tube     |
 * |                        |         |       |  EDTA", "Eviter absolument l'hemolyse"          |
 *
 * `CPA_Instructions` est la FICHE TECHNIQUE DU PRELEVEUR : tubes, centrifugation,
 * congelation, acheminement. L'absence totale de traduction arabe suffit a le
 * prouver — ce champ n'a jamais ete ecrit pour un patient. L'afficher a un
 * patient est au mieux incomprehensible, au pire inquietant.
 *
 * REGLE : `patientPreparation` va au PATIENT ; `technicalInstructions` va au
 * LABORATOIRE (e-mail) et nulle part ailleurs.
 */
export interface PreparationRules {
  maxJeune: number;
  maxDRR: number;
  sampleTypes: string[];
  /**
   * Consignes de preparation destinees au PATIENT (`Pre_Analytique_FR`),
   * dedupliquees. Toujours renseignees, et traduites.
   */
  patientPreparation: string[];
  /** Idem en arabe (`Pre_Analytique_AR`). */
  patientPreparationAr: string[];
  /**
   * Consignes techniques destinees au PRELEVEUR (`CPA_Instructions`).
   * NE JAMAIS afficher a un patient.
   * @see specialInstructions - alias historique, deprecie
   */
  technicalInstructions: string[];
  /**
   * @deprecated Ancien nom de `technicalInstructions`. Conserve parce que
   * `CartPreparation` et `generateDevisPdf` le lisent encore ; ils doivent
   * basculer sur `patientPreparation`.
   */
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
        const excluded = new Set((cartItem.excludedCodes ?? []).map(normalizeCode));
        for (const code of cartItem.item.Composition_Codes) {
          const key = normalizeCode(code);
          if (excluded.has(key)) continue;
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

    // Fiche technique du preleveur — jamais montree au patient.
    const technicalInstructions = [...new Set(
      analyses
        .map(a => a.CPA_Instructions)
        .filter((i): i is string => !!i && i.trim() !== '')
    )];

    // Consignes patient, dans les deux langues.
    //
    // ⚠ On RETIRE tout ce qui ne parle que du jeune. Le jeune a deja sa propre
    // ligne, calculee sur le MAXIMUM du panier ("A jeun : 12 h"). Sans ce
    // filtre, un panier melangeant une analyse a jeun et une autre non affichait
    // "Jeune 12h. · Jeune non obligatoire." l'une a cote de l'autre : deux
    // phrases qui se contredisent, sous une ligne qui tranchait deja. Et sur un
    // panier ordinaire, 129 analyses sur 304 portent le meme "Non a jeun." —
    // du bruit pur.
    //
    // Le decoupage se fait PHRASE PAR PHRASE : "Le matin. A jeun." conserve
    // "Le matin.", qui est une vraie consigne.
    const FASTING_ONLY =
      /^(non\s+à\s+jeun|jeûne\s+non\s+obligatoire|jeûne\s+préférable|à\s+jeun(\s+de\s+préférence)?|strictement\s+à\s+jeun[^.]*|à\s+jeun\s+strict)$/i;

    const stripFasting = (text: string): string =>
      text
        .split('.')
        .map(part => part.trim())
        .filter(part => part !== '' && !FASTING_ONLY.test(part))
        .map(part => part + '.')
        .join(' ');

    const patientPreparation = [...new Set(
      analyses
        .map(a => a.Pre_Analytique_FR)
        .filter((i): i is string => !!i && i.trim() !== '')
        .map(i => stripFasting(i.trim()))
        .filter(i => i !== '')
    )];

    // En arabe on ne filtre pas phrase par phrase (il faudrait un second jeu de
    // motifs, donc un second endroit a maintenir). On s'aligne sur la DECISION
    // prise en francais : si le texte francais de l'analyse ne disait QUE le
    // jeune, on retire aussi sa version arabe. Sinon on la garde entiere — au
    // pire une redondance, jamais une contradiction.
    const patientPreparationAr = [...new Set(
      analyses
        .filter(a => {
          const fr = (a.Pre_Analytique_FR ?? '').trim();
          return fr === '' || stripFasting(fr) !== '';
        })
        .map(a => a.Pre_Analytique_AR)
        .filter((i): i is string => !!i && i.trim() !== '')
        .map(i => i.trim())
    )];

    return {
      maxJeune,
      maxDRR,
      sampleTypes,
      patientPreparation,
      patientPreparationAr,
      technicalInstructions,
      specialInstructions: technicalInstructions,
      uniqueAnalysisCount: analyses.length,
    };
  }, [cartItems, analysesMap]);
}
