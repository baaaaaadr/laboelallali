'use client';

/**
 * /[lang]/mes-patients — the prescribing doctor's space: the results of the
 * patients he prescribed for, and only those (the lab server enforces the
 * rule). See docs/pages/mes-patients.md.
 *
 * This page only decides WHO may see the workspace:
 *  - not signed in → login, then back here (`?redirect=`);
 *  - signed in without a doctor access → an explanation, a way to re-check
 *    (the profile is read once per session, so an access the lab just gave
 *    would not show without it) and the lab's contacts;
 *  - a doctor access whose code equals one of the account's PATIENT ids →
 *    a configuration error, never a call (the server would answer with the
 *    patient's own dossier, which would be shown as « Mes patients »);
 *  - otherwise → `PractitionerWorkspace`, keyed by uid + code.
 */
import React, { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Phone, RefreshCw, Stethoscope } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import MedicalLoader from '@/components/ui/MedicalLoader';
import VerdictPanel from '@/components/ui/VerdictPanel';
import PractitionerWorkspace from '@/components/features/practitioner/PractitionerWorkspace';
import { readPractitioner, resolveIdentities } from '@/lib/results/identities';
import { LAB_CONTACT } from '@/constants/contact';

export default function MesPatientsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, userProfile, loading, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${lang}/login?redirect=${encodeURIComponent(`/${lang}/mes-patients`)}`);
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

  const link =
    'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-[var(--border-default)] text-[var(--text-primary)] font-medium hover:bg-[var(--background-tertiary)] hover:border-[var(--color-bordeaux-primary)] transition-all';

  return (
    <div className="min-h-[80vh] py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
      <div className="max-w-2xl mx-auto space-y-6">
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
          <VerdictPanel
            tone="warning"
            title={t('mes_patients.no_access_title', 'Espace réservé aux médecins partenaires')}
            body={t(
              'mes_patients.no_access_body',
              'Cet espace permet aux médecins prescripteurs de consulter les résultats de leurs patients. Votre compte n’y a pas accès.'
            )}
            todo={t(
              'mes_patients.no_access_todo',
              'Vous êtes médecin prescripteur ? Le laboratoire active votre accès sur ce compte.'
            )}
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={recheck}
                  disabled={checking}
                  className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-60"
                  data-testid="mp-recheck"
                >
                  <RefreshCw size={18} className={checking ? 'animate-spin' : ''} />
                  {t('mes_patients.check_again', 'Vérifier à nouveau')}
                </button>
                <a href={LAB_CONTACT.LANDLINE.url} className={link}>
                  <Phone size={18} />
                  <span dir="ltr">{LAB_CONTACT.LANDLINE.display}</span>
                </a>
                <a href={LAB_CONTACT.WHATSAPP[0].url} target="_blank" rel="noopener noreferrer" className={link}>
                  <MessageCircle size={18} />
                  {t('mes_patients.contact_whatsapp', 'WhatsApp du laboratoire')}
                </a>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
