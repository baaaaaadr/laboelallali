'use client';

/**
 * The doctor's confidentiality engagement — the TEXT (owner's request,
 * 24/09/2026: « je déclare ne pas partager avec autrui… il coche et puis fait
 * sa demande »).
 *
 * Shown in two places, with the same words — it is one engagement:
 *  - the access request form (`PractitionerAccessRequest`), above the tick
 *    « Je suis médecin et j'accepte cet engagement »;
 *  - once, before his first roster, for a doctor the lab activated directly
 *    (`PractitionerEngagementGate`).
 *
 * Displayed open, not folded: four short lines, and a commitment should be read
 * before it is ticked. The acceptance is recorded server-side (date + version,
 * `functions/src/admin/practitionerEngagement.ts`); changing this text
 * materially means bumping the version on both sides.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ShieldCheck } from 'lucide-react';

export default function EngagementTerms() {
  const { t } = useTranslation('common');
  const items = [
    t('mes_patients.engagement_1', 'consulter ces résultats uniquement pour soigner mes patients ;'),
    t('mes_patients.engagement_2', 'ne donner mes identifiants à personne, et ne laisser personne utiliser mon compte ;'),
    t('mes_patients.engagement_3', 'respecter le secret médical : ne diffuser aucun résultat hors du cadre du soin ;'),
    t(
      'mes_patients.engagement_4',
      'prévenir le laboratoire sans délai si mon téléphone est perdu ou volé, ou si j’arrête mon activité.'
    ),
  ];
  return (
    <div
      className="rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] p-4 space-y-3"
      data-testid="mp-engagement-terms"
    >
      {/* A <p>, not an <h3>: headings are sized and coloured unlayered by reset.css. */}
      <p className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <ShieldCheck size={18} className="flex-shrink-0 text-[var(--color-bordeaux-primary)]" />
        {t('mes_patients.engagement_title', 'Mon engagement de confidentialité')}
      </p>
      <p className="text-sm text-[var(--text-secondary)]">
        {t('mes_patients.engagement_intro', 'En utilisant cet accès, je m’engage à :')}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
            <Check size={16} className="flex-shrink-0 mt-0.5 text-[var(--color-bordeaux-primary)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--text-secondary)]">
        {t(
          'mes_patients.engagement_ack',
          'Je sais que je ne vois que les bilans que j’ai moi-même prescrits, que le laboratoire enregistre la date et le nombre de mes consultations (jamais lesquelles), et qu’il peut retirer cet accès à tout moment.'
        )}
      </p>
    </div>
  );
}
