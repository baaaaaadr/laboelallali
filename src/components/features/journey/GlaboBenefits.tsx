"use client";

import React from 'react';
import { ShieldCheck, Clock3, Building } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Les trois arguments du service de prélèvement à domicile (GLABO) :
 * sécurité, gain de temps, flexibilité.
 *
 * Extrait de `src/app/[lang]/glabo/page.tsx` : le parcours patient les affiche
 * sur son écran d'accueil quand le patient arrive par GLABO, et la page /glabo
 * doit continuer d'afficher exactement les mêmes. Deux copies auraient divergé —
 * c'est déjà ce qui est arrivé aux deux formulaires de rendez-vous.
 *
 * Les clés vivent dans le namespace `glabo` (safety_*, time_save_*, flexibility_*).
 */
export interface GlaboBenefitsProps {
  /** Titre affiché au-dessus de la liste. Masqué si `false`. */
  showTitle?: boolean;
  className?: string;
}

const BENEFITS = [
  {
    key: 'safety',
    Icon: ShieldCheck,
    // Vert : hygiène / sécurité. Tons pris sur les jetons de statut.
    iconClass: 'bg-[var(--status-success)]/10 text-[var(--status-success)]',
  },
  {
    key: 'time_save',
    Icon: Clock3,
    iconClass: 'bg-[var(--status-info)]/10 text-[var(--status-info)]',
  },
  {
    key: 'flexibility',
    Icon: Building,
    iconClass: 'bg-[var(--color-fuchsia-accent)]/10 text-[var(--color-fuchsia-accent)]',
  },
] as const;

export default function GlaboBenefits({ showTitle = true, className = '' }: GlaboBenefitsProps) {
  const { t } = useTranslation('glabo');

  return (
    <div className={className}>
      {showTitle && (
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-5 border-b border-[var(--border-default)] pb-3">
          {t('why_choose_title')}
        </h3>
      )}
      <ul className="space-y-5">
        {BENEFITS.map(({ key, Icon, iconClass }) => (
          <li key={key} className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg ${iconClass}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h4 className="text-base font-semibold text-[var(--text-primary)]">
                {t(`${key}_title`)}
              </h4>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{t(`${key}_desc`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
