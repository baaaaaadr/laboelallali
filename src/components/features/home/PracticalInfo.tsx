import React from 'react';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

interface PracticalInfoProps {
  lang: string;
}

export default function PracticalInfo({ lang }: PracticalInfoProps) {
  const { t } = useTranslation(['common', 'glabo']);

  return (
    <section id="info" className="mb-12">
      <h2 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] mb-10">{t('practical_info')}</h2>
      <div className="card">
        <div className="flex items-start">
          <div className="bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 p-3 rounded-lg mr-4">
            <Info className="text-[var(--color-bordeaux-primary)]" size={24} />
          </div>
          <div>
            <div className="flex items-center mb-2">
              <h3 className="font-semibold text-[var(--text-primary)]">{t('glabo:analysis_tips')}</h3>
            </div>
            <ul className="list-disc pl-6 sm:pl-10 pt-2 space-y-2 text-[var(--text-secondary)]">
              <li>{t('glabo:fasting_recommendation')}</li>
              <li>{t('glabo:documents_to_bring')}</li>
            </ul>
            <Link href={`/${lang}/contact`} className="text-[var(--color-bordeaux-primary)] hover:text-[var(--color-fuchsia-accent)] mt-4 inline-block font-medium transition-colors duration-200">
              {t('glabo:more_information')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
