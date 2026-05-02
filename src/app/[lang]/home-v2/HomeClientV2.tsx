// src/app/[lang]/home-v2/HomeClientV2.tsx
"use client";
import HeroBannerV2 from '@/components/features/home/HeroBannerV2';
import { Clock, CheckCircle, Award, FlaskConical, HeartPulse, Home as HomeIcon, Info, MapPin, ChevronRight, Phone, Navigation } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import ContactModal from '@/components/ui/ContactModal';
import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { useLabStatus } from '@/hooks/useLabStatus';
import { LAB_CONTACT } from '@/constants/contact';

const SimpleMap = dynamic(() => import('@/components/SimpleMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center">
      <MapPin size={48} style={{ color: 'var(--text-tertiary)' }} />
      <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>Loading map...</span>
    </div>
  )
});


export default function HomeClientV2({ lang }: { lang: string }) {
  const { t, i18n } = useTranslation(['common', 'glabo']);
  const labStatus = useLabStatus();

  useEffect(() => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  const [isClient, setIsClient] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    setIsClient(true);
    const checkMobile = () => {
      const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const widthMobile = window.innerWidth < 768;
      setIsMobile(uaMobile || widthMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleCallClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (!isMobile) {
      e.preventDefault();
      e.stopPropagation();
      setIsContactModalOpen(true);
    }
  };

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

  // Slate-800 icon background (no fuchsia/pink)
  const iconBg = 'rgba(30, 41, 59, 0.08)'; // slate-800/8%
  const iconColor = '#1e293b'; // slate-800

  return (
    <>
      {/* Hero Banner */}
      <div className="relative">
        <HeroBannerV2 onCallClick={handleCallClick} isMobile={isMobile} />

        {/* Opening Hours Widget */}
        <div className="lg:absolute lg:top-4 lg:right-4 lg:z-20 lg:max-w-80 w-full">
          <div
            className="mx-4 mt-4 lg:mx-0 lg:mt-0 rounded-lg border p-6 shadow-lg backdrop-blur-sm"
            style={{
              backgroundColor: 'var(--background-card)',
              borderColor: 'var(--border-default)'
            }}
          >
            <div className="flex flex-col md:flex-row lg:flex-col items-center justify-between gap-4">
              <div className="flex-1 w-full">
                <h3
                  className="text-lg font-bold mb-1 flex items-center gap-2"
                  style={{ color: 'var(--color-bordeaux-primary)' }}
                >
                  {/* Clock icon in slate-800 instead of fuchsia */}
                  <Clock size={20} style={{ color: iconColor }} />
                  {t('opening_hours')}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('opening_hours_text')}
                </p>
              </div>
              <div className="flex flex-col items-center justify-center gap-2">
                <div
                  className="px-5 py-2 rounded-lg font-semibold text-base shadow transition-colors duration-200 flex items-center gap-2"
                  style={{
                    backgroundColor: labStatus.isOpen ? 'var(--status-success)' : 'var(--status-error)',
                    color: 'white'
                  }}
                >
                  <span
                    className="w-3 h-3 bg-white rounded-lg"
                    style={{ opacity: labStatus.isOpen ? 1 : 0.8, animation: labStatus.isOpen ? 'pulse 2s infinite' : 'none' }}
                  />
                  {labStatus.statusText}
                </div>
                {labStatus.isClient && labStatus.countdownText && (
                  <div
                    className="text-sm font-medium px-3 py-1 rounded-lg border"
                    style={{
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--background-secondary)',
                      borderColor: 'var(--border-default)'
                    }}
                  >
                    {labStatus.countdownText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-12">

        {/* Why Choose Us — slate icons, no fuchsia */}
        <section id="why-us" className="mb-12 fade-in-section mt-8">
          <h2
            className="text-2xl font-bold mb-6"
            style={{ color: 'var(--color-bordeaux-primary)' }}
          >
            {t('why_choose_us')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { Icon: Award, label: t('certified_quality'), text: t('certified_quality_text') },
              { Icon: FlaskConical, label: t('state_of_the_art_equipment'), text: t('state_of_the_art_equipment_text') },
              { Icon: HeartPulse, label: t('experienced_team'), text: t('experienced_team_text') },
              { Icon: CheckCircle, label: t('dedicated_patient_service'), text: t('dedicated_patient_service_text') },
            ].map(({ Icon, label, text }) => (
              <div
                key={label}
                className="rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                style={{
                  backgroundColor: 'var(--background-card)',
                  borderColor: '#e2e8f0' /* gray-200 */
                }}
              >
                <div className="flex items-start">
                  <div
                    className="p-3 rounded-lg mr-3 flex-shrink-0"
                    style={{ backgroundColor: iconBg }}
                  >
                    <Icon size={24} style={{ color: iconColor }} />
                  </div>
                  <div>
                    <h3
                      className="font-semibold mb-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {label}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Services — bordeaux icons, gray backgrounds, single primary CTA per card */}
        <section id="services" className="mb-12 fade-in-section">
          <h2
            className="text-2xl font-bold mb-6"
            style={{ color: 'var(--color-bordeaux-primary)' }}
          >
            {t('our_main_services')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                Icon: FlaskConical,
                label: t('blood_tests'),
                text: t('blood_tests_text'),
                href: `/${lang}/analyses?tab=all`,
                ariaLabel: t('learn_more_about_blood_tests'),
              },
              {
                Icon: HeartPulse,
                label: t('health_checks'),
                text: t('health_checks_text'),
                href: `/${lang}/analyses?tab=bilans`,
                ariaLabel: t('learn_more_about_health_checks'),
              },
              {
                Icon: HomeIcon,
                label: t('home_service'),
                text: t('home_service_text'),
                href: `/${lang}/glabo`,
                ariaLabel: t('learn_more_about_home_service'),
              },
            ].map(({ Icon, label, text, href, ariaLabel }) => (
              <div
                key={label}
                className="rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                style={{
                  backgroundColor: 'var(--background-card)',
                  borderColor: '#e2e8f0'
                }}
              >
                <div className="text-center">
                  <div
                    className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-lg"
                    style={{ backgroundColor: 'rgba(128,0,32,0.07)' }}
                  >
                    <Icon size={32} style={{ color: 'var(--color-bordeaux-primary)' }} />
                  </div>
                  <h3
                    className="text-xl font-semibold mb-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {label}
                  </h3>
                  <p
                    className="text-sm mb-4"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {text}
                  </p>
                  {/* Text link — no solid button, strict hierarchy */}
                  <Link
                    href={href}
                    aria-label={ariaLabel}
                    className="inline-flex items-center gap-1 font-medium text-sm transition-colors duration-200"
                    style={{ color: 'var(--color-bordeaux-primary)' }}
                  >
                    {t('learn_more')}
                    <ChevronRight size={16} style={{ color: 'var(--color-bordeaux-primary)' }} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Location — bordeaux primary CTA, outline for secondary */}
        <section id="contact" className="mb-12 fade-in-section">
          <h2
            className="text-2xl font-bold mb-6"
            style={{ color: 'var(--color-bordeaux-primary)' }}
          >
            {t('our_location')}
          </h2>
          <div
            className="rounded-lg border overflow-hidden shadow-sm"
            style={{ borderColor: '#e2e8f0', backgroundColor: 'var(--background-card)' }}
          >
            <div style={{ backgroundColor: 'var(--background-secondary)', height: '16rem' }} className="md:h-96">
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
                  <MapPin size={48} style={{ color: 'var(--text-tertiary)' }} />
                  <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>
                    {t('loading_map')}
                  </span>
                </div>
              )}
            </div>
            <div className="p-6">
              <h3
                className="font-semibold text-xl mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('laboratory_name')}
              </h3>
              <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
                {t('laboratory_address')}
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                {/* Primary: Directions (bordeaux solid) */}
                <a
                  href="https://maps.app.goo.gl/NUiSsY2AQjeNHcDeA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-bordeaux flex items-center justify-center gap-2"
                  style={{ minWidth: '160px', height: '48px', fontSize: '1rem' }}
                >
                  <Navigation size={20} />
                  {t('get_directions')}
                </a>

                {/* Secondary: Call (outline) */}
                {isMobile ? (
                  <a
                    href={LAB_CONTACT.WHATSAPP_TEL}
                    className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 border"
                    style={{
                      minWidth: '160px',
                      height: '48px',
                      fontSize: '1rem',
                      padding: '0 1.5rem',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      borderColor: '#cbd5e1' /* slate-300 */
                    }}
                  >
                    <Phone size={20} />
                    {t('call_us')}
                  </a>
                ) : (
                  <button
                    onClick={handleCallClick}
                    className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 border"
                    style={{
                      minWidth: '160px',
                      height: '48px',
                      fontSize: '1rem',
                      padding: '0 1.5rem',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      borderColor: '#cbd5e1'
                    }}
                  >
                    <Phone size={20} />
                    {t('call_us')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Practical Info — slate icon */}
        <section id="info" className="mb-12">
          <h2
            className="text-2xl font-bold mb-6"
            style={{ color: 'var(--color-bordeaux-primary)' }}
          >
            {t('practical_info')}
          </h2>
          <div
            className="rounded-lg border p-6 shadow-sm"
            style={{ backgroundColor: 'var(--background-card)', borderColor: '#e2e8f0' }}
          >
            <div className="flex items-start">
              <div
                className="p-3 rounded-lg mr-4 flex-shrink-0"
                style={{ backgroundColor: iconBg }}
              >
                <Info size={24} style={{ color: iconColor }} />
              </div>
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t('glabo:analysis_tips')}
                </h3>
                <ul
                  className="list-disc pl-6 sm:pl-10 pt-2 space-y-2 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <li>{t('glabo:fasting_recommendation')}</li>
                  <li>{t('glabo:documents_to_bring')}</li>
                </ul>
                <Link
                  href={`/${lang}/analyses`}
                  className="mt-4 inline-block font-medium text-sm transition-colors duration-200 hover:underline"
                  style={{ color: 'var(--color-bordeaux-primary)' }}
                >
                  {t('glabo:more_information')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </>
  );
}
