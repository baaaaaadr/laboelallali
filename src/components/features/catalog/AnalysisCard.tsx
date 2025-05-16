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

/**
 * Props for the AnalysisCard component
 * @interface AnalysisCardProps
 * @property {Analysis} analysis - The analysis data to display
 * @property {string} lang - The current language code ('fr' or 'ar')
 * @property {boolean} [isSelected] - Whether this analysis is currently selected
 * @property {Function} [onSelect] - Callback function when the analysis is selected/deselected
 */
interface AnalysisCardProps {
  analysis: Analysis;
  lang: string;
  isSelected?: boolean;
  onSelect?: (analysis: Analysis) => void;
}

export function AnalysisCard({ analysis, lang, isSelected = false, onSelect }: AnalysisCardProps) {
  // Define animation keyframes for the check icon - client side only
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.innerHTML = `
        @keyframes appearAnimation {
          0% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-appear {
          animation: appearAnimation 0.3s ease-out forwards;
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);
  const isArabic = lang === "ar";
  const [showPreparation, setShowPreparation] = useState(false);
  
  // Get the preparation text based on the current language
  const preparationText = isArabic ? analysis.preparation_ar : analysis.preparation_fr;
  const hasPreparation = preparationText && preparationText.trim().length > 0;
  
  // Toggle preparation visibility
  const togglePreparation = () => {
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
    e.stopPropagation(); // Prevent event bubbling
    if (onSelect) {
      onSelect(analysis);
    }
  };

  return (
    <div 
      className={`shadow-lg rounded-lg p-4 mb-4 border 
        ${isSelected 
          ? 'border-[var(--accent-fuchsia)] border border-opacity-80 bg-[var(--bordeaux-pale)] ring-1 ring-[var(--accent-fuchsia)] ring-opacity-40' 
          : 'border-gray-200 bg-white hover:border-gray-300'} 
        hover:shadow-xl transition-all duration-300 ease-in-out transform ${isSelected ? 'scale-[1.01]' : ''} relative`}
      onClick={handleSelectClick}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleSelectClick(e as unknown as React.MouseEvent);
        }
      }}
    >
      {/* Selection indicator - position based on language direction */}
      <div 
        className={`absolute top-3 ${isArabic ? 'left-3' : 'right-3'} flex items-center z-10`}
        aria-hidden="true"
      >
        <div 
          className={`w-6 h-6 rounded-full 
            ${isSelected 
              ? 'bg-[var(--accent-fuchsia)] shadow-md' 
              : 'border-2 border-gray-300 bg-white hover:border-[var(--accent-fuchsia)] hover:border-opacity-50'} 
            flex items-center justify-center transform transition-all duration-300 ease-in-out 
            ${isSelected ? 'scale-110 rotate-3' : ''}`}
        >
          {isSelected ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white animate-appear" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </div>
        <span className="sr-only">{isSelected ? translations.selected : translations.select}</span>
      </div>
      
      <h3 className={`text-xl font-semibold mb-2 ${isSelected ? 'text-[var(--accent-fuchsia)]' : 'text-[var(--primary-bordeaux)]'} ${isArabic ? 'pl-8' : 'pr-8'} transition-colors duration-300`}>
        {isArabic ? analysis.name_ar : analysis.name_fr}
      </h3>
      
      <div className="mt-2 space-y-1">
        <p className="text-gray-600">
          <span className="font-medium">{translations.categoryLabel} </span>
          {isArabic ? analysis.category_ar : analysis.category_fr}
        </p>
        
        <p className="text-gray-600">
          <span className="font-medium">{translations.delayLabel} </span>
          {isArabic ? analysis.delay_ar : analysis.delay_fr}
        </p>
        
        <p className="text-[var(--accent-fuchsia)] font-bold mt-2">
          {analysis.price.toLocaleString(isArabic ? 'ar-MA' : 'fr-MA')} {translations.priceCurrency}
        </p>
        
        {/* Preparation toggle button - only show if the analysis has preparation instructions */}
        {hasPreparation && (
          <div className="mt-3">
            <button 
              onClick={togglePreparation}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors duration-200"
              aria-expanded={showPreparation}
            >
              {showPreparation 
                ? translations.hidePreparation
                : translations.showPreparation
              }
            </button>
          </div>
        )}
        
        {/* Preparation details section - conditionally rendered */}
        {showPreparation && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="font-medium text-sm mb-1 text-gray-700">
              {translations.preparationLabel}
            </h4>
            <p className="text-gray-700 text-sm whitespace-pre-line">
              {hasPreparation 
                ? preparationText 
                : translations.noPreparation
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalysisCard;
