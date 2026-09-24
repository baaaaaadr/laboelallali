'use client';

/**
 * « Médecins ayant accès » — every account that holds a doctor access, in the
 * admin « Médecins » tab (owner's request, 24/09/2026: « on voit les médecins
 * déjà accordés, avec des boutons update ou revoke ou des accès rapides, sans
 * devoir les chercher manuellement »).
 *
 * Presentational only, like the other admin sub-components: the list comes
 * from `adminListPractitioners` and every action lives in `/admin/page.tsx`.
 *
 * One card per doctor:
 *  - who: display name, Qalam code, account name, e-mail, phone; tags for a
 *    « Correspondant » and for a team account (the lab's own tests);
 *  - how much he uses it: last visit, days of visit and reports opened this
 *    month, reports opened in total (`practitionerUsage`, counts only — never
 *    which patient). Label/value pairs, so no plural forms are needed;
 *  - activation date and who did it, his confidentiality engagement (accepted,
 *    or « asked at his next visit »), and a warning when the code is shared;
 *  - quick actions: « Ouvrir sa fiche » (the Patients tab, his account selected
 *    — the « Accès médecin » card edits code, type and name), « WhatsApp » (a
 *    message with the link to his space), « Retirer l'accès » (admin only, two
 *    clicks, on its own at the end of the row).
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Clock, ExternalLink, MessageCircle, RefreshCw, Stethoscope } from 'lucide-react';
import MedicalLoader from '@/components/ui/MedicalLoader';
import { doctorSpacePath, whatsappInviteLink } from '@/lib/practitioner/invitation';
import { useSiteOrigin } from '@/hooks/useSiteOrigin';

/** One doctor, as `adminListPractitioners` returns it (timestamps in ms). */
export interface PractitionerRow {
  uid: string;
  fullName: string;
  email: string | null;
  phone: string;
  requester_id: string;
  type: string;
  label: string;
  linkedAt: number | null;
  linkedByName: string;
  team: boolean;
  sharedWith: number;
  engaged: boolean;
  engagementAt: number | null;
  lastVisitAt: number | null;
  usage: {
    days: number;
    reports: number;
    monthDays: number;
    monthReports: number;
    firstAt: number | null;
    lastAt: number | null;
    lastReportAt: number | null;
  };
}

interface Props {
  lang: string;
  /** `null` while loading. */
  doctors: PractitionerRow[] | null;
  error: string | null;
  message: string | null;
  /** Admin level: may withdraw an access (the server enforces it too). */
  canAct: boolean;
  busyUid: string | null;
  onOpen: (row: PractitionerRow) => void;
  onRevoke: (row: PractitionerRow) => void;
  onRetry: () => void;
  fmtWhen: (ms?: number | null) => string;
}

