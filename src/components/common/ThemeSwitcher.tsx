'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';

export default function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const Icon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 rounded-full min-h-[44px] min-w-[44px] hover:bg-[#600018] dark:hover:bg-gray-700 flex items-center justify-center text-white"
        aria-label={t('theme.toggle', 'Toggle theme')}
      >
        <Icon size={20} />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 py-1">
          <button
            onClick={() => { setTheme('light'); setIsOpen(false); }}
            className={`flex items-center w-full px-4 py-2 text-sm ${theme === 'light' ? 'text-[#FF4081]' : 'text-gray-700 dark:text-gray-200'} hover:bg-gray-100 dark:hover:bg-gray-700`}
          >
            <Sun size={16} className="mr-2" />
            {t('theme.light', 'Light')}
          </button>
          <button
            onClick={() => { setTheme('dark'); setIsOpen(false); }}
            className={`flex items-center w-full px-4 py-2 text-sm ${theme === 'dark' ? 'text-[#FF4081]' : 'text-gray-700 dark:text-gray-200'} hover:bg-gray-100 dark:hover:bg-gray-700`}
          >
            <Moon size={16} className="mr-2" />
            {t('theme.dark', 'Dark')}
          </button>
          <button
            onClick={() => { setTheme('system'); setIsOpen(false); }}
            className={`flex items-center w-full px-4 py-2 text-sm ${theme === 'system' ? 'text-[#FF4081]' : 'text-gray-700 dark:text-gray-200'} hover:bg-gray-100 dark:hover:bg-gray-700`}
          >
            <Monitor size={16} className="mr-2" />
            {t('theme.system', 'System')}
          </button>
        </div>
      )}
    </div>
  );
}
