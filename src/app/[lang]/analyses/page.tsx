// src/app/[lang]/analyses/page.tsx
"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react"; // Added Suspense
import { collection, query, where, orderBy, getDocs, Firestore } from "firebase/firestore";
import { db } from "@/config/firebase";
import AnalysisCard, { Analysis } from "@/components/features/catalog/AnalysisCard";
import TotalCalculator from "@/components/features/catalog/TotalCalculator";
import { useTranslation } from 'react-i18next';

// Define the component that does the data fetching
const AnalysesCatalogDataFetcher = ({ lang, onDataFetched, onErrorOccurred, onLoadingStateChange }: {
  lang: string;
  onDataFetched: (data: Analysis[]) => void;
  onErrorOccurred: (errorMsg: string | null) => void;
  onLoadingStateChange: (isLoading: boolean) => void;
}) => {
  const { t } = useTranslation(['common', 'catalog']);
  const translations = useMemo(() => ({
    errorFetchingBase: t('catalog.error_fetching', 'Échec du chargement des analyses'),
    errorDbNotInitialized: t('firebase.db_not_initialized', 'Database connection error. Please check configuration or try again later.'),
    errorPermissions: t('catalog.error_permissions', 'Access to data denied. Please check Firestore rules.'),
    errorOffline: t('catalog.error_offline', 'Cannot connect to database. Check your internet connection.'),
    errorProjectIdUndefined: t('firebase.project_id_undefined', "Firebase project ID is undefined or Firestore is not initialized. Configuration error.")
  }), [t]);

  useEffect(() => {
    let isMounted = true;
    const fetchAnalyses = async () => {
      onLoadingStateChange(true);
      onErrorOccurred(null);
      
      console.log("AnalysesPage: Fetcher attempting to fetch.");

      try {
        // Check if Firestore is initialized
        if (!db) {
          throw new Error("Firestore is not initialized");
        }
        
        // Use the existing Firestore instance
        console.log("AnalysesPage: Fetcher - Fetching analyses...");
        const analysesCollectionRef = collection(db, "analysisCatalog");
        const analysesQuery = query(
          analysesCollectionRef,
          where("is_active", "==", true),
          orderBy(lang === "ar" ? "name_ar" : "name_fr")
        );

        const querySnapshot = await getDocs(analysesQuery);
        if (!isMounted) return;
        console.log(`AnalysesPage: Fetcher - Fetched ${querySnapshot.docs.length} analyses.`);
        
        const fetchedAnalyses: Analysis[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Analysis, "id">)
        }));
        onDataFetched(fetchedAnalyses);
      } catch (err) {
        if (!isMounted) return;
        console.error("AnalysesPage: Fetcher - Error fetching analyses:", err);
        let specificErrorMessage = translations.errorFetchingBase;
        
        if (err instanceof Error) {
          if (err.message.includes("Missing or insufficient permissions")) {
            specificErrorMessage = translations.errorPermissions;
          } else if (err.message.includes("offline") || err.message.includes("Failed to fetch")) {
            specificErrorMessage = translations.errorOffline;
          } else if (err.message.toLowerCase().includes("firestore is not initialized") || 
                    (err.message.toLowerCase().includes("projectid") && err.message.toLowerCase().includes("undefined"))) {
            specificErrorMessage = translations.errorProjectIdUndefined;
          }
        }
        onErrorOccurred(specificErrorMessage);
      } finally {
        if (isMounted) {
          onLoadingStateChange(false);
        }
      }
    };
    
    const timerId = setTimeout(fetchAnalyses, 150); // Small delay for init
    
    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };

  }, [lang, translations, onDataFetched, onErrorOccurred, onLoadingStateChange]);

  return null; // This component only fetches data
};

