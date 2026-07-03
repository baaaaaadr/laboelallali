import React from 'react';
import { Award, FlaskConical, HeartPulse, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function WhyChooseUs() {
  const { t } = useTranslation('common');

  const features = [
    { icon: Award, title: t('certified_quality'), text: t('certified_quality_text') },
    { icon: FlaskConical, title: t('state_of_the_art_equipment'), text: t('state_of_the_art_equipment_text') },
    { icon: HeartPulse, title: t('experienced_team'), text: t('experienced_team_text') },
    { icon: CheckCircle, title: t('dedicated_patient_service'), text: t('dedicated_patient_service_text') },
  ];

  return (
    <section id="why-us" className="mb-12 fade-in-section mt-8">
      <h2 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] mb-10">{t('why_choose_us')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map(({ icon: Icon, title, text }, i) => (
          // Icon + title on one row, description full-width below (avoids the cramped
          // narrow text column that made the text hug the card border).
          <div key={i} className="card p-6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 p-3 rounded-lg flex-shrink-0">
                <Icon className="text-[var(--color-bordeaux-primary)]" size={24} />
              </div>
              <h3 className="font-semibold text-[var(--color-gray-600)] leading-tight">{title}</h3>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
