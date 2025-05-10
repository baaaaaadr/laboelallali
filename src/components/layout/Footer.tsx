"use client";
import Link from 'next/link';
import { Phone, Mail, MapPin, Clock, ChevronRight } from 'lucide-react';

import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation('common');
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer-gradient text-white pt-12 pb-8 mt-4">
      <div className="container mx-auto px-4">
        <div className="w-full h-1 mb-4 bg-gradient-to-r from-[#800020]/70 via-[#B84C63]/70 to-[#FF4081]/70 rounded-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm sm:text-base">
  {/* Sur mobile, grille verticale et padding supplémentaire */}
          {/* Contact Info */}
          <div>
            <h3 className="text-xl font-bold mb-4">{t('contact')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <MapPin size={20} className="mr-2 mt-1 flex-shrink-0 text-[#FF4081]" />
                <span>61 Bis, Rue de Marrakech, 80020, Agadir</span>
              </li>
              <li className="flex flex-col">
                <div className="flex items-center mb-1">
                  <Phone size={20} className="mr-2 flex-shrink-0 text-[#FF4081]" />
                  <span className="font-semibold">{t('lab_contact')}</span>
                </div>
                <div className="ml-7">
                  <p>{t('landline_label')} <a href="tel:0528843384" className="hover:underline">0528843384</a></p>
                  <p>{t('whatsapp_label')} <a href="https://wa.me/212634293900" className="hover:underline">0634293900</a></p>
                  <p>{t('whatsapp_label')} <a href="https://wa.me/212707291873" className="hover:underline">0707291873</a></p>
                  <p>{t('companies_label')} <a href="tel:0664727681" className="hover:underline">0664727681</a></p>
                  <p>{t('fax_label')} 0528828758</p>
                </div>
              </li>
              <li className="flex items-center">
                <Mail size={20} className="mr-2 flex-shrink-0 text-[#FF4081]" />
                <div className="flex flex-col">
                  <a href="mailto:laboelallali@gmail.com" className="hover:underline">
                    laboelallali@gmail.com
                  </a>
                </div>
              </li>
              <li className="flex items-start">
                <Clock size={20} className="mr-2 mt-1 flex-shrink-0 text-[#FF4081]" />
                <div>
                  <p>Lundi au Samedi: 7h30 to 18h30</p>
                  <p>Dimanche: 08h00 to 18h00</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xl font-bold mb-4">{t('quick_links')}</h3>
            <ul className="space-y-2">
  {/* Liens avec taille minimum pour accessibilité mobile */}
              <li>
                <Link href="/" className="flex items-center hover:text-[#FF4081] transition-colors min-h-[44px] py-2">
                  <ChevronRight size={16} className="mr-2" />
                  {t('home')}
                </Link>
              </li>
              <li>
                <Link href="#services" className="flex items-center hover:text-[#FF4081] transition-colors min-h-[44px] py-2">
                  <ChevronRight size={16} className="mr-2" />
                  {t('our_main_services')}
                </Link>
              </li>
              <li>
                <Link href="#info" className="flex items-center hover:text-[#FF4081] transition-colors min-h-[44px] py-2">
                  <ChevronRight size={16} className="mr-2" />
                  {t('practical_info')}
                </Link>
              </li>
              <li>
                <Link href="#contact" className="flex items-center hover:text-[#FF4081] transition-colors min-h-[44px] py-2">
                  <ChevronRight size={16} className="mr-2" />
                  Contact
                </Link>
              </li>
              <li>
                <Link href="#faq" className="flex items-center hover:text-[#FF4081] transition-colors min-h-[44px] py-2">
                  <ChevronRight size={16} className="mr-2" />
                  {t('faq')}
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
            <a 
              href="https://wa.me/212528000000" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer-whatsapp-btn bg-[#800020] hover:bg-[#B84C63] text-white px-4 py-2 rounded-lg inline-flex items-center transition-colors shadow-sm hover:shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="mr-2" viewBox="0 0 16 16">
                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
              </svg>
              {t('contact')}
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 mt-8 pt-6 text-center">
          <p className="footer-copyright">© {currentYear} {t('laboratory_name')}. {t('rights_reserved')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;