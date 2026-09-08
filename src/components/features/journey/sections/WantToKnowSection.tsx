"use client";

import React from 'react';
import { Coins, Clock, Coffee, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WANT_TO_KNOW_KEYS, type WantToKnow, type WantToKnowKey } from '@/lib/journey/types';

/**
 * "Je souhaite connaître" — quatre cases à cocher qui disent au laboratoire par
 * quoi commencer sa réponse.
 *
 * ⚠ Les clés partent BRUTES vers le serveur (`prix`, `delai`, `jeune`,
 * `explication`) ; c'est `route.ts` qui les traduit en libellés français. Envoyer
 * la sortie de `t()` mettrait de l'arabe dans la boîte mail française du
 * laboratoire — l'incident déjà survenu sur `lieuPrelevement`.
 */
export interface WantToKnowSectionProps {
  value: WantToKnow;
  onToggle: (key: WantToKnowKey) => void;
}

const ICONS: Record<WantToKnowKey, React.ReactNode> = {
  prix: <Coins className="h-4 w-4" />,
  delai: <Clock className="h-4 w-4" />,
  jeune: <Coffee className="h-4 w-4" />,
  explication: <BookOpen className="h-4 w-4" />,
};

export default function WantToKnowSection({ value, onToggle }: WantToKnowSectionProps) {
  const { t } = useTranslation('journey');

  return (
    <div>
      <p className="text-sm text-[var(--text-secondary)] mb-4">{t('want.help')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {WANT_TO_KNOW_KEYS.map((key) => {
          const checked = value[key];
          return (
            <label
              key={key}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                checked
                  ? 'border-[var(--color-fuchsia-accent)] bg-[var(--color-fuchsia-accent)]/5'
                  : 'border-[var(--border-default)] hover:bg-[var(--background-secondary)]'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(key)}
                className="h-5 w-5 flex-shrink-0 accent-[var(--color-fuchsia-accent)]"
              />
              <span
                className={`flex-shrink-0 ${
                  checked ? 'text-[var(--color-fuchsia-accent)]' : 'text-[var(--text-tertiary)]'
                }`}
                aria-hidden="true"
              >
                {ICONS[key]}
              </span>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {t(`want.${key}`)}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
