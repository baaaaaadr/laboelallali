"use client";

/**
 * /[lang]/emploi — « Emploi & Stage » (devis lines 27 and 40, Dr Aziz,
 * 08/10/2026): the public page where anyone applies for an internship or a
 * job, without an account. The form is `ApplicationForm`; the lab reads the
 * applications in the admin « Candidatures » tab. See docs/pages/emploi.md.
 */
import React, { use } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase } from 'lucide-react';
import ApplicationForm from '@/components/features/emploi/ApplicationForm';

export default function EmploiPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const { t } = useTranslation('common');

  return (
    <div className="min-h-[80vh] py-10 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <Briefcase size={30} className="text-[var(--color-bordeaux-primary)] flex-shrink-0 mt-1" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-bordeaux-primary)]">
              {t('emploi.title', 'Emploi & Stage')}
            </h1>
            <p className="text-[var(--text-secondary)] mt-2">
              {t(
                'emploi.intro',
                'Rejoignez l’équipe du Laboratoire El Allali. Stage d’observation, stage pré-embauche ou candidature : ce formulaire prend quelques minutes, sans créer de compte. Nous étudions chaque demande.'
              )}
            </p>
          </div>
        </div>
        <ApplicationForm lang={lang} />
      </div>
    </div>
  );
}
