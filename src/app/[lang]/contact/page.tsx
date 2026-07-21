"use client";

import React from 'react';
import { Phone, Mail, MapPin, Clock, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';
import ContactModal from '@/components/ui/ContactModal';
import { useState, useEffect } from 'react';

// Dynamically import SimpleMap with SSR disabled to avoid window is not defined errors
const SimpleMap = dynamic(
  () => import('@/components/SimpleMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-96 w-full flex items-center justify-center bg-[var(--background-secondary)] rounded-lg border border-[var(--border-default)]">
        <MapPin size={48} className="text-[var(--text-tertiary)]" />
        <span className="ml-2 text-[var(--text-secondary)]">Loading map...</span>
      </div>
    )
  }
);
import { 
  LAB_NAME, 
  LAB_ADDRESS, 
  LAB_COORDINATES,
  LAB_CONTACT
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
  
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const checkMobile = () => {
      const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const widthMobile = window.innerWidth < 768;
      setIsMobile(uaMobile || widthMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleCallClick = (e: React.MouseEvent) => {
    if (!isMobile) {
      e.preventDefault();
      setIsContactModalOpen(true);
    }
  };

  // Get translated lab name and address
  const labName = t(LAB_NAME);
  const labAddress = t(LAB_ADDRESS);

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--brand-primary)] mb-10">{t('contact_title')}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Information */}
        <div className="space-y-8">
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-[var(--brand-primary)] mb-10">{t('lab_coordinates')}</h2>
            
            <div className="space-y-6">
              <div className="flex items-start">
                <MapPin size={24} className={`${isRTL ? 'ml-4' : 'mr-4'} mt-1 flex-shrink-0 text-[var(--brand-primary)]`} />
                <div>
                  <h3 className="font-semibold text-lg mb-1 text-[var(--color-gray-600)]">{labName}</h3>
                  <p className="text-[var(--text-secondary)]">{labAddress}</p>
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
              
              <div className="border-t border-[var(--border-default)] pt-6">
                <h3 className="font-semibold text-lg mb-4 text-[var(--color-gray-600)]">{t('contact')}</h3>
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
                      <p>{t('monday_to_friday')}</p>
                      <p>{t('saturday_hours')}</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Additional Information Card */}
          <div className="card p-6 bg-[var(--background-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-gray-600)] mb-8">{t('find_us')}</h3>
            <p className="text-[var(--text-secondary)] mb-4">
              {t('find_us_text')}
            </p>
            <p className="text-[var(--text-secondary)]">
              {t('emergency_contact')}
            </p>
          </div>
        </div>
        
        {/* Map Section */}
        <div className="h-full">
          <div className="card h-full p-0 overflow-hidden">
            <div className="w-full relative z-10" style={{ height: '400px' }}>
              <SimpleMap 
                latitude={30.4173116} 
                longitude={-9.5897999} 
                markerText={`${labName} - ${labAddress}`}
                height="100%"
              />
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-xl mb-2 text-[var(--text-primary)]">{labName}</h3>
              <p className="text-[var(--text-secondary)] mb-4">
                {labAddress}
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://maps.app.goo.gl/NUiSsY2AQjeNHcDeA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-bordeaux flex-1 min-w-[150px] h-12"
                >
                  <MapPin size={22} />
                  {t('get_directions')}
                </a>
                <a
                  href={LAB_CONTACT.WHATSAPP_TEL}
                  onClick={handleCallClick}
                  className="button-fuchsia flex-1 min-w-[150px] h-12"
                >
                  <Phone size={22} />
                  {t('call_us')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ContactModal 
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />

      {/* Practical Information Section */}
      <section id="info" className="mt-16 pt-8 border-t border-[var(--border-default)]">
        <h2 className="text-2xl font-bold text-[var(--brand-primary)] mb-8 flex items-center">
          <Clock size={28} className={`${isRTL ? 'ml-3' : 'mr-3'}`} />
          {t('practical_info')}
        </h2>
        
        {/* "Coordonnées du Laboratoire" card removed here — it duplicated the
            "Comment nous trouver" block above (same find_us_text). */}
        <div className="card p-6 md:p-8 bg-[var(--background-card)]">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">{t('glabo:analysis_tips')}</h3>
            <ul className={`space-y-3 text-[var(--text-secondary)] ${isRTL ? 'list-disc pr-5' : 'list-disc pl-5'}`}>
              <li>{t('glabo:fasting_recommendation')}</li>
              <li>{t('glabo:documents_to_bring')}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="mt-16 pt-8 mb-8">
        <h2 className="text-2xl font-bold text-[var(--brand-primary)] mb-8 flex items-center">
          <ChevronRight size={28} className={`${isRTL ? 'ml-3 rotate-180' : 'mr-3'}`} />
          {t('faq')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className="card p-6 border border-[var(--border-default)] hover:border-[var(--brand-primary)]/30">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                {t(`faq_questions.q${num}`)}
              </h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {t(`faq_questions.a${num}`)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
