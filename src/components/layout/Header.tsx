"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, Search, User, Globe, Home, CalendarDays, Truck, FlaskConical, Phone, MessageCircle, ChevronDown, Check } from 'lucide-react';  
import { LAB_WHATSAPP_NUMBER } from '@/constants/contact';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';
import { supportedLngs } from '../../../i18n';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';
import dynamic from 'next/dynamic';

// Import the PWA install button component with SSR disabled
const PWAInstallButton = dynamic(
  () => import('@/components/features/pwa/PWAInstallButton').then(mod => mod.default),
  { 
    ssr: false,
    loading: () => <div className="w-full h-3"></div> // Minimal loading placeholder
  }
);

function getLangFromPath(path: string) {
  const match = path.match(/^\/([a-zA-Z-]+)/);
  return match ? match[1] : 'fr'; // fallback on 'fr'
}

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const pathname = usePathname();
  // Create separate refs for desktop and mobile dropdowns
  const desktopLangDropdownRef = useRef<HTMLDivElement>(null);
  const mobileLangDropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside both dropdown refs
      const isOutsideDesktop = !desktopLangDropdownRef.current || !desktopLangDropdownRef.current.contains(event.target as Node);
      const isOutsideMobile = !mobileLangDropdownRef.current || !mobileLangDropdownRef.current.contains(event.target as Node);
      
      if (isOutsideDesktop && isOutsideMobile) {
        setIsLangDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLanguageChange = (newLocale: string) => {
    // Only change if it's different from current language
    if (newLocale !== urlLang) {
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

      console.log(`Language switch: URL lang=${urlLang} -> ${newLocale}, Path: ${pathname} -> ${newPath}`);
      
      // Force a full page reload to reset i18n context
      window.location.href = newPath;
    }
    
    // Close the dropdown
    setIsLangDropdownOpen(false);
  };

  const toggleLangDropdown = () => {
    setIsLangDropdownOpen(!isLangDropdownOpen);
  };

  return (
    <header className="bg-[#800020] dark:bg-[var(--color-bordeaux-primary)] text-white shadow-md transition-colors duration-300">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto transition-all duration-200">
          {/* Logo and name */}
          <div className="flex items-center">
            <Link href={currentLanguagePath} className="flex items-center">
              <div className="bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)] p-1.5 rounded-md mr-2 transition-colors duration-200">
                <span className="text-[var(--color-bordeaux-primary)] dark:text-[var(--color-bordeaux-primary)] font-bold text-lg">L</span>
              </div>
              <h1 className="text-xl font-bold hidden sm:block">
                {t('laboName')}
              </h1>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href={`${currentLanguagePath}/`} className="hover:text-rose-200 transition-colors duration-200">
              {t('home')}
            </Link>
            <Link href={`${currentLanguagePath}/rendez-vous`} className="hover:text-rose-200 transition-colors duration-200 font-semibold">
              {t('appointment')}
            </Link>
            <Link href={`${currentLanguagePath}/glabo`} className="hover:text-rose-200 transition-colors duration-200 font-semibold">
              {t('glabo')}
            </Link>
            <Link href={`${currentLanguagePath}/analyses`} className="hover:text-rose-200 transition-colors duration-200 font-semibold">
              {t('navigation.analyses_catalog', { ns: 'common', defaultValue: "Catalogue Analyses" })}
            </Link>
            <Link href={`${currentLanguagePath}/contact`} className="hover:text-rose-200 transition-colors duration-200">
              {t('contact')}
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <div className="relative" ref={desktopLangDropdownRef}>
              <button 
                onClick={toggleLangDropdown} 
                className="flex items-center text-sm px-3 py-2 min-h-[44px] rounded hover:bg-[#600018] transition-colors text-[rgba(255,255,255,0.85)] hover:text-white hover:shadow-[0_0_8px_var(--color-fuchsia-light)]"
                aria-label={t('changeLanguage')}
                aria-haspopup="true"
                aria-expanded={isLangDropdownOpen}
              >
                <Globe size={18} className="mr-1.5" />
                <span>{urlLang.toUpperCase()}</span>
                <ChevronDown size={16} className="ml-1" />
              </button>
              
              {/* Language Dropdown Menu */}
              {isLangDropdownOpen && (
                <div className="absolute right-0 mt-1 w-36 bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)] rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.1)] z-50 border border-[var(--color-bordeaux-light)] overflow-hidden">
                  <button
                    onClick={() => { handleLanguageChange('fr'); return; }}
                    className="flex items-center justify-between w-full px-3 py-2 text-[#800020] hover:bg-[#FFF0F5] hover:text-[#FF4081] transition-colors rounded-t-md"
                  >
                    <span className={urlLang === 'fr' ? 'font-bold' : ''}>Français</span>
                    {urlLang === 'fr' && <Check size={16} />}
                  </button>
                  <button
                    onClick={() => { handleLanguageChange('ar'); return; }}
                    className="flex items-center justify-between w-full px-3 py-2 text-[#800020] hover:bg-[#FFF0F5] hover:text-[#FF4081] transition-colors rounded-b-md"
                  >
                    <span className={urlLang === 'ar' ? 'font-bold' : ''}>العربية</span>
                    {urlLang === 'ar' && <Check size={16} />}
                  </button>
                </div>
              )}
            </div>
            <ThemeSwitcher />
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
          className="fixed top-0 right-0 h-full w-72 bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)] shadow-lg z-50 flex flex-col"
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
                <span className="bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)] text-[var(--color-bordeaux-primary)] p-1.5 rounded-md text-lg font-bold mr-3">L</span>
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
            
          <nav className="flex flex-col flex-grow p-4 space-y-2 overflow-y-auto bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)] text-[var(--text-primary)]">
            {console.log('[DEBUG] Rendering mobile menu nav content')}
            

            <Link 
              href={`${currentLanguagePath}/`} 
              className="flex items-center py-2.5 px-3 rounded-md transition-colors font-medium group text-black hover:bg-[var(--fuchsia-pale)] hover:text-[var(--accent-fuchsia)] focus:bg-[var(--fuchsia-pale)] focus:text-[var(--accent-fuchsia)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-fuchsia)]"
              onClick={toggleMenu}
            >
              <Home size={20} className="mr-3 text-[var(--text-secondary)] group-hover:text-[var(--accent-fuchsia)] transition-colors" />
              {t('home')}
            </Link>

            <Link 
              href={`${currentLanguagePath}/rendez-vous`} 
              className="flex items-center py-2.5 px-3 rounded-md transition-colors font-medium group text-black hover:bg-[var(--fuchsia-pale)] hover:text-[var(--accent-fuchsia)] focus:bg-[var(--fuchsia-pale)] focus:text-[var(--accent-fuchsia)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-fuchsia)]"
              onClick={toggleMenu}
            >
              <CalendarDays size={20} className="mr-3 text-[var(--text-secondary)] group-hover:text-[var(--accent-fuchsia)] transition-colors" />
              {t('appointment')}
            </Link>
            
            <Link 
              href={`${currentLanguagePath}/glabo`} 
              className="flex items-center py-2.5 px-3 rounded-md transition-colors font-medium group text-black hover:bg-[var(--fuchsia-pale)] hover:text-[var(--accent-fuchsia)] focus:bg-[var(--fuchsia-pale)] focus:text-[var(--accent-fuchsia)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-fuchsia)]"
              onClick={toggleMenu}
            >
              <Truck size={20} className="mr-3 text-[var(--text-secondary)] group-hover:text-[var(--accent-fuchsia)] transition-colors" />
              {t('glabo')}
            </Link>

            <Link 
              href={`${currentLanguagePath}/analyses`} 
              className="flex items-center py-2.5 px-3 rounded-md transition-colors font-medium group text-black hover:bg-[var(--fuchsia-pale)] hover:text-[var(--accent-fuchsia)] focus:bg-[var(--fuchsia-pale)] focus:text-[var(--accent-fuchsia)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-fuchsia)]"
              onClick={toggleMenu}
            >
              <FlaskConical size={20} className="mr-3 text-[var(--text-secondary)] group-hover:text-[var(--accent-fuchsia)] transition-colors" />
              {t('navigation.analyses_catalog', { ns: 'common', defaultValue: "Catalogue Analyses" })}
            </Link>

            <Link 
              href={`${currentLanguagePath}/contact`} 
              className="flex items-center py-2.5 px-3 rounded-md transition-colors font-medium group text-black hover:bg-[var(--fuchsia-pale)] hover:text-[var(--accent-fuchsia)] focus:bg-[var(--fuchsia-pale)] focus:text-[var(--accent-fuchsia)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent-fuchsia)]"
              onClick={toggleMenu}
            >
              <Phone size={20} className="mr-3 text-[var(--text-secondary)] group-hover:text-[var(--accent-fuchsia)] transition-colors" />
              {t('contact')}
            </Link>
          </nav>
            
          {/* Navigation Footer - Branded Buttons Layout */}
          <div className="mt-auto p-4 border-t border-[var(--border-default)] bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)]">
            <div className="flex flex-col gap-3">
              {/* WhatsApp Contact Button - Using custom button class */}
              <a 
                href={`https://wa.me/${LAB_WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={toggleMenu}
                className="menu-action-button"
                aria-label="Contact via WhatsApp"
              >
                <MessageCircle size={20} className="mr-2.5" />
                {t('contact')} WhatsApp
              </a>
            
              {/* PWA Install Button - Using consolidated component */}
              <PWAInstallButton 
                variant="footer"
                className="w-full menu-action-button"
                style={{ margin: 0 }}
              />

              {/* Language button - Using custom button class */}
              <div className="relative" ref={mobileLangDropdownRef}>
                <button
                  onClick={toggleLangDropdown}
                  className="menu-action-button flex items-center"
                  aria-label={t('changeLanguage')}
                  aria-haspopup="true"
                  aria-expanded={isLangDropdownOpen}
                >
                  <Globe size={20} className="mr-2.5" />
                  <span>{urlLang.toUpperCase()}</span>
                  <ChevronDown size={16} className="ml-1" />
                </button>
                
                {/* Mobile Language Dropdown Menu */}
                {isLangDropdownOpen && (
                  <div className="absolute right-0 bottom-full mb-1 w-36 bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)] rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.1)] z-50 border border-[var(--color-bordeaux-light)] overflow-hidden">
                    <button
                      onClick={() => { handleLanguageChange('fr'); return; }}
                      className="flex items-center justify-between w-full px-3 py-2 text-[#800020] hover:bg-[#FFF0F5] hover:text-[#FF4081] transition-colors rounded-t-md"
                    >
                      <span className={urlLang === 'fr' ? 'font-bold' : ''}>Français</span>
                      {urlLang === 'fr' && <Check size={16} />}
                    </button>
                    <button
                      onClick={() => { handleLanguageChange('ar'); return; }}
                      className="flex items-center justify-between w-full px-3 py-2 text-[#800020] hover:bg-[#FFF0F5] hover:text-[#FF4081] transition-colors rounded-b-md"
                    >
                      <span className={urlLang === 'ar' ? 'font-bold' : ''}>العربية</span>
                      {urlLang === 'ar' && <Check size={16} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;