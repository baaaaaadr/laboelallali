"use client";

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Phone, Mail, MapPin, Clock, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { 
  LAB_NAME, 
  LAB_ADDRESS, 
  LAB_CONTACT, 
  LAB_HOURS 
} from '@/constants/contact';

// Dynamically import the PWA install button with SSR disabled
const PWAInstallButton = dynamic(
  () => import('@/components/features/pwa/PWAInstallButton').then(mod => mod.default),
  { ssr: false }
);

const Footer = () => {
  const { t } = useTranslation('common');
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer-gradient text-white pt-12 pb-8 mt-4 dark:bg-gradient-to-br dark:from-[var(--brand-primary)] dark:via-[var(--color-bordeaux-light)] dark:to-[var(--brand-accent)]">
      <div className="container mx-auto px-4">
        <div className="w-full h-1 mb-4 bg-gradient-to-r from-[var(--brand-primary)]/70 via-[var(--color-bordeaux-light)]/70 to-[var(--brand-accent)]/70 dark:from-[var(--brand-accent)]/50 dark:via-[var(--color-bordeaux-light)]/50 dark:to-[var(--brand-primary)]/50 rounded-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm sm:text-base">
          {/* Contact Info */}
          <div>
            <h3 className="text-xl font-bold mb-4">{t('contact')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <MapPin size={20} className="flex-shrink-0 text-white dark:text-rose-200 mt-0.5" />
                <span>{t(LAB_ADDRESS)}</span>
              </li>
              <li className="flex flex-col">
                <div className="flex items-start space-x-3 mb-1">
                  <Phone size={20} className="flex-shrink-0 text-white dark:text-rose-200 mt-0.5" />
                  <span className="font-semibold">{t('lab_contact')}</span>
                </div>
                <div className={`${isRTL ? 'mr-7' : 'ml-7'}`}>
                  <p>{t('landline_label')} <a href={LAB_CONTACT.LANDLINE.url} className="hover:underline">{LAB_CONTACT.LANDLINE.display}</a></p>
                  {LAB_CONTACT.WHATSAPP.map((whatsapp, index) => (
                    <p key={index}>
                      {t('whatsapp_label')} <a href={whatsapp.url} className="hover:underline">{whatsapp.display}</a>
                    </p>
                  ))}
                  <p>{t('companies_label')} <a href={LAB_CONTACT.COMPANIES.url} className="hover:underline">{LAB_CONTACT.COMPANIES.display}</a></p>
                  <p>{t('fax_label')} {LAB_CONTACT.FAX}</p>
                </div>
              </li>
              <li className="flex items-start space-x-3">
                <Mail size={20} className="flex-shrink-0 text-white dark:text-rose-200 mt-0.5" />
                <div className="flex flex-col">
                  <a href={LAB_CONTACT.EMAIL.url} className="hover:underline">
                    {LAB_CONTACT.EMAIL.display}
                  </a>
                </div>
              </li>
              <li className="flex items-start space-x-3">
                <Clock size={20} className="flex-shrink-0 text-white dark:text-rose-200 mt-0.5" />
                <div>
                  <p>{LAB_HOURS.WEEKDAYS}</p>
                  <p>{LAB_HOURS.SUNDAY}</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xl font-bold mb-4">{t('quick_links')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="flex items-center space-x-2 hover:text-[var(--brand-accent)] dark:hover:text-rose-300 transition-colors duration-200 min-h-[44px] py-2">
                  <ChevronRight size={16} className="w-4 h-4" />
                  <span>{t('home')}</span>
                </Link>
              </li>
              <li>
                <Link href="#services" className="flex items-center space-x-2 hover:text-[var(--brand-accent)] dark:hover:text-rose-300 transition-colors duration-200 min-h-[44px] py-2">
                  <ChevronRight size={16} className="w-4 h-4" />
                  <span>{t('our_main_services')}</span>
                </Link>
              </li>
              <li>
                <Link href="#info" className="flex items-center space-x-2 hover:text-[var(--brand-accent)] dark:hover:text-rose-300 transition-colors duration-200 min-h-[44px] py-2">
                  <ChevronRight size={16} className="w-4 h-4" />
                  <span>{t('practical_info')}</span>
                </Link>
              </li>
              <li>
                <Link href="#contact" className="flex items-center space-x-2 hover:text-[var(--brand-accent)] dark:hover:text-rose-300 transition-colors duration-200 min-h-[44px] py-2">
                  <ChevronRight size={16} className="w-4 h-4" />
                  <span>{t('contact')}</span>
                </Link>
              </li>
              <li>
                <Link href="#faq" className="flex items-center space-x-2 hover:text-[var(--brand-accent)] transition-colors min-h-[44px] py-2">
                  <ChevronRight size={16} className="w-4 h-4" />
                  <span>{t('faq')}</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* About Us */}
          <div>
            <h3 className="text-xl font-bold mb-4">{t('about')}</h3>
            <p className="mb-4">
              {t('about_description')}
            </p>
            <div className="space-y-4">
              <div className="space-y-4 flex flex-col sm:w-auto w-full">
                <a 
                  href={LAB_CONTACT.WHATSAPP[0].url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-[var(--brand-primary)] hover:bg-[var(--color-bordeaux-light)] text-white px-6 py-3 rounded-lg inline-flex items-center justify-center space-x-2 transition-colors shadow-sm hover:shadow-md w-full"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="white" viewBox="0 0 16 16" className="flex-shrink-0">
                    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                  </svg>
                  <span>{t('contact_on_whatsapp')}</span>
                </a>
              
                <PWAInstallButton 
                  variant="footer" 
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 mt-8 pt-6 text-center">
          <p className="footer-copyright">
            <Image
              src="/images/icons/logo-footer.png"
              alt="Company Logo"
              width={24} // w-auto will be handled by Tailwind, but width/height are required by Next/Image
              height={24} // h-6
              className="inline mr-2 h-6 w-auto align-middle"
            />
            {currentYear} {t('laboratory_name')}. {t('rights_reserved')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