// Main page component
export function AnalysesCatalogPageContents({ params: langParams }: { params: { lang: string } }) {
  // LOCAL STORAGE KEY
  const STORAGE_KEY = 'laboElAllali_selectedAnalyses';
  const { t } = useTranslation(['common', 'catalog']);
  const lang = langParams.lang;
  const isArabic = lang === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  
  // Define state variables
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedAnalyses, setSelectedAnalyses] = useState<Analysis[]>([]);
  
  // Load selected analyses from localStorage on component mount
  useEffect(() => {
    try {
      const savedSelections = localStorage.getItem(STORAGE_KEY);
      if (savedSelections) {
        const parsedSelections = JSON.parse(savedSelections);
        // Only load if we have valid data in the expected format
        if (Array.isArray(parsedSelections) && parsedSelections.length > 0) {
          // Make sure each item has at least an id field
          if (parsedSelections.every(item => item && typeof item === 'object' && 'id' in item)) {
            console.log('Restored selections from localStorage:', parsedSelections.length);
            setSelectedAnalyses(parsedSelections);
          }
        }
      }
    } catch (error) {
      console.error('Error restoring selections from localStorage:', error);
    }
  }, []);
  
  // Function to save the current selections to localStorage
  const saveSelectionsToStorage = (selections: Analysis[]) => {
    try {
      const serializedData = JSON.stringify(selections);
      localStorage.setItem(STORAGE_KEY, serializedData);
      // Also create a cookie with just the IDs to help with persistence
      document.cookie = `${STORAGE_KEY}_ids=${selections.map(a => a.id).join(',')};path=/;max-age=86400`;
    } catch (error) {
      console.error('Error saving selections to localStorage:', error);
    }
  };
  
  // Save selected analyses to localStorage when they change
  useEffect(() => {
    saveSelectionsToStorage(selectedAnalyses);
  }, [selectedAnalyses]);
  
  /**
   * Calculate the total cost of all selected analyses
   * @returns {number} The total cost
   */
  const getTotalCost = (): number => {
    return selectedAnalyses.reduce((total, analysis) => total + analysis.price, 0);
  };

  const translations = useMemo(() => ({
    title: t('common:navigation.analyses_catalog', isArabic ? 'دليل التحاليل' : 'Catalogue des Analyses'),
    searchLabel: t('catalog:search_label', isArabic ? 'البحث عن تحليل' : 'Rechercher une analyse'),
    searchPlaceholder: t('catalog:search_placeholder', isArabic ? 'اكتب اسم التحليل...' : "Tapez le nom d'une analyse..."),
    categoryLabel: t('catalog:category_label', isArabic ? 'التصنيف' : 'Catégorie'),
    allCategories: t('catalog:all_categories', isArabic ? 'جميع التصنيفات' : 'Toutes les catégories'),
    noResults: t('catalog:no_results', isArabic ? 'لا توجد نتائج مطابقة لمعايير البحث.' : 'Aucun résultat trouvé.'),
    clearFilters: t('catalog:clear_filters', isArabic ? 'مسح عوامل التصفية' : 'Effacer les filtres'),
    noAnalyses: t('catalog:no_analyses', isArabic ? 'لا توجد تحاليل متاحة حاليًا.' : 'Aucune analyse disponible.'),
    loadingText: t('catalog:loading', isArabic ? 'جاري التحميل...' : 'Chargement des analyses...'),
    errorTitle: t('common:error.title', isArabic ? 'خطأ' : 'Erreur'),
    selectedCount: t('common:analyses_catalog.selection.count_other', isArabic ? 'تحاليل محددة: {{count}}' : 'Analyses sélectionnées: {{count}}', { count: selectedAnalyses.length }),
    totalCost: t('common:analyses_catalog.selection.total_cost', isArabic ? 'المجموع: {{cost}}' : 'Coût total: {{cost}}', { cost: getTotalCost().toLocaleString(isArabic ? 'ar-MA' : 'fr-MA') }),
    costUnit: isArabic ? 'درهم' : 'MAD',
    selectedAnalyses: t('common:analyses_catalog.selection.count_other', isArabic ? '{{count}} تحاليل محددة' : '{{count}} analyses sélectionnées', { count: selectedAnalyses.length }),
    total: t('common:analyses_catalog.selection.total', isArabic ? 'المجموع' : 'Total'),
    reset: t('common:analyses_catalog.selection.reset', isArabic ? 'إعادة ضبط' : 'Réinitialiser')
  }), [t, selectedAnalyses, isArabic]);

  const categories = useMemo(() => {
    const categoryField = lang === "ar" ? "category_ar" : "category_fr";
    const uniqueCategories = new Set<string>();
    analyses.forEach((analysis) => {
      const category = analysis[categoryField as keyof Analysis] as string;
      if (category && category.trim()) uniqueCategories.add(category.trim());
    });
    return Array.from(uniqueCategories).sort();
  }, [analyses, lang]);

  /**
   * Toggle selection status of an analysis
   * @param {Analysis} analysis - The analysis to toggle
   */
  const handleToggleSelection = (analysis: Analysis) => {
    setSelectedAnalyses(prev => {
      // Check if analysis is already selected
      const isSelected = prev.some(item => item.id === analysis.id);
      
      let newSelections;
      if (isSelected) {
        // If already selected, remove it
        newSelections = prev.filter(item => item.id !== analysis.id);
      } else {
        // If not selected, add it
        newSelections = [...prev, analysis];
      }
      
      // Force immediate save to localStorage for more reliable persistence
      setTimeout(() => saveSelectionsToStorage(newSelections), 0);
      return newSelections;
    });
  };

  /**
   * Check if an analysis is selected
   * @param {string} analysisId - The ID of the analysis to check
   * @returns {boolean} True if the analysis is selected
   */
  const isAnalysisSelected = (analysisId: string): boolean => {
    return selectedAnalyses.some(analysis => analysis.id === analysisId);
  };

  /**
   * Clear all selections
   */
  const clearAllSelections = () => {
    setSelectedAnalyses([]);
    // Clear from localStorage immediately
    saveSelectionsToStorage([]);
  };

  const filteredAnalyses = useMemo(() => analyses.filter((analysis) => {
    const nameField = lang === "ar" ? "name_ar" : "name_fr";
    const categoryField = lang === "ar" ? "category_ar" : "category_fr";
    const nameMatches = !searchTerm || (analysis[nameField as keyof Analysis] as string).toLowerCase().includes(searchTerm.toLowerCase());
    const categoryMatches = !selectedCategory || (analysis[categoryField as keyof Analysis] as string) === selectedCategory;
    return nameMatches && categoryMatches;
  }), [analyses, searchTerm, selectedCategory, lang]);

  return (
    <div className={`container mx-auto px-4 py-8 ${isArabic ? 'rtl-content' : ''}`} dir={dir}>
      <AnalysesCatalogDataFetcher 
        lang={lang}
        onDataFetched={setAnalyses}
        onErrorOccurred={setError}
        onLoadingStateChange={setLoading}
      />
      <h1 className="text-3xl font-bold text-[var(--primary-bordeaux)] mb-6 text-center">
        {translations.title}
      </h1>
      
      {/* Filter section - only visible when analyses are loaded */}
      {!loading && analyses.length > 0 && (
        <div className="mb-6" id="filter-section">
          <div className={`p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm ${isArabic ? 'rtl-filter-section' : ''}`}>
            <div className={`flex flex-col md:flex-row gap-4 ${isArabic ? 'md:flex-row-reverse' : ''}`}>
              <div className={`flex-1 ${isArabic ? 'text-right' : ''}`}>
                <label htmlFor="search" className={`block text-sm font-medium text-gray-700 mb-1 ${isArabic ? 'text-right' : ''}`}>
                  {translations.searchLabel}
                </label>
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  placeholder={translations.searchPlaceholder}
                  style={isArabic ? {textAlign: 'right', direction: 'rtl'} : {}}
                  className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--accent-fuchsia)] focus:border-transparent ${isArabic ? 'text-right' : ''}`}
                />
              </div>
              <div className={`md:w-1/3 ${isArabic ? 'text-right' : ''}`}>
                <label htmlFor="category" className={`block text-sm font-medium text-gray-700 mb-1 ${isArabic ? 'text-right' : ''}`}>
                  {translations.categoryLabel}
                </label>
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value)}
                  style={isArabic ? {textAlign: 'right', direction: 'rtl'} : {}}
                  className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--accent-fuchsia)] focus:border-transparent ${isArabic ? 'text-right' : ''}`}
                >
                  <option value="">{translations.allCategories}</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Le calculateur total a été déplacé vers le composant flottant */}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF4081]"></div>
          <span className="ml-3 text-gray-600">{translations.loadingText}</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 shadow-md" role="alert">
          <strong className="font-bold">{translations.errorTitle}: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && analyses.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>{translations.noAnalyses}</p>
        </div>
      )}

      {/* Floating Total Calculator */}
      <TotalCalculator
        totalCost={getTotalCost()}
        selectedCount={selectedAnalyses.length}
        onReset={clearAllSelections}
        currencyLabel={translations.costUnit}
        isRtl={isArabic}
        selectedAnalyses={selectedAnalyses}
      />

      {/* Analysis cards or empty results message */}
      {!loading && !error && analyses.length > 0 && (
        <>
          {filteredAnalyses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
              {filteredAnalyses.map((analysis: Analysis) => (
                <AnalysisCard 
                  key={analysis.id} 
                  analysis={analysis} 
                  lang={lang} 
                  isSelected={isAnalysisSelected(analysis.id)}
                  onSelect={handleToggleSelection}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 text-lg mb-3">{translations.noResults}</p>
              <button 
                onClick={() => { setSearchTerm(""); setSelectedCategory(""); }}
                className="px-4 py-2 bg-[var(--primary-bordeaux)] text-white rounded-md hover:bg-[var(--bordeaux-dark)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--bordeaux-dark)]"
              >
                {translations.clearFilters}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// Suspense Boundary for Client Component
const AnalysesCatalogPageWithSuspense: React.FC<{ params: { lang: string } | Promise<{ lang: string }> }> = ({params}) => {
  // Resolve the promise for params before passing to the component
  const resolvedParams = 'then' in params ? React.use(params) : params;

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><div className="loading"></div> <span className="ml-2">Loading Catalog...</span></div>}>
      <AnalysesCatalogPageContents params={resolvedParams} />
    </Suspense>
  );
};

export default AnalysesCatalogPageWithSuspense;