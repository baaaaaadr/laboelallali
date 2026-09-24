'use client';

/**
 * « Une dernière étape avant vos patients » — the confidentiality engagement,
 * ONCE, before the first roster, for a doctor who holds an access but has not
 * accepted it yet (24/09/2026).
 *
 * Who meets it: a doctor the lab activated DIRECTLY from his account (the
 * « already has an account » case — he never filled the request form, where the
 * same text is ticked), and every doctor again if the text version is bumped.
 * A doctor who asked through the invitation link accepted it there and never
 * sees this screen.
 *
 * No call to the results server happens before he accepts: the page renders
 * this INSTEAD of the workspace. Accepting records date + version on his
 * account (`acceptPractitionerEngagement`), then re-reads the profile — the
 * profile is read once per session, so without it the gate would stay.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { ShieldCheck } from 'lucide-react';
import { getClientFunctions } from '@/config/firebase';
import { PRACTITIONER_ENGAGEMENT_VERSION } from '@/lib/practitioner/engagement';
import EngagementTerms from './EngagementTerms';

interface Props {
  /** Re-read the profile once the acceptance is recorded. */
  onAccepted: () => Promise<void>;
}

export default function PractitionerEngagementGate({ onAccepted }: Props) {
  const { t } = useTranslation('common');
  const [accepted, setAccepted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted || sending) return;
    setSending(true);
    setError(null);
    try {
      const functions = await getClientFunctions();
      if (!functions) throw new Error('functions-unavailable');
      await httpsCallable(functions, 'acceptPractitionerEngagement')({ version: PRACTITIONER_ENGAGEMENT_VERSION });
      await onAccepted();
    } catch {
      setError(
        t('mes_patients.engagement_error', 'Votre acceptation n’a pas pu être enregistrée. Réessayez dans un instant.')
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-6 space-y-5" data-testid="mp-engagement-gate">
      <div className="space-y-2">
        {/* A <p>, not an <h2>: base/reset.css sizes and colours h2 unlayered. */}
        <p className="text-lg font-semibold text-[var(--text-primary)]">
          {t('mes_patients.engagement_gate_title', 'Une dernière étape avant vos patients')}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          {t(
            'mes_patients.engagement_gate_intro',
            'Votre accès médecin est actif. Avant votre première consultation, lisez et acceptez votre engagement de confidentialité. Il ne vous sera demandé qu’une fois.'
          )}
        </p>
      </div>

      <EngagementTerms />

      <label className="flex items-start gap-3 text-sm text-[var(--text-primary)] cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 h-4 w-4 flex-shrink-0"
          data-testid="mp-engagement-accept"
        />
        <span>{t('mes_patients.engagement_accept', 'J’accepte cet engagement.')}</span>
      </label>

      {error && <p className="text-sm text-[var(--status-error)]">{error}</p>}

      <div className="space-y-2">
        <button
          type="submit"
          disabled={!accepted || sending}
          className="button-bordeaux justify-center flex items-center gap-2 w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
          data-testid="mp-engagement-submit"
        >
          {/* flex-shrink-0: on a phone the nowrap label would squeeze the icon to nothing. */}
          <ShieldCheck size={18} className="flex-shrink-0" />
          {sending
            ? t('mes_patients.engagement_sending', 'Enregistrement…')
            : t('mes_patients.engagement_submit', 'Accepter et ouvrir mes patients')}
        </button>
        {/* A locked button always says why. */}
        {!accepted && (
          <p className="text-xs text-[var(--text-secondary)]" data-testid="mp-engagement-why">
            {t('mes_patients.engagement_need', 'Cochez la case pour accepter l’engagement.')}
          </p>
        )}
      </div>
    </form>
  );
}
