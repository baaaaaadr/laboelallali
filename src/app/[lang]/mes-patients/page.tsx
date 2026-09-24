'use client';

/**
 * /[lang]/mes-patients — the prescribing doctor's space: the results of the
 * patients he prescribed for, and only those (the lab server enforces the
 * rule). See docs/pages/mes-patients.md.
 *
 * It is also the doctor INVITATION link the lab sends (24/09/2026): the same
 * URL shows the request form before activation, and his patients after.
 *
 * This page only decides WHO sees WHAT:
 *  - not signed in → login, then back here (`?redirect=`); the login page says
 *    why, and skips the patient onboarding request for this target;
 *  - signed in without a doctor access → `PractitionerAccessRequest`: the form
 *    « Demander mon accès médecin », or where his request stands (pending,
 *    refused), with a way to re-check (the profile is read once per session, so
 *    an access the lab just gave would not show without it) and the lab's
 *    contacts;
 *  - a doctor access whose code equals one of the account's PATIENT ids →
 *    a configuration error, never a call (the server would answer with the
 *    patient's own dossier, which would be shown as « Mes patients »);
 *  - otherwise → `PractitionerWorkspace`, keyed by uid + code.
 */
import React, { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Stethoscope } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import MedicalLoader from '@/components/ui/MedicalLoader';
import VerdictPanel from '@/components/ui/VerdictPanel';
import PractitionerWorkspace from '@/components/features/practitioner/PractitionerWorkspace';
import PractitionerAccessRequest from '@/components/features/practitioner/PractitionerAccessRequest';
import ResultsSpaceSwitch from '@/components/features/practitioner/ResultsSpaceSwitch';
import { readPractitioner, resolveIdentities } from '@/lib/results/identities';
import { doctorSpacePath } from '@/lib/practitioner/invitation';

export default function MesPatientsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, userProfile, loading, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${lang}/login?redirect=${encodeURIComponent(doctorSpacePath(lang))}`);
    }
  }, [loading, user, router, lang]);

  const practitioner = useMemo(() => readPractitioner(userProfile), [userProfile]);
  const collides = useMemo(
    () =>
      !!practitioner &&
      resolveIdentities(userProfile, '').some((i) => i.requester_id.toUpperCase() === practitioner.requester_id),
    [practitioner, userProfile]
  );

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background-default)]">
        <MedicalLoader />
      </div>
    );
  }

  if (practitioner && !collides) {
    return (
      <PractitionerWorkspace
        key={`${user.uid}:${practitioner.requester_id}`}
        lang={lang}
        practitioner={practitioner}
      />
    );
  }

  const recheck = async () => {
    setChecking(true);
    try {
      await refreshProfile();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-[80vh] py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Shown only in the collision case (the account HAS a doctor access):
            his own results stay one tap away. Nothing without an access. */}
        <ResultsSpaceSwitch lang={lang} current="patients" />
        <h1 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] flex items-center gap-2">
          <Stethoscope size={26} />
          {t('mes_patients.title', 'Mes patients')}
        </h1>
        {collides ? (
          <VerdictPanel
            tone="error"
            title={t('mes_patients.config_title', 'Accès médecin à corriger')}
            body={t(
              'mes_patients.config_body',
              'Le code médecin de ce compte est aussi l’un de vos dossiers patient. Rien n’est affiché tant que ce n’est pas corrigé.'
            )}
            todo={t('mes_patients.config_todo', 'Contactez le laboratoire pour le corriger.')}
          />
        ) : (
          // No doctor access: the request form (the lab's invitation link lands
          // here), or where the request stands. Asking grants nothing.
          <PractitionerAccessRequest lang={lang} onRecheck={recheck} checking={checking} />
        )}
      </div>
    </div>
  );
}
