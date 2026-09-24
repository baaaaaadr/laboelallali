'use client';

/**
 * « Demander mon accès médecin » — what /mes-patients shows to a signed-in
 * account WITHOUT a doctor access (owner's decision, 24/09/2026).
 *
 * The lab sends a doctor who has no account yet the invitation link
 * (/{lang}/mes-patients, « Inviter un médecin » card in the admin). He signs
 * in or up, comes back here, and asks. The request lands in the admin
 * « Demandes » tab; an admin attaches his Qalam code; the same link then opens
 * his patients. Asking grants NOTHING (`requestPractitionerAccess`): anyone can
 * claim to be a doctor in an app, and only the lab knows his Qalam code.
 *
 * Works for a doctor who never had a test at the lab — nothing here needs a
 * patient dossier.
 *
 * States: loading → form (none) | pending | rejected (→ form again on demand)
 * | fulfilled (the session's profile predates the activation: re-read it).
 */
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { MessageCircle, Phone, RefreshCw, Send } from 'lucide-react';
import { getClientFunctions } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import MedicalLoader from '@/components/ui/MedicalLoader';
import VerdictPanel from '@/components/ui/VerdictPanel';
import { LAB_CONTACT } from '@/constants/contact';
import { formatDossierDate } from '@/lib/results/format';

type ReqStatus = 'loading' | 'none' | 'pending' | 'rejected' | 'fulfilled';

interface MyRequest {
  status: string | null;
  createdAt?: number | null;
}

interface Props {
  lang: string;
  /** Re-read the profile (an access the lab just gave). */
  onRecheck: () => Promise<void>;
  checking: boolean;
}

const LABEL_MIN = 3;

async function call<T>(name: string, data: object): Promise<T> {
  const functions = await getClientFunctions();
  if (!functions) throw new Error('functions-unavailable');
  return (await httpsCallable<object, T>(functions, name)(data)).data;
}

