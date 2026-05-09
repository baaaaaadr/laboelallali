// src/app/[lang]/analyses/page.tsx
"use client";

import React, { useState, useEffect, useMemo, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";
import { AnalyseItem, BilanItem, CartItem } from "@/components/features/catalog/AnalysisCard";
import BilanCard from "@/components/features/catalog/BilanCard";
import AnalysisMiniCard from "@/components/features/catalog/AnalysisMiniCard";
import TabsNavigation, { TabItem } from "@/components/features/catalog/TabsNavigation";
import SortToolbar, { SortOption } from "@/components/features/catalog/SortToolbar";
import BilanDetailsModal from "@/components/features/catalog/BilanDetailsModal";
import AnalysisDetailsModal from "@/components/features/catalog/AnalysisDetailsModal";
import TotalCalculator from "@/components/features/catalog/TotalCalculator";
import CartDetailsModal from "@/components/features/catalog/CartDetailsModal";
import { getCategoryIcon } from '@/utils/iconMapper';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Search, Star, BookOpen, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { LAB_CONTACT } from "@/constants/contact";
import MedicalLoader from "@/components/ui/MedicalLoader";

const normalizeId = (id: string) => id.replace(/\s+/g, '').toUpperCase();

// Data fetcher component
const CatalogDataFetcher = ({
  lang,
  onDataFetched,
  onErrorOccurred,
  onLoadingStateChange
}: {
  lang: string;
  onDataFetched: (analyses: AnalyseItem[], bilans: BilanItem[]) => void;
  onErrorOccurred: (errorMsg: string | null) => void;
  onLoadingStateChange: (isLoading: boolean) => void;
}) => {
  const { t } = useTranslation(['catalog']);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!isMounted) return;

      onLoadingStateChange(true);
      onErrorOccurred(null);

      try {
        if (!db) {
          throw new Error("Firestore is not initialized");
        }

        // Fetch both collections in parallel
        const [analysesSnapshot, bilansSnapshot] = await Promise.all([
          getDocs(collection(db, "analyses")),
          getDocs(collection(db, "bilans"))
        ]);

        if (!isMounted) return;

        const fetchedAnalyses: AnalyseItem[] = analysesSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<AnalyseItem, "id">)
          }))
          .filter(item => item.Nom_Patient_FR !== 'Nom_Patient_FR');

        const fetchedBilans: BilanItem[] = bilansSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<BilanItem, "id">)
          }))
          .filter(item => item.Nom_Bilan_FR !== 'Nom_Bilan_FR');

        onDataFetched(fetchedAnalyses, fetchedBilans);
      } catch (err) {
        if (!isMounted) return;

        let errorMessage = t('error_fetching', 'Échec du chargement des données');

        if (err instanceof Error) {
          if (err.message.includes("Missing or insufficient permissions")) {
            errorMessage = t('error_permissions', 'Accès refusé');
          } else if (err.message.includes("offline") || err.message.includes("Failed to fetch")) {
            errorMessage = t('error_offline', 'Impossible de se connecter à la base de données');
          }
        }
        onErrorOccurred(errorMessage);
      } finally {
        if (isMounted) {
          onLoadingStateChange(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [lang, t, onDataFetched, onErrorOccurred, onLoadingStateChange]);

  return null;
};

// Main page component
export function AnalysesCatalogPageContents({ params: langParams }: { params: { lang: string } }) {
  const STORAGE_KEY = 'laboElAllali_selectedItems_v2';
  const { t } = useTranslation(['catalog']);
  const lang = langParams.lang;
  const isArabic = lang === "ar";

  // State variables
  const [analyses, setAnalyses] = useState<AnalyseItem[]>([]);
  const [bilans, setBilans] = useState<BilanItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<CartItem[]>([]);
  const [bilanModalOpen, setBilanModalOpen] = useState(false);
  const [selectedBilanForDetails, setSelectedBilanForDetails] = useState<BilanItem | null>(null);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [selectedAnalysisForDetails, setSelectedAnalysisForDetails] = useState<AnalyseItem | null>(null);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [cartInitialTab, setCartInitialTab] = useState<'devis' | 'preparation'>('devis');
  const ITEMS_PER_PAGE = 24;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // NEW: Tabs state
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>('bilans');

  // Handle initial tab from query param
  useEffect(() => {
    if (tabParam && (tabParam === 'all' || tabParam === 'bilans')) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [closedCategories, setClosedCategories] = useState<Set<string>>(new Set());

  // Create analyses map for fast lookups
  const analysesMap = useMemo(() => {
    const map = new Map<string, AnalyseItem>();
    analyses.forEach(analyse => map.set(analyse.id, analyse));
    return map;
  }, [analyses]);

  // Create normalized map for matching (handles inconsistent spacing)
  const normalizedAnalysesMap = useMemo(() => {
    const map = new Map<string, AnalyseItem>();
    analyses.forEach(analyse => {
      map.set(normalizeId(analyse.id), analyse);
    });
    return map;
  }, [analyses]);

  // Stable callbacks
  const handleDataFetched = useCallback((fetchedAnalyses: AnalyseItem[], fetchedBilans: BilanItem[]) => {
    setAnalyses(fetchedAnalyses);
    setBilans(fetchedBilans);
  }, []);

  const handleErrorOccurred = useCallback((errorMsg: string | null) => {
    setError(errorMsg);
  }, []);

  const handleLoadingStateChange = useCallback((isLoading: boolean) => {
    setLoading(isLoading);
  }, []);

  // Load from localStorage
  useEffect(() => {
    try {
      const savedSelections = localStorage.getItem(STORAGE_KEY);
      if (savedSelections) {
        const parsedSelections = JSON.parse(savedSelections);
        if (Array.isArray(parsedSelections)) {
          setSelectedItems(parsedSelections);
        }
      }
    } catch {
      // Silently ignore errors
    }
  }, []);

  // Save to localStorage
  const saveSelectionsToStorage = useCallback((selections: CartItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
    } catch {
      // Silently ignore errors
    }
  }, []);

  useEffect(() => {
    saveSelectionsToStorage(selectedItems);
  }, [selectedItems, saveSelectionsToStorage]);

  // Search function
  const searchInItem = useCallback((item: AnalyseItem | BilanItem, term: string): boolean => {
    const searchLower = term.toLowerCase();

    if ('Nom_Patient_FR' in item) {
      // AnalyseItem
      const name = isArabic ? item.Nom_Patient_AR : item.Nom_Patient_FR;
      const tags = isArabic ? item.Tags_AR : item.Tags_FR;
      const category = isArabic ? item.Categorie_AR : item.Categorie_FR;
      const description = isArabic ? item.Description_Patient_AR : item.Description_Patient_FR;

      return name.toLowerCase().includes(searchLower) ||
        tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        category.toLowerCase().includes(searchLower) ||
        (description?.toLowerCase().includes(searchLower) || false);
    } else {
      // BilanItem
      const name = isArabic ? item.Nom_Bilan_AR : item.Nom_Bilan_FR;
      const description = isArabic ? item.Description_AR : item.Description_FR;

      return name.toLowerCase().includes(searchLower) ||
        description.toLowerCase().includes(searchLower) ||
        item.Categorie.toLowerCase().includes(searchLower);
    }
  }, [isArabic]);

  // Filtered data
  const filteredAnalyses = useMemo(() => {
    if (!searchTerm.trim()) return analyses;
    return analyses.filter(analyse => searchInItem(analyse, searchTerm));
  }, [analyses, searchTerm, searchInItem]);

  const filteredBilans = useMemo(() => {
    if (!searchTerm.trim()) return bilans;
    return bilans.filter(bilan => searchInItem(bilan, searchTerm));
  }, [bilans, searchTerm, searchInItem]);

  // Sorted bilans (featured first, then alphabetically)
  const sortedBilans = useMemo(() => {
    return [...filteredBilans].sort((a, b) => {
      // Featured first
      if (a.Is_Featured && !b.Is_Featured) return -1;
      if (!a.Is_Featured && b.Is_Featured) return 1;

      // Then alphabetically
      const nameA = isArabic ? a.Nom_Bilan_AR : a.Nom_Bilan_FR;
      const nameB = isArabic ? b.Nom_Bilan_AR : b.Nom_Bilan_FR;
      return nameA.localeCompare(nameB, lang);
    });
  }, [filteredBilans, isArabic, lang]);

  // Sorted analyses based on sortBy
  const sortedAnalyses = useMemo(() => {
    const sorted = [...filteredAnalyses];

    if (sortBy === 'name') {
      sorted.sort((a, b) => {
        const nameA = isArabic ? a.Nom_Patient_AR : a.Nom_Patient_FR;
        const nameB = isArabic ? b.Nom_Patient_AR : b.Nom_Patient_FR;
        return nameA.localeCompare(nameB, lang);
      });
    } else {
      // popularity (default) and category both sort by popularity
      sorted.sort((a, b) => (b.Nombre_Demandes || 0) - (a.Nombre_Demandes || 0));
    }

    return sorted;
  }, [filteredAnalyses, sortBy, isArabic, lang]);

  // Categories with analyses — uses sortedAnalyses to keep popularity order within each group
  const categoriesWithAnalyses = useMemo(() => {
    const categoryMap = new Map<string, AnalyseItem[]>();

    sortedAnalyses.forEach(analyse => {
      const category = isArabic ? analyse.Categorie_AR : analyse.Categorie_FR;
      if (!categoryMap.has(category)) categoryMap.set(category, []);
      categoryMap.get(category)!.push(analyse);
    });

    return Array.from(categoryMap.entries())
      .map(([name, analyses]) => ({ name, analyses }))
      .sort((a, b) => a.name.localeCompare(b.name, lang))
      .filter(cat => cat.analyses.length > 0);
  }, [sortedAnalyses, isArabic, lang]);

  // NEW: Build tabs list dynamically
  const tabs: TabItem[] = useMemo(() => {
    const tabsList: TabItem[] = [];

    // 1. Nos Bilans tab (always visible)
    tabsList.push({
      id: 'bilans',
      label: t('tabs.our_bilans', 'Nos Bilans'),
      icon: Star,
      count: sortedBilans.length
    });

    // 2. Catalogue Complet tab
    tabsList.push({
      id: 'all',
      label: t('tabs.full_catalog', 'Catalogue Complet'),
      icon: BookOpen,
      count: sortedAnalyses.length
    });

    // 3. Category tabs (only non-empty) - HIDDEN FOR NOW
    // categoriesWithAnalyses.forEach(({ name, analyses }) => {
    //   tabsList.push({
    //     id: name, // Category name as ID
    //     label: name,
    //     icon: getCategoryIcon(name),
    //     count: analyses.length
    //   });
    // });

    return tabsList;
  }, [sortedBilans, sortedAnalyses, categoriesWithAnalyses, t]);


  // Cart operations
  const isAnalyseInCart = useCallback((analyse: AnalyseItem) => {
    return selectedItems.some(item => item.type === 'analyse' && item.item.id === analyse.id);
  }, [selectedItems]);

  const isBilanInCart = useCallback((bilan: BilanItem) => {
    return selectedItems.some(item => item.type === 'bilan' && item.item.id === bilan.id);
  }, [selectedItems]);

  const toggleAnalyseInCart = useCallback((analyse: AnalyseItem) => {
    // If already a direct item, remove it
    const inCartAsAnalyse = selectedItems.some(
      item => item.type === 'analyse' && item.item.id === analyse.id
    );
    if (inCartAsAnalyse) {
      setSelectedItems(prev =>
        prev.filter(item => !(item.type === 'analyse' && item.item.id === analyse.id))
      );
      return;
    }

    // Block if already covered by a bilan in the cart
    const normId = normalizeId(analyse.id);
    const coveringBilan = selectedItems
      .filter((item): item is Extract<CartItem, { type: 'bilan' }> => item.type === 'bilan')
      .find(item => item.item.Composition_Codes.some(code => normalizeId(code) === normId));

    if (coveringBilan) {
      const bilanName = isArabic ? coveringBilan.item.Nom_Bilan_AR : coveringBilan.item.Nom_Bilan_FR;
      toast(t('cart.analyse_in_bilan', 'Cette analyse est déjà incluse dans le bilan «{{bilan}}»', { bilan: bilanName }), {
        icon: 'ℹ️',
        duration: 4000,
      });
      return;
    }

    setSelectedItems(prev => [...prev, { type: 'analyse' as const, item: analyse }]);
  }, [selectedItems, isArabic, t]);

  const toggleBilanInCart = useCallback((bilan: BilanItem) => {
    // If already in cart, remove it
    const inCart = selectedItems.some(item => item.type === 'bilan' && item.item.id === bilan.id);
    if (inCart) {
      setSelectedItems(prev =>
        prev.filter(item => !(item.type === 'bilan' && item.item.id === bilan.id))
      );
      return;
    }

    // Remove individual analyses that are already covered by this bilan
    const bilanNormCodes = new Set(bilan.Composition_Codes.map(code => normalizeId(code)));
    const overlapping = selectedItems.filter(
      item => item.type === 'analyse' && bilanNormCodes.has(normalizeId(item.item.id))
    );

    if (overlapping.length > 0) {
      const bilanName = isArabic ? bilan.Nom_Bilan_AR : bilan.Nom_Bilan_FR;
      toast(
        t('cart.analyses_replaced', '{{count}} analyse(s) retirée(s), déjà couvertes par le bilan «{{bilan}}»', {
          count: overlapping.length,
          bilan: bilanName,
        }),
        { icon: 'ℹ️', duration: 5000 }
      );
    }

    setSelectedItems(prev => {
      const filtered = prev.filter(
        item => !(item.type === 'analyse' && bilanNormCodes.has(normalizeId(item.item.id)))
      );
      return [...filtered, { type: 'bilan' as const, item: bilan }];
    });
  }, [selectedItems, isArabic, t]);

  // Add multiple analyses to cart (used by BilanDetailsModal)
  const addAnalysesToCart = useCallback((newAnalyses: AnalyseItem[]) => {
    // Build set of analysis IDs already covered by bilans in the cart
    const coveredCodes = new Set<string>();
    selectedItems.forEach(item => {
      if (item.type === 'bilan') {
        item.item.Composition_Codes.forEach(code => coveredCodes.add(normalizeId(code)));
      }
    });

    const toAdd = newAnalyses.filter(a => !coveredCodes.has(normalizeId(a.id)));
    const skippedCount = newAnalyses.length - toAdd.length;

    if (skippedCount > 0) {
      toast(
        t('cart.analyses_skipped_in_bilan', '{{count}} analyse(s) ignorée(s), déjà couvertes par un bilan dans votre panier', {
          count: skippedCount,
        }),
        { icon: 'ℹ️', duration: 4000 }
      );
    }

    if (toAdd.length === 0) return;

    setSelectedItems(prev => {
      const newItems = [...prev];
      toAdd.forEach(analyse => {
        const alreadyInCart = newItems.some(
          item => item.type === 'analyse' && item.item.id === analyse.id
        );
        if (!alreadyInCart) {
          newItems.push({ type: 'analyse' as const, item: analyse });
        }
      });
      return newItems;
    });
  }, [selectedItems, t]);

  // NOUVEAU - Fonction pour retirer un item individuel du panier
  const removeItemFromCart = useCallback((itemToRemove: CartItem) => {
    setSelectedItems(prev => {
      const updated = prev.filter(item => {
        if (item.type === 'analyse' && itemToRemove.type === 'analyse') {
          return item.item.id !== itemToRemove.item.id;
        } else if (item.type === 'bilan' && itemToRemove.type === 'bilan') {
          return item.item.id !== itemToRemove.item.id;
        }
        return true;
      });

      // Sauvegarder dans localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setSelectedItems([]);
    localStorage.removeItem(STORAGE_KEY);
    setIsCartModalOpen(false); // Fermer la modale
  }, []);

  // Frais de prélèvement fixes (acte de prise de sang)
  const SAMPLING_FEE = 20;

  // Calculate total cost — deduplicated by normalized analysis ID to prevent double-counting
  const totalCost = useMemo(() => {
    const seen = new Set<string>();
    let itemsTotal = 0;

    for (const item of selectedItems) {
      if (item.type === 'analyse') {
        const key = normalizeId(item.item.id);
        if (!seen.has(key)) {
          seen.add(key);
          itemsTotal += item.item.Prix_Dhs;
        }
      } else {
        for (const code of item.item.Composition_Codes) {
          const key = normalizeId(code);
          if (!seen.has(key)) {
            seen.add(key);
            itemsTotal += normalizedAnalysesMap.get(key)?.Prix_Dhs ?? 0;
          }
        }
      }
    }

    return selectedItems.length > 0 ? itemsTotal + SAMPLING_FEE : 0;
  }, [selectedItems, normalizedAnalysesMap]);

  // NOUVEAU - Auto-close cart modal si panier devient vide
  useEffect(() => {
    if (selectedItems.length === 0 && isCartModalOpen) {
      setIsCartModalOpen(false);
    }
  }, [selectedItems.length, isCartModalOpen]);

  // Modal handlers
  const handleShowBilanDetails = useCallback((bilan: BilanItem) => {
    setSelectedBilanForDetails(bilan);
    setBilanModalOpen(true);
  }, []);

  const handleCloseBilanModal = useCallback(() => {
    setBilanModalOpen(false);
    setSelectedBilanForDetails(null);
  }, []);

  const handleShowAnalysisDetails = useCallback((analyse: AnalyseItem) => {
    setSelectedAnalysisForDetails(analyse);
    setAnalysisModalOpen(true);
  }, []);

  const handleCloseAnalysisModal = useCallback(() => {
    setAnalysisModalOpen(false);
    setSelectedAnalysisForDetails(null);
  }, []);

  // Get selected analyses for accordion
  const selectedAnalyses = useMemo(() => {
    return selectedItems
      .filter(item => item.type === 'analyse')
      .map(item => item.item);
  }, [selectedItems]);

  // Get selected analyses IDs for BilanDetailsModal
  const selectedAnalysisIds = useMemo(() => {
    return new Set(
      selectedItems
        .filter(item => item.type === 'analyse')
        .map(item => item.item.id)
    );
  }, [selectedItems]);

  // Get selected bilans for carousel
  const selectedBilans = useMemo(() => {
    return selectedItems
      .filter(item => item.type === 'bilan')
      .map(item => item.item);
  }, [selectedItems]);

  // Get displayed analyses for current category tab
  const displayedAnalyses = useMemo(() => {
    if (activeTab === 'all') {
      return sortedAnalyses;
    } else if (activeTab === 'bilans') {
      return [];
    } else {
      // Category-specific
      return filteredAnalyses.filter(a =>
        (isArabic ? a.Categorie_AR : a.Categorie_FR) === activeTab
      );
    }
  }, [activeTab, sortedAnalyses, filteredAnalyses, isArabic]);

  // Handle infinite scroll
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  useEffect(() => {
    if (inView && !loading && sortBy !== 'category' && displayedAnalyses.length > visibleCount) {
      setVisibleCount(prev => prev + ITEMS_PER_PAGE);
    }
  }, [inView, loading, sortBy, displayedAnalyses.length, visibleCount]);

  // Reset pagination when tab, search or sort changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [activeTab, searchTerm, sortBy]);

  return (
    <>
      <CatalogDataFetcher
        lang={lang}
        onDataFetched={handleDataFetched}
        onErrorOccurred={handleErrorOccurred}
        onLoadingStateChange={handleLoadingStateChange}
      />

      <div className="min-h-screen bg-[var(--background-default)] dark:bg-[var(--background-default)] pb-32">
        {/* Title - Normal flow, NOT STICKY */}
        <div className="pt-6 pb-4 bg-[var(--background-default)]">
          <div className="container mx-auto px-4">
            <h1 className="text-2xl md:text-3xl font-bold text-center text-gray-900 dark:text-[var(--text-primary)]">
              {t('title', 'Catalogue des Analyses')}
            </h1>
          </div>
        </div>

        {/* Sticky Container - Search + Tabs Together */}
        <div
          className="sticky top-0 z-50 bg-[var(--background-default)] shadow-sm border-b border-gray-200 dark:border-[var(--border-default)]"
          style={{ willChange: 'transform' }}
        >
          <div className="container mx-auto px-4">
            {/* Search bar */}
            <div className="py-3">
              <div className="relative max-w-2xl mx-auto">
                <Search className={`absolute ${isArabic ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)] transition-colors`} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('search_in_tags', 'Rechercher par nom, catégorie ou mots-clés...')}
                  className={`
                    w-full ${isArabic ? 'pr-12 pl-10' : 'pl-12 pr-10'} py-2.5 rounded-lg
                    bg-[var(--background-default)] text-[var(--text-primary)]
                    border border-[var(--border-default)]
                    text-sm
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent
                    placeholder:text-[var(--text-tertiary)]
                    shadow-sm
                    transition-all duration-200
                  `}
                  dir={isArabic ? 'rtl' : 'ltr'}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className={`absolute ${isArabic ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors`}
                    aria-label="Effacer la recherche"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs - Directly below search */}
            <div className="pb-2">
              <TabsNavigation
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isRtl={isArabic}
              />
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 mt-8">

          {/* Loading state */}
          {loading && (
            <MedicalLoader label={t('loading', 'Chargement en cours...')} />
          )}

          {/* Error state */}
          {error && (
            <div className="max-w-2xl mx-auto mb-8 p-6 rounded-lg bg-red-100 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-700">
              <p className="text-red-800 dark:text-red-200 text-center">{error}</p>
            </div>
          )}

          {/* Content - Conditional based on active tab */}
          {!loading && !error && (
            <>
              {/* TAB: Nos Bilans */}
              {activeTab === 'bilans' && (
                <section>
                  {sortedBilans.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {sortedBilans.map((bilan) => (
                        <BilanCard
                          key={bilan.id}
                          bilan={bilan}
                          lang={lang}
                          isSelected={isBilanInCart(bilan)}
                          onSelect={toggleBilanInCart}
                          onShowDetails={handleShowBilanDetails}
                          normalizedAnalysesMap={normalizedAnalysesMap}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-600 dark:text-gray-400 text-lg">
                        {t('no_bilans_found', 'Aucun bilan trouvé.')}
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* TAB: Catalogue Complet */}
              {activeTab === 'all' && (
                <section>
                  {/* Sort toolbar */}
                  <SortToolbar
                    sortBy={sortBy}
                    onSortChange={(next) => {
                      setSortBy(next);
                      // Reset all closed categories when entering category view
                      if (next === 'category') setClosedCategories(new Set());
                    }}
                    isRtl={isArabic}
                  />

                  {/* ── Category view ── */}
                  {sortBy === 'category' ? (
                    categoriesWithAnalyses.length > 0 ? (
                      <div className="space-y-3">
                        {categoriesWithAnalyses.map(({ name: catName, analyses: catAnalyses }) => {
                          const isOpen = !closedCategories.has(catName);
                          const CategoryIcon = getCategoryIcon(catName);
                          const toggleCategory = () => {
                            setClosedCategories(prev => {
                              const next = new Set(prev);
                              if (next.has(catName)) next.delete(catName);
                              else next.add(catName);
                              return next;
                            });
                          };

                          return (
                            <div
                              key={catName}
                              className="rounded-lg overflow-hidden transition-shadow duration-200"
                              style={{
                                border: '1px solid var(--border-default)',
                                backgroundColor: 'var(--background-card)',
                              }}
                            >
                              {/* Category header */}
                              <button
                                onClick={toggleCategory}
                                className="w-full flex items-center justify-between px-5 py-4 transition-colors duration-150 focus:outline-none"
                                style={{ backgroundColor: isOpen ? 'var(--color-bordeaux-pale)' : 'transparent' }}
                                onMouseEnter={e => {
                                  if (!isOpen) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--background-secondary)';
                                }}
                                onMouseLeave={e => {
                                  if (!isOpen) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: isOpen ? 'rgba(128,0,32,0.12)' : 'var(--background-secondary)' }}
                                  >
                                    <CategoryIcon
                                      className="h-4 w-4"
                                      style={{ color: 'var(--color-bordeaux-primary)' }}
                                    />
                                  </div>
                                  <span
                                    className="font-semibold text-sm"
                                    style={{ color: isOpen ? 'var(--color-bordeaux-primary)' : 'var(--text-primary)' }}
                                  >
                                    {catName}
                                  </span>
                                  <span
                                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: isOpen ? 'rgba(128,0,32,0.1)' : 'var(--background-secondary)',
                                      color: isOpen ? 'var(--color-bordeaux-primary)' : 'var(--text-secondary)',
                                    }}
                                  >
                                    {catAnalyses.length}
                                  </span>
                                </div>
                                {isOpen
                                  ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--color-bordeaux-primary)' }} />
                                  : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                                }
                              </button>

                              {/* Analyses grid — visible when open */}
                              {isOpen && (
                                <div className="px-4 pb-4 pt-2">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {catAnalyses.map((analyse) => (
                                      <AnalysisMiniCard
                                        key={analyse.id}
                                        analysis={analyse}
                                        lang={lang}
                                        isSelected={isAnalyseInCart(analyse)}
                                        onSelect={() => toggleAnalyseInCart(analyse)}
                                        onShowDetails={() => handleShowAnalysisDetails(analyse)}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-[var(--text-secondary)] text-lg">
                          {t('no_results', 'Aucun résultat trouvé.')}
                        </p>
                      </div>
                    )
                  ) : (
                    /* ── Flat view (popularity / A-Z) ── */
                    displayedAnalyses.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {displayedAnalyses.slice(0, visibleCount).map((analyse) => (
                            <AnalysisMiniCard
                              key={analyse.id}
                              analysis={analyse}
                              lang={lang}
                              isSelected={isAnalyseInCart(analyse)}
                              onSelect={() => toggleAnalyseInCart(analyse)}
                              onShowDetails={() => handleShowAnalysisDetails(analyse)}
                            />
                          ))}
                        </div>

                        {/* Infinite Scroll Trigger */}
                        {filteredAnalyses.length > visibleCount && (
                          <div ref={ref} className="mt-12 flex flex-col items-center justify-center gap-4 py-8">
                            <MedicalLoader size="sm" />
                            <p className="text-sm text-[var(--text-tertiary)] transition-colors">
                              {isArabic ? 'جاري تحميل المزيد...' : 'Chargement de plus d\'analyses...'}
                            </p>
                          </div>
                        )}

                        {filteredAnalyses.length > 0 && filteredAnalyses.length <= visibleCount && (
                          <div className="mt-12 text-center py-8 opacity-50">
                            <p className="text-sm text-[var(--text-tertiary)]">
                              {isArabic ? 'نهاية القائمة' : 'Fin de la liste'}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-[var(--text-secondary)] text-lg">
                          {t('no_results', 'Aucun résultat trouvé.')}
                        </p>
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm('')}
                            className="mt-4 px-6 py-2 rounded-lg text-white transition-colors duration-200"
                            style={{ backgroundColor: 'var(--color-bordeaux-primary)' }}
                          >
                            {t('clear_filters', 'Effacer les filtres')}
                          </button>
                        )}
                      </div>
                    )
                  )}
                </section>
              )}

              {/* TAB: Category-specific */}
              {activeTab !== 'bilans' && activeTab !== 'all' && (
                <section>
                  {/* Category header */}
                  <div className="flex items-center gap-3 mb-6">
                    {(() => {
                      const CategoryIcon = getCategoryIcon(activeTab);
                      return <CategoryIcon className="h-8 w-8 text-[#E3004F]" />;
                    })()}
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {activeTab}
                      <span className="ml-2 text-gray-500 dark:text-gray-400 text-lg">
                        ({displayedAnalyses.length})
                      </span>
                    </h2>
                  </div>

                  {/* Analyses list */}
                  {displayedAnalyses.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayedAnalyses.slice(0, visibleCount).map((analyse) => (
                          <AnalysisMiniCard
                            key={analyse.id}
                            analysis={analyse}
                            lang={lang}
                            isSelected={isAnalyseInCart(analyse)}
                            onSelect={() => toggleAnalyseInCart(analyse)}
                            onShowDetails={() => handleShowAnalysisDetails(analyse)}
                          />
                        ))}
                      </div>

                      {/* Infinite Scroll Trigger */}
                      {displayedAnalyses.length > visibleCount && (
                        <div ref={ref} className="mt-12 flex flex-col items-center justify-center gap-4 py-8">
                          <MedicalLoader size="sm" />
                          <p className="text-sm text-[var(--text-tertiary)] transition-colors">
                            {isArabic ? 'جاري تحميل المزيد...' : 'Chargement de plus d\'analyses...'}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-600 dark:text-gray-400 text-lg">
                        {t('no_results', 'Aucun résultat trouvé.')}
                      </p>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Cart */}
      {selectedItems.length > 0 && (
        <TotalCalculator
          totalCost={totalCost}
          selectedCount={selectedItems.length}
          onReset={clearCart}
          currencyLabel={isArabic ? 'درهم' : 'MAD'}
          isRtl={isArabic}
          selectedItems={selectedItems}
          onOpenCartDetails={() => setIsCartModalOpen(true)}
          onOpenPreparation={() => { setCartInitialTab('preparation'); setIsCartModalOpen(true); }}
        />
      )}

      {/* Bilan Details Modal */}
      <BilanDetailsModal
        bilan={selectedBilanForDetails}
        isOpen={bilanModalOpen}
        onClose={handleCloseBilanModal}
        analysesMap={analysesMap}
        normalizedAnalysesMap={normalizedAnalysesMap}
        lang={lang}
        onAddAnalysesToCart={addAnalysesToCart}
        selectedAnalysesInCart={selectedAnalysisIds}
      />

      {/* Analysis Details Modal */}
      {selectedAnalysisForDetails && (
        <AnalysisDetailsModal
          analysis={selectedAnalysisForDetails}
          isOpen={analysisModalOpen}
          onClose={handleCloseAnalysisModal}
          lang={lang}
        />
      )}

      {/* Cart Details Modal */}
      <CartDetailsModal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        selectedItems={selectedItems}
        totalCost={totalCost}
        onRemoveItem={removeItemFromCart}
        onClearCart={clearCart}
        onWhatsAppSend={() => {
          // Generate WhatsApp message
          const whatsappTranslations = {
            greeting: t('analyses_catalog.selection.whatsapp_message.greeting', 'Bonjour Laboratoire El Allali,'),
            intro: t('analyses_catalog.selection.whatsapp_message.intro', 'Je suis intéressé(e) par les analyses suivantes :'),
            analysisItemPrefix: t('analyses_catalog.selection.whatsapp_message.analysis_item_prefix', '- '),
            totalLabel: t('analyses_catalog.selection.whatsapp_message.total_label', 'Total estimé :'),
            currency: t('analyses_catalog.selection.whatsapp_message.currency', 'MAD'),
            closingRemark: t('analyses_catalog.selection.whatsapp_message.closing_remark', 'Pouvez-vous me donner plus d\'informations ?'),
            websiteReference: t('analyses_catalog.selection.whatsapp_message.website_reference', 'Sélection faite depuis le site web.')
          };

          let message = `${whatsappTranslations.greeting}\n\n`;
          message += `${whatsappTranslations.intro}\n`;

          const bilans = selectedItems.filter(item => item.type === 'bilan');
          const analyses = selectedItems.filter(item => item.type === 'analyse');

          if (bilans.length > 0) {
            message += `\n📦 ${t('catalog:bilans', 'Bilans')} :\n`;
            bilans.forEach(cartItem => {
              const name = isArabic ? cartItem.item.Nom_Bilan_AR : cartItem.item.Nom_Bilan_FR;
              message += `${whatsappTranslations.analysisItemPrefix}${name}\n`;
            });
          }

          if (analyses.length > 0) {
            message += `\n🔬 ${t('catalog:analyses', 'Analyses')} :\n`;
            analyses.forEach(cartItem => {
              const name = isArabic ? cartItem.item.Nom_Patient_AR : cartItem.item.Nom_Patient_FR;
              message += `${whatsappTranslations.analysisItemPrefix}${name}\n`;
            });
          }

          const locale = isArabic ? 'ar-MA' : 'fr-MA';
          message += `\n${whatsappTranslations.totalLabel} ${totalCost.toLocaleString(locale)} ${whatsappTranslations.currency}\n\n`;
          message += `${whatsappTranslations.closingRemark}\n\n`;
          message += whatsappTranslations.websiteReference;

          const encodedMessage = encodeURIComponent(message);
          const whatsappUrl = `https://wa.me/${LAB_CONTACT.WHATSAPP_ID}?text=${encodedMessage}`;
          
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          if (isMobile) {
            window.location.href = whatsappUrl;
          } else {
            window.open(whatsappUrl, '_blank');
          }
          
          setIsCartModalOpen(false);
        }}
        currencyLabel={isArabic ? 'درهم' : 'MAD'}
        isRtl={isArabic}
        normalizedAnalysesMap={normalizedAnalysesMap}
        initialTab={cartInitialTab}
        onViewAnalysisDetails={(analysis) => {
          setSelectedAnalysisForDetails(analysis);
          setAnalysisModalOpen(true);
        }}
        onViewBilanDetails={(bilan) => {
          setSelectedBilanForDetails(bilan);
          setBilanModalOpen(true);
        }}
      />
    </>
  );
}

// Wrapper with Suspense
export default function Page({ params }: { params: Promise<{ lang: string }> }) {
  const [resolvedParams, setResolvedParams] = React.useState<{ lang: string } | null>(null);

  React.useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  if (!resolvedParams) {
    return <MedicalLoader fullScreen />;
  }

  return (
    <Suspense fallback={<MedicalLoader fullScreen />}>
      <AnalysesCatalogPageContents params={resolvedParams} />
    </Suspense>
  );
}
