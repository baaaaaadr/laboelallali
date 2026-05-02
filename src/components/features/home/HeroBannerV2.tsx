import React from 'react';
import { Navigation, FileText, Phone } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslation as useTranslationOriginal } from 'react-i18next';
import { LAB_CONTACT } from '@/constants/contact';

const useTranslation = (ns: string) => {
  return useTranslationOriginal(ns);
};

const PWAInstallButton = dynamic<{ className?: string, variant?: 'button' | 'banner' | 'footer' }>(
  () => import('@/components/features/pwa/PWAInstallButton').then(mod => mod.default),
  { ssr: false, loading: () => <div className="w-full h-12"></div> }
);

interface HeroBannerV2Props {
  onCallClick?: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  isMobile?: boolean;
}

const HeroBannerV2: React.FC<HeroBannerV2Props> = ({ onCallClick, isMobile = true }) => {
  const { t, i18n } = useTranslation('common');
  const currentLang = i18n.language || 'fr';

  return (
    <div className="relative overflow-hidden -mt-[1px] w-full min-h-screen flex items-center justify-center">
      {/* Banner Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/hero-banner.jpg"
          alt={t('banner_alt')}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Clean dark gray gradient overlay — no bordeaux tint */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(15,15,15,0.55) 0%, rgba(10,10,10,0.70) 100%)'
          }}
        />
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 relative z-10 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight break-words"
            style={{ color: 'white', textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}
          >
            {t('welcome_banner')}
          </h1>
          <p
            className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 opacity-90 break-words"
            style={{ color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
          >
            {t('welcome_description')}
          </p>

          <div className="flex flex-col gap-4 justify-center items-center w-full">
            {/* Primary CTA — single bordeaux button */}
            <Link
              href={`/${currentLang}/rendez-vous`}
              className="button-bordeaux w-full sm:w-auto sm:min-w-[240px] text-lg"
            >
              <FileText size={22} />
              {t('send_prescription')}
            </Link>

            {/* Secondary actions — outlined, not solid */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center w-full">
              {isMobile ? (
                <a
                  href={LAB_CONTACT.WHATSAPP_TEL}
                  onClick={onCallClick}
                  className="w-full sm:w-auto sm:min-w-[200px] text-lg flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 border-2"
                  style={{
                    padding: '0.75rem 1.75rem',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(4px)',
                    minHeight: '48px'
                  }}
                >
                  <Phone size={20} />
                  {t('call_us')}
                </a>
              ) : (
                <button
                  onClick={onCallClick}
                  className="w-full sm:w-auto sm:min-w-[200px] text-lg flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 border-2"
                  style={{
                    padding: '0.75rem 1.75rem',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(4px)',
                    minHeight: '48px'
                  }}
                >
                  <Phone size={20} />
                  {t('call_us')}
                </button>
              )}
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=61+Bis+Rue+de+Marrakech+80020+Agadir"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto sm:min-w-[220px] text-lg flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 border-2"
                style={{
                  padding: '0.75rem 1.75rem',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.6)',
                  backdropFilter: 'blur(4px)',
                  minHeight: '48px'
                }}
              >
                <Navigation size={20} />
                {t('navigate_to_lab')}
              </a>
            </div>

            {/* PWA install — text-level, no solid fill */}
            <div className="flex justify-center w-full">
              <PWAInstallButton
                variant="button"
                className="w-full sm:w-auto sm:min-w-[200px] text-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroBannerV2;