export default function PractitionerAccessRequest({ lang, onRecheck, checking }: Props) {
  const { t } = useTranslation('common');
  const { userProfile } = useAuth();
  const [status, setStatus] = useState<ReqStatus>('loading');
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [formAgain, setFormAgain] = useState(false);
  const [label, setLabel] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [place, setPlace] = useState('');
  const [attest, setAttest] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // « Dr » + the account's name, once — he corrects it to match his prescriptions.
  const fullName = userProfile?.fullName?.trim() ?? '';
  useEffect(() => {
    if (!fullName) return;
    setLabel((cur) => cur || (/^dr\b\.?/i.test(fullName) ? fullName : `Dr ${fullName}`));
  }, [fullName]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await call<MyRequest>('myPractitionerRequest', {});
      setCreatedAt(res?.createdAt ?? null);
      setStatus(
        res?.status === 'pending'
          ? 'pending'
          : res?.status === 'rejected'
            ? 'rejected'
            : res?.status === 'fulfilled'
              ? 'fulfilled'
              : 'none'
      );
    } catch {
      // Status unreadable: offer the form — the server de-duplicates anyway.
      setStatus('none');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Fulfilled while this session still holds the old profile: re-read it once;
  // the page then opens the workspace by itself.
  useEffect(() => {
    if (status === 'fulfilled') void onRecheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const trimmed = label.replace(/\s+/g, ' ').trim();
  const lockReason =
    trimmed.length < LABEL_MIN
      ? t('mes_patients.request_need_label', 'Indiquez votre nom tel qu’il figure sur vos ordonnances.')
      : !attest
        ? t('mes_patients.request_need_attest', 'Cochez la case pour confirmer que vous êtes médecin.')
        : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockReason || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await call<{ status: string; createdAt?: number | null }>('requestPractitionerAccess', {
        label: trimmed,
        specialty: specialty.trim(),
        place: place.trim(),
        attest: true,
      });
      if (res?.status === 'already_granted') {
        await onRecheck();
        return;
      }
      setCreatedAt(res?.createdAt ?? Date.now());
      setStatus('pending');
      setFormAgain(false);
    } catch {
      setError(t('mes_patients.request_error', 'Votre demande n’a pas pu être envoyée. Réessayez dans un instant.'));
    } finally {
      setSending(false);
    }
  };

  const linkClass =
    'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-[var(--border-default)] text-[var(--text-primary)] font-medium hover:bg-[var(--background-tertiary)] hover:border-[var(--color-bordeaux-primary)] transition-all';
  const inputClass =
    'w-full rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm';

  const contacts = (
    <div className="flex flex-wrap gap-2">
      <a href={LAB_CONTACT.LANDLINE.url} className={linkClass}>
        <Phone size={18} />
        <span dir="ltr">{LAB_CONTACT.LANDLINE.display}</span>
      </a>
      <a href={LAB_CONTACT.WHATSAPP[0].url} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <MessageCircle size={18} />
        {t('mes_patients.contact_whatsapp', 'WhatsApp du laboratoire')}
      </a>
    </div>
  );

  const recheckButton = (
    <button
      type="button"
      onClick={() => void onRecheck()}
      disabled={checking}
      className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-60"
      data-testid="mp-recheck"
    >
      <RefreshCw size={18} className={checking ? 'animate-spin' : ''} />
      {t('mes_patients.check_again', 'Vérifier à nouveau')}
    </button>
  );

  if (status === 'loading' || status === 'fulfilled') {
    return (
      <div className="card">
        <MedicalLoader />
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div data-testid="mp-request-pending">
        <VerdictPanel
          tone="success"
          title={t('mes_patients.request_pending_title', 'Votre demande est bien arrivée')}
          body={
            createdAt
              ? t('mes_patients.request_pending_body', 'Envoyée le {{date}}. Le laboratoire vérifie votre identité, puis active votre accès.', {
                  date: formatDossierDate(new Date(createdAt).toISOString(), lang),
                })
              : t('mes_patients.request_pending_body_nodate', 'Le laboratoire vérifie votre identité, puis active votre accès.')
          }
          todo={t('mes_patients.request_pending_todo', 'Vous recevrez un e-mail dès que c’est fait. Revenez alors sur cette page.')}
          actions={
            <div className="flex flex-wrap gap-2">
              {recheckButton}
              {contacts}
            </div>
          }
        />
      </div>
    );
  }

  if (status === 'rejected' && !formAgain) {
    return (
      <div data-testid="mp-request-rejected">
        <VerdictPanel
          tone="warning"
          title={t('mes_patients.request_rejected_title', 'Votre demande n’a pas été acceptée')}
          body={t('mes_patients.request_rejected_body', 'Le laboratoire n’a pas pu valider votre demande d’accès médecin.')}
          todo={t('mes_patients.request_rejected_todo', 'Contactez-le pour en savoir plus, ou faites une nouvelle demande.')}
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFormAgain(true)}
                className="button-bordeaux justify-center flex items-center gap-2"
                data-testid="mp-request-again"
              >
                {t('mes_patients.request_again', 'Faire une nouvelle demande')}
              </button>
              {contacts}
            </div>
          }
        />
      </div>
    );
  }

  // No request yet (or a new one after a refusal): the form.
  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card p-6 space-y-5" data-testid="mp-request-form">
        <div className="space-y-2">
          {/* A <p>, not an <h2>: base/reset.css sizes and colours h2 unlayered. */}
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {t('mes_patients.request_title', 'Demander votre accès médecin')}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            {t(
              'mes_patients.request_intro',
              'Cet espace permet aux médecins prescripteurs de consulter dans l’application les résultats des patients qu’ils adressent au laboratoire — uniquement les bilans qu’ils ont eux-mêmes prescrits. Le laboratoire vérifie chaque demande avant d’ouvrir l’accès.'
            )}
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="mp-req-label" className="block text-sm font-medium text-[var(--text-secondary)]">
            {t('mes_patients.request_label', 'Votre nom, tel qu’il figure sur vos ordonnances')}
          </label>
          <input
            id="mp-req-label"
            type="text"
            value={label}
            maxLength={60}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('mes_patients.request_label_placeholder', 'Ex. : Dr Nom Prénom')}
            className={inputClass}
            autoComplete="name"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="mp-req-specialty" className="block text-sm font-medium text-[var(--text-secondary)]">
              {t('mes_patients.request_specialty', 'Spécialité (facultatif)')}
            </label>
            <input
              id="mp-req-specialty"
              type="text"
              value={specialty}
              maxLength={60}
              onChange={(e) => setSpecialty(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="mp-req-place" className="block text-sm font-medium text-[var(--text-secondary)]">
              {t('mes_patients.request_place', 'Ville ou cabinet (facultatif)')}
            </label>
            <input
              id="mp-req-place"
              type="text"
              value={place}
              maxLength={80}
              onChange={(e) => setPlace(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <label className="flex items-start gap-3 text-sm text-[var(--text-primary)] cursor-pointer">
          <input
            type="checkbox"
            checked={attest}
            onChange={(e) => setAttest(e.target.checked)}
            className="mt-1 h-4 w-4 flex-shrink-0"
            data-testid="mp-request-attest"
          />
          <span>
            {t(
              'mes_patients.request_attest',
              'Je suis médecin et je demande l’accès aux résultats des patients dont je suis le prescripteur.'
            )}
          </span>
        </label>

        {error && <p className="text-sm text-[var(--status-error)]">{error}</p>}

        <div className="space-y-2">
          <button
            type="submit"
            disabled={!!lockReason || sending}
            className="button-bordeaux justify-center flex items-center gap-2 w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
            data-testid="mp-request-submit"
          >
            <Send size={18} />
            {sending
              ? t('mes_patients.request_sending', 'Envoi…')
              : t('mes_patients.request_submit', 'Demander mon accès médecin')}
          </button>
          {/* A locked button always says why. */}
          {lockReason && (
            <p className="text-xs text-[var(--text-secondary)]" data-testid="mp-request-why">
              {lockReason}
            </p>
          )}
        </div>
      </form>

      <p className="text-sm text-[var(--text-secondary)]">
        {t('mes_patients.request_patient_hint', 'Vous êtes patient ?')}{' '}
        <Link href={`/${lang}/resultats`} style={{ color: 'var(--color-bordeaux-primary)', fontWeight: 600 }}>
          {t('mes_patients.request_patient_link', 'Voir mes résultats')}
        </Link>
      </p>
      {contacts}
    </div>
  );
}
