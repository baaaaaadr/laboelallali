import React from 'react';
import { Navigation } from 'lucide-react';
import dynamic from 'next/dynamic';
// Import useTranslation hook without type issues
import { useTranslation as useTranslationOriginal } from 'react-i18next';

// Create a wrapper to avoid TypeScript errors
const useTranslation = (ns: string) => {
  return useTranslationOriginal(ns);
};

// Import the PWA install button component with SSR disabled
const InstallButton = dynamic<{ className?: string }>(
  () => import('@/components/features/pwa/InstallButton').then(mod => mod.default),
  { 
    ssr: false,
    loading: () => <div className="w-full h-12"></div> // Keep the layout stable while loading
  }
);

const HeroBanner = () => {
  // Use a simpler approach without type assertions
  const { t } = useTranslation('common');
  return (
    <div className="relative overflow-hidden mb-8 -mt-[1px] w-full">
      {/* Banner Image */}
      <div className="absolute inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-banner.jpg"
          alt={t('banner_alt')}
          className="object-cover w-full h-full"
          style={{ position: 'absolute', inset: 0 }}
        />
        {/* Overlay to ensure text is readable */}
        <div className="absolute inset-0 bg-[#800020] opacity-60"></div>
      </div>
      
      {/* Content */}
      <div className="container mx-auto px-4 py-16 sm:py-20 md:py-32 relative z-10">
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 break-words text-white">
            {t('welcome_banner')}
          </h1>
          <p className="text-base sm:text-lg md:text-xl mb-8 opacity-90 break-words text-white">
            {t('welcome_description')}
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 w-full">
            <a
              href="tel:0528843384"
              className="flex items-center justify-center min-w-[170px] h-12 px-6 bg-[#FF4081] text-white font-semibold rounded-lg shadow transition-all duration-200 text-center text-lg hover:bg-white hover:text-[#FF4081] focus:bg-white focus:text-[#FF4081] gap-2 w-full sm:w-auto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 -ml-1"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a2 2 0 011.94 1.515l.3 1.2a2 2 0 01-.45 1.95l-1.27 1.27a16.001 16.001 0 006.586 6.586l1.27-1.27a2 2 0 011.95-.45l1.2.3A2 2 0 0121 16.72V19a2 2 0 01-2 2h-1C9.163 21 3 14.837 3 7V5z" /></svg>
              {t('call_us')}
            </a>
            <a
              href="https://www.google.com/maps/dir/?api=1&destination=61+Bis+Rue+de+Marrakech+80020+Agadir"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center min-w-[220px] h-12 px-6 bg-[#FF4081] text-white font-semibold rounded-lg shadow transition-all duration-200 text-center text-lg hover:bg-white hover:text-[#FF4081] focus:bg-white focus:text-[#FF4081] gap-2 w-full sm:w-auto"
            >
              <Navigation size={22} className="mr-2 -ml-1" />
              {t('navigate_to_lab')}
            </a>
            <InstallButton 
              className="flex items-center justify-center min-w-[170px] h-12 px-6 bg-[#FF4081] text-white font-semibold rounded-lg shadow transition-all duration-200 text-center text-lg hover:bg-white hover:text-[#FF4081] focus:bg-white focus:text-[#FF4081] gap-2 w-full sm:w-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;