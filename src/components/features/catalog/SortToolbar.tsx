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
      <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">
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
            classes: isSelected ? 'bg-[#E3004F] text-white (ROSE BRAND)' : 'bg-white text-gray-900 (WHITE)'
          });

          return (
            <button
              key={option.id}
              onClick={() => {
                console.log(`🖱️ SORT CLICKED: "${option.label}" (${option.id})`);
                onSortChange(option.id);
              }}
              className={`
                px-4 py-1.5 rounded-full text-xs font-medium
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1
                ${isSelected
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }
              `}
              style={isSelected ? { backgroundColor: '#1F2937', color: 'white' } : {}}
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
