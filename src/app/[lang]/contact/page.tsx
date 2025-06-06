"use client";

import React from 'react';
import { Phone, Mail, MapPin, Clock, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';

// Dynamically import SimpleMap with SSR disabled to avoid window is not defined errors
const SimpleMap = dynamic(
  () => import('@/components/SimpleMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-96 w-full flex items-center justify-center bg-gray-100 rounded-lg">
        <MapPin size={48} className="text-gray-400" />
        <span className="ml-2 text-gray-500">Loading map...</span>
      </div>
    )
  }
);
import { 
  LAB_NAME, 
  LAB_ADDRESS, 
  LAB_COORDINATES, 
  LAB_CONTACT, 
  LAB_HOURS 
} from '@/constants/contact';

export default function ContactPage({ 
  params 
}: { 
  params: { lang: string } | Promise<{ lang: string }>
}) {
  // Unwrap params using React.use() to prevent hydration errors
  const resolvedParams = 'then' in params ? React.use(params) : params;
  const { t, i18n } = useTranslation('common');
  const isRTL = i18n.language === 'ar';
  
  // Get translated lab name and address
  const labName = t(LAB_NAME);
  const labAddress = t(LAB_ADDRESS);

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--brand-primary)] mb-8">{t('contact_title')}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Information */}
        <div className="space-y-8">
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-[var(--brand-primary)] mb-6">{t('lab_coordinates')}</h2>
            
            <div className="space-y-6">
              <div className="flex items-start">
                <MapPin size={24} className={`${isRTL ? 'ml-4' : 'mr-4'} mt-1 flex-shrink-0 text-[var(--brand-primary)]`} />
                <div>
                  <h3 className="font-semibold text-lg mb-1">{labName}</h3>
                  <p className="text-gray-700">{labAddress}</p>
                  <a 
                    href={LAB_COORDINATES.GOOGLE_MAPS_URL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-[var(--brand-primary)] hover:underline mt-2"
                  >
                    {t('view_map')}
                    <ChevronRight size={16} className="ml-1" />
                  </a>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-semibold text-lg mb-4">{t('contact')}</h3>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <Phone size={20} className={`${isRTL ? 'ml-4' : 'mr-4'} mt-1 flex-shrink-0 text-[var(--brand-primary)]`} />
                    <div>
                      <p className="font-medium">{t('lab_contact')}</p>
                      <div className={`mt-1 space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <p>{t('landline_label')} <a href={LAB_CONTACT.LANDLINE.url} className="text-[var(--brand-primary)] hover:underline">{LAB_CONTACT.LANDLINE.display}</a></p>
                        {LAB_CONTACT.WHATSAPP.map((whatsapp, index) => (
                          <p key={index}>
                            {t('whatsapp_label')} <a href={whatsapp.url} className="text-[var(--brand-primary)] hover:underline">{whatsapp.display}</a>
                          </p>
                        ))}
                        <p>{t('companies_label')} <a href={LAB_CONTACT.COMPANIES.url} className="text-[var(--brand-primary)] hover:underline">{LAB_CONTACT.COMPANIES.display}</a></p>
                        <p>{t('fax_label')} {LAB_CONTACT.FAX}</p>
                      </div>
                    </div>
                  </li>
                  
                  <li className="flex items-start">
                    <Mail size={20} className={`${isRTL ? 'ml-4' : 'mr-4'} mt-1 flex-shrink-0 text-[var(--brand-primary)]`} />
                    <div>
                      <p className="font-medium">{t('email_label')}</p>
                      <a href={LAB_CONTACT.EMAIL.url} className="text-[var(--brand-primary)] hover:underline">{LAB_CONTACT.EMAIL.display}</a>
                    </div>
                  </li>
                  
                  <li className="flex items-start">
                    <Clock size={20} className={`${isRTL ? 'ml-4' : 'mr-4'} mt-1 flex-shrink-0 text-[var(--brand-primary)]`} />
                    <div>
                      <p className="font-medium">{t('working_hours_label')}</p>
                      <p>{LAB_HOURS.WEEKDAYS}</p>
                      <p>{LAB_HOURS.SUNDAY}</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Additional Information Card */}
          <div className="card p-6 bg-[var(--background-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--brand-primary)] mb-4">{t('find_us')}</h3>
            <p className="text-gray-700 mb-4">
              {t('find_us_text')}
            </p>
            <p className="text-gray-700">
              {t('emergency_contact')}
            </p>
          </div>
        </div>
        
        {/* Map Section */}
        <div className="h-full">
          <div className="card h-full p-0 overflow-hidden">
            <div className="w-full" style={{ height: '400px' }}>
              <SimpleMap 
                latitude={30.4173116} 
                longitude={-9.5897999} 
                markerText={`${labName} - ${labAddress}`}
                height="100%"
              />
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-xl mb-2">{labName}</h3>
              <p className="text-gray-600 mb-4">
                {labAddress}
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://maps.app.goo.gl/NUiSsY2AQjeNHcDeA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center min-w-[160px] h-12 px-6 bg-[var(--brand-accent)] text-white font-semibold rounded-lg shadow transition-colors text-center text-lg hover:bg-[var(--brand-accent-hover)] focus:bg-[var(--brand-accent-hover)] gap-2"
                >
                  <MapPin size={22} className="mr-2 -ml-1" />
                  {t('get_directions')}
                </a>
                <a
                  href={LAB_CONTACT.LANDLINE.url}
                  className="flex items-center justify-center min-w-[160px] h-12 px-6 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm transition-colors text-center text-lg hover:bg-gray-100 focus:bg-gray-100 gap-2"
                >
                  <Phone size={22} className="mr-2 -ml-1" />
                  {t('call_us')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
