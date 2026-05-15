"use client";

import React, { useState } from 'react';
import {
  Trash2, ShoppingCart, MessageCircle, Download,
  FileText, ClipboardList, TestTube, AlertTriangle,
  CheckCircle2, CalendarCheck, Info
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CartItem, AnalyseItem, BilanItem } from './AnalysisCard';
import { usePreparationRules } from '@/hooks/usePreparationRules';
import { generateDevisPdf } from '@/lib/pdf/generateDevisPdf';

type TabId = 'devis' | 'preparation';

interface CartSidePanelProps {
  selectedItems: CartItem[];
  totalCost: number;
  onRemoveItem: (item: CartItem) => void;
  onClearCart: () => void;
  onWhatsAppSend: () => void;
  currencyLabel: string;
  isRtl?: boolean;
  normalizedAnalysesMap?: Map<string, AnalyseItem>;
  onViewAnalysisDetails: (analysis: AnalyseItem) => void;
  onViewBilanDetails: (bilan: BilanItem) => void;
}

export function CartSidePanel({
  selectedItems,
  totalCost,
  onRemoveItem,
  onClearCart,
  onWhatsAppSend,
  currencyLabel,
  isRtl = false,
  normalizedAnalysesMap,
  onViewAnalysisDetails,
  onViewBilanDetails,
}: CartSidePanelProps) {
  const { t } = useTranslation('common');
  const { t: tc } = useTranslation('catalog');
  const locale = isRtl ? 'ar-MA' : 'fr-MA';

  const [activeTab, setActiveTab] = useState<TabId>('devis');

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

  const renderItemRow = (item: CartItem, key: string) => (
    <div key={key} className="flex items-center justify-between py-3 border-b border-[var(--border-default)] group">
      <button
        onClick={() => handleItemClick(item)}
        className="flex-1 flex items-start gap-3 text-left hover:bg-[var(--background-secondary)] p-2 rounded-lg transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-[#E3004F] transition-colors truncate">
            {getItemName(item)}
          </p>
          <p className="text-xs text-[var(--text-secondary)] truncate">{getItemCategory(item)}</p>
        </div>
        <span className="text-sm font-bold text-[#E3004F] flex-shrink-0 ml-1">
          {getItemPrice(item).toLocaleString(locale)} {currencyLabel}
        </span>
      </button>
      <button
        onClick={e => { e.stopPropagation(); onRemoveItem(item); }}
        className="p-1.5 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--status-error)] transition-colors ml-1 flex-shrink-0"
        aria-label={t('analyses_catalog.selection.remove_item', 'Retirer')}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div
      className={`flex flex-col h-full bg-[var(--background-card)] ${isRtl ? 'border-r' : 'border-l'} border-[var(--border-default)] shadow-xl`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* ── Sticky header: tabs + clear ── */}
      <div className="sticky top-0 z-10 bg-[var(--background-card)] border-b border-[var(--border-default)] flex-shrink-0">
        <div className="flex items-center">
          {([
            { id: 'devis' as TabId, Icon: FileText },
            { id: 'preparation' as TabId, Icon: ClipboardList },
          ] as const).map(({ id, Icon }) => {
            const baseLabel = id === 'devis'
              ? tc('cart.tab_devis', 'Mon Devis')
              : tc('cart.tab_preparation', 'Ma Préparation');
            const label = id === 'devis' && selectedItems.length > 0
              ? `${baseLabel} (${selectedItems.length})`
              : baseLabel;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 text-xs font-semibold transition-colors border-b-2 ${
                  activeTab === id
                    ? 'border-[var(--color-fuchsia-accent)] text-[var(--color-fuchsia-accent)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
          {selectedItems.length > 0 && (
            <button
              onClick={onClearCart}
              className="p-2 mx-1 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--status-error)] transition-colors flex-shrink-0"
              aria-label={t('analyses_catalog.selection.clear_all', 'Tout supprimer')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {selectedItems.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4">
            <ShoppingCart className="h-12 w-12 text-[var(--text-tertiary)] mb-3" />
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              {t('analyses_catalog.selection.cart_empty', 'Votre panier est vide')}
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {t('analyses_catalog.selection.empty_panel_hint', 'Ajoutez des analyses pour voir votre devis ici.')}
            </p>
          </div>

        ) : activeTab === 'devis' ? (
          /* ── Tab 1: Devis ── */
          <div className="space-y-4">
            <div className="rounded-xl border border-[#E3004F]/20 bg-[#E3004F]/5 dark:bg-[#E3004F]/10 px-4 py-3 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-secondary)]">
                  {t('analyses_catalog.selection.subtotal', 'Sous-total')}
                </span>
                <span className="font-medium text-[var(--text-primary)]">
                  {(totalCost - 20).toLocaleString(locale)} {currencyLabel}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-secondary)]">
                  {t('analyses_catalog.selection.sampling_fee', 'Frais de prélèvement')}
                </span>
                <span className="font-medium text-[var(--text-primary)]">20 {currencyLabel}</span>
              </div>
              <div className="border-t border-[var(--border-default)] pt-2 flex justify-between items-center">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {t('analyses_catalog.selection.total', 'Total')}
                </span>
                <span className="text-lg font-bold text-[#E3004F]">
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
          /* ── Tab 2: Préparation ── */
          <div className="space-y-3">
            {/* Documents */}
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

            {/* Prélèvements */}
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

            {/* Fasting + special instructions */}
            <div className="space-y-2">
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

            {/* Délai + total */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--background-default)]">
              <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <CalendarCheck className="h-4 w-4 flex-shrink-0 text-[var(--text-tertiary)] mt-0.5" />
                <span className="leading-snug text-xs">
                  {maxDRR === 0
                    ? tc('preparation_summary.delay_same_day', 'Résultats disponibles le jour même.')
                    : tc('preparation_summary.delay_days', 'Résultats sous {{days}} jour(s).', { days: maxDRR })}
                </span>
              </div>
              <span className="text-base font-bold text-[#E3004F] flex-shrink-0 whitespace-nowrap">
                {totalCost.toLocaleString(locale)} {currencyLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {selectedItems.length > 0 && (
        <div className="border-t border-[var(--border-default)] px-4 py-3 bg-[var(--background-card)] flex-shrink-0 flex gap-2">
          <button
            onClick={onWhatsAppSend}
            className="flex-1 bg-[var(--status-success)] dark:bg-transparent dark:border dark:border-[var(--status-success)] text-white dark:text-[var(--status-success)] hover:brightness-90 dark:hover:bg-[var(--status-success)]/10 py-2.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-colors shadow-md dark:shadow-none active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4 flex-shrink-0" />
            {t('analyses_catalog.selection.send_whatsapp', 'Envoyer via WhatsApp')}
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)] border border-[var(--border-default)] transition-colors active:scale-[0.98] flex-shrink-0"
            aria-label={tc('cart.download_pdf', 'Télécharger / Imprimer PDF')}
          >
            <Download className="h-4 w-4" />
            <span className="sr-only">PDF</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default CartSidePanel;
