"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, Search, User, Globe, Home, CalendarDays, Truck, FlaskConical, Phone, MessageCircle, Check, Download, Stethoscope, FileText, LogOut, UserCog } from 'lucide-react';
import { LAB_WHATSAPP_NUMBER } from '@/constants/contact';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';
import { supportedLngs } from '../../../i18n';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { getLangFromPath, isActivePath } from '@/lib/navigation/isActivePath';

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

const UniversalSearchModal = dynamic(
  () => import('@/components/features/search/UniversalSearchModal'),
  { ssr: false }
);

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
  // « Vous êtes ici » : la ligne entière s'inverse + rail de 4px au bord intérieur.
  // Les couleurs passent par les variables --nav-here-* pour suivre le mode sombre
  // sans dépendre de la détection JS (cf. src/styles/components/navigation.css).
  navLinkActive: {
     backgroundColor: 'var(--nav-here-row-bg)',
     borderInlineStart: '4px solid var(--nav-here-rail)',
     paddingInlineStart: '12px',
     fontWeight: 700,
  } as React.CSSProperties,
  navIconActive: {
     color: 'var(--nav-here-row-fg)',
  } as React.CSSProperties,
  navTextActive: {
     color: 'var(--nav-here-row-fg)',
     fontWeight: 700,
  } as React.CSSProperties,
};

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const pathname = usePathname();
  const mobileLangDropdownRef = useRef<HTMLDivElement>(null);
  const { user, userProfile, logout } = useAuth();
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
  const isStaff = ['owner', 'admin', 'staff'].includes(userProfile?.role || '');

  // « Vous êtes ici » — un seul canal visuel dans toute l'appli : un fond PLEIN.
  // Le fuchsia, lui, ne signale que la mise en avant de Résultats (contour/badge/point).
  const isHere = (target: string) => isActivePath(pathname, target);
  // Profil et Connexion partagent la même entrée de menu.
  const isAccountHere = isHere('/profile') || isHere('/login');

  const drawerLinkStyle = (active: boolean): React.CSSProperties => ({
    ...menuStyles.navLink,
    ...(isDarkMode ? menuStyles.navLinkDark : {}),
    ...(active ? menuStyles.navLinkActive : {}),
  });

  const drawerIconStyle = (active: boolean): React.CSSProperties => ({
    ...menuStyles.navIcon,
    ...(isDarkMode ? menuStyles.navIconDark : {}),
    ...(active ? menuStyles.navIconActive : {}),
  });

  const drawerTextStyle = (active: boolean): React.CSSProperties => ({
    ...menuStyles.navText,
    ...(isDarkMode ? menuStyles.navTextDark : {}),
    ...(active ? menuStyles.navTextActive : {}),
  });

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
    router.push(`/${urlLang}`);
  };

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
    <>
      <header className="header-main shadow-md sticky top-0 z-50 w-full">
        <div className="w-full mx-auto px-2 sm:px-4 lg:px-6 lg:max-w-7xl relative">
        {/* Hauteur pilotée par --header-height : .header-main y ajoute l'encoche
            (barre d'état PWA) via padding-top, cette rangée garde ses 64px. */}
        {/* gap-3 is a floor, not spacing: `justify-between` gives zero room once
            the row is full, which is how the active "Accueil" pill came to touch
            the logo at 1024px. Direction-neutral, so it holds in RTL too. */}
        <div className="flex items-center justify-between gap-3 transition-all text-white h-[var(--header-height)]">
          {/* Logo and name */}
          <Link href={currentLanguagePath} className="flex items-center h-full flex-shrink-0">
            <img
              src="/images/icons/logo-footer.png"
              alt="Labo El Allali"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex-shrink-0 object-contain"
            />
          </Link>

          {/* Desktop Navigation - Only visible at lg (1024px) and above */}
          {/* Espacement resserré entre 1024 et 1279 px : à space-x-4 la barre
              débordait horizontalement en français (7 liens, 8 pour le staff). */}
          <nav className="desktop-nav hidden lg:flex items-center space-x-2 xl:space-x-6">
            <Link
              href={`${currentLanguagePath}/`}
              className={`nav-link text-sm lg:text-base ${isHere('/') ? 'active' : ''}`}
              aria-current={isHere('/') ? 'page' : undefined}
            >
              {t('home')}
            </Link>
            {/* Service vedette : contour + badge fuchsia. Jamais de fond plein —
                le fond plein est réservé à l'état « vous êtes ici ». */}
            <Link
              href={`${currentLanguagePath}/resultats`}
              className={`nav-link nav-link-featured text-sm lg:text-base ${isHere('/resultats') ? 'active' : ''}`}
              aria-current={isHere('/resultats') ? 'page' : undefined}
            >
              <FileText size={16} />
              {t('resultats.nav', { defaultValue: "Résultats" })}
              <span className="nav-badge-new">{t('services_hub.results_badge')}</span>
            </Link>
            <Link
              href={`${currentLanguagePath}/rendez-vous`}
              className={`nav-link font-semibold text-sm lg:text-base ${isHere('/rendez-vous') ? 'active' : ''}`}
              aria-current={isHere('/rendez-vous') ? 'page' : undefined}
            >
              {t('appointment')}
            </Link>
            <Link
              href={`${currentLanguagePath}/glabo`}
              className={`nav-link font-semibold text-sm lg:text-base ${isHere('/glabo') ? 'active' : ''}`}
              aria-current={isHere('/glabo') ? 'page' : undefined}
            >
              {t('glabo')}
            </Link>
            <Link
              href={`${currentLanguagePath}/analyses`}
              className={`nav-link font-semibold text-sm lg:text-base ${isHere('/analyses') ? 'active' : ''}`}
              aria-current={isHere('/analyses') ? 'page' : undefined}
            >
              {t('navigation.analyses_catalog', { ns: 'common', defaultValue: "Catalogue Analyses" })}
            </Link>
            <Link
              href={`${currentLanguagePath}/medecins`}
              className={`nav-link font-semibold text-sm lg:text-base ${isHere('/medecins') ? 'active' : ''}`}
              aria-current={isHere('/medecins') ? 'page' : undefined}
            >
              {t('navigation.medecins', { ns: 'common', defaultValue: "Médecins" })}
            </Link>
            <Link
              href={`${currentLanguagePath}/contact`}
              className={`nav-link text-sm lg:text-base ${isHere('/contact') ? 'active' : ''}`}
              aria-current={isHere('/contact') ? 'page' : undefined}
            >
              {t('contact')}
            </Link>
            {isStaff && (
              <Link
                href={`${currentLanguagePath}/admin`}
                className={`nav-link font-semibold text-sm lg:text-base flex items-center gap-1 ${isHere('/admin') ? 'active' : ''}`}
                aria-current={isHere('/admin') ? 'page' : undefined}
              >
                <UserCog size={16} /> {t('admin.nav', 'Admin')}
              </Link>
            )}
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
            {/* Search - Universal search modal trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex p-2 lg:p-3 rounded-lg min-h-[44px] min-w-[44px] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] items-center justify-center transition-colors"
              aria-label={t('search.modal_label')}
            >
              <Search size={20} className="text-white" />
            </button>
            {/* User Icon - Desktop only */}
            <Link
              href={`${currentLanguagePath}/${user ? 'profile' : 'login'}`}
              className="hidden lg:flex p-2 lg:p-3 rounded-lg min-h-[44px] min-w-[44px] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] items-center justify-center transition-colors"
              aria-label={user ? t('personal_information', 'Profil') : t('sign_in', 'Se connecter')}
            >
              <User size={20} className="text-white" />
            </Link>
            {/* Logout - Desktop only, when logged in */}
            {user && (
              <button
                onClick={handleLogout}
                className="hidden lg:flex p-2 lg:p-3 rounded-lg min-h-[44px] min-w-[44px] hover:bg-[var(--color-bordeaux-dark)] dark:hover:bg-[var(--background-tertiary)] items-center justify-center transition-colors"
                aria-label={t('logout', 'Déconnexion')}
                title={t('logout', 'Déconnexion')}
              >
                <LogOut size={20} className="text-white" />
              </button>
            )}
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
    </header>

      {/* Mobile Menu Overlay and Container */}
      <div
        className={`fixed inset-0 z-[100] lg:hidden transition-opacity duration-300 ${
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
          className="fixed top-0 right-0 h-full w-72 bg-white dark:bg-[var(--background-default)] shadow-lg z-[100] flex flex-col"
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
          {/* Pas de h-16 ici : .mobile-menu-header porte min-height + le padding
              d'encoche, sinon le bouton « fermer » passe sous la barre d'état. */}
          <div className="mobile-menu-header flex items-center justify-between px-4" suppressHydrationWarning>
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
              style={drawerLinkStyle(isHere('/'))}
              aria-current={isHere('/') ? 'page' : undefined}
              onClick={toggleMenu}
            >
              <Home size={20} style={drawerIconStyle(isHere('/'))} />
              <span style={drawerTextStyle(isHere('/'))}>
                {t('home')}
              </span>
            </Link>

            {/* Service vedette : icône fuchsia + badge « Nouveau ».
                Plus de fond rose permanent — ce canal signale désormais la page courante. */}
            <Link
              href={`${currentLanguagePath}/resultats`}
              style={drawerLinkStyle(isHere('/resultats'))}
              aria-current={isHere('/resultats') ? 'page' : undefined}
              onClick={toggleMenu}
            >
              <FileText
                size={20}
                style={
                  isHere('/resultats')
                    ? drawerIconStyle(true)
                    : { ...menuStyles.navIcon, color: 'var(--color-fuchsia-accent)' }
                }
              />
              <span style={drawerTextStyle(isHere('/resultats'))}>
                {t('resultats.nav', { defaultValue: 'Résultats' })}
              </span>
              <span
                className="nav-badge-new"
                style={{ marginInlineStart: 'auto', fontSize: '11px', padding: '2px 8px' }}
              >
                {t('services_hub.results_badge')}
              </span>
            </Link>

            <Link
              href={`${currentLanguagePath}/rendez-vous`}
              style={drawerLinkStyle(isHere('/rendez-vous'))}
              aria-current={isHere('/rendez-vous') ? 'page' : undefined}
              onClick={toggleMenu}
            >
              <CalendarDays size={20} style={drawerIconStyle(isHere('/rendez-vous'))} />
              <span style={drawerTextStyle(isHere('/rendez-vous'))}>
                {t('appointment')}
              </span>
            </Link>

            <Link
              href={`${currentLanguagePath}/glabo`}
              style={drawerLinkStyle(isHere('/glabo'))}
              aria-current={isHere('/glabo') ? 'page' : undefined}
              onClick={toggleMenu}
            >
              <Truck size={20} style={drawerIconStyle(isHere('/glabo'))} />
              <span style={drawerTextStyle(isHere('/glabo'))}>
                {t('glabo')}
              </span>
            </Link>

            <Link
              href={`${currentLanguagePath}/analyses`}
              style={drawerLinkStyle(isHere('/analyses'))}
              aria-current={isHere('/analyses') ? 'page' : undefined}
              onClick={toggleMenu}
            >
              <FlaskConical size={20} style={drawerIconStyle(isHere('/analyses'))} />
              <span style={drawerTextStyle(isHere('/analyses'))}>
                {t('navigation.analyses_catalog', { ns: 'common', defaultValue: 'Analyses' })}
              </span>
            </Link>

            <Link
              href={`${currentLanguagePath}/medecins`}
              style={drawerLinkStyle(isHere('/medecins'))}
              aria-current={isHere('/medecins') ? 'page' : undefined}
              onClick={toggleMenu}
            >
              <Stethoscope size={20} style={drawerIconStyle(isHere('/medecins'))} />
              <span style={drawerTextStyle(isHere('/medecins'))}>
                {t('navigation.medecins', { ns: 'common', defaultValue: 'Médecins' })}
              </span>
            </Link>

            <Link
              href={`${currentLanguagePath}/contact`}
              style={drawerLinkStyle(isHere('/contact'))}
              aria-current={isHere('/contact') ? 'page' : undefined}
              onClick={toggleMenu}
            >
              <Phone size={20} style={drawerIconStyle(isHere('/contact'))} />
              <span style={drawerTextStyle(isHere('/contact'))}>
                {t('contact')}
              </span>
            </Link>

            {/* Profile Link - Mobile Only */}
            <Link
              href={`${currentLanguagePath}/${user ? 'profile' : 'login'}`}
              style={drawerLinkStyle(isAccountHere)}
              aria-current={isAccountHere ? 'page' : undefined}
              onClick={toggleMenu}
            >
              <User size={20} style={drawerIconStyle(isAccountHere)} />
              <span style={drawerTextStyle(isAccountHere)}>
                {user ? t('personal_information', 'Profil') : t('sign_in', 'Se connecter')}
              </span>
            </Link>

            {/* Admin Link - Mobile, staff only */}
            {isStaff && (
              <Link
                href={`${currentLanguagePath}/admin`}
                style={drawerLinkStyle(isHere('/admin'))}
                aria-current={isHere('/admin') ? 'page' : undefined}
                onClick={toggleMenu}
              >
                <UserCog size={20} style={drawerIconStyle(isHere('/admin'))} />
                <span style={drawerTextStyle(isHere('/admin'))}>
                  {t('admin.nav', 'Admin')}
                </span>
              </Link>
            )}

            {/* Logout - Mobile, when logged in */}
            {user && (
              <button
                onClick={handleLogout}
                style={{ ...menuStyles.navLink, ...(isDarkMode ? menuStyles.navLinkDark : {}), border: 'none', cursor: 'pointer' }}
              >
                <LogOut size={20} style={{ ...menuStyles.navIcon, ...(isDarkMode ? menuStyles.navIconDark : {}) }} />
                <span style={{ ...menuStyles.navText, ...(isDarkMode ? menuStyles.navTextDark : {}) }}>
                  {t('logout', 'Déconnexion')}
                </span>
              </button>
            )}
          </nav>
          
          {/* Action Buttons Section - Stuck to Bottom: compact 3-icon row */}
          <div
            className="p-4"
            style={{
              backgroundColor: 'var(--background-default)',
              borderTop: '1px solid var(--border-default)',
            }}
          >
            <div className="menu-icon-row">
              {/* WhatsApp */}
              <a
                href={`https://wa.me/${LAB_WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={toggleMenu}
                aria-label={`${t('contact')} WhatsApp`}
                title={`${t('contact')} WhatsApp`}
                className="menu-icon-button"
              >
                <MessageCircle size={22} />
              </a>

              {/* PWA Install (icon-only) */}
              <PWAInstallButton variant="icon" />

              {/* Language toggle */}
              <button
                onClick={() => {
                  const newLang = urlLang === 'fr' ? 'ar' : 'fr';
                  handleLanguageChange(newLang);
                }}
                aria-label={t('changeLanguage')}
                title={urlLang === 'fr' ? 'العربية' : 'Français'}
                className="menu-icon-button"
              >
                <Globe size={20} />
                <span className="text-sm font-bold">{urlLang === 'fr' ? 'AR' : 'FR'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <UniversalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        lang={urlLang}
      />
    </>
  );
};

export default Header;