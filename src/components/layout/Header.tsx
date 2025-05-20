"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Search, User, Globe, Home, CalendarDays, Truck, FlaskConical, Phone, MessageCircle, Download } from 'lucide-react';  
import { LAB_WHATSAPP_NUMBER } from '@/constants/contact';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';
import { supportedLngs } from '../../../i18n';

function getLangFromPath(path: string) {
  const match = path.match(/^\/([a-zA-Z-]+)/);
  return match ? match[1] : 'fr'; // fallback on 'fr'
}

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const pathname = usePathname();

  const lang = i18n.language || getLangFromPath(pathname);
  // Make sure we're using the language from the URL, not potentially a mismatched language from i18n
  const urlLang = getLangFromPath(pathname);
  // Force i18n language to match the URL language as early as possible
  useEffect(() => {
    if (i18n.language !== urlLang) {
      i18n.changeLanguage(urlLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLang]);
  const currentLanguagePath = `/${urlLang}`;
  
  // Debug log to help identify language issues
  console.log(`Header: i18n.language=${lang}, URL language=${urlLang}, pathname=${pathname}`)

  const toggleMenu = () => {
    const newMenuState = !isMenuOpen;
    console.log(`[DEBUG] Mobile menu toggled: ${newMenuState ? 'OPENED' : 'CLOSED'}`);
    setIsMenuOpen(newMenuState);
  };
  
  // Debug log when component renders
  useEffect(() => {
    console.log(`[DEBUG] Header rendered, isMenuOpen: ${isMenuOpen}`);
  }, [isMenuOpen]);

  const handleLanguageChange = () => {
    // CORRECTION: Utiliser la langue de l'URL comme source de vérité, pas i18n.language
    const currentLang = urlLang; // Utiliser urlLang au lieu de lang
    const newLocale = currentLang === 'fr' ? 'ar' : 'fr';

    // Extract the path after the language code
    let pathWithoutLang = pathname;
    const langPattern = new RegExp(`^/(${supportedLngs.join('|')})`);
    if (langPattern.test(pathname)) {
      // Remove the language prefix from the path
      pathWithoutLang = pathname.replace(langPattern, '');
      // If the path is empty after removing language code, set it to '/' for homepage
      if (pathWithoutLang === '') pathWithoutLang = '/';
    }

    // Construct a new path with the new language code
    const newPath = pathWithoutLang === '/' 
      ? `/${newLocale}` 
      : `/${newLocale}${pathWithoutLang}`;

    console.log(`CORRECTION MAJEURE - Language switch: URL lang=${currentLang} -> ${newLocale}, Path: ${pathname} -> ${newPath}`);
    
    // CORRECTION CRITIQUE: Au lieu d'utiliser router.push qui fait une navigation côté client
    // et ne recharge pas complètement le contexte i18n, on utilise window.location.href
    // pour forcer un rechargement complet de la page et réinitialiser le contexte i18n
    window.location.href = newPath;
  };

  return (
    <header className="bg-[#800020] text-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo et nom */}
          <div className="flex items-center">
            <Link href={currentLanguagePath} className="flex items-center">
              <div className="bg-white p-1.5 rounded-md mr-2">
                <span className="text-[#800020] font-bold text-lg">L</span>
              </div>
              <h1 className="text-xl font-bold hidden sm:block">
                {t('laboName')}
              </h1>
            </Link>
          </div>

          {/* Navigation desktop */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href={`${currentLanguagePath}/`} className="hover:text-rose-200 transition-colors">
              {t('home')}
            </Link>

            <Link href={`${currentLanguagePath}/rendez-vous`} className="hover:text-rose-200 transition-colors font-semibold">
              {t('appointment')}
            </Link>
            
            <Link href={`${currentLanguagePath}/glabo`} className="hover:text-rose-200 transition-colors font-semibold">
              {t('glabo')}
            </Link>

            <Link href={`${currentLanguagePath}/analyses`} className="hover:text-rose-200 transition-colors font-semibold">
              {t('navigation.analyses_catalog', { ns: 'common', defaultValue: "Catalogue Analyses" })}
            </Link>

            <Link href={`${currentLanguagePath}/contact`} className="hover:text-rose-200 transition-colors">
              {t('contact')}
            </Link>
          </nav>

          {/* Boutons d'action */}
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleLanguageChange} 
              className="flex items-center text-sm px-3 py-2 min-h-[44px] rounded hover:bg-[#600018] transition-colors"
              aria-label={t('changeLanguage')}
            >
              <Globe size={18} className="mr-1.5" />
              {t('currentLanguage')}
            </button>
            <button className="p-3 rounded-full min-h-[44px] min-w-[44px] hover:bg-[#600018] flex items-center justify-center">
              <Search size={20} />
            </button>
            <button className="p-3 rounded-full min-h-[44px] min-w-[44px] hover:bg-[#600018] flex items-center justify-center">
              <User size={20} />
            </button>
            <button 
              className="md:hidden p-3 rounded-full min-h-[44px] min-w-[44px] hover:bg-[#600018] flex items-center justify-center"
              onClick={toggleMenu}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay and Container */}
      <div 
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
          isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          transition: isMenuOpen ? 'opacity 0.3s ease-in-out' : 'opacity 0.3s ease-in-out 0.1s'
        }}
        id="mobile-menu-container"
      >
        {console.log('[DEBUG] Rendering mobile menu container, isMenuOpen:', isMenuOpen)}
        {/* Backdrop with blur effect */}
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          style={{
            opacity: isMenuOpen ? 1 : 0,
            pointerEvents: isMenuOpen ? 'auto' : 'none',
            transition: 'opacity 0.3s ease-in-out',
            transitionDelay: isMenuOpen ? '0s' : '0.1s'
          }}
          onClick={toggleMenu}
        />
        
        {/* Menu Panel */}
        <div 
          className="fixed top-0 right-0 h-full w-72 bg-white shadow-lg z-50 flex flex-col"
          style={{
            transform: isMenuOpen ? 'translateX(0)' : 'translateX(100%)',
            opacity: isMenuOpen ? 1 : 0.7,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-in-out',
            transitionDelay: isMenuOpen ? '0s' : '0s',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Menu Header Section - Matches main header height */}
          <div className="bg-[#800020] text-white h-16 flex items-center justify-between px-4">
            <div className="flex items-center">
              <Link href={currentLanguagePath} className="flex items-center" onClick={toggleMenu}>
                <span className="bg-white text-[var(--primary-bordeaux)] p-1.5 rounded-md text-lg font-bold mr-3">L</span>
                <span className="font-semibold text-lg">{t('laboName')}</span>
              </Link>
            </div>
            <button 
              onClick={toggleMenu}
              className="p-2 rounded-full hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label={t('close_menu')}
            >
              <X size={24} className="text-white" />
            </button>
          </div>
            
          <nav className="flex flex-col flex-grow p-4 space-y-2 overflow-y-auto bg-white text-black">
            {console.log('[DEBUG] Rendering mobile menu nav content')}
            

            <Link 
              href={`${currentLanguagePath}/`} 
              className="flex items-center py-2.5 px-3 rounded-md transition-colors font-medium group text-black hover:bg-[var(--fuchsia-pale)] hover:text-[var(--accent-fuchsia)] focus:bg-[var(--fuchsia-pale)] focus:text-[var(--accent-fuchsia)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-fuchsia)]"
              onClick={toggleMenu}
            >
              <Home size={20} className="mr-3 text-gray-700 group-hover:text-[var(--accent-fuchsia)] transition-colors" />
              {t('home')}
            </Link>

            <Link 
              href={`${currentLanguagePath}/rendez-vous`} 
              className="flex items-center py-2.5 px-3 rounded-md transition-colors font-medium group text-black hover:bg-[var(--fuchsia-pale)] hover:text-[var(--accent-fuchsia)] focus:bg-[var(--fuchsia-pale)] focus:text-[var(--accent-fuchsia)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-fuchsia)]"
              onClick={toggleMenu}
            >
              <CalendarDays size={20} className="mr-3 text-gray-700 group-hover:text-[var(--accent-fuchsia)] transition-colors" />
              {t('appointment')}
            </Link>
            
            <Link 
              href={`${currentLanguagePath}/glabo`} 
              className="flex items-center py-2.5 px-3 rounded-md transition-colors font-medium group text-black hover:bg-[var(--fuchsia-pale)] hover:text-[var(--accent-fuchsia)] focus:bg-[var(--fuchsia-pale)] focus:text-[var(--accent-fuchsia)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-fuchsia)]"
              onClick={toggleMenu}
            >
              <Truck size={20} className="mr-3 text-gray-700 group-hover:text-[var(--accent-fuchsia)] transition-colors" />
              {t('glabo')}
            </Link>

            <Link 
              href={`${currentLanguagePath}/analyses`} 
              className="flex items-center py-2.5 px-3 rounded-md transition-colors font-medium group text-black hover:bg-[var(--fuchsia-pale)] hover:text-[var(--accent-fuchsia)] focus:bg-[var(--fuchsia-pale)] focus:text-[var(--accent-fuchsia)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-fuchsia)]"
              onClick={toggleMenu}
            >
              <FlaskConical size={20} className="mr-3 text-gray-700 group-hover:text-[var(--accent-fuchsia)] transition-colors" />
              {t('navigation.analyses_catalog', { ns: 'common', defaultValue: "Catalogue Analyses" })}
            </Link>

            <Link 
              href={`${currentLanguagePath}/contact`} 
              className="flex items-center py-2.5 px-3 rounded-md transition-colors font-medium group text-black hover:bg-[var(--fuchsia-pale)] hover:text-[var(--accent-fuchsia)] focus:bg-[var(--fuchsia-pale)] focus:text-[var(--accent-fuchsia)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-fuchsia)]"
              onClick={toggleMenu}
            >
              <Phone size={20} className="mr-3 text-gray-700 group-hover:text-[var(--accent-fuchsia)] transition-colors" />
              {t('contact')}
            </Link>
          </nav>
            
          {/* Navigation Footer - Branded Buttons Layout */}
          <div className="mt-auto p-4 border-t border-gray-200 bg-white">
            <div className="space-y-4">
              {/* WhatsApp Contact Button - Professional Green Style */}
              <a 
                href={`https://wa.me/${LAB_WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={toggleMenu}
                className="block w-full text-center py-3.5 px-5 rounded-lg bg-gradient-to-br from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-all duration-200 font-medium shadow-sm"
                aria-label="Contact via WhatsApp"
              >
                <span className="flex items-center justify-center">
                  <MessageCircle size={20} className="mr-2.5" />
                  {t('contact')} WhatsApp
                </span>
              </a>
            
              {/* PWA Install Button - Maximum Compatibility */}
              <a 
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  console.log(`[DEBUG] Simple PWA Install button clicked`);
                  if (typeof window !== 'undefined' && window.deferredPrompt) {
                    console.log(`[DEBUG] deferredPrompt available, showing prompt`);
                    window.deferredPrompt.prompt();
                  } else {
                    console.log(`[DEBUG] deferredPrompt NOT available, showing alert`);
                    alert(t('pwa.install_hint') || 'Cette fonctionnalité est disponible uniquement sur les appareils compatibles.');
                  }
                  toggleMenu();
                }}
                className="block w-full text-center py-3 px-4 rounded-md bg-[#800020] text-white font-medium"
                id="pwa-install-button-mobile"
              >
                <span className="flex items-center justify-center">
                  <Download size={20} className="mr-2" />
                  {t('pwa.install_app_button') || 'Installer l\'application'}
                </span>
              </a>

              {/* Language button - Elegant Style */}
              <button
                onClick={handleLanguageChange}
                className="block w-full text-center py-3 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                aria-label={t('changeLanguage')}
              >
                <span className="flex items-center justify-center">
                  <Globe size={18} className="mr-2 text-gray-500" />
                  {t('currentLanguage')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;