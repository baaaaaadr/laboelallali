import React, { useState } from "react";

// Define Analysis interface for type safety
export interface Analysis {
  id: string;
  name_fr: string;
  name_ar: string;
  price: number;
  category_fr: string;
  category_ar: string;
  preparation_fr: string;
  preparation_ar: string;
  delay_fr: string;
  delay_ar: string;
  is_active: boolean;
}

interface AnalysisCardProps {
  analysis: Analysis;
  lang: string;
  isSelected?: boolean;
  onSelect?: (analysis: Analysis) => void;
}

export function AnalysisCard({ analysis, lang, isSelected = false, onSelect }: AnalysisCardProps) {
  const isArabic = lang === "ar";
  const [showPreparation, setShowPreparation] = useState(false);
  
  // Get the preparation text based on the current language
  const preparationText = isArabic ? analysis.preparation_ar : analysis.preparation_fr;
  const hasPreparation = preparationText && preparationText.trim().length > 0;
  
  // Toggle preparation visibility
  const togglePreparation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPreparation(prev => !prev);
  };
  
  // Manual translations based on language
  const translations = {
    categoryLabel: isArabic ? "التصنيف:" : "Catégorie:",
    delayLabel: isArabic ? "المدة:" : "Délai:",
    priceCurrency: isArabic ? "درهم" : "MAD",
    showPreparation: isArabic ? "عرض التحضير" : "Voir Préparation",
    hidePreparation: isArabic ? "إخفاء التحضير" : "Masquer Préparation",
    preparationLabel: isArabic ? "تعليمات التحضير:" : "Instructions de préparation:",
    noPreparation: isArabic ? "لا توجد تعليمات تحضير محددة." : "Aucune préparation spécifique.",
    select: isArabic ? "اختيار" : "Sélectionner",
    selected: isArabic ? "تم الاختيار" : "Sélectionné"
  };
  
  // Handle selection
  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(analysis);
    }
  };

  return (
    <div 
      className={`
        relative w-full
        bg-[var(--background-secondary)] dark:bg-[var(--background-secondary)]
        border-2 rounded-xl p-5 mb-4
        cursor-pointer
        transition-all duration-200 ease-in-out
        ${isSelected 
          ? 'border-[var(--color-fuchsia-accent)] dark:border-[var(--color-fuchsia-accent)] ring-2 ring-[var(--color-fuchsia-accent)]/30 scale-[1.02] bg-[var(--color-fuchsia-pale)] dark:bg-[var(--background-tertiary)]' 
          : 'border-[var(--border-default)] hover:border-[var(--color-bordeaux-light)] dark:hover:border-[var(--color-bordeaux-primary)] hover:shadow-lg dark:hover:bg-[var(--background-tertiary)]'
        }
      `}
      onClick={handleSelectClick}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelectClick(e as unknown as React.MouseEvent);
        }
      }}
      style={{
        boxShadow: isSelected 
          ? '0 8px 25px -5px rgba(255, 64, 129, 0.2)' 
          : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        minHeight: '200px'
      }}
    >
      {/* Selection indicator */}
      <div 
        className={`absolute top-3 ${isArabic ? 'left-3' : 'right-3'} z-10`}
        aria-hidden="true"
      >
        <div 
          className={`
            w-6 h-6 rounded-full flex items-center justify-center
            transition-all duration-200
            ${isSelected 
              ? 'bg-[var(--color-fuchsia-accent)] text-white scale-110' 
              : 'border-2 border-[var(--border-default)] bg-[var(--background-default)] hover:border-[var(--color-fuchsia-accent)]'
            }
          `}
        >
          {isSelected ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </div>
        <span className="sr-only">{isSelected ? translations.selected : translations.select}</span>
      </div>
      
      {/* Card Content */}
      <div className={`${isArabic ? 'pl-10' : 'pr-10'}`}>
        <h3 
          className={`
            text-xl font-semibold mb-3 transition-colors duration-200
            ${isSelected 
              ? 'text-[var(--color-fuchsia-accent)]' 
              : 'text-[var(--color-bordeaux-primary)]'
            }
          `}
        >
          {isArabic ? analysis.name_ar : analysis.name_fr}
        </h3>
        
        <div className="space-y-2">
          <p className="text-[var(--text-secondary)] text-sm">
            <span className="font-medium text-[var(--text-primary)]">{translations.categoryLabel} </span>
            {isArabic ? analysis.category_ar : analysis.category_fr}
          </p>
          
          <p className="text-[var(--text-secondary)] text-sm">
            <span className="font-medium text-[var(--text-primary)]">{translations.delayLabel} </span>
            {isArabic ? analysis.delay_ar : analysis.delay_fr}
          </p>
          
          <p className="text-[var(--color-fuchsia-accent)] font-bold mt-3 text-lg">
            {analysis.price.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} {translations.priceCurrency}
          </p>
          
          {/* Preparation toggle button */}
          {hasPreparation && (
            <div className="mt-3">
              <button 
                onClick={togglePreparation}
                className="
                  px-3 py-2 text-xs rounded-md
                  bg-[var(--color-gray-soft)] hover:bg-[var(--color-gray-border)]
                  text-[var(--text-primary)]
                  border border-[var(--border-default)]
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:ring-opacity-50
                "
                aria-expanded={showPreparation}
              >
                {showPreparation ? translations.hidePreparation : translations.showPreparation}
              </button>
            </div>
          )}
          
          {/* Preparation details section */}
          {showPreparation && (
            <div className="mt-3 p-3 bg-[var(--color-gray-soft)] border border-[var(--border-default)] rounded-md">
              <h4 className="font-medium text-xs mb-2 text-[var(--text-primary)]">
                {translations.preparationLabel}
              </h4>
              <p className="text-[var(--text-secondary)] text-xs whitespace-pre-line leading-relaxed">
                {hasPreparation ? preparationText : translations.noPreparation}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnalysisCard;