'use client';

/**
 * « Espace médecin » — the entry to « Mes patients », shown on /profile (and at
 * the top of /resultats) ONLY to an account holding a doctor access. Renders
 * nothing otherwise, so callers can mount it unconditionally.
 */
import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Stethoscope } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { readPractitioner } from '@/lib/results/identities';

export default function PractitionerAccessCard({ lang, compact = false }: { lang: string; compact?: boolean }) {
  const { t } = useTranslation('common');
  const { userProfile } = useAuth();
  const practitioner = readPractitioner(userProfile);
  if (!practitioner) return null;

  return (
    <section className={`card ${compact ? 'p-4' : 'p-5'} flex items-start gap-3`} data-testid="mp-access-card">
      <div className="w-10 h-10 rounded-xl bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 flex items-center justify-center flex-shrink-0">
        <Stethoscope size={20} className="text-[var(--color-bordeaux-primary)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--text-primary)]">
          {t('mes_patients.access_card_title', 'Espace médecin')}
        </p>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t(
            'mes_patients.access_card_desc',
            'Consultez les résultats des patients dont vous êtes le prescripteur.'
          )}
        </p>
        <Link href={`/${lang}/mes-patients`} className="button-bordeaux justify-center mt-3 px-4 py-2 text-sm inline-flex">
          {t('mes_patients.access_card_cta', 'Ouvrir « Mes patients »')}
        </Link>
      </div>
    </section>
  );
}
