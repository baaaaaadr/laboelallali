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

          // DEBUG: Log sort button state
          console.log(`🔍 SORT DEBUG: "${option.label}"`, {
            optionId: option.id,
            currentSort: sortBy,
            isSelected: isSelected,
            shouldBeRose: isSelected,
            classes: isSelected ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--background-secondary)] text-[var(--text-secondary)]'
          });

          return (
            <button
              key={option.id}
              onClick={() => {
                console.log(`🖱️ SORT CLICKED: "${option.label}" (${option.id})`);
                onSortChange(option.id);
              }}
              className={`
                px-6 py-1.5 rounded-lg text-xs font-semibold
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-[var(--color-bordeaux-primary)] focus:ring-offset-1
                ${isSelected
                  ? 'bg-[var(--color-bordeaux-primary)] text-white shadow-md'
                  : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--color-bordeaux-primary)]'
                }
              `}
              style={isSelected ? { color: 'white' } : {}}
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
