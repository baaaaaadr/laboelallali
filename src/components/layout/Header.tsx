"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, Search, User, Globe, Home, CalendarDays, Truck, FlaskConical, Phone, MessageCircle, ChevronDown, Check, Download, Stethoscope } from 'lucide-react';
import { LAB_WHATSAPP_NUMBER } from '@/constants/contact';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';
import { supportedLngs } from '../../../i18n';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';
import dynamic from 'next/dynamic';

// Debug version - update this to verify deployment
const HEADER_VERSION = 'v2.0.1-fix-menu-colors-2024-12-27';

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

// Inline styles for mobile menu - ensures visibility regardless of CSS
const menuStyles = {
  navLink: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    color: '#1f2937',
    textDecoration: 'none',
    fontWeight: 500,
    borderRadius: '8px',
    transition: 'all 0.2s ease',
    width: '100%',
    backgroundColor: 'transparent',
  } as React.CSSProperties,
  navLinkDark: {
    color: '#e5e5e5',
  } as React.CSSProperties,
  navIcon: {
    color: '#800020',
    flexShrink: 0,
    width: '24px',
    marginRight: '12px',
  } as React.CSSProperties,
  navIconDark: {
    color: '#ff80ab',
  } as React.CSSProperties,
  navText: {
    color: '#1f2937',
    fontSize: '15px',
    fontWeight: 500,
  } as React.CSSProperties,
  navTextDark: {
    color: '#e5e5e5',
  } as React.CSSProperties,
};

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
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

  // Dark mode detection and debug logging
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    // Debug logging
    console.log('🔧 Header Debug:', {
      version: HEADER_VERSION,
      timestamp: new Date().toISOString(),
      isDarkMode: document.documentElement.classList.contains('dark'),
    });

    checkDarkMode();

    // Watch for dark mode changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const currentLanguagePath = `/${urlLang}`;

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside both dropdown refs
      const isOutsideDesktop = !desktopLangDropdownRef.current || !desktopLangDropdownRef.current.contains(event.target as Node);
      const isOutsideMobile = !mobileLangDropdownRef.current || !mobileLangDropdownRef.current.contains(event.target as Node);
      
      if (isOutsideDesktop && isOutsideMobile) {
        console.log('🌍 [Click Outside] Closing dropdown', {
          targetElement: (event.target as HTMLElement)?.tagName,
          targetClass: (event.target as HTMLElement)?.className,
          timestamp: new Date().toISOString()
        });
        setIsLangDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLanguageChange = (newLocale: string) => {
    console.log('🌍 [Language Change] Handler called', {
      requestedLocale: newLocale,
      currentUrlLang: urlLang,
      currentPathname: pathname,
      timestamp: new Date().toISOString()
    });

    // Only change if it's different from current language
    if (newLocale !== urlLang) {
      console.log('🌍 [Language Change] Guard passed - different locale', {
        newLocale,
        urlLang,
        willNavigate: true
      });
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

      console.log('🌍 [Language Change] Navigating', {
        oldPath: pathname,
        newPath: newPath,
        method: 'window.location.href'
      });

      // Force a full page reload to reset i18n context
      window.location.href = newPath;
    } else {
      console.log('🌍 [Language Change] Guard blocked - same locale', {
        newLocale,
        urlLang,
        skipped: true
      });
    }

    // Close the dropdown
    setIsLangDropdownOpen(false);
  };

  const toggleLangDropdown = () => {
    console.log('🌍 [Language Dropdown] Toggle clicked', {
      currentState: isLangDropdownOpen,
      willBecome: !isLangDropdownOpen,
      timestamp: new Date().toISOString()
    });
    setIsLangDropdownOpen(!isLangDropdownOpen);
  };

  return (
    <header className="header-main shadow-md transition-colors duration-300 relative z-50 w-full overflow-hidden">
      <div className="w-full mx-auto px-2 sm:px-4 lg:px-6 lg:max-w-7xl relative">
        <div className="flex items-center justify-between py-2 sm:py-4 transition-all duration-200 text-white dark:text-[var(--text-primary)] min-h-[56px] sm:min-h-[64px]">
          {/* Logo and name */}
          <div className="flex items-center">
            <Link href={currentLanguagePath} className="flex items-center">
              <div className="header-logo">
                <span className="font-bold text-lg">L</span>
              </div>
              <h1 className="text-xl font-bold hidden sm:block dark:text-[var(--text-primary)]">
                {t('laboName')}
              </h1>
            </Link>
          </div>

          {/* Desktop Navigation - Only visible at lg (1024px) and above */}
          <nav className="desktop-nav hidden lg:flex items-center space-x-4 xl:space-x-6">
            <Link href={`${currentLanguagePath}/`} className="nav-link text-white dark:text-[var(--text-primary)] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded transition-colors duration-200 text-sm lg:text-base">
              {t('home')}
            </Link>
            <Link href={`${currentLanguagePath}/rendez-vous`} className="nav-link text-white dark:text-[var(--text-primary)] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded transition-colors duration-200 font-semibold text-sm lg:text-base">
              {t('appointment')}
            </Link>
            <Link href={`${currentLanguagePath}/glabo`} className="nav-link text-white dark:text-[var(--text-primary)] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded transition-colors duration-200 font-semibold text-sm lg:text-base">
              {t('glabo')}
            </Link>
            <Link href={`${currentLanguagePath}/analyses`} className="nav-link text-white dark:text-[var(--text-primary)] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded transition-colors duration-200 font-semibold text-sm lg:text-base">
              {t('navigation.analyses_catalog', { ns: 'common', defaultValue: "Catalogue Analyses" })}
            </Link>
            <Link href={`${currentLanguagePath}/medecins`} className="nav-link text-white dark:text-[var(--text-primary)] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded transition-colors duration-200 font-semibold text-sm lg:text-base">
              {t('navigation.medecins', { ns: 'common', defaultValue: "Médecins" })}
            </Link>
            <Link href={`${currentLanguagePath}/contact`} className="nav-link text-white dark:text-[var(--text-primary)] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded transition-colors duration-200 text-sm lg:text-base">
              {t('contact')}
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {/* Language Selector - Hidden on mobile, shown on tablet+ */}
            <div className="relative hidden sm:block" ref={desktopLangDropdownRef}>
              <button
                onClick={toggleLangDropdown}
                className="flex items-center text-sm px-2 lg:px-3 py-2 min-h-[44px] rounded hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] transition-colors text-[rgba(255,255,255,0.85)] hover:text-white hover:shadow-[0_0_8px_var(--color-fuchsia-light)]"
                aria-label={t('changeLanguage')}
                aria-haspopup="true"
                aria-expanded={isLangDropdownOpen}
              >
                <Globe size={18} className="mr-1 lg:mr-1.5 text-white dark:text-[var(--text-primary)]" />
                <span className="text-white dark:text-[var(--text-primary)]">{urlLang.toUpperCase()}</span>
                <ChevronDown size={16} className="ml-0.5 lg:ml-1 text-white dark:text-[var(--text-primary)]" />
              </button>
              
              {/* Language Dropdown Menu */}
              {isLangDropdownOpen && (
                <div className="dropdown-menu absolute right-0 top-full mt-2 w-36 bg-white dark:bg-[var(--background-secondary)] rounded-md shadow-lg border border-gray-200 dark:border-[var(--border-default)] overflow-hidden z-[9999] pointer-events-auto" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                  <button
                    onClick={(e) => {
                      console.log('🌍 [Desktop Button] FR clicked', { urlLang, timestamp: new Date().toISOString() });
                      handleLanguageChange('fr');
                      return;
                    }}
                    className="flex items-center justify-between w-full px-4 py-3 text-gray-800 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-[var(--background-tertiary)] hover:text-[var(--color-bordeaux-primary)] dark:hover:text-[var(--color-fuchsia-accent)] transition-colors text-left"
                  >
                    <span className={`${urlLang === 'fr' ? 'font-bold text-[var(--color-bordeaux-primary)] dark:text-[var(--color-fuchsia-accent)]' : 'text-gray-800 dark:text-[var(--text-primary)]'}`}>Français</span>
                    {urlLang === 'fr' && <Check size={16} className="text-[var(--color-bordeaux-primary)] dark:text-[var(--color-fuchsia-accent)]" />}
                  </button>
                  <div className="border-t border-gray-100 dark:border-[var(--border-default)]"></div>
                  <button
                    onClick={(e) => {
                      console.log('🌍 [Desktop Button] AR clicked', { urlLang, timestamp: new Date().toISOString() });
                      handleLanguageChange('ar');
                      return;
                    }}
                    className="flex items-center justify-between w-full px-4 py-3 text-gray-800 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-[var(--background-tertiary)] hover:text-[var(--color-bordeaux-primary)] dark:hover:text-[var(--color-fuchsia-accent)] transition-colors text-left"
                  >
                    <span className={`${urlLang === 'ar' ? 'font-bold text-[var(--color-bordeaux-primary)] dark:text-[var(--color-fuchsia-accent)]' : 'text-gray-800 dark:text-[var(--text-primary)]'}`}>العربية</span>
                    {urlLang === 'ar' && <Check size={16} className="text-[var(--color-bordeaux-primary)] dark:text-[var(--color-fuchsia-accent)]" />}
                  </button>
                </div>
              )}
            </div>
            {/* Theme Switcher - Always visible but minimal */}
            <ThemeSwitcher />
            {/* Mobile Language Toggle - Visible only on mobile */}
            <button
              onClick={() => {
                const newLang = urlLang === 'fr' ? 'ar' : 'fr';
                console.log('🌍 [Mobile Toggle] Switching language', {
                  from: urlLang,
                  to: newLang,
                  timestamp: new Date().toISOString()
                });
                handleLanguageChange(newLang);
              }}
              className="sm:hidden p-1.5 sm:p-2 rounded-full min-h-[40px] min-w-[40px] hover:bg-[#600018] dark:hover:bg-[var(--background-tertiary)] flex items-center justify-center transition-colors"
              aria-label={t('changeLanguage')}
            >
              <Globe size={18} className="text-white dark:text-[var(--text-primary)]" />
              <span className="text-xs ml-0.5 text-white dark:text-[var(--text-primary)] font-medium">
                {urlLang.toUpperCase()}
              </span>
            </button>
            {/* Search - Hidden on mobile */}
            <button className="hidden sm:flex p-2 lg:p-3 rounded-full min-h-[44px] min-w-[44px] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] items-center justify-center transition-colors">
              <Search size={20} className="text-white dark:text-[var(--text-primary)]" />
            </button>
            {/* User Icon - Desktop only */}
            <button className="hidden lg:flex p-2 lg:p-3 rounded-full min-h-[44px] min-w-[44px] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] items-center justify-center transition-colors">
              <User size={20} className="text-white dark:text-[var(--text-primary)]" />
            </button>
            {/* Hamburger Menu - Mobile/Tablet only */}
            <button
              className="mobile-menu-toggle lg:hidden p-1.5 sm:p-2 lg:p-3 rounded-full min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] flex items-center justify-center transition-colors"
              onClick={toggleMenu}
              aria-label={t('menu')}
            >
              <Menu size={22} className="text-white dark:text-[var(--text-primary)]" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay and Container */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
          isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          transition: isMenuOpen ? 'opacity 0.3s ease-in-out' : 'opacity 0.3s ease-in-out 0.1s'
        }}
        id="mobile-menu-container"
      >
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
          className="fixed top-0 right-0 h-full w-72 bg-white dark:bg-[var(--background-default)] shadow-lg z-50 flex flex-col"
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
          <div className="mobile-menu-header h-16 flex items-center justify-between px-4">
            <div className="flex items-center">
              <Link href={currentLanguagePath} className="flex items-center" onClick={toggleMenu}>
                <span className="header-logo text-lg font-bold mr-3">L</span>
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
            
          {/* Navigation Links Section */}
          <nav
            className="flex flex-col flex-grow p-4 space-y-1 overflow-y-auto"
            style={{ backgroundColor: isDarkMode ? '#1a1a2e' : '#ffffff' }}
          >
            {/* Navigation Links with inline styles for guaranteed visibility */}
            <Link
              href={`${currentLanguagePath}/`}
              style={{
                ...menuStyles.navLink,
                ...(isDarkMode ? menuStyles.navLinkDark : {}),
              }}
              onClick={toggleMenu}
            >
              <Home size={20} style={{ ...menuStyles.navIcon, ...(isDarkMode ? menuStyles.navIconDark : {}) }} />
              <span style={{ ...menuStyles.navText, ...(isDarkMode ? menuStyles.navTextDark : {}) }}>
                {t('home')}
              </span>
            </Link>

            <Link
              href={`${currentLanguagePath}/rendez-vous`}
              style={{
                ...menuStyles.navLink,
                ...(isDarkMode ? menuStyles.navLinkDark : {}),
              }}
              onClick={toggleMenu}
            >
              <CalendarDays size={20} style={{ ...menuStyles.navIcon, ...(isDarkMode ? menuStyles.navIconDark : {}) }} />
              <span style={{ ...menuStyles.navText, ...(isDarkMode ? menuStyles.navTextDark : {}) }}>
                {t('appointment')}
              </span>
            </Link>

            <Link
              href={`${currentLanguagePath}/glabo`}
              style={{
                ...menuStyles.navLink,
                ...(isDarkMode ? menuStyles.navLinkDark : {}),
              }}
              onClick={toggleMenu}
            >
              <Truck size={20} style={{ ...menuStyles.navIcon, ...(isDarkMode ? menuStyles.navIconDark : {}) }} />
              <span style={{ ...menuStyles.navText, ...(isDarkMode ? menuStyles.navTextDark : {}) }}>
                {t('glabo')}
              </span>
            </Link>

            <Link
              href={`${currentLanguagePath}/analyses`}
              style={{
                ...menuStyles.navLink,
                ...(isDarkMode ? menuStyles.navLinkDark : {}),
              }}
              onClick={toggleMenu}
            >
              <FlaskConical size={20} style={{ ...menuStyles.navIcon, ...(isDarkMode ? menuStyles.navIconDark : {}) }} />
              <span style={{ ...menuStyles.navText, ...(isDarkMode ? menuStyles.navTextDark : {}) }}>
                {t('navigation.analyses_catalog', { ns: 'common', defaultValue: 'Analyses' })}
              </span>
            </Link>

            <Link
              href={`${currentLanguagePath}/medecins`}
              style={{
                ...menuStyles.navLink,
                ...(isDarkMode ? menuStyles.navLinkDark : {}),
              }}
              onClick={toggleMenu}
            >
              <Stethoscope size={20} style={{ ...menuStyles.navIcon, ...(isDarkMode ? menuStyles.navIconDark : {}) }} />
              <span style={{ ...menuStyles.navText, ...(isDarkMode ? menuStyles.navTextDark : {}) }}>
                {t('navigation.medecins', { ns: 'common', defaultValue: 'Médecins' })}
              </span>
            </Link>

            <Link
              href={`${currentLanguagePath}/contact`}
              style={{
                ...menuStyles.navLink,
                ...(isDarkMode ? menuStyles.navLinkDark : {}),
              }}
              onClick={toggleMenu}
            >
              <Phone size={20} style={{ ...menuStyles.navIcon, ...(isDarkMode ? menuStyles.navIconDark : {}) }} />
              <span style={{ ...menuStyles.navText, ...(isDarkMode ? menuStyles.navTextDark : {}) }}>
                {t('contact')}
              </span>
            </Link>

            {/* Profile Link - Mobile Only */}
            <Link
              href={`${currentLanguagePath}/profile`}
              style={{
                ...menuStyles.navLink,
                ...(isDarkMode ? menuStyles.navLinkDark : {}),
              }}
              onClick={toggleMenu}
            >
              <User size={20} style={{ ...menuStyles.navIcon, ...(isDarkMode ? menuStyles.navIconDark : {}) }} />
              <span style={{ ...menuStyles.navText, ...(isDarkMode ? menuStyles.navTextDark : {}) }}>
                Profil
              </span>
            </Link>
          </nav>
          
          {/* Action Buttons Section - Stuck to Bottom */}
          <div
            className="p-6 space-y-4"
            style={{
              backgroundColor: isDarkMode ? '#1a1a2e' : '#ffffff',
              borderTop: `1px solid ${isDarkMode ? '#3d3d5c' : '#e5e7eb'}`,
            }}
          >
            {/* WhatsApp Contact Button */}
            <a
              href={`https://wa.me/${LAB_WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={toggleMenu}
              aria-label="Contact via WhatsApp"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 16px',
                borderRadius: '8px',
                fontWeight: 500,
                minHeight: '48px',
                border: `2px solid ${isDarkMode ? '#ff80ab' : '#800020'}`,
                backgroundColor: 'transparent',
                color: isDarkMode ? '#ff80ab' : '#800020',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <MessageCircle size={20} style={{ marginRight: '8px' }} />
              {t('contact')} WhatsApp
            </a>

            {/* PWA Install Button */}
            <button
              onClick={() => {
                const pwaButton = document.querySelector('[aria-label*="Install"]') as HTMLButtonElement;
                if (pwaButton && pwaButton !== event?.currentTarget) {
                  pwaButton.click();
                }
                toggleMenu();
              }}
              aria-label="Install App"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                fontWeight: 500,
                minHeight: '48px',
                border: '2px solid #c2185b',
                backgroundColor: '#c2185b',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Download size={20} style={{ marginRight: '8px' }} />
              {t('pwa.install_app_button', "Installer l'App")}
            </button>

            {/* Language Dropdown Button */}
            <div className="relative" ref={mobileLangDropdownRef}>
              <button
                onClick={toggleLangDropdown}
                aria-label={t('changeLanguage')}
                aria-haspopup="true"
                aria-expanded={isLangDropdownOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontWeight: 500,
                  minHeight: '48px',
                  border: `2px solid ${isDarkMode ? '#ff80ab' : '#800020'}`,
                  backgroundColor: isDarkMode ? '#ff80ab' : '#800020',
                  color: isDarkMode ? '#1a1a2e' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Globe size={20} style={{ marginRight: '8px' }} />
                <span>{urlLang.toUpperCase()}</span>
                <ChevronDown size={16} style={{ marginLeft: '4px' }} />
              </button>

              {isLangDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    right: 0,
                    marginBottom: '8px',
                    backgroundColor: isDarkMode ? '#2d2d44' : '#ffffff',
                    borderRadius: '8px',
                    boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.15)',
                    border: `1px solid ${isDarkMode ? '#3d3d5c' : '#e5e7eb'}`,
                    overflow: 'hidden',
                    zIndex: 100,
                  }}
                >
                  <button
                    onClick={() => {
                      console.log('🌍 [Mobile Menu Button] FR clicked', { urlLang, timestamp: new Date().toISOString() });
                      handleLanguageChange('fr');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: urlLang === 'fr' ? (isDarkMode ? '#ff80ab' : '#800020') : (isDarkMode ? '#e5e5e5' : '#1f2937'),
                      fontWeight: urlLang === 'fr' ? 600 : 400,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    <span>Français</span>
                    {urlLang === 'fr' && <Check size={16} />}
                  </button>
                  <div style={{ height: '1px', backgroundColor: isDarkMode ? '#3d3d5c' : '#e5e7eb' }} />
                  <button
                    onClick={() => {
                      console.log('🌍 [Mobile Menu Button] AR clicked', { urlLang, timestamp: new Date().toISOString() });
                      handleLanguageChange('ar');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: urlLang === 'ar' ? (isDarkMode ? '#ff80ab' : '#800020') : (isDarkMode ? '#e5e5e5' : '#1f2937'),
                      fontWeight: urlLang === 'ar' ? 600 : 400,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    <span>العربية</span>
                    {urlLang === 'ar' && <Check size={16} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;