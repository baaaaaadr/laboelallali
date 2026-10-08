'use client';

/**
 * « Peut-être déjà connu comme proche » (Dr Aziz, 08/10/2026).
 *
 * The case: Hassania's mother was attached to her daughter's account as
 * « Maman » (dossier 183513). Later the mother creates her own account and
 * asks for her own access — her dossier number is ALREADY in the app, on her
 * daughter's account. This panel says so, on her search card and on her
 * access request, with the number in one click (« Utiliser ce numéro »).
 *
 * The server only proposes (rule `hintsFor`, functions/src/admin/adminPatients.ts):
 *  - « shared » — this account's own dossier IS attached there (certain);
 *  - same date of birth + a common name word (likely);
 *  - same date of birth only, for an account without a dossier (to check:
 *    a name typed in Arabic and one typed in Latin share no word).
 * The front desk always confirms in Qalam — and the attach gates still apply.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { identityLabel, type RelativeOfHint } from '@/lib/results/relativeIdentity';

interface Props {
  hints: RelativeOfHint[] | undefined;
  /** "YYYY-MM-DD" → long date. */
  fmtDate: (iso: string) => string;
  /** Fill the dossier number of the form below. Absent = nothing to fill. */
  onUse?: (requesterId: string) => void;
  testId?: string;
}

export default function RelativeOfHints({ hints, fmtDate, onUse, testId = 'relative-of' }: Props) {
  const { t } = useTranslation('common');
  if (!hints || hints.length === 0) return null;
  return (
    <div
      className="rounded-lg border p-3 space-y-3"
      style={{ borderColor: 'var(--status-info)', background: 'var(--background-secondary)' }}
      data-testid={testId}
    >
      {hints.map((h) => {
        const who = identityLabel(h);
        return (
          <div key={`${h.holderUid}-${h.requester_id}`} className="flex items-start gap-2 text-sm">
            <Users size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--status-info)' }} />
            <div className="min-w-0 space-y-1">
              {h.shared ? (
                <p className="text-[var(--text-primary)]">
                  {t('admin.rel_of_shared', 'Son dossier {{id}} est aussi rattaché comme proche au compte de {{holder}} (« {{label}} »).', {
                    id: h.requester_id,
                    holder: h.holderName || '—',
                    label: h.label,
                  })}
                </p>
              ) : (
                <>
                  <p className="font-medium text-[var(--text-primary)]">
                    {t('admin.rel_of_maybe', 'Peut-être déjà connu(e) comme proche : {{name}}, né(e) le {{date}} — dossier {{id}}.', {
                      name: who || h.label,
                      date: h.dateOfBirth ? fmtDate(h.dateOfBirth) : '—',
                      id: h.requester_id,
                    })}
                  </p>
                  <p className="text-[var(--text-secondary)]">
                    {t('admin.rel_of_where', 'Rattaché(e) au compte de {{holder}}, sous le nom « {{label}} ».', {
                      holder: h.holderName || '—',
                      label: h.label,
                    })}{' '}
                    {h.nameMatch
                      ? t('admin.rel_of_same_name', 'Même nom et même date de naissance.')
                      : t('admin.rel_of_same_dob', 'Même date de naissance : comparez les noms.')}
                  </p>
                  {onUse && (
                    <button
                      type="button"
                      onClick={() => onUse(h.requester_id)}
                      className="flex items-center min-h-[40px] px-3 rounded-lg border text-sm font-medium"
                      style={{ borderColor: 'var(--border-default)', background: 'var(--background-default)', color: 'var(--text-primary)' }}
                      data-testid={`${testId}-use`}
                    >
                      {t('admin.rel_of_use', 'Utiliser ce numéro ({{id}})', { id: h.requester_id })}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      {hints.some((h) => !h.shared) && (
        <p className="text-xs text-[var(--text-secondary)]">
          {t('admin.rel_of_check', 'Vérifiez toujours dans Qalam qu’il s’agit bien de la même personne avant d’utiliser ce numéro.')}
        </p>
      )}
    </div>
  );
}
