"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, Search, User, Globe, Home, CalendarDays, Truck, FlaskConical, Phone, MessageCircle, Check, Download, Stethoscope } from 'lucide-react';
import { LAB_WHATSAPP_NUMBER } from '@/constants/contact';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';
import { supportedLngs } from '../../../i18n';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';

// Debug version - update this to verify deployment
const HEADER_VERSION = 'v2.0.2-hydration-fix-2026-05-02';

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
     justifyContent: 'flex-start',
     padding: '12px 16px',
     color: 'var(--text-primary)',
     textDecoration: 'none',
     fontWeight: 500,
     borderRadius: '8px',
     transition: 'all 0.2s ease',
     width: '100%',
     backgroundColor: 'transparent',
     textAlign: 'start',
  } as React.CSSProperties,
  navLinkDark: {
     color: 'var(--text-primary)',
  } as React.CSSProperties,
  navIcon: {
     color: 'var(--color-bordeaux-primary)',
     flexShrink: 0,
     width: '24px',
     marginInlineEnd: '12px',
  } as React.CSSProperties,
  navIconDark: {
     color: 'var(--color-fuchsia-light)',
  } as React.CSSProperties,
  navText: {
     color: 'var(--text-primary)',
     fontSize: '15px',
     fontWeight: 500,
  } as React.CSSProperties,
  navTextDark: {
     color: 'var(--text-primary)',
  } as React.CSSProperties,
};

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const pathname = usePathname();
  const mobileLangDropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // Close mobile menu dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isOutsideMobile = !mobileLangDropdownRef.current || !mobileLangDropdownRef.current.contains(event.target as Node);

      if (isOutsideMobile) {
        setIsLangDropdownOpen(false);
      }
    };

    if (isLangDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isLangDropdownOpen]);

  const handleLanguageChange = (newLocale: string) => {
    if (newLocale === urlLang) return;

    let pathWithoutLang = pathname;
    const langPattern = new RegExp(`^/(${supportedLngs.join('|')})`);
    if (langPattern.test(pathname)) {
      pathWithoutLang = pathname.replace(langPattern, '');
      if (pathWithoutLang === '') pathWithoutLang = '/';
    }

    const newPath = pathWithoutLang === '/'
      ? `/${newLocale}`
      : `/${newLocale}${pathWithoutLang}`;

    router.push(newPath);
    setIsLangDropdownOpen(false);
  };

  const toggleLangDropdown = () => {
    setIsLangDropdownOpen(!isLangDropdownOpen);
  };

  return (
    <header className="header-main shadow-md sticky top-0 z-50 w-full overflow-hidden">
      <div className="w-full mx-auto px-2 sm:px-4 lg:px-6 lg:max-w-7xl relative">
        <div className="flex items-center justify-between transition-all text-white h-[64px]">
          {/* Logo and name */}
          <Link href={currentLanguagePath} className="flex items-center h-full">
            <img
              src="/images/icons/logo-footer.png"
              alt="Labo El Allali"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg"
            />
          </Link>

          {/* Desktop Navigation - Only visible at lg (1024px) and above */}
          <nav className="desktop-nav hidden lg:flex items-center space-x-4 xl:space-x-6">
            <Link href={`${currentLanguagePath}/`} className="nav-link text-white hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded text-sm lg:text-base">
              {t('home')}
            </Link>
            <Link href={`${currentLanguagePath}/rendez-vous`} className="nav-link text-white hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded font-semibold text-sm lg:text-base">
              {t('appointment')}
            </Link>
            <Link href={`${currentLanguagePath}/glabo`} className="nav-link text-white hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded font-semibold text-sm lg:text-base">
              {t('glabo')}
            </Link>
            <Link href={`${currentLanguagePath}/analyses`} className="nav-link text-white hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded font-semibold text-sm lg:text-base">
              {t('navigation.analyses_catalog', { ns: 'common', defaultValue: "Catalogue Analyses" })}
            </Link>
            <Link href={`${currentLanguagePath}/medecins`} className="nav-link text-white hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded font-semibold text-sm lg:text-base">
              {t('navigation.medecins', { ns: 'common', defaultValue: "Médecins" })}
            </Link>
            <Link href={`${currentLanguagePath}/contact`} className="nav-link text-white hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] px-2 lg:px-3 py-2 rounded text-sm lg:text-base">
              {t('contact')}
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {/* Language Switch Button - Simple toggle for both mobile and desktop */}
            <button
              onClick={() => {
                const newLang = urlLang === 'fr' ? 'ar' : 'fr';
                console.log('🌍 [Language Switch] Toggling', {
                  from: urlLang,
                  to: newLang,
                  timestamp: new Date().toISOString()
                });
                handleLanguageChange(newLang);
              }}
              className="flex items-center gap-1 px-2 lg:px-3 py-2 min-h-[40px] sm:min-h-[44px] rounded-lg hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] transition-all hover:shadow-[0_0_8px_var(--color-fuchsia-light)] group"
              aria-label={t('changeLanguage')}
              title={urlLang === 'fr' ? 'Switch to العربية' : 'Passer au Français'}
            >
              <Globe size={18} className="text-white group-hover:scale-110 transition-transform" />
              <div className="flex items-center gap-0.5 text-xs lg:text-sm font-semibold">
                <span className={`transition-all ${urlLang === 'fr' ? 'text-white scale-110' : 'text-white/70'}`}>
                  FR
                </span>
                <span className="text-white/50">|</span>
                <span className={`transition-all ${urlLang === 'ar' ? 'text-white scale-110' : 'text-white/70'}`}>
                  AR
                </span>
              </div>
            </button>
            {/* Theme Switcher - Always visible but minimal */}
            <ThemeSwitcher />
            {/* Search - Hidden on mobile */}
            <button className="hidden sm:flex p-2 lg:p-3 rounded-lg min-h-[44px] min-w-[44px] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] items-center justify-center transition-colors">
              <Search size={20} className="text-white" />
            </button>
            {/* User Icon - Desktop only */}
            <Link 
              href={`${currentLanguagePath}/${user ? 'profile' : 'login'}`}
              className="hidden lg:flex p-2 lg:p-3 rounded-lg min-h-[44px] min-w-[44px] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] items-center justify-center transition-colors"
            >
              <User size={20} className="text-white" />
            </Link>
            {/* Hamburger Menu - Mobile/Tablet only */}
            <button
              className="mobile-menu-toggle lg:hidden p-1.5 sm:p-2 lg:p-3 rounded-lg min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] flex items-center justify-center transition-colors"
              onClick={toggleMenu}
              aria-label={t('menu')}
            >
              <Menu size={22} className="text-white" />
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
            flexDirection: 'column',
            left: i18n.language === 'ar' ? 0 : 'auto',
            right: i18n.language === 'ar' ? 'auto' : 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Menu Header Section - Matches main header height */}
          <div className="mobile-menu-header h-16 flex items-center justify-between px-4" suppressHydrationWarning>
            <div className="flex items-center gap-2">
              <Link href={currentLanguagePath} className="flex items-center gap-2" onClick={toggleMenu}>
                <img
                  src="/images/icons/logo-footer.png"
                  alt="Labo El Allali"
                  className="w-8 h-8 rounded-lg"
                />
                <span className="font-semibold text-lg text-white">{t('laboName')}</span>
              </Link>
            </div>
            <button 
              onClick={toggleMenu}
              className="p-2 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
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
              href={`${currentLanguagePath}/${user ? 'profile' : 'login'}`}
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
              backgroundColor: 'var(--background-default)',
              borderTop: '1px solid var(--border-default)',
            }}
          >
            {/* WhatsApp Contact Button */}
            <a
              href={`https://wa.me/${LAB_WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={toggleMenu}
              aria-label="Contact via WhatsApp"
              className="menu-whatsapp-button"
            >
              <MessageCircle size={20} />
              {t('contact')} WhatsApp
            </a>

            {/* PWA Install Button */}
            <div className="w-full">
              <PWAInstallButton variant="footer" />
            </div>

            {/* Language Switch Button - Mobile Menu */}
            <button
              onClick={() => {
                const newLang = urlLang === 'fr' ? 'ar' : 'fr';
                handleLanguageChange(newLang);
              }}
              aria-label={t('changeLanguage')}
              className="menu-language-button"
            >
              <Globe size={20} />
              <div className="flex items-center gap-1 font-bold">
                <span className={urlLang === 'fr' ? 'opacity-100' : 'opacity-60'}>FR</span>
                <span className="opacity-40">|</span>
                <span className={urlLang === 'ar' ? 'opacity-100' : 'opacity-60'}>AR</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;