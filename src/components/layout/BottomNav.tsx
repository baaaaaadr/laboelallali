"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FlaskConical, CalendarDays, Phone, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Helper function to extract language from pathname
function getLangFromPath(path: string): string {
  const match = path.match(/^\/([a-zA-Z-]+)/);
  return match ? match[1] : 'fr';
}

// Helper function to check if a path is active
function isActivePath(currentPath: string, targetPath: string): boolean {
  const lang = getLangFromPath(currentPath);
  const expectedPath = `/${lang}${targetPath === '/' ? '' : targetPath}`;
  
  if (targetPath === '/') {
    // For home, match exactly
    return currentPath === `/${lang}` || currentPath === expectedPath;
  }
  
  // For other paths, check if current path starts with the target path
  return currentPath.startsWith(expectedPath);
}

const BottomNav = () => {
  const { t, i18n } = useTranslation('common');
  const pathname = usePathname();
  const currentLang = getLangFromPath(pathname);
  const isRTL = i18n.language === 'ar';

  // Navigation items configuration — Résultats (flagship) sits right after Accueil,
  // flagged `highlight` for its fuchsia indicator dot.
  const navItems = [
    {
      key: 'home',
      label: t('home'),
      icon: Home,
      href: `/${currentLang}`,
      activePath: '/',
      highlight: false,
    },
    {
      key: 'resultats',
      label: t('resultats.nav'),
      icon: FileText,
      href: `/${currentLang}/resultats`,
      activePath: '/resultats',
      highlight: true,
    },
    {
      key: 'analyses',
      label: t('navigation.analyses_catalog'),
      icon: FlaskConical,
      href: `/${currentLang}/analyses`,
      activePath: '/analyses',
      highlight: false,
    },
    {
      key: 'appointment',
      label: t('appointment'),
      icon: CalendarDays,
      href: `/${currentLang}/rendez-vous`,
      activePath: '/rendez-vous',
      highlight: false,
    },
    {
      key: 'contact',
      label: t('contact'),
      icon: Phone,
      href: `/${currentLang}/contact`,
      activePath: '/contact',
      highlight: false,
    },
  ];

  return (
    <nav
      className="bottom-nav-container lg:hidden fixed bottom-0 left-0 right-0 z-40"
      role="navigation"
      aria-label="Navigation principale"
      suppressHydrationWarning
    >
      <div className="bottom-nav-bar" suppressHydrationWarning>
        {navItems.map((item) => {
          const isActive = isActivePath(pathname, item.activePath);
          const IconComponent = item.icon;
          
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="bottom-nav-icon-container" style={{ position: 'relative' }}>
                <IconComponent
                  size={20}
                  className="bottom-nav-icon"
                  aria-hidden="true"
                />
                {item.highlight && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      insetInlineEnd: '-3px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--color-fuchsia-accent)',
                      boxShadow: '0 0 0 2px var(--background-default)',
                    }}
                  />
                )}
              </div>
              <span className="bottom-nav-label">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;