export default function PractitionersSection({
  lang,
  doctors,
  error,
  message,
  canAct,
  busyUid,
  onOpen,
  onRevoke,
  onRetry,
  fmtWhen,
}: Props) {
  const { t } = useTranslation('common');
  const origin = useSiteOrigin();
  // Withdrawing is two clicks, never next to « Ouvrir » (a double click must
  // not cut a doctor off).
  const [confirming, setConfirming] = useState<string | null>(null);

  const link = `${origin}${doctorSpacePath(lang)}`;
  const tag =
    'text-xs font-semibold px-2 py-0.5 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)]';

  return (
    <section className="space-y-4" data-testid="doctors-section">
      <div>
        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Stethoscope size={18} className="text-[var(--color-bordeaux-primary)]" />
          {t('admin.doctors_title', 'Médecins ayant accès')}
          {doctors && doctors.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] tabular-nums">
              {doctors.length}
            </span>
          )}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t(
            'admin.doctors_intro',
            'Chaque compte qui ouvre « Mes patients ». Pour changer le code ou le nom affiché, ouvrez la fiche du médecin.'
          )}
        </p>
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--status-error)]">
          <span className="flex items-start gap-2">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-[var(--border-default)] text-[var(--text-primary)]"
          >
            <RefreshCw size={16} />
            {t('admin.doctors_retry', 'Réessayer')}
          </button>
        </div>
      )}
      {message && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg p-3 bg-[var(--background-tertiary)] text-[var(--status-success)]"
        >
          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span className="font-medium">{message}</span>
        </div>
      )}

      {doctors === null && !error && (
        <div className="card">
          <MedicalLoader label={t('admin.doctors_loading', 'Chargement des médecins…')} />
        </div>
      )}

      {doctors !== null && doctors.length === 0 && (
        <div className="card p-6 text-center text-sm text-[var(--text-secondary)]" data-testid="doctors-empty">
          {t(
            'admin.doctors_empty',
            'Aucun médecin n’a encore accès. Invitez-en un ci-dessous, ou activez-le depuis sa fiche (onglet Patients).'
          )}
        </div>
      )}

      {(doctors || []).map((d) => {
        const busy = busyUid === d.uid;
        const name = d.label || d.fullName;
        const wa = d.phone
          ? whatsappInviteLink(d.phone, t('admin.doctors_wa_message', { name, link }))
          : null;
        const stats: [string, string | number][] = [
          [
            t('admin.doctors_last_visit', 'Dernière visite'),
            d.lastVisitAt ? fmtWhen(d.lastVisitAt) : t('admin.doctors_never', 'Pas encore venu'),
          ],
          [t('admin.doctors_month_days', 'Jours de visite ce mois-ci'), d.usage.monthDays],
          [t('admin.doctors_month_reports', 'Bilans ouverts ce mois-ci'), d.usage.monthReports],
          [t('admin.doctors_total_reports', 'Bilans ouverts au total'), d.usage.reports],
        ];
        return (
          <div key={d.uid} className="card p-5 space-y-4" data-testid="doctor-row">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-[var(--color-bordeaux-primary)]/10 text-[var(--color-bordeaux-primary)] flex items-center justify-center flex-shrink-0">
                <Stethoscope size={20} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[var(--text-primary)]" data-testid="doctor-name">
                    {name}
                  </span>
                  <span dir="ltr" className={tag} data-testid="doctor-code">
                    {d.requester_id}
                  </span>
                  {d.type === 'correspondant' && (
                    <span className={tag}>{t('admin.pract_type_correspondant', 'Correspondant (clinique)')}</span>
                  )}
                  {d.team && (
                    <span className={tag} data-testid="doctor-team">
                      {t('admin.doctors_team', 'Compte de l’équipe')}
                    </span>
                  )}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {d.fullName}
                  {d.email && (
                    <>
                      {' · '}
                      <span className="break-all">{d.email}</span>
                    </>
                  )}
                  {d.phone && (
                    <>
                      {' · '}
                      <span dir="ltr">{d.phone}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="doctor-usage">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-[var(--background-secondary)] px-3 py-2">
                  <dt className="text-xs text-[var(--text-tertiary)] leading-tight">{label}</dt>
                  <dd className="mt-1 font-semibold text-[var(--text-primary)] tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-1 text-xs text-[var(--text-secondary)]">
              {d.linkedAt && (
                <p className="flex items-start gap-1.5">
                  <Clock size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {d.linkedByName
                      ? t('admin.doctors_activated_by', 'Activé le {{date}} par {{name}}', {
                          date: fmtWhen(d.linkedAt),
                          name: d.linkedByName,
                        })
                      : t('admin.doctors_activated', 'Activé le {{date}}', { date: fmtWhen(d.linkedAt) })}
                  </span>
                </p>
              )}
              {d.engaged ? (
                <p className="flex items-start gap-1.5 text-[var(--status-success)]" data-testid="doctor-engaged">
                  <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {d.engagementAt
                      ? t('admin.doctors_engaged', 'Engagement de confidentialité accepté le {{date}}', {
                          date: fmtWhen(d.engagementAt),
                        })
                      : t('admin.doctors_engaged_nodate', 'Engagement de confidentialité accepté')}
                  </span>
                </p>
              ) : (
                <p className="flex items-start gap-1.5" data-testid="doctor-not-engaged">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {t(
                      'admin.doctors_not_engaged',
                      'Engagement de confidentialité pas encore accepté : il lui sera demandé à sa prochaine visite.'
                    )}
                  </span>
                </p>
              )}
              {d.sharedWith > 0 && (
                <p className="flex items-start gap-1.5 text-[var(--status-warning)]" data-testid="doctor-shared">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {t('admin.doctors_shared', 'Ce code est aussi sur d’autres comptes : {{n}}', { n: d.sharedWith })}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--border-default)]">
              <button
                type="button"
                onClick={() => onOpen(d)}
                disabled={busy}
                className="button-bordeaux-outline disabled:opacity-60"
                data-testid="doctor-open"
              >
                <ExternalLink size={18} />
                {t('admin.doctors_open', 'Ouvrir sa fiche')}
              </button>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  // Inline colour: the global unlayered `a { color }` beats utilities.
                  style={{ color: 'var(--text-primary)' }}
                  className="flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-lg border border-[var(--border-default)] font-medium"
                  data-testid="doctor-whatsapp"
                >
                  <MessageCircle size={18} />
                  {t('admin.doctors_whatsapp', 'WhatsApp')}
                </a>
              )}
              {canAct &&
                (confirming === d.uid ? (
                  <span className="flex flex-wrap items-center gap-3 text-sm ms-auto">
                    <span className="text-[var(--status-error)]">
                      {t('admin.pract_remove_confirm', "Retirer l'accès médecin de ce compte ? Il ne verra plus aucun patient.")}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                        onRevoke(d);
                      }}
                      disabled={busy}
                      className="min-h-[44px] px-3 rounded-lg font-semibold text-[var(--color-white)] bg-[var(--status-error)] disabled:opacity-50"
                      data-testid="doctor-revoke-confirm"
                    >
                      {t('admin.pract_remove_yes', 'Oui, retirer')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="min-h-[44px] px-2 text-[var(--text-secondary)] underline"
                    >
                      {t('cancel', 'Annuler')}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(d.uid)}
                    disabled={busy}
                    className="ms-auto min-h-[44px] px-2 text-sm text-[var(--status-error)] underline disabled:opacity-50"
                    data-testid="doctor-revoke"
                  >
                    {t('admin.pract_remove', "Retirer l'accès")}
                  </button>
                ))}
            </div>
          </div>
        );
      })}

      {doctors !== null && doctors.length > 0 && !canAct && (
        <p className="text-xs text-[var(--text-secondary)]">
          {t('admin.pract_admin_only', "Seul un administrateur peut modifier l'accès médecin.")}
        </p>
      )}
    </section>
  );
}
