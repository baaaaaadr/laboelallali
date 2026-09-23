'use client';

/**
 * « Espace médecin » — the entry to « Mes patients » for an account holding a
 * doctor access. Renders nothing otherwise, so callers mount it unconditionally.
 *
 *   variant="card"   (/profile)    title, one sentence, a button;
 *   variant="banner" (/resultats)  one line under the page title: that page only
 *                                  ever shows the account's OWN dossiers and its
 *                                  relatives' — a doctor looking there for his
 *                                  patients must be told where they are.
 *
 * ⚠ `.button-bordeaux` is declared UNLAYERED in `src/styles/index.css` (padding,
 * font size, 48 px min height): Tailwind utilities, which live in a layer, cannot
 * shrink it. Only margins are free.
 */
import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Stethoscope } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { readPractitioner } from '@/lib/results/identities';

export default function PractitionerAccessCard({
  lang,
  variant = 'card',
}: {
  lang: string;
  variant?: 'card' | 'banner';
}) {
  const { t } = useTranslation('common');
  const { userProfile } = useAuth();
  const practitioner = readPractitioner(userProfile);
  if (!practitioner) return null;

  const href = `/${lang}/mes-patients`;

  if (variant === 'banner') {
    return (
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg p-3 bg-[var(--background-tertiary)] border border-[var(--border-default)]"
        data-testid="mp-resultats-banner"
      >
        <Stethoscope size={18} className="flex-shrink-0 text-[var(--color-bordeaux-primary)]" />
        <p className="text-sm text-[var(--text-secondary)] flex-1 min-w-[12rem]">
          {t(
            'mes_patients.resultats_banner',
            'Vous êtes médecin : les résultats de vos patients sont dans « Mes patients ».'
          )}
        </p>
        <Link href={href} className="button-bordeaux">
          {t('mes_patients.resultats_banner_cta', 'Mes patients')}
        </Link>
      </div>
    );
  }

  // The button sits UNDER the icon row, full width on a phone: beside the icon
  // it had ~196 px at 320 px for a label that needs ~240 once padded, and
  // `.button-bordeaux` never wraps (`white-space: nowrap`, unlayered).
  return (
    <section className="card p-5" data-testid="mp-access-card">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 flex items-center justify-center flex-shrink-0">
          <Stethoscope size={20} className="text-[var(--color-bordeaux-primary)]" />
        </div>
        <div className="min-w-0 flex-1">
          {/* A <p>, not an <h2>: `base/reset.css` sizes and colours h2 UNLAYERED
              (2xl, brand colour), which no utility can override. */}
          <p className="font-semibold text-[var(--text-primary)]">
            {t('mes_patients.access_card_title', 'Espace médecin')}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t(
              'mes_patients.access_card_desc',
              'Consultez les résultats des patients dont vous êtes le prescripteur.'
            )}
          </p>
        </div>
      </div>
      <Link href={href} className="button-bordeaux mt-4 w-full sm:w-auto">
        {t('mes_patients.access_card_cta', 'Ouvrir « Mes patients »')}
      </Link>
    </section>
  );
}
