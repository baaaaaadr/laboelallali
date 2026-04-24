"use client";

import React from "react";
import { useTranslation } from 'react-i18next';

export type SortOption = 'popularity' | 'name';

interface SortToolbarProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  isRtl?: boolean;
}

export function SortToolbar({
  sortBy,
  onSortChange,
  isRtl = false
}: SortToolbarProps) {
  const { t } = useTranslation('catalog');

  const sortOptions: { id: SortOption; labelKey: string; label: string }[] = [
    { id: 'popularity', labelKey: 'tabs.popularity', label: 'Popularité' },
    { id: 'name', labelKey: 'tabs.alphabetical', label: 'A-Z' }
  ];

  return (
    <div className={`flex items-center gap-4 mb-6 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Label */}
      <span className="text-sm text-[var(--text-primary)] font-medium">
        {t('tabs.sort_by', 'Trier par')}:
      </span>

      {/* Sort buttons pills */}
      <div className="flex gap-2">
        {sortOptions.map((option) => {
          const isSelected = sortBy === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onSortChange(option.id)}
              className="rounded-lg text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 border"
              style={{
                paddingLeft: '16px',
                paddingRight: '16px',
                paddingTop: '8px',
                paddingBottom: '8px',
                backgroundColor: isSelected ? 'var(--color-bordeaux-primary)' : 'var(--background-secondary)',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                borderColor: isSelected ? 'var(--color-bordeaux-primary)' : 'var(--border-default)',
                boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {t(option.labelKey, option.label)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SortToolbar;
