"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import MedicalLoader from '@/components/ui/MedicalLoader';
import GroupedJourneyPage from '@/components/features/journey/GroupedJourneyPage';
import { variantFromService } from '@/lib/journey/route';

/**
 * Parcours patient regroupé en QUATRE blocs — seconde page de TEST.
 *
 * Coquille strictement identique à celle de `/test-rdv` : résolution des
 * paramètres et lecture de `?service=`, rien d'autre. Seul le composant rendu
 * change (`GroupedJourneyPage` au lieu de `PatientJourneyPage`). Les deux
 * partagent l'intégralité de leur logique — état, panier, brouillon,
 * validation, écriture Firestore, e-mail, WhatsApp — de sorte que la
 * comparaison porte sur la SEULE disposition. Voir `docs/pages/test-rdv2.md`.
 *
 * ⚠ `useSearchParams()` impose une frontière `<Suspense>` et sort la page du
 * rendu statique — même motif que `/analyses` et `/test-rdv`.
 *
 * ⚠ Page non indexable : le `noindex` vit dans `layout.tsx` (composant SERVEUR).
 */
function TestRdv2Contents({ lang }: { lang: string }) {
  const searchParams = useSearchParams();
  const variant = variantFromService(searchParams.get('service'));
  return <GroupedJourneyPage lang={lang} variant={variant} />;
}

export default function Page({ params }: { params: Promise<{ lang: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ lang: string } | null>(null);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  if (!resolvedParams) return <MedicalLoader fullScreen />;

  return (
    <Suspense fallback={<MedicalLoader fullScreen />}>
      <TestRdv2Contents lang={resolvedParams.lang} />
    </Suspense>
  );
}
