"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FlaskConical, CalendarDays, Phone } from 'lucide-react';
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

  // Navigation items configuration
  const navItems = [
    {
      key: 'home',
      label: t('home'),
      icon: Home,
      href: `/${currentLang}`,
      activePath: '/',
    },
    {
      key: 'analyses',
      label: t('navigation.analyses_catalog'),
      icon: FlaskConical,
      href: `/${currentLang}/analyses`,
      activePath: '/analyses',
    },
    {
      key: 'appointment',
      label: t('appointment'),
      icon: CalendarDays,
      href: `/${currentLang}/rendez-vous`,
      activePath: '/rendez-vous',
    },
    {
      key: 'contact',
      label: t('contact'),
      icon: Phone,
      href: `/${currentLang}/contact`,
      activePath: '/contact',
    },
  ];

  return (
    <nav 
      className="bottom-nav-container md:hidden fixed bottom-0 left-0 right-0 z-40"
      role="navigation"
      aria-label="Navigation principale"
    >
      <div className="bottom-nav-bar">
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
              <div className="bottom-nav-icon-container">
                <IconComponent 
                  size={20} 
                  className="bottom-nav-icon"
                  aria-hidden="true"
                />
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