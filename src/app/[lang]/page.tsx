"use client";

import HeroBanner from '@/components/features/home/HeroBanner';
import { Clock, CheckCircle, Award, FlaskConical, HeartPulse, HomeIcon, Info, MapPin, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, Suspense } from "react";
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';

// Dynamically import the map component with SSR disabled
const LocationMap = dynamic(
  () => import('@/components/features/maps/LocationMap'),
  { ssr: false }
);

// For Next.js 15.3.1, params in client components should be unwrapped with React.use()
export default function HomePage({ 
  params 
}: { 
  params: { lang: string } | Promise<{ lang: string }>
}) {
  // Unwrap params using React.use() to prevent hydration errors
  // This works for both Promise<Params> and direct Params
  const resolvedParams = 'then' in params ? React.use(params) : params;
  
  // Log the language for debugging
  console.log(`Page rendered for language: ${resolvedParams.lang}`);
  const { t } = useTranslation('common');
  // On peut faire un check pour savoir si le labo est ouvert actuellement
  const currentHour = new Date().getHours();
  const currentDay = new Date().getDay(); // 0 = Dimanche, 6 = Samedi
  const isWeekday = currentDay > 0 && currentDay < 6;
  const isSaturday = currentDay === 6;
  const isSunday = currentDay === 0;
  
  const isOpen = (isWeekday && currentHour >= 7.5 && currentHour < 18.5) || 
                 (isSaturday && currentHour >= 7.5 && currentHour < 18.5) ||
                 (isSunday && currentHour >= 8 && currentHour < 18);

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
      {/* Hero Banner - Now truly full width with no constraints */}
      <HeroBanner />
      
      {/* Container for the rest of the content */}
      <div className="container mx-auto px-4 py-8 pb-12">
        {/* Status Widget */}
        <div className="card flex flex-col md:flex-row items-center justify-between mb-8 gap-4 border-l-4 border-[#FF4081]">
  <div className="flex-1 w-full md:w-auto">
    <h3 className="text-lg font-bold text-[#800020] mb-1 flex items-center">
      <Clock size={20} className="mr-2 text-[#FF4081]" />
      {t('opening_hours')}
    </h3>
    <p className="text-sm text-gray-700">{t('opening_hours_text')}</p>
  </div>
  <div className="flex items-center justify-center md:ml-8">
    <div className={`${isOpen ? 'bg-green-700' : 'bg-[#B71C1C]'} text-white px-5 py-2 rounded-full font-semibold text-base shadow transition-colors duration-200 flex items-center gap-2`}>
      <span className={`w-3 h-3 ${isOpen ? 'bg-green-300' : 'bg-red-300'} rounded-full`}></span>
      {isOpen ? t('open') : t('closed')}
    </div>
  </div>
</div>
        
        {/* Why Choose Us Section */}
        <section id="why-us" className="mb-12 fade-in-section">
          <h2 className="text-2xl font-bold text-[#800020] mb-6">{t('why_choose_us')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <Award className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t('certified_quality')}</h3>
                  <p className="text-gray-600">{t('certified_quality_text')}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <FlaskConical className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t('state_of_the_art_equipment')}</h3>
                  <p className="text-gray-600">{t('state_of_the_art_equipment_text')}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <HeartPulse className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t('experienced_team')}</h3>
                  <p className="text-gray-600">{t('experienced_team_text')}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <CheckCircle className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t('dedicated_patient_service')}</h3>
                  <p className="text-gray-600">{t('dedicated_patient_service_text')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Services Section */}
        <section id="services" className="mb-12 fade-in-section">
          <h2 className="text-2xl font-bold text-[#800020] mb-6">{t('our_main_services')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[#F7E7EA]">
                  <FlaskConical className="text-[#800020]" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{t('blood_tests')}</h3>
                <p className="text-gray-600 mb-4">{t('blood_tests_text')}</p>
                <Link href="#" className="btn-text" aria-label={t('learn_more_about_blood_tests')}>
                  {t('learn_more')}
                  <span className="btn-chevron" aria-hidden="true">
                    <ChevronRight className="text-[#800020]" size={16} />
                  </span>
                </Link>
              </div>
            </div>
            
            <div className="card">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[#F7E7EA]">
                  <HeartPulse className="text-[#800020]" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{t('health_checks')}</h3>
                <p className="text-gray-600 mb-4">{t('health_checks_text')}</p>
                <Link href="#" className="btn-text" aria-label={t('learn_more_about_health_checks')}>
                  {t('learn_more')}
                  <span className="btn-chevron" aria-hidden="true">
                    <ChevronRight className="text-[#800020]" size={16} />
                  </span>
                </Link>
              </div>
            </div>
            
            <div className="card">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[#F7E7EA]">
                  <HomeIcon className="text-[#800020]" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{t('home_service')}</h3>
                <p className="text-gray-600 mb-4">{t('home_service_text')}</p>
                <Link href="#" className="btn-text" aria-label={t('learn_more_about_home_service')}>
                  {t('learn_more')}
                  <span className="btn-chevron" aria-hidden="true">
                    <ChevronRight className="text-[#800020]" size={16} />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>
        
        {/* Location Section */}
        <section id="contact" className="mb-12 fade-in-section">
          <h2 className="text-2xl font-bold text-[#800020] mb-6">{t('our_location')}</h2>
          <div className="card p-0 overflow-hidden">
            <div className="bg-gray-200 relative">
              <Suspense fallback={<div className="h-64 md:h-96 flex items-center justify-center"><MapPin size={48} className="text-gray-500" /> <span className="ml-2 text-gray-500">{t('loading_map')}</span></div>}>
                <LocationMap 
                  latitude={30.4173116} 
                  longitude={-9.589799900000001} 
                  name={t('laboratory_name')} 
                  address={t('laboratory_address')} 
                />
              </Suspense>
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-xl mb-2">{t('laboratory_name')}</h3>
              <p className="text-gray-600 mb-4">
                {t('laboratory_address')}
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-wrap gap-4 items-center">
                  <a
                    href="https://maps.app.goo.gl/NUiSsY2AQjeNHcDeA"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center min-w-[160px] h-12 px-6 bg-[var(--accent-fuchsia)] text-white font-semibold rounded-lg shadow transition-colors text-center text-lg hover:bg-[#F50057] focus:bg-[#F50057] gap-2"
                  >
                    <MapPin size={22} className="mr-2 -ml-1" />
                    {t('get_directions')}
                  </a>
                  <a
                    href="tel:+212528841414" // Remplacez par le numéro de téléphone réel
                    className="flex items-center justify-center min-w-[160px] h-12 px-6 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm transition-colors text-center text-lg hover:bg-gray-100 focus:bg-gray-100 gap-2"
                  >
                    <Info size={22} className="mr-2 -ml-1" />
                    {t('call_us')}
                  </a>
                   {/*<Link href="/rendez-vous" className="flex items-center justify-center min-w-[160px] h-12 px-6 bg-[var(--accent-fuchsia)] text-white font-semibold rounded-lg shadow transition-colors text-center text-lg hover:bg-[#F50057] focus:bg-[#F50057] gap-2">
                        <Navigation size={22} className="mr-2 -ml-1" />
                        RDV en Ligne
  </Link>*/}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
