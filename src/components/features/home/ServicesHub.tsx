import React from 'react';
import Link from 'next/link';
import {
  FileText,
  CalendarDays,
  Truck,
  FlaskConical,
  Stethoscope,
  Phone,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BILANS_ENABLED } from '@/constants/features';

interface ServicesHubProps {
  lang: string;
}

/**
 * Quick-access services hub, rendered right under the hero.
 * The "Résultats" viewer is the flagship: it gets a full fuchsia banner on top,
 * the five other services follow as a compact grid of icon buttons.
 * Replaces the older MainServices section (which only surfaced 3 services).
 */
export default function ServicesHub({ lang }: ServicesHubProps) {
  const { t } = useTranslation('common');

  const services = [
    { key: 'appointment', href: `/${lang}/rendez-vous`, icon: CalendarDays, label: t('services_hub.appointment'), desc: t('services_hub.appointment_desc') },
    { key: 'glabo', href: `/${lang}/glabo`, icon: Truck, label: t('services_hub.glabo'), desc: t('services_hub.glabo_desc') },
    // This tile is labelled "Nos bilans", so it needs `?tab=bilans` — the
    // analyses page opens on the full catalogue by default (demande n. 16) and
    // the tile would otherwise contradict its own label.
    // While the bilans are hidden (BILANS_ENABLED, 26/08/2026) it becomes a
    // plain "Catalogue des analyses" tile on the same page: dropping it
    // altogether would cost the home page its entry to the catalogue, and
    // keeping the old label would have been a lie.
    BILANS_ENABLED
      ? { key: 'analyses', href: `/${lang}/analyses?tab=bilans`, icon: FlaskConical, label: t('services_hub.analyses'), desc: t('services_hub.analyses_desc') }
      : { key: 'analyses', href: `/${lang}/analyses`, icon: FlaskConical, label: t('services_hub.catalog'), desc: t('services_hub.catalog_desc') },
    { key: 'medecins', href: `/${lang}/medecins`, icon: Stethoscope, label: t('services_hub.medecins'), desc: t('services_hub.medecins_desc') },
    { key: 'contact', href: `/${lang}/contact`, icon: Phone, label: t('services_hub.contact'), desc: t('services_hub.contact_desc') },
  ];

  return (
    <section id="services" className="mb-12 mt-6">
      <h2 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] mb-6">{t('services_hub.title')}</h2>

      {/* Résultats — flagship banner (reuses the footer gradient: bordeaux → fuchsia, dark-mode aware) */}
      <Link
        href={`/${lang}/resultats`}
        className="footer-gradient group block rounded-2xl overflow-hidden mb-6 shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-fuchsia-light)]"
      >
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5 sm:gap-6 text-white">
          {/* Decorative icon: to the LEFT of the text on desktop. Hidden on mobile
              (stacked, it just became a big empty box above the "NOUVEAU" badge). */}
          <div className="hidden sm:flex flex-shrink-0 w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm items-center justify-center">
            <FileText size={40} className="text-white" />
          </div>
          <div className="flex-1 text-center sm:text-start">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide bg-white/25 rounded-full px-3 py-1 mb-2">
              <ShieldCheck size={14} /> {t('services_hub.results_badge')}
            </span>
            <h3 className="text-xl sm:text-2xl font-bold mb-1">{t('resultats.home_highlight_title')}</h3>
            <p className="text-white/90 text-sm sm:text-base">{t('resultats.home_highlight_desc')}</p>
          </div>
          <div className="flex-shrink-0">
            <span
              className="results-cta inline-flex items-center gap-2 font-bold rounded-xl px-6 py-3 text-base shadow-md group-hover:scale-105 transition-transform"
              style={{ backgroundColor: 'var(--color-white)', color: 'var(--color-fuchsia-bright)' }}
            >
              {t('resultats.home_highlight_cta')}
              <ChevronRight size={20} />
            </span>
          </div>
        </div>
      </Link>

      {/* Other services — quick access grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {services.map(({ key, href, icon: Icon, label, desc }) => (
          <Link
            key={key}
            href={href}
            className="card group flex flex-col items-center text-center gap-2 py-6 px-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[var(--color-fuchsia-accent)]"
          >
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 group-hover:bg-[var(--color-fuchsia-accent)]/15 transition-colors">
              <Icon className="text-[var(--color-bordeaux-primary)] group-hover:text-[var(--color-fuchsia-accent)] transition-colors" size={26} />
            </span>
            <span className="font-semibold text-sm sm:text-base text-[var(--text-primary)] group-hover:text-[var(--color-fuchsia-accent)] transition-colors leading-tight">{label}</span>
            <span className="text-xs text-[var(--text-secondary)] leading-snug">{desc}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
