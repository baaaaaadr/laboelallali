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
 * ⚠ Page non indexable tant qu'elle est en test. Le `noindex` vit dans
 * `layout.tsx` (composant SERVEUR) et non ici : un composant client ne peut pas
 * exporter `metadata`, et la version précédente injectait la balise en
 * JavaScript — donc absente du HTML servi, vérifié en production. S'y ajoutent
 * l'exclusion du sitemap et une règle `Disallow` dans `robots.txt`. Un tunnel de
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

  if (!resolvedParams) return <MedicalLoader fullScreen />;

  return (
    <Suspense fallback={<MedicalLoader fullScreen />}>
      <TestRdvContents lang={resolvedParams.lang} />
    </Suspense>
  );
}
