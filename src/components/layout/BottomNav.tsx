"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FlaskConical, CalendarDays, Phone, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLangFromPath, isActivePath } from '@/lib/navigation/isActivePath';

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
              {/* La pilule porte l'état « vous êtes ici » ; le conteneur intérieur reste
                  le repère de positionnement du point fuchsia, collé à l'icône. */}
              <span className="bottom-nav-pill">
                <span className="bottom-nav-icon-container" style={{ position: 'relative', display: 'flex' }}>
                  <IconComponent
                    size={20}
                    className="bottom-nav-icon"
                    aria-hidden="true"
                  />
                  {/* Point « service vedette » — inutile sur la page où l'on se trouve déjà. */}
                  {item.highlight && !isActive && (
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
                </span>
              </span>
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