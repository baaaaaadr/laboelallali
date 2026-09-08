"use client";

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Disclosure from '@/components/ui/Disclosure';
import type { CartItem } from '@/components/features/catalog/AnalysisCard';

/**
 * « À quoi servent vos analyses ? » — UN SEUL bloc dépliant qui, une fois
 * ouvert, montre la liste complète : chaque analyse avec son utilité, à plat.
 *
 * Version précédente : un dépliant PAR analyse. Le propriétaire l'a écartée
 * (08/09/2026) — « pas la peine que chaque analyse ait son propre collapse ».
 * Il a raison : avec dix analyses, l'écran devenait une colonne de dix flèches
 * qu'il fallait ouvrir une par une pour lire trois mots à chaque fois.
 *
 * Les textes viennent des champs `Description_Patient_FR` / `_AR` de la
 * collection Firestore `analyses` (et `Description_FR` / `_AR` pour les bilans).
 * Ils sont remplis pour les 324 analyses mais TRÈS courts — 25 caractères en
 * moyenne, 50 au maximum (« Moyenne du sucre sur 3 mois. Suivi diabète. »).
 * Assez pour une ligne d'explication ; pas assez pour une page dédiée, d'où
 * l'absence de section « explications » dans le PDF.
 *
 * Une analyse sans description n'apparaît PAS dans la liste (plutôt qu'une ligne
 * vide qui ressemblerait à un bug).
 */
export interface AnalysisExplanationsProps {
  cartItems: CartItem[];
  isArabic: boolean;
}

interface Explanation {
  key: string;
  name: string;
  text: string;
}

function explanationsFrom(cartItems: CartItem[], isArabic: boolean): Explanation[] {
  return cartItems
    .map((entry): Explanation | null => {
      if (entry.type === 'analyse') {
        const a = entry.item;
        const text = (isArabic ? a.Description_Patient_AR : a.Description_Patient_FR) || '';
        const name = (isArabic ? a.Nom_Patient_AR : a.Nom_Patient_FR) || a.id;
        return text.trim() ? { key: `analyse:${a.id}`, name, text: text.trim() } : null;
      }
      const b = entry.item;
      const text = (isArabic ? b.Description_AR : b.Description_FR) || '';
      const name = (isArabic ? b.Nom_Bilan_AR : b.Nom_Bilan_FR) || b.id;
      return text.trim() ? { key: `bilan:${b.id}`, name, text: text.trim() } : null;
    })
    .filter((e): e is Explanation => e !== null);
}

export default function AnalysisExplanations({ cartItems, isArabic }: AnalysisExplanationsProps) {
  const { t } = useTranslation('journey');
  const [open, setOpen] = useState(false);
  const explanations = explanationsFrom(cartItems, isArabic);

  if (explanations.length === 0) return null;

  return (
    <div className="mt-5 pt-5 border-t border-[var(--border-default)]">
      <Disclosure
        open={open}
        onToggle={() => setOpen((o) => !o)}
        isRtl={isArabic}
        headerClassName="px-3 py-2.5 border border-[var(--border-default)] bg-[var(--background-secondary)]"
        icon={
          <Info className="h-4 w-4 text-[var(--color-bordeaux-primary)]" aria-hidden="true" />
        }
        title={
          <span className="text-sm font-semibold">
            {t('cart.explain_title')} ({explanations.length})
          </span>
        }
      >
        <dl className="space-y-3">
          {explanations.map(({ key, name, text }) => (
            <div key={key} className="border-s-2 border-[var(--border-default)] ps-3">
              <dt className="text-sm font-medium text-[var(--text-primary)]">{name}</dt>
              <dd className="mt-0.5 text-sm text-[var(--text-secondary)]">{text}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </div>
  );
}
