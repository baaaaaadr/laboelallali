import React from 'react';
import { FlaskConical, HeartPulse, Home as HomeIcon, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

interface MainServicesProps {
  lang: string;
}

export default function MainServices({ lang }: MainServicesProps) {
  const { t } = useTranslation('common');

  return (
    <section id="services" className="mb-12 fade-in-section">
      <h2 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] mb-10">{t('our_main_services')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-lg bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20">
              <FlaskConical className="text-[var(--color-bordeaux-primary)]" size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">{t('blood_tests')}</h3>
            <p className="text-[var(--text-secondary)] mb-4">{t('blood_tests_text')}</p>
            <Link href={`/${lang}/analyses?tab=all`} className="btn-text" aria-label={t('learn_more_about_blood_tests')}>
              {t('learn_more')}
              <span className="btn-chevron" aria-hidden="true">
                <ChevronRight className="text-[var(--color-bordeaux-primary)]" size={16} />
              </span>
            </Link>
          </div>
        </div>
        <div className="card">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-lg bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20">
              <HeartPulse className="text-[var(--color-bordeaux-primary)]" size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">{t('health_checks')}</h3>
            <p className="text-[var(--text-secondary)] mb-4">{t('health_checks_text')}</p>
            <Link href={`/${lang}/analyses?tab=bilans`} className="btn-text" aria-label={t('learn_more_about_health_checks')}>
              {t('learn_more')}
              <span className="btn-chevron" aria-hidden="true">
                <ChevronRight className="text-[var(--color-bordeaux-primary)]" size={16} />
              </span>
            </Link>
          </div>
        </div>
        <div className="card">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-lg bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20">
              <HomeIcon className="text-[var(--color-bordeaux-primary)]" size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">{t('home_service')}</h3>
            <p className="text-[var(--text-secondary)] mb-4">{t('home_service_text')}</p>
            <Link href={`/${lang}/glabo`} className="btn-text" aria-label={t('learn_more_about_home_service')}>
              {t('learn_more')}
              <span className="btn-chevron" aria-hidden="true">
                <ChevronRight className="text-[var(--color-bordeaux-primary)]" size={16} />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
