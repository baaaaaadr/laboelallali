import React from 'react';
import { MapPin, Navigation, Phone } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { LAB_CONTACT } from '@/constants/contact';

const SimpleMap = dynamic(() => import('@/components/SimpleMap'), { ssr: false });

interface LocationInfoProps {
  isClient: boolean;
  isMobile: boolean;
  onCallClick: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
}

export default function LocationInfo({ isClient, isMobile, onCallClick }: LocationInfoProps) {
  const { t } = useTranslation('common');

  return (
    <section id="contact" className="mb-12 fade-in-section">
      <h2 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] mb-10">{t('our_location')}</h2>
      <div className="card p-0 overflow-hidden">
        <div className="bg-[var(--background-secondary)] h-64 md:h-96">
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
              {isMobile ? (
                <a
                  href={LAB_CONTACT.WHATSAPP_TEL}
                  className="map-call-btn flex items-center justify-center min-w-[160px] h-12 px-6 font-semibold rounded-lg shadow-sm transition-colors text-center text-lg gap-2 cursor-pointer"
                >
                  <Phone size={22} className="mr-2 -ml-1" />
                  {t('call_us')}
                </a>
              ) : (
                <button
                  onClick={onCallClick}
                  className="map-call-btn flex items-center justify-center min-w-[160px] h-12 px-6 font-semibold rounded-lg shadow-sm transition-colors text-center text-lg gap-2 cursor-pointer"
                >
                  <Phone size={22} className="mr-2 -ml-1" />
                  {t('call_us')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
