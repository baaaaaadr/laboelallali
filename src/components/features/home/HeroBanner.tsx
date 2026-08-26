import React from 'react';
import { Navigation, FileText } from 'lucide-react';
// Quick-access tiles (demande n° 15). Client component, imported eagerly: it is
// above the fold and its five links are the primary entry points of the site.
import HeroShortcuts from '@/components/features/home/HeroShortcuts';
// Import useTranslation hook without type issues
import { useTranslation as useTranslationOriginal } from 'react-i18next';
import { LAB_CONTACT } from '@/constants/contact';

// Create a wrapper to avoid TypeScript errors
const useTranslation = (ns: string) => {
  return useTranslationOriginal(ns);
};

interface HeroBannerProps {
  /** Locale segment, needed to build the shortcut hrefs. */
  lang: string;
  onCallClick?: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  isMobile?: boolean;
}

const HeroBanner: React.FC<HeroBannerProps> = ({ lang, onCallClick, isMobile = true }) => {
  // Use a simpler approach without type assertions
  const { t } = useTranslation('common');

  return (
    <div className="relative overflow-hidden -mt-[1px] w-full min-h-screen flex items-center justify-center hero-banner">
      {/* Banner Image */}
      <div className="absolute inset-0 z-0">
        {/* Use standard img tag which we know works from the test */}
        <img
          src="/images/hero-banner.jpg"
          alt={t('banner_alt')}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Semi-transparent overlay to ensure text is readable */}
        <div className="hero-banner-overlay"></div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 relative z-10 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight break-words hero-text" style={{ color: 'white !important' }}>
            {t('welcome_banner')}
          </h1>
          <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 opacity-90 break-words hero-text" style={{ color: 'white !important' }}>
            {t('welcome_description')}
          </p>
          {/* Quick-access tiles, in the order set by the lab: bilan, ordonnance,
              résultats, WhatsApp du Dr, installation. They come BEFORE the three
              historical buttons below, as requested. */}
          <div className="mb-6 sm:mb-8">
            <HeroShortcuts lang={lang} />
          </div>

          <div className="flex flex-col gap-4 justify-center items-center w-full">
            {/* First row: 3 main action buttons on desktop, stacked on mobile */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full">
              {isMobile ? (
                <a
                  href={LAB_CONTACT.WHATSAPP_TEL}
                  onClick={onCallClick}
                  className="button-fuchsia w-full sm:w-auto sm:min-w-[200px] text-lg flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a2 2 0 011.94 1.515l.3 1.2a2 2 0 01-.45 1.95l-1.27 1.27a16.001 16.001 0 006.586 6.586l1.27-1.27a2 2 0 011.95-.45l1.2.3A2 2 0 0121 16.72V19a2 2 0 01-2 2h-1C9.163 21 3 14.837 3 7V5z" />
                  </svg>
                  {t('call_us')}
                </a>
              ) : (
                <button
                  onClick={onCallClick}
                  className="button-fuchsia w-full sm:w-auto sm:min-w-[200px] text-lg flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a2 2 0 011.94 1.515l.3 1.2a2 2 0 01-.45 1.95l-1.27 1.27a16.001 16.001 0 006.586 6.586l1.27-1.27a2 2 0 011.95-.45l1.2.3A2 2 0 0121 16.72V19a2 2 0 01-2 2h-1C9.163 21 3 14.837 3 7V5z" />
                  </svg>
                  {t('call_us')}
                </button>
              )}
              <a
                href={LAB_CONTACT.WHATSAPP[0].url}
                target="_blank"
                rel="noopener noreferrer"
                className="button-fuchsia w-full sm:w-auto sm:min-w-[240px] text-lg"
              >
                <FileText size={22} />
                {t('send_prescription')}
              </a>
              <a
                href="https://maps.app.goo.gl/7ZnXdXo9wiehq2tm7"
                target="_blank"
                rel="noopener noreferrer"
                className="button-fuchsia w-full sm:w-auto sm:min-w-[220px] text-lg"
              >
                <Navigation size={22} />
                {t('navigate_to_lab')}
              </a>
            </div>
            {/* The standalone PWA install button that used to sit here was removed:
                installation is now the 5th tile of HeroShortcuts above, and two
                install CTAs 100px apart made no sense. It is still reachable from
                the footer (variant="footer") and the mobile menu (variant="icon"). */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
