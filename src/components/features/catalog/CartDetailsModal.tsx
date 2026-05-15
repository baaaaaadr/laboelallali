"use client";

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  X, Trash2, ShoppingCart, MessageCircle, Download,
  FileText, ClipboardList, TestTube, AlertTriangle,
  CheckCircle2, CalendarCheck, Info
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CartItem, AnalyseItem, BilanItem } from './AnalysisCard';
import { usePreparationRules } from '@/hooks/usePreparationRules';
import { generateDevisPdf } from '@/lib/pdf/generateDevisPdf';

type TabId = 'devis' | 'preparation';

interface CartDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: CartItem[];
  totalCost: number;
  onRemoveItem: (item: CartItem) => void;
  onClearCart: () => void;
  onWhatsAppSend: () => void;
  currencyLabel: string;
  isRtl?: boolean;
  onViewAnalysisDetails: (analysis: AnalyseItem) => void;
  onViewBilanDetails: (bilan: BilanItem) => void;
  normalizedAnalysesMap?: Map<string, AnalyseItem>;
  initialTab?: TabId;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CartDetailsModal({
  isOpen,
  onClose,
  selectedItems,
  totalCost,
  onRemoveItem,
  onClearCart,
  onWhatsAppSend,
  currencyLabel,
  isRtl = false,
  onViewAnalysisDetails,
  onViewBilanDetails,
  normalizedAnalysesMap,
  initialTab,
}: CartDetailsModalProps) {
  const { t } = useTranslation('common');
  const { t: tc } = useTranslation('catalog');
  const locale = isRtl ? 'ar-MA' : 'fr-MA';

  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'devis');

  // Reset to initialTab whenever the modal opens
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab ?? 'devis');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const { maxJeune, maxDRR, sampleTypes, specialInstructions } =
    usePreparationRules(selectedItems, normalizedAnalysesMap);

  const requiresFasting = maxJeune > 0;
  const bilans = selectedItems.filter(item => item.type === 'bilan');
  const analyses = selectedItems.filter(item => item.type === 'analyse');

  const handleItemClick = (item: CartItem) => {
    if (item.type === 'analyse') onViewAnalysisDetails(item.item);
    else onViewBilanDetails(item.item);
  };

  const getItemName = (item: CartItem) =>
    item.type === 'analyse'
      ? (isRtl ? item.item.Nom_Patient_AR : item.item.Nom_Patient_FR)
      : (isRtl ? item.item.Nom_Bilan_AR : item.item.Nom_Bilan_FR);

  const getItemCategory = (item: CartItem) =>
    item.type === 'analyse'
      ? (isRtl ? item.item.Categorie_AR : item.item.Categorie_FR)
      : t('analyses_catalog.selection.bilans_section', 'Bilan');

  const getItemPrice = (item: CartItem): number => {
    if (item.type === 'analyse') return item.item.Prix_Dhs;
    if (!normalizedAnalysesMap) return item.item.Prix_Affiche_Dhs;
    return item.item.Composition_Codes.reduce((sum, code) => {
      const key = code.replace(/\s+/g, '').toUpperCase();
      return sum + (normalizedAnalysesMap.get(key)?.Prix_Dhs ?? 0);
    }, 0);
  };

  const handleDownloadPdf = () => {
    void generateDevisPdf({
      bilans: bilans.map(item => ({
        name: item.item.Nom_Bilan_FR,
        price: getItemPrice(item),
      })),
      analyses: analyses.map(item => ({
        name: item.item.Nom_Patient_FR,
        price: getItemPrice(item),
      })),
      totalCost,
      currencyLabel,
      maxJeune,
      maxDRR,
      sampleTypes,
      specialInstructions,
    });
  };

  // Shared item row renderer (used in both bilans and analyses sections)
  const renderItemRow = (item: CartItem, key: string) => (
    <div key={key} className="flex items-center justify-between py-3 border-b border-[var(--border-default)] group">
      <button
        onClick={() => handleItemClick(item)}
        className="flex-1 flex items-start gap-3 text-left hover:bg-[var(--background-secondary)] p-2 rounded-lg transition-colors"
      >
        <div className="flex-1">
          <p className="font-semibold text-[var(--text-primary)] group-hover:text-[#E3004F] transition-colors">
            {getItemName(item)}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">{getItemCategory(item)}</p>
        </div>
        <span className="text-lg font-bold text-[#E3004F] flex-shrink-0">
          {getItemPrice(item).toLocaleString(locale)} {currencyLabel}
        </span>
      </button>
      <button
        onClick={e => { e.stopPropagation(); onRemoveItem(item); }}
        className="p-2 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--status-error)] transition-colors ml-2 flex-shrink-0"
        aria-label={t('analyses_catalog.selection.remove_item', 'Retirer')}
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </div>
  );

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose} dir={isRtl ? 'rtl' : 'ltr'}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-end md:items-center justify-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-full md:translate-y-0 md:scale-95"
            enterTo="opacity-100 translate-y-0 md:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 md:scale-100"
            leaveTo="opacity-0 translate-y-full md:translate-y-0 md:scale-95"
          >
            <Dialog.Panel className="w-full h-[100dvh] md:h-auto md:max-w-2xl md:max-h-[92vh] flex flex-col bg-[var(--background-card)] shadow-2xl md:rounded-2xl overflow-hidden border border-[var(--border-default)]">

              {/* ── Header: tabs + actions on one line ── */}
              <div className="flex items-center border-b border-[var(--border-default)] bg-[var(--background-card)] flex-shrink-0">
                {/* Tabs (fill available space) */}
                <div className="flex flex-1 min-w-0">
                  {([
                    { id: 'devis' as TabId, label: tc('cart.tab_devis', 'Mon Devis'), Icon: FileText },
                    { id: 'preparation' as TabId, label: tc('cart.tab_preparation', 'Ma Préparation'), Icon: ClipboardList },
                  ] as const).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-4 px-2 text-sm font-semibold transition-colors border-b-2 ${
                        activeTab === id
                          ? 'border-[var(--color-fuchsia-accent)] text-[var(--color-fuchsia-accent)]'
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate max-[360px]:hidden">{label}</span>
                    </button>
                  ))}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 px-2 border-b-2 border-transparent py-4 flex-shrink-0">
                  {selectedItems.length > 0 && (
                    <button
                      onClick={onClearCart}
                      className="p-2 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--status-error)] transition-colors"
                      aria-label={t('analyses_catalog.selection.clear_all', 'Tout supprimer')}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--text-secondary)] transition-colors"
                    aria-label="Fermer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* ── Scrollable Body ── */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {selectedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ShoppingCart className="h-16 w-16 text-[var(--text-tertiary)] mb-4" />
                    <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                      {t('analyses_catalog.selection.cart_empty', 'Votre panier est vide')}
                    </p>
                    <button
                      onClick={onClose}
                      className="mt-4 px-6 py-2 bg-[#E3004F] text-white rounded-lg hover:bg-[#c20042] transition-colors"
                    >
                      {t('analyses_catalog.selection.continue_shopping', 'Continuer mes achats')}
                    </button>
                  </div>

                ) : activeTab === 'devis' ? (
                  /* ── Tab 1: Devis ── */
                  <div className="space-y-4" role="list">
                    {/* Total breakdown — lives inside the devis tab */}
                    <div className="rounded-xl border border-[#E3004F]/20 bg-[#E3004F]/5 dark:bg-[#E3004F]/10 px-4 py-3 space-y-1.5">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-secondary)]">
                          {t('analyses_catalog.selection.subtotal', 'Sous-total')}
                        </span>
                        <span className="font-medium text-[var(--text-primary)]">
                          {(totalCost - 20).toLocaleString(locale)} {currencyLabel}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-secondary)]">
                          {t('analyses_catalog.selection.sampling_fee', 'Frais de prélèvement')}
                        </span>
                        <span className="font-medium text-[var(--text-primary)]">20 {currencyLabel}</span>
                      </div>
                      <div className="border-t border-[var(--border-default)] pt-2 flex justify-between items-center">
                        <span className="text-base font-semibold text-[var(--text-primary)]">
                          {t('analyses_catalog.selection.total', 'Total')}
                        </span>
                        <span className="text-xl font-bold text-[#E3004F]">
                          {totalCost.toLocaleString(locale)} {currencyLabel}
                        </span>
                      </div>
                    </div>

                    {bilans.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
                          {t('analyses_catalog.selection.bilans_section', 'Bilans')} ({bilans.length})
                        </h4>
                        <div className="space-y-1">
                          {bilans.map((item, i) => renderItemRow(item, `bilan-${item.item.id}-${i}`))}
                        </div>
                      </div>
                    )}
                    {analyses.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
                          {t('analyses_catalog.selection.analyses_section', 'Analyses')} ({analyses.length})
                        </h4>
                        <div className="space-y-1">
                          {analyses.map((item, i) => renderItemRow(item, `analyse-${item.item.id}-${i}`))}
                        </div>
                      </div>
                    )}
                  </div>

                ) : (
                  /* ── Tab 2: Fiche de Préparation (compact) ── */
                  <div className="space-y-3">

                    {/* Documents — compact list */}
                    <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
                      <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 dark:bg-blue-900/50 border-b border-[var(--border-default)]">
                        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-300 flex-shrink-0" />
                        <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                          {tc('preparation_summary.card_documents_title', 'Documents Administratifs')}
                        </h3>
                      </div>
                      <ul className="px-4 py-3 space-y-2">
                        {[
                          tc('preparation_summary.cin', "Carte d'Identité Nationale (CIN)"),
                          tc('preparation_summary.mutuelle', 'Carte de Mutuelle / Assurance'),
                          tc('preparation_summary.ordonnance', 'Ordonnance médicale (si vous en avez une)'),
                        ].map((item, i) => (
                          <li key={i} className="flex items-center gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            <span className="text-sm text-[var(--text-primary)]">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Prélèvements — framed card with badge row */}
                    {sampleTypes.length > 0 && (
                      <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-teal-50 dark:bg-teal-900/50 border-b border-[var(--border-default)]">
                          <TestTube className="h-4 w-4 text-teal-600 dark:text-teal-300 flex-shrink-0" />
                          <h3 className="font-semibold text-sm text-teal-900 dark:text-teal-100">
                            {tc('preanalytic.type_label', 'Type de prélèvement')}
                          </h3>
                        </div>
                        <div className="px-4 py-3 flex flex-wrap gap-2">
                          {sampleTypes.map((type, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-700">
                              <TestTube className="h-3 w-3" />
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Préparation */}
                    <div className="space-y-2">
                      {/* Normal instructions — grouped in one neutral bubble */}
                      {specialInstructions.length > 0 && (
                        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--background-default)] px-4 py-3 space-y-2">
                          {specialInstructions.map((instr, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <Info className="h-3.5 w-3.5 text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-[var(--text-primary)] leading-snug">{instr}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Fasting — orange alert or quiet green line */}
                      {requiresFasting ? (
                        <div className="rounded-xl border border-orange-400 dark:border-orange-600 bg-orange-100 dark:bg-orange-900/30 px-4 py-3 flex items-start gap-2.5">
                          <AlertTriangle className="h-4 w-4 text-orange-700 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm font-semibold text-orange-900 dark:text-orange-200 leading-snug">
                            {tc('preparation_summary.fasting_warning', 'Jeûne strict de {{hours}} heures requis avant votre prise de sang.', { hours: maxJeune })}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 px-1 py-1">
                          <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                          <p className="text-sm text-[var(--text-secondary)]">
                            {tc('preparation_summary.fasting_ok', 'Aucun jeûne obligatoire pour vos analyses.')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Délai & Total — single row */}
                    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--background-default)]">
                      <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                        <CalendarCheck className="h-4 w-4 flex-shrink-0 text-[var(--text-tertiary)] mt-0.5" />
                        <span className="leading-snug">
                          {maxDRR === 0
                            ? tc('preparation_summary.delay_same_day', 'Résultats disponibles le jour même.')
                            : tc('preparation_summary.delay_days', 'Résultats sous {{days}} jour(s).', { days: maxDRR })}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-[#E3004F] flex-shrink-0 whitespace-nowrap">
                        {totalCost.toLocaleString(locale)} {currencyLabel}
                      </span>
                    </div>

                  </div>
                )}
              </div>

              {/* ── Footer: WhatsApp + PDF on one row ── */}
              {selectedItems.length > 0 && (
                <div className="border-t border-[var(--border-default)] px-4 py-3 bg-[var(--background-card)] flex-shrink-0 flex gap-2">
                  <button
                    onClick={onWhatsAppSend}
                    className="flex-1 bg-[var(--status-success)] dark:bg-transparent dark:border dark:border-[var(--status-success)] text-white dark:text-[var(--status-success)] hover:brightness-90 dark:hover:bg-[var(--status-success)]/10 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-colors shadow-md dark:shadow-none active:scale-[0.98]"
                  >
                    <MessageCircle className="h-4 w-4 flex-shrink-0" />
                    {t('analyses_catalog.selection.send_whatsapp', 'Envoyer via WhatsApp')}
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)] border border-[var(--border-default)] transition-colors active:scale-[0.98] flex-shrink-0"
                    aria-label={tc('cart.download_pdf', 'Télécharger / Imprimer PDF')}
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">{tc('cart.download_pdf', 'PDF')}</span>
                    <span className="sm:hidden">PDF</span>
                  </button>
                </div>
              )}

            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

export default CartDetailsModal;
