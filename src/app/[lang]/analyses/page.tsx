// src/app/[lang]/analyses/page.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense, useCallback } from "react";
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
import CartSidePanel from "@/components/features/catalog/CartSidePanel";
import { getCategoryIcon } from '@/utils/iconMapper';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
// ChevronDown/ChevronUp went away with the "by category" accordion (demande n. 16).
import { Search, Star, BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { LAB_CONTACT } from "@/constants/contact";
import MedicalLoader from "@/components/ui/MedicalLoader";
import { computeCartView } from "@/lib/cart/cartView";
import { toggleBilanCompositionExclusion } from "@/lib/cart/cartItem";

const normalizeId = (id: string) => id.replace(/\s+/g, '').toUpperCase();

// The catalog is language-independent — each entry carries BOTH its FR and AR
// fields, so switching language only needs a re-render, not a refetch. Because
// changing language remounts the whole [lang] subtree, we keep the fetched catalog
// in a module-level cache that survives that remount (otherwise the ~324-doc
// Firestore fetch runs again every fr↔ar switch). Memory only; a full page reload
// refetches (picks up any catalog change).
let catalogCache: { analyses: AnalyseItem[]; bilans: BilanItem[] } | null = null;

// Tab display order and the tab opened by default (demande n. 16: the lab asked
// for the two tabs to swap places). THIS IS THE SINGLE REVERT POINT — to put the
// packaged bilans back in front, set ['bilans', 'all'] and DEFAULT_TAB = 'bilans'.
// The ids themselves are contractual: `?tab=bilans` is linked from CheckupReminder,
// MainServices, UniversalSearchModal and the ServicesHub tile — never rename them.
const TAB_ORDER = ['all', 'bilans'] as const;
const DEFAULT_TAB = 'all';

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

      // Reuse the already-fetched catalog (e.g. after a language-switch remount)
      // instead of hitting Firestore again — just re-render with the other language.
      // NOTE: `tsc --noEmit` mis-types `catalogCache` as `never` in this file due to
      // the pre-existing i18next TS2589 recursion cascade (see next.config.js
      // `ignoreBuildErrors`); the runtime type/logic is correct and `next build` passes.
      if (catalogCache) {
        onErrorOccurred(null);
        onDataFetched(catalogCache.analyses, catalogCache.bilans);
        onLoadingStateChange(false);
        return;
      }

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

  // State variables (seeded from the module cache so a language-switch remount
  // shows the catalog instantly instead of a loader + refetch).
  const [analyses, setAnalyses] = useState<AnalyseItem[]>(() => catalogCache?.analyses ?? []);
  const [bilans, setBilans] = useState<BilanItem[]>(() => catalogCache?.bilans ?? []);
  const [loading, setLoading] = useState<boolean>(() => !catalogCache);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<CartItem[]>([]);
  const [bilanModalOpen, setBilanModalOpen] = useState(false);
  const [selectedBilanForDetails, setSelectedBilanForDetails] = useState<BilanItem | null>(null);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [selectedAnalysisForDetails, setSelectedAnalysisForDetails] = useState<AnalyseItem | null>(null);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [cartInitialTab, setCartInitialTab] = useState<'devis' | 'preparation'>('devis');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const hasPanelAutoOpened = useRef(false);
  const ITEMS_PER_PAGE = 24;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // NEW: Tabs state
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const qParam = searchParams.get('q');
  // Lazy init rather than "default then correct in an effect": with DEFAULT_TAB
  // now 'all', a deep link on ?tab=bilans would visibly flash the full catalogue
  // for one frame before switching.
  const [activeTab, setActiveTab] = useState<string>(
    () => (tabParam === 'bilans' || tabParam === 'all' ? tabParam : DEFAULT_TAB)
  );

  // Keep following the query param if it changes after mount (client navigation)
  useEffect(() => {
    if (tabParam && (tabParam === 'all' || tabParam === 'bilans')) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Pre-fill search from ?q= URL param (e.g. coming from universal search modal)
  useEffect(() => {
    if (qParam) setSearchTerm(qParam);
  }, [qParam]);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');

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

  // Ref to guard against overwriting localStorage with [] before the initial load has run
  const isFirstLoad = useRef(true);

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

  // Combined load-then-save effect.
  // On the very first call: load from localStorage and return early (never write [] on mount).
  // On all subsequent calls: save the current cart.
  // This prevents the race where the save runs with [] before the load has updated state.
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedItems(parsed);
            return; // state will update → effect re-runs → save happens then
          }
        }
      } catch {}
      return; // nothing to load, nothing to save on initial empty mount
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedItems));
    } catch {}
  }, [selectedItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open side panel on first item add (desktop only, one-shot)
  useEffect(() => {
    if (selectedItems.length > 0 && !hasPanelAutoOpened.current) {
      hasPanelAutoOpened.current = true;
      if (window.matchMedia('(min-width: 1024px)').matches) {
        setIsPanelOpen(true);
      }
    }
  }, [selectedItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close panel when viewport drops below lg breakpoint (1024px)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => { if (!e.matches) setIsPanelOpen(false); };
    mq.addEventListener('change', handler);
    if (!mq.matches) setIsPanelOpen(false);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Search function
  const searchInItem = useCallback((item: AnalyseItem | BilanItem, term: string): boolean => {
    const searchLower = term.toLowerCase();

    if ('Nom_Patient_FR' in item) {
      // AnalyseItem
      const name = isArabic ? item.Nom_Patient_AR : item.Nom_Patient_FR;
      const tags = (isArabic ? item.Tags_AR : item.Tags_FR) ?? [];
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
      // popularity — the default and only other sort since 'category' was removed
      sorted.sort((a, b) => (b.Nombre_Demandes || 0) - (a.Nombre_Demandes || 0));
    }

    return sorted;
  }, [filteredAnalyses, sortBy, isArabic, lang]);

  // Tabs, rendered in TAB_ORDER (see the constant at the top of the file for the
  // revert instructions). Category tabs stay disabled — see the note below.
  const tabs: TabItem[] = useMemo(() => {
    const defs: Record<string, TabItem> = {
      bilans: {
        id: 'bilans',
        label: t('tabs.our_bilans', 'Nos Bilans'),
        icon: Star,
        count: sortedBilans.length
      },
      all: {
        id: 'all',
        label: t('tabs.full_catalog', 'Catalogue Complet'),
        icon: BookOpen,
        count: sortedAnalyses.length
      }
    };

    // Category tabs were never enabled (they would push tabs.length past 3 and
    // switch TabsNavigation back to its scrollable rail — which is the intended
    // behaviour, nothing to change there if they ever come back).

    return TAB_ORDER.map((id) => defs[id]);
  }, [sortedBilans, sortedAnalyses, t]);


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
    setIsCartModalOpen(false);
  }, []);

  // Frais de prélèvement fixes (acte de prise de sang)
  const SAMPLING_FEE = 20;

  // Vue unifiée du panier — source de vérité pour total, lignes, dédup, exclusions
  const cartView = useMemo(
    () => computeCartView(selectedItems, normalizedAnalysesMap, SAMPLING_FEE),
    [selectedItems, normalizedAnalysesMap]
  );
  const totalCost = cartView.total;

  // Bascule l'exclusion d'un code d'analyse à l'intérieur d'un bilan du panier
  const handleToggleBilanComposition = useCallback(
    (bilanId: string, code: string) => {
      setSelectedItems(prev => toggleBilanCompositionExclusion(prev, bilanId, code));
    },
    []
  );

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

  // Shared WhatsApp send handler — used by both CartDetailsModal and CartSidePanel
  const handleWhatsAppSend = useCallback(() => {
    const whatsappTranslations = {
      greeting: t('analyses_catalog.selection.whatsapp_message.greeting', 'Bonjour Laboratoire El Allali,'),
      intro: t('analyses_catalog.selection.whatsapp_message.intro', 'Je suis intéressé(e) par les analyses suivantes :'),
      analysisItemPrefix: t('analyses_catalog.selection.whatsapp_message.analysis_item_prefix', '- '),
      totalLabel: t('analyses_catalog.selection.whatsapp_message.total_label', 'Total estimé :'),
      currency: t('analyses_catalog.selection.whatsapp_message.currency', 'MAD'),
      closingRemark: t('analyses_catalog.selection.whatsapp_message.closing_remark', "Pouvez-vous me donner plus d'informations ?"),
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
  }, [selectedItems, totalCost, isArabic, t]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (inView && !loading && displayedAnalyses.length > visibleCount) {
      setVisibleCount(prev => prev + ITEMS_PER_PAGE);
    }
  }, [inView, loading, displayedAnalyses.length, visibleCount]);

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

      <div
        className="bg-[var(--background-default)] dark:bg-[var(--background-default)]"
        style={isArabic ? {
          paddingLeft: isPanelOpen ? '360px' : '0px',
          transition: 'padding-left 0.3s ease-in-out',
        } : {
          paddingRight: isPanelOpen ? '360px' : '0px',
          transition: 'padding-right 0.3s ease-in-out',
        }}
      >
        <div className="min-h-screen pb-32 lg:pb-8">
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
          className="sticky top-[var(--header-total-height)] z-40 bg-[var(--background-default)] shadow-sm border-b border-gray-200 dark:border-[var(--border-default)]"
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
                    onSortChange={setSortBy}
                    isRtl={isArabic}
                  />

                  {/* Flat list (popularity / A-Z). The alternative "by category"
                      rendering that used to sit here was removed together with the
                      « Catégorie » sort option — see docs/pages/analyses.md. */}
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
      </div>

      {/* Fixed desktop side panel — below site header, independent scroll.
          --header-total-height inclut l'encoche de la barre d'état : en PWA iPad
          en paysage (≥1024px), un 64px en dur ferait passer le panneau dessous. */}
      <div
        className="hidden lg:block fixed z-30 overflow-hidden"
        style={{
          top: 'var(--header-total-height)',
          right: isArabic ? 'auto' : '0',
          left: isArabic ? '0' : 'auto',
          height: 'calc(100vh - var(--header-total-height))',
          width: isPanelOpen ? '360px' : '0',
          transition: 'width 0.3s ease-in-out',
        }}
      >
        <div className="w-[360px] h-full">
          <CartSidePanel
            selectedItems={selectedItems}
            cartView={cartView}
            onRemoveItem={removeItemFromCart}
            onClearCart={clearCart}
            onWhatsAppSend={handleWhatsAppSend}
            onToggleBilanComposition={handleToggleBilanComposition}
            currencyLabel={isArabic ? 'درهم' : 'MAD'}
            isRtl={isArabic}
            normalizedAnalysesMap={normalizedAnalysesMap}
            onViewAnalysisDetails={(analysis) => {
              setSelectedAnalysisForDetails(analysis);
              setAnalysisModalOpen(true);
            }}
          />
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

      {/* Cart Details Modal — mobile only (panel handles desktop) */}
      <CartDetailsModal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        selectedItems={selectedItems}
        cartView={cartView}
        onRemoveItem={removeItemFromCart}
        onClearCart={clearCart}
        onWhatsAppSend={handleWhatsAppSend}
        onToggleBilanComposition={handleToggleBilanComposition}
        currencyLabel={isArabic ? 'درهم' : 'MAD'}
        isRtl={isArabic}
        normalizedAnalysesMap={normalizedAnalysesMap}
        initialTab={cartInitialTab}
        onViewAnalysisDetails={(analysis) => {
          setSelectedAnalysisForDetails(analysis);
          setAnalysisModalOpen(true);
        }}
      />

      {/* Desktop panel toggle tab — fixed to viewport edge, slides with panel */}
      <button
        onClick={() => setIsPanelOpen(v => !v)}
        className={`hidden lg:flex fixed z-40 top-1/2 -translate-y-1/2 items-center justify-center w-6 h-16 bg-[#800020] dark:bg-[var(--brand-primary)] text-white shadow-lg ${isArabic ? 'rounded-r-lg' : 'rounded-l-lg'}`}
        style={{
          right: isArabic ? 'auto' : (isPanelOpen ? '360px' : '0'),
          left: isArabic ? (isPanelOpen ? '360px' : '0') : 'auto',
          transition: 'right 0.3s ease-in-out, left 0.3s ease-in-out',
        }}
        aria-label={isPanelOpen
          ? t('analyses_catalog.selection.close_panel', 'Réduire')
          : t('analyses_catalog.selection.open_panel', 'Voir le panier')}
      >
        {isArabic
          ? (isPanelOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />)
          : (isPanelOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)
        }
        {!isPanelOpen && selectedItems.length > 0 && (
          <span className={`absolute -top-2 ${isArabic ? '-right-2' : '-left-2'} text-[10px] bg-white text-[#800020] rounded-full w-4 h-4 flex items-center justify-center font-bold`}>
            {selectedItems.length}
          </span>
        )}
      </button>
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
