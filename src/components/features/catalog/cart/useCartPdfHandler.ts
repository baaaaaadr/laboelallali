"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
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

/** Aperçu PDF actuellement affiché (PC uniquement). */
export interface PdfPreview {
  url: string;
  fileName: string;
}

/**
 * Hook partagé pour le téléchargement / aperçu PDF du devis.
 * Encapsule :
 *   - le check d'authentification (user + profile complétés)
 *   - la redirection vers /login si non auth
 *   - la construction des données PDF à partir du cartView (exclusions filtrées)
 *   - le comportement adaptatif :
 *       • Mobile  → téléchargement direct (comportement historique).
 *       • PC      → génère le PDF, l'affiche d'abord dans une grande modale
 *                   d'aperçu, puis laisse l'utilisateur télécharger.
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

  // Détection mobile vs PC (même heuristique que /contact et la page d'accueil).
  const [isMobile, setIsMobile] = useState(true);
  useEffect(() => {
    const checkMobile = () => {
      const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const widthMobile = window.innerWidth < 768;
      setIsMobile(uaMobile || widthMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // État de l'aperçu PDF (PC uniquement).
  const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  // Révoque l'object URL quand on ferme l'aperçu ou au démontage.
  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revokePreviewUrl(), [revokePreviewUrl]);

  const closePdfPreview = useCallback(() => {
    revokePreviewUrl();
    setPdfPreview(null);
  }, [revokePreviewUrl]);

  /** Construit les inputs PDF depuis le cartView (exclus filtrés). */
  const buildPdfOptions = useCallback(() => {
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

    return {
      bilans,
      analyses,
      totalCost: cartView.total,
      currencyLabel,
      maxJeune: preparationRules.maxJeune,
      maxDRR: preparationRules.maxDRR,
      sampleTypes: preparationRules.sampleTypes,
      specialInstructions: preparationRules.specialInstructions,
      patientName: userProfile?.fullName,
      patientPhone: userProfile?.phone,
    };
  }, [cartView, preparationRules, currencyLabel, userProfile]);

  const handleDownloadPdf = useCallback(async () => {
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

    // Mobile : téléchargement direct, comme avant.
    if (isMobile) {
      void generateDevisPdf({ ...buildPdfOptions(), download: true });
      return;
    }

    // PC : génère le PDF puis l'affiche dans une modale d'aperçu.
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const { blob, fileName } = await generateDevisPdf({
        ...buildPdfOptions(),
        download: false,
      });
      revokePreviewUrl();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPdfPreview({ url, fileName });
    } catch {
      toast.error(tc('cart.pdf_error', 'Une erreur est survenue lors de la génération du PDF.'));
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [
    authLoading,
    user,
    userProfile,
    isMobile,
    isGeneratingPdf,
    buildPdfOptions,
    revokePreviewUrl,
    onAuthFail,
    router,
    params,
    tc,
  ]);

  /** Déclenche le téléchargement du PDF actuellement affiché dans l'aperçu. */
  const downloadFromPreview = useCallback(() => {
    if (!pdfPreview) return;
    const a = document.createElement('a');
    a.href = pdfPreview.url;
    a.download = pdfPreview.fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfPreview]);

  return {
    handleDownloadPdf,
    isAuthReady: !authLoading,
    isGeneratingPdf,
    pdfPreview,
    closePdfPreview,
    downloadFromPreview,
  };
}
