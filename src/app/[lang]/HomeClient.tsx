// src/app/[lang]/HomeClient.tsx
"use client";
import HeroBanner from '@/components/features/home/HeroBanner';
import { Clock, CheckCircle, Award, FlaskConical, HeartPulse, Home as HomeIcon, Info, MapPin, ChevronRight, Phone, Navigation } from 'lucide-react';
import SimpleMap from '@/components/SimpleMap';
import Link from 'next/link';
import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { useLabStatus } from '@/hooks/useLabStatus';

export default function HomeClient({ lang }: { lang: string }) {
  const { t, i18n } = useTranslation(['common', 'glabo']);
  const labStatus = useLabStatus();

  // Ensure i18n language is set based on the lang prop
  useEffect(() => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  // Track if we're on the client side for map rendering
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      document.querySelectorAll('.fade-in-section').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight - 40) {
          el.classList.add('visible');
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Hero Banner with Opening Hours Widget */}
      <div className="relative">
        <HeroBanner />
        {/* Opening Hours Widget - Positioned at top right on large screens, always visible */}
        <div className="lg:absolute lg:top-4 lg:right-4 lg:z-10 lg:max-w-80 w-full">
          <div className="card bg-white/95 dark:bg-[var(--background-card)]/95 backdrop-blur-sm shadow-lg border border-[var(--border-default)] mx-4 mt-4 lg:mx-0 lg:mt-0">
            <div className="flex flex-col md:flex-row lg:flex-col items-center justify-between gap-4">
              <div className="flex-1 w-full">
                <h3 className="text-lg font-bold text-[var(--color-bordeaux-primary)] mb-1 flex items-center">
                  <Clock size={20} className="mr-2 text-[var(--color-fuchsia-accent)]" />
                  {t('opening_hours')}
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">{t('opening_hours_text')}</p>
              </div>
              <div className="flex flex-col items-center justify-center gap-2">
                <div className={`${labStatus.isOpen ? 'bg-green-700' : 'bg-[#B71C1C]'} text-white px-5 py-2 rounded-full font-semibold text-base shadow transition-colors duration-200 flex items-center gap-2`}>
                  <span className={`w-3 h-3 ${labStatus.isOpen ? 'bg-green-300' : 'bg-red-300'} rounded-full`}></span>
                  {labStatus.statusText}
                </div>
                {/* Only show countdown on client side to prevent hydration mismatch */}
                {labStatus.isClient && labStatus.countdownText && (
                  <div className="text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)] px-3 py-1 rounded-full border border-[var(--border-default)]">
                    {labStatus.countdownText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 pb-12">
        {/* Why Choose Us Section */}
        <section id="why-us" className="mb-12 fade-in-section mt-8">
          <h2 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] mb-6">{t('why_choose_us')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[var(--color-fuchsia-accent)]/10 dark:bg-[var(--color-fuchsia-accent)]/20 p-3 rounded-full mr-3">
                  <Award className="text-[var(--color-fuchsia-accent)]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-[var(--text-primary)]">{t('certified_quality')}</h3>
                  <p className="text-[var(--text-secondary)]">{t('certified_quality_text')}</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[var(--color-fuchsia-accent)]/10 dark:bg-[var(--color-fuchsia-accent)]/20 p-3 rounded-full mr-3">
                  <FlaskConical className="text-[var(--color-fuchsia-accent)]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-[var(--text-primary)]">{t('state_of_the_art_equipment')}</h3>
                  <p className="text-[var(--text-secondary)]">{t('state_of_the_art_equipment_text')}</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[var(--color-fuchsia-accent)]/10 dark:bg-[var(--color-fuchsia-accent)]/20 p-3 rounded-full mr-3">
                  <HeartPulse className="text-[var(--color-fuchsia-accent)]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-[var(--text-primary)]">{t('experienced_team')}</h3>
                  <p className="text-[var(--text-secondary)]">{t('experienced_team_text')}</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[var(--color-fuchsia-accent)]/10 dark:bg-[var(--color-fuchsia-accent)]/20 p-3 rounded-full mr-3">
                  <CheckCircle className="text-[var(--color-fuchsia-accent)]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-[var(--text-primary)]">{t('dedicated_patient_service')}</h3>
                  <p className="text-[var(--text-secondary)]">{t('dedicated_patient_service_text')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="mb-12 fade-in-section">
          <h2 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] mb-6">{t('our_main_services')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20">
                  <FlaskConical className="text-[var(--color-bordeaux-primary)]" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">{t('blood_tests')}</h3>
                <p className="text-[var(--text-secondary)] mb-4">{t('blood_tests_text')}</p>
                <Link href={`/${lang}/analyses/sang`} className="btn-text" aria-label={t('learn_more_about_blood_tests')}>
                  {t('learn_more')}
                  <span className="btn-chevron" aria-hidden="true">
                    <ChevronRight className="text-[var(--color-bordeaux-primary)]" size={16} />
                  </span>
                </Link>
              </div>
            </div>
            <div className="card">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20">
                  <HeartPulse className="text-[var(--color-bordeaux-primary)]" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">{t('health_checks')}</h3>
                <p className="text-[var(--text-secondary)] mb-4">{t('health_checks_text')}</p>
                <Link href={`/${lang}/bilans`} className="btn-text" aria-label={t('learn_more_about_health_checks')}>
                  {t('learn_more')}
                  <span className="btn-chevron" aria-hidden="true">
                    <ChevronRight className="text-[var(--color-bordeaux-primary)]" size={16} />
                  </span>
                </Link>
              </div>
            </div>
            <div className="card">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20">
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

        {/* Location Section */}
        <section id="contact" className="mb-12 fade-in-section">
          <h2 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] mb-6">{t('our_location')}</h2>
          <div className="card p-0 overflow-hidden">
            <div className="bg-gray-200 dark:bg-gray-700 h-64 md:h-96">
              {isClient ? (
                <SimpleMap 
                  latitude={30.4173116} 
                  longitude={-9.589799900000001} 
                  zoom={15} 
                  markerText={t('laboratory_name')} 
                  height="100%" 
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <MapPin size={48} className="text-[var(--text-tertiary)]" />
                  <span className="ml-2 text-[var(--text-tertiary)]">{t('loading_map')}</span>
                </div>
              )}
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-xl mb-2 text-[var(--text-primary)]">{t('laboratory_name')}</h3>
              <p className="text-[var(--text-secondary)] mb-4">
                {t('laboratory_address')}
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-wrap gap-4 items-center">
                  <a
                    href="https://maps.app.goo.gl/NUiSsY2AQjeNHcDeA"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="map-directions-btn flex items-center justify-center min-w-[160px] h-12 px-6 font-semibold rounded-lg shadow transition-colors text-center text-lg gap-2"
                  >
                    <Navigation size={22} className="mr-2 -ml-1" />
                    {t('get_directions')}
                  </a>
                  <a
                    href="tel:0528843384"
                    className="map-call-btn flex items-center justify-center min-w-[160px] h-12 px-6 font-semibold rounded-lg shadow-sm transition-colors text-center text-lg gap-2"
                  >
                    <Phone size={22} className="mr-2 -ml-1" />
                    {t('call_us')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Infos Pratiques Section */}
        <section id="info" className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] mb-6">{t('practical_info')}</h2>
          <div className="card">
            <div className="flex items-start">
                <div className="bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 p-3 rounded-full mr-4">
                    <Info className="text-[var(--color-bordeaux-primary)]" size={24} />
                </div>
                <div>
                    <div className="flex items-center justify-center">
                      <Info size={24} className="text-[var(--color-bordeaux-primary)] mr-2" />
                      <h3 className="font-semibold text-[var(--text-primary)]">{t('glabo:analysis_tips')}</h3>
                    </div>
                    <ul className="list-disc pl-10 pt-4 space-y-2 text-[var(--text-secondary)]">
                      <li>{t('glabo:fasting_recommendation')}</li>
                      <li>{t('glabo:documents_to_bring')}</li>
                    </ul>
                    <a href="#" className="text-[var(--color-bordeaux-primary)] hover:text-[var(--color-fuchsia-accent)] mt-4 inline-block font-medium transition-colors duration-200">{t('glabo:more_information')}</a>
                </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}