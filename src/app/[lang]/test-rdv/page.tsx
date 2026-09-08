"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import MedicalLoader from '@/components/ui/MedicalLoader';
import PatientJourneyPage from '@/components/features/journey/PatientJourneyPage';
import { variantFromService } from '@/lib/journey/route';

/**
 * Parcours patient unifié — page de TEST.
 *
 * Cette coquille ne contient rien d'autre que la résolution des paramètres et la
 * lecture de `?service=`. C'est ce qui rendra l'étape finale triviale : le jour
 * où `/rendez-vous` et `/glabo` afficheront ce parcours, chacune se contentera
 * de rendre `<PatientJourneyPage lang variant="lab" />` ou `variant="home"`,
 * la variante venant alors de la ROUTE et non de l'URL.
 *
 * ⚠ `useSearchParams()` impose une frontière `<Suspense>` et sort la page du
 * rendu statique — même motif que `/analyses`.
 *
 * ⚠ Page non indexable tant qu'elle est en test : exclue du sitemap
 * (`next-sitemap.config.js`) et marquée `noindex` ci-dessous. Un tunnel de
 * réservation à moitié construit, indexé au nom d'un laboratoire d'analyses
 * médicales, est un vrai risque d'image.
 */

function TestRdvContents({ lang }: { lang: string }) {
  const searchParams = useSearchParams();
  const variant = variantFromService(searchParams.get('service'));
  return <PatientJourneyPage lang={lang} variant={variant} />;
}

export default function Page({ params }: { params: Promise<{ lang: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ lang: string } | null>(null);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // `noindex` posé côté client : la page est un composant client, elle ne peut
  // pas exporter `metadata`. Retiré le jour où elle deviendra /rendez-vous.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  if (!resolvedParams) return <MedicalLoader fullScreen />;

  return (
    <Suspense fallback={<MedicalLoader fullScreen />}>
      <TestRdvContents lang={resolvedParams.lang} />
    </Suspense>
  );
}
