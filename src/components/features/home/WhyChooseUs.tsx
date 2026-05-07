import React from 'react';
import { Award, FlaskConical, HeartPulse, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function WhyChooseUs() {
  const { t } = useTranslation('common');

  return (
    <section id="why-us" className="mb-12 fade-in-section mt-8">
      <h2 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] mb-10">{t('why_choose_us')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-start">
            <div className="bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 p-3 rounded-lg mr-3">
              <Award className="text-[var(--color-bordeaux-primary)]" size={24} />
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-[var(--color-gray-600)]">{t('certified_quality')}</h3>
              <p className="text-[var(--text-secondary)]">{t('certified_quality_text')}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start">
            <div className="bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 p-3 rounded-lg mr-3">
              <FlaskConical className="text-[var(--color-bordeaux-primary)]" size={24} />
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-[var(--color-gray-600)]">{t('state_of_the_art_equipment')}</h3>
              <p className="text-[var(--text-secondary)]">{t('state_of_the_art_equipment_text')}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start">
            <div className="bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 p-3 rounded-lg mr-3">
              <HeartPulse className="text-[var(--color-bordeaux-primary)]" size={24} />
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-[var(--color-gray-600)]">{t('experienced_team')}</h3>
              <p className="text-[var(--text-secondary)]">{t('experienced_team_text')}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start">
            <div className="bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 p-3 rounded-lg mr-3">
              <CheckCircle className="text-[var(--color-bordeaux-primary)]" size={24} />
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-[var(--color-gray-600)]">{t('dedicated_patient_service')}</h3>
              <p className="text-[var(--text-secondary)]">{t('dedicated_patient_service_text')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
