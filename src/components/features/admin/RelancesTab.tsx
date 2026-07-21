'use client';

/**
 * "Relances" tab of /admin — the front-desk tool for chasing patients who have an
 * activated access but never (or no longer) use it.
 *
 * It lives OUTSIDE the dashboard on purpose: the dashboard shows the lab's steering
 * figures and is admin/owner-only, while relancing patients is exactly the job of
 * the stagiaires at the front desk. So this tab is visible from staff level up.
 *
 * Clicking "Relancer" opens WhatsApp with a prefilled message AND records the
 * contact (`adminRecordRelance`) so the row can show "relancé il y a X j" and the
 * dashboard can measure whether relances actually bring patients back.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Loader2, CheckCircle } from 'lucide-react';
import MedicalLoader from '@/components/ui/MedicalLoader';

export interface DormantAccount {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  createdAt?: string;
  lastResultsAt?: number | null;
  lastRelanceAt?: number | null;
}

interface Props {
  list: DormantAccount[] | null;
  error: string | null;
  busyUid: string | null;
  onRelance: (a: DormantAccount, link: string | null) => void;
  waLink: (phone: string, name: string) => string | null;
  daysSince: (ms: number) => number;
}

export default function RelancesTab({
  list, error, busyUid, onRelance, waLink, daysSince,
}: Props) {
  const { t } = useTranslation('common');

  if (error) {
    return (
      <div className="card p-4 flex items-center gap-3">
        <span className="text-[var(--text-primary)]">{error}</span>
      </div>
    );
  }
  if (!list) {
    return (
      <div className="card">
        <MedicalLoader label={t('admin.rel_loading', 'Chargement des comptes à relancer…')} />
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <MessageCircle size={20} className="text-[var(--color-bordeaux-primary)]" />
          {t('admin.rel_title', 'Comptes à relancer')}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] tabular-nums">
            {list.length}
          </span>
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t('admin.rel_subtitle', "Ces patients ont un accès activé mais ne consultent pas leurs résultats. Un message WhatsApp suffit souvent à les débloquer.")}
        </p>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {t('admin.rel_empty', 'Aucun compte à relancer pour le moment. 👌')}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border-default)]">
          {list.map((a) => {
            const link = waLink(a.phone || '', a.fullName);
            const busy = busyUid === a.uid;
            return (
              <li key={a.uid} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary)] truncate">{a.fullName || a.email}</p>
                  <p className="text-sm text-[var(--status-warning)]">
                    {a.lastResultsAt
                      ? t('admin.dash_inactive_days', { days: daysSince(a.lastResultsAt), defaultValue: 'Inactif depuis {{days}} j' })
                      : t('admin.dash_never', 'Jamais consulté')}
                  </p>
                  {/* The relance history — so nobody gets chased twice in a week. */}
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    {a.lastRelanceAt
                      ? t('admin.rel_last', { days: daysSince(a.lastRelanceAt), defaultValue: 'Dernière relance il y a {{days}} j' })
                      : t('admin.rel_never', 'Jamais relancé')}
                  </p>
                </div>
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onRelance(a, link)}
                    className="button-bordeaux-outline justify-center flex items-center gap-2 flex-shrink-0"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                    {t('admin.dash_relance', 'Relancer')}
                  </a>
                ) : (
                  <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
                    {t('admin.rel_no_phone', 'Pas de téléphone')}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-[var(--text-tertiary)] flex items-start gap-1.5 pt-1">
        <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />
        {t('admin.rel_hint', "Chaque relance est enregistrée (date uniquement) pour éviter de recontacter deux fois la même personne.")}
      </p>
    </div>
  );
}
