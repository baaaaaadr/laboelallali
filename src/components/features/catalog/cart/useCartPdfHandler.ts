"use client";

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { generateDevisPdf } from '@/lib/pdf/generateDevisPdf';
import type { CartView } from '@/lib/cart/cartView';
import type { PreparationRules } from '@/hooks/usePreparationRules';

interface UseCartPdfHandlerOptions {
  cartView: CartView;
  preparationRules: PreparationRules;
  currencyLabel: string;
  /** Optional hook called when auth check fails (used by modals to close themselves). */
  onAuthFail?: () => void;
}

/**
 * Hook partagé pour le téléchargement PDF du devis.
 * Encapsule :
 *   - le check d'authentification (user + profile complétés)
 *   - la redirection vers /login si non auth
 *   - la construction des données PDF à partir du cartView (exclusions filtrées)
 */
export function useCartPdfHandler({
  cartView,
  preparationRules,
  currencyLabel,
  onAuthFail,
}: UseCartPdfHandlerOptions) {
  const { t: tc } = useTranslation('catalog');
  const router = useRouter();
  const params = useParams<{ lang: string }>();
  const { user, userProfile, loading: authLoading } = useAuth();

  const handleDownloadPdf = useCallback(() => {
    if (authLoading) {
      toast(tc('cart.session_loading', 'Vérification de votre session…'));
      return;
    }
    if (!user || !userProfile) {
      onAuthFail?.();
      toast.error(
        tc(
          'cart.login_required_for_pdf',
          'Créez un compte gratuit pour télécharger votre devis PDF !'
        )
      );
      router.push(`/${params?.lang ?? 'fr'}/login`);
      return;
    }

    // Construction des inputs PDF depuis le cartView (exclus filtrés)
    const bilans = cartView.lines
      .filter(line => line.type === 'bilan')
      .map(line => ({
        name: line.displayName,
        price: line.effectivePrice,
        composition: (line.composition ?? [])
          .filter(c => !c.isExcluded)
          .map(c => ({ name: c.name, price: c.price })),
      }));

    const analyses = cartView.lines
      .filter(line => line.type === 'analyse')
      .map(line => ({
        name: line.displayName,
        price: line.cartItem.type === 'analyse' ? line.cartItem.item.Prix_Dhs : 0,
      }));

    void generateDevisPdf({
      bilans,
      analyses,
      totalCost: cartView.total,
      currencyLabel,
      maxJeune: preparationRules.maxJeune,
      maxDRR: preparationRules.maxDRR,
      sampleTypes: preparationRules.sampleTypes,
      specialInstructions: preparationRules.specialInstructions,
      patientName: userProfile.fullName,
      patientPhone: userProfile.phone,
    });
  }, [
    authLoading,
    user,
    userProfile,
    cartView,
    preparationRules,
    currencyLabel,
    onAuthFail,
    router,
    params,
    tc,
  ]);

  return { handleDownloadPdf, isAuthReady: !authLoading };
}
