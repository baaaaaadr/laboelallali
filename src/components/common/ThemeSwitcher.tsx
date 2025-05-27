'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation('common');
  const isDark = theme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-3 rounded-full min-h-[44px] min-w-[44px] hover:bg-[#600018] dark:hover:bg-[var(--background-tertiary)] flex items-center justify-center text-white dark:text-[var(--text-primary)] transition-colors duration-200"
      aria-label={t('theme.toggle', 'Toggle theme')}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
