"use client";

import React from "react";
import { Disclosure } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';
import { AnalyseItem } from './AnalysisCard';
import { AnalysisCard } from './AnalysisCard';
import { getCategoryIcon } from '@/utils/iconMapper';
import { useTranslation } from 'react-i18next';

interface CategoryAccordionProps {
  categoryName: string;
  analyses: AnalyseItem[];
  lang: string;
  selectedAnalyses: AnalyseItem[];
  onToggleAnalysis: (analysis: AnalyseItem) => void;
  onShowDetails: (analysis: AnalyseItem) => void;
}

export function CategoryAccordion({
  categoryName,
  analyses,
  lang,
  selectedAnalyses,
  onToggleAnalysis,
  onShowDetails
}: CategoryAccordionProps) {
  const isArabic = lang === "ar";
  const { t } = useTranslation('catalog');

  // Get category icon
  const CategoryIcon = getCategoryIcon(categoryName);

  // Check if an analysis is selected
  const isAnalysisSelected = (analysis: AnalyseItem) => {
    return selectedAnalyses.some(selected => selected.id === analysis.id);
  };

  // Convert AnalyseItem to legacy Analysis format for the card
  const convertToLegacyFormat = (analyse: AnalyseItem) => {
    return {
      id: analyse.id,
      name_fr: analyse.Nom_Patient_FR,
      name_ar: analyse.Nom_Patient_AR,
      price: analyse.Prix_Dhs,
      category_fr: analyse.Categorie_FR,
      category_ar: analyse.Categorie_AR,
      preparation_fr: analyse.Pre_Analytique_FR,
      preparation_ar: analyse.Pre_Analytique_AR,
      delay_fr: '', // Not available in new structure
      delay_ar: '', // Not available in new structure
      is_active: true
    };
  };

  return (
    <Disclosure as="div" className="mb-4" defaultOpen={false}>
      {({ open }) => (
        <>
          <Disclosure.Button className="w-full">
            <div
              className={`
                flex items-center justify-between p-6
                bg-white dark:bg-gray-800 rounded-xl
                shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]
                hover:shadow-[0_8px_30px_-2px_rgba(0,0,0,0.1)]
                transition-all duration-300
                border-2 border-transparent
                ${open ? 'border-[#E3004F]' : ''}
              `}
            >
              {/* Left: Icon + Category Name */}
              <div className={`flex items-center gap-4 ${isArabic ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="h-12 w-12 rounded-full bg-[#E3004F]/10 dark:bg-[#E3004F]/20 flex items-center justify-center">
                  <CategoryIcon className="h-6 w-6 text-[#E3004F]" />
                </div>
                <div className={`${isArabic ? 'text-right' : 'text-left'}`}>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {categoryName}
                  </h3>
                  {/* Badge with count */}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {analyses.length} {analyses.length === 1 ? t('analysis', 'analyse') : t('analyses', 'analyses')}
                  </span>
                </div>
              </div>

              {/* Right: Chevron */}
              <ChevronDown
                className={`h-5 w-5 text-gray-500 transition-transform duration-300 ${
                  open ? 'rotate-180' : ''
                } ${isArabic ? 'transform scale-x-[-1]' : ''}`}
              />
            </div>
          </Disclosure.Button>

          <Disclosure.Panel className="mt-4">
            {/* Analyses in vertical list (not grid) */}
            <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
              {analyses.map((analyse) => (
                <AnalysisCard
                  key={analyse.id}
                  analysis={convertToLegacyFormat(analyse)}
                  lang={lang}
                  isSelected={isAnalysisSelected(analyse)}
                  onSelect={() => onToggleAnalysis(analyse)}
                  onShowDetails={() => onShowDetails(analyse)}
                />
              ))}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}

export default CategoryAccordion;
