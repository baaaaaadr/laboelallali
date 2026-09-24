'use client';

/**
 * « Accès médecin » — gives an account a prescribing doctor's code, which opens
 * `/[lang]/mes-patients`: the named results of the dossiers HE prescribed (the
 * lab server enforces that rule). See docs/pages/mes-patients.md.
 *
 * Presentational only, like `LinkedRequestersCard`: the draft and every callable
 * live in `/admin/page.tsx` (the draft must survive a trip to the Tester tab,
 * which unmounts the Patients block).
 *
 * The two-step flow is the safety net:
 *  1. « Vérifier le code » asks the server (`adminSetPractitioner` with
 *     `dryRun`) what this code would show — COUNTS only, never a name — and who
 *     else already holds it;
 *  2. « Activer » unlocks only when that verification matches exactly what is
 *     typed (a code edited after the check invalidates it), and, when the lab
 *     does not know the code yet or another account holds it, only after an
 *     explicit tick. The server re-checks everything anyway.
 *
 * Staff (interns) see the access read-only: activating a doctor is an admin
 * decision — a code opens a whole roster of named results.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Info, Loader2, SearchCheck, Stethoscope, Trash2 } from 'lucide-react';
import { normalizePractitionerId } from '@/lib/results/identities';

export type PractitionerKind = 'medecin' | 'correspondant';

/** The access as `adminSearchPatients` / `adminSetPractitioner` return it. */
export interface PractitionerDTO {
  requester_id: string;
  type: string;
  label: string;
  linkedAt: number | null;
  lastUsedAt: number | null;
  /** His confidentiality engagement (optional: absent from an older function). */
  engaged?: boolean;
  engagementAt?: number | null;
}

/** The form. Held by the PAGE, not by this component (see header). */
export interface PractitionerDraft {
  requester_id: string;
  type: PractitionerKind;
  label: string;
  allowUnknown: boolean;
  allowShared: boolean;
}

/** Result of the last « Vérifier » (a `dryRun` call), for ONE code + type. */
export interface PractitionerCheck {
  code: string;
  type: PractitionerKind;
  probe: { status: 'ok' | 'unknown' | 'error'; dossierCount: number; patientCount: number };
  sharedWith: { uid: string; fullName: string; email: string | null }[];
  pendingAccessRequest: boolean;
}

interface Props {
  current: PractitionerDTO | null;
  /** Admin or owner. Staff see the access read-only. */
  canEdit: boolean;
  draft: PractitionerDraft;
  onDraft: (patch: Partial<PractitionerDraft>) => void;
  check: PractitionerCheck | null;
  busy: 'check' | 'activate' | 'remove' | null;
  error: string | null;
  notice: string | null;
  onCheck: () => void;
  onActivate: () => void;
  onRemove: () => void;
  fmtDate: (ms: number) => string;
}

export default function PractitionerCard({
  current,
  canEdit,
  draft,
  onDraft,
  check,
  busy,
  error,
  notice,
  onCheck,
  onActivate,
  onRemove,
  fmtDate,
}: Props) {
  const { t } = useTranslation('common');
  // In-page confirmation, never window.confirm() — see LinkedRequestersCard.
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const code = normalizePractitionerId(draft.requester_id);
  const label = draft.label.trim();
  // A verification is only valid for the exact code and type it was run on.
  const checkMatches = !!check && check.code === code && check.type === draft.type;
  const sameAsCurrent = !!current && current.requester_id === code;

  let lockReason: string | null = null;
  if (!code) lockReason = t('admin.pract_need_code', 'Saisissez le code du médecin.');
  else if (label.length < 3) lockReason = t('admin.pract_need_label', 'Indiquez le nom affiché.');
  else if (!checkMatches) lockReason = t('admin.pract_need_check', "Vérifiez d'abord le code.");
  else if (check!.probe.status === 'error')
    lockReason = t('admin.pract_probe_error', 'Le serveur de résultats ne répond pas. Réessayez dans quelques minutes.');
  else if (check!.probe.status === 'unknown' && !draft.allowUnknown)
    lockReason = t('admin.pract_need_unknown_ok', 'Cochez la confirmation ci-dessus pour activer quand même.');
  else if (check!.sharedWith.length > 0 && !draft.allowShared)
    lockReason = t('admin.pract_need_shared_ok', 'Cochez la confirmation de partage ci-dessus.');
  const canActivate = canEdit && lockReason === null && busy === null;

  const typeLabel = (type: string) =>
    type === 'correspondant'
      ? t('admin.pract_type_correspondant', 'Correspondant (clinique)')
      : t('admin.pract_type_medecin', 'Médecin');

  const inputClass =
    'w-full rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm';

  return (
    <div className="card p-6 space-y-5" data-testid="practitioner-card">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-lg bg-[var(--color-bordeaux-primary)]/10 text-[var(--color-bordeaux-primary)] flex items-center justify-center flex-shrink-0">
          <Stethoscope size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)]">
            {t('admin.pract_title', 'Accès médecin — « Mes patients »')}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t(
              'admin.pract_explain',
              "Donne à ce compte l'accès aux résultats des patients dont ce médecin est le prescripteur, et seulement ceux-là. Son propre dossier et ceux de ses proches ne changent pas."
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-[var(--status-error)]">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 text-sm text-[var(--status-success)]">
          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {/* Current access */}
      {current ? (
        <div className="flex items-start justify-between gap-3 rounded-lg p-3 bg-[var(--background-secondary)]">
          <div className="min-w-0">
            <p className="font-medium text-[var(--text-primary)] truncate">
              {t('admin.pract_active', 'Accès actif')} — {current.label}
            </p>
            {confirmingRemove ? (
              <p className="text-sm text-[var(--status-error)]">
                {t('admin.pract_remove_confirm', "Retirer l'accès médecin de ce compte ? Il ne verra plus aucun patient.")}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                <span dir="ltr">{current.requester_id}</span>
                {' · '}
                {typeLabel(current.type)}
                {current.linkedAt ? ` · ${t('admin.pract_since', 'activé le {{date}}', { date: fmtDate(current.linkedAt) })}` : ''}
                {' · '}
                {current.lastUsedAt
                  ? t('admin.pract_last_used', 'dernière consultation le {{date}}', { date: fmtDate(current.lastUsedAt) })
                  : t('admin.pract_never_used', 'pas encore consulté')}
              </p>
            )}
            {/* His confidentiality engagement: accepted on his request form or
                at his first visit — never by the lab on his behalf. */}
            {!confirmingRemove && current.engaged !== undefined && (
              <p
                className={`text-sm ${current.engaged ? 'text-[var(--status-success)]' : 'text-[var(--text-secondary)]'}`}
                data-testid="practitioner-engagement"
              >
                {current.engaged
                  ? current.engagementAt
                    ? t('admin.pract_engaged', 'Engagement de confidentialité accepté le {{date}}', {
                        date: fmtDate(current.engagementAt),
                      })
                    : t('admin.doctors_engaged_nodate', 'Engagement de confidentialité accepté')
                  : t('admin.pract_not_engaged', 'Engagement de confidentialité : il lui sera demandé à sa prochaine visite.')}
              </p>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {confirmingRemove ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingRemove(false);
                      onRemove();
                    }}
                    disabled={busy === 'remove'}
                    className="min-h-[44px] px-3 rounded-lg text-sm font-semibold text-[var(--color-white)] bg-[var(--status-error)] disabled:opacity-50"
                  >
                    {busy === 'remove' ? <Loader2 size={16} className="animate-spin" /> : t('admin.pract_remove_yes', 'Oui, retirer')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(false)}
                    className="min-h-[44px] px-3 rounded-lg text-sm text-[var(--text-secondary)]"
                  >
                    {t('cancel', 'Annuler')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  aria-label={t('admin.pract_remove', "Retirer l'accès")}
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[var(--status-error)]"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">
          {t('admin.pract_none', 'Aucun accès médecin sur ce compte.')}
        </p>
      )}

      {!canEdit ? (
        <p className="text-xs text-[var(--text-secondary)]">
          {t('admin.pract_admin_only', "Seul un administrateur peut modifier l'accès médecin.")}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canActivate) onActivate();
          }}
          className="space-y-4 pt-4 border-t border-[var(--border-default)]"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {t('admin.pract_code_label', 'Code du médecin dans Qalam')}
              </label>
              <input
                type="text"
                value={draft.requester_id}
                onChange={(e) => onDraft({ requester_id: e.target.value })}
                // NEVER a real code here — see the same rule in LinkedRequestersCard.
                placeholder={t('admin.pract_code_placeholder', 'Ex. : DRCODE')}
                dir="ltr"
                autoCapitalize="characters"
                autoComplete="off"
                className={`${inputClass} uppercase`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {t('admin.pract_type_label', 'Type')}
              </label>
              <select
                value={draft.type}
                onChange={(e) => onDraft({ type: e.target.value as PractitionerKind })}
                className={inputClass}
              >
                <option value="medecin">{t('admin.pract_type_medecin', 'Médecin')}</option>
                <option value="correspondant">{t('admin.pract_type_correspondant', 'Correspondant (clinique)')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('admin.pract_label_label', 'Nom affiché')}
            </label>
            <input
              type="text"
              maxLength={60}
              value={draft.label}
              onChange={(e) => onDraft({ label: e.target.value })}
              placeholder={t('admin.pract_label_placeholder', 'Ex. : Dr Nom Prénom')}
              className={inputClass}
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('admin.pract_code_hint', 'Le code est celui de la fiche Prescripteur de Qalam (il figure aussi sur la notification « Serveur Résultat »).')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onCheck}
              disabled={!code || busy !== null}
              className="min-h-[44px] px-4 rounded-lg border border-[var(--border-default)] text-[var(--text-primary)] disabled:opacity-50 flex items-center gap-2"
            >
              {busy === 'check' ? <Loader2 size={18} className="animate-spin" /> : <SearchCheck size={18} />}
              {busy === 'check' ? t('admin.pract_checking', 'Vérification…') : t('admin.pract_check', 'Vérifier le code')}
            </button>
          </div>

          {/* What the lab server answered — for THIS code and type only */}
          {checkMatches && check && (
            <div className="space-y-3" data-testid="practitioner-check">
              {check.probe.status === 'ok' && (
                <div className="flex items-start gap-2 text-sm text-[var(--status-success)]">
                  <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {t('admin.pract_probe_ok', 'Le serveur du laboratoire connaît ce code : {{dossiers}} bilan(s), {{patients}} patient(s).', {
                      dossiers: check.probe.dossierCount,
                      patients: check.probe.patientCount,
                    })}
                  </span>
                </div>
              )}
              {check.probe.status === 'unknown' && (
                <div className="rounded-lg p-3 bg-[var(--background-tertiary)] space-y-2">
                  <p className="text-sm text-[var(--text-primary)]">
                    {t('admin.pract_probe_unknown', 'Le serveur du laboratoire ne connaît encore aucun dossier pour ce code.')}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {t(
                      'admin.pract_probe_unknown_help',
                      'Vérifiez dans Qalam que la case « Serveur Résultat » du prescripteur est active, et qu’au moins un de ses dossiers est parti (écran du prescripteur, « Envois »).'
                    )}
                  </p>
                  <label className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={draft.allowUnknown}
                      onChange={(e) => onDraft({ allowUnknown: e.target.checked })}
                      className="mt-1"
                    />
                    <span>{t('admin.pract_allow_unknown', 'Activer quand même : ses bilans apparaîtront dès leur envoi.')}</span>
                  </label>
                </div>
              )}
              {check.probe.status === 'error' && (
                <div className="flex items-start gap-2 text-sm text-[var(--status-error)]">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{t('admin.pract_probe_error', 'Le serveur de résultats ne répond pas. Réessayez dans quelques minutes.')}</span>
                </div>
              )}
              {check.sharedWith.length > 0 && (
                <div className="rounded-lg p-3 bg-[var(--background-tertiary)] space-y-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {t('admin.pract_shared', 'Ce code est déjà rattaché à :')}
                  </p>
                  <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                    {check.sharedWith.map((a) => (
                      <li key={a.uid}>{a.fullName || a.email || a.uid}</li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={draft.allowShared}
                      onChange={(e) => onDraft({ allowShared: e.target.checked })}
                      className="mt-1"
                    />
                    <span>
                      {t('admin.pract_allow_shared', 'Je confirme : ce compte aura aussi accès à cette patientèle (par exemple la secrétaire du médecin).')}
                    </span>
                  </label>
                </div>
              )}
              {check.pendingAccessRequest && (
                <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <Info size={18} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {t(
                      'admin.pract_pending_request',
                      "Ce compte a aussi une demande d'accès patient en attente (créée automatiquement à l'inscription). Si le médecin n'a pas de dossier au laboratoire, refusez-la dans l'onglet Demandes."
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <button
              type="submit"
              disabled={!canActivate}
              className="button-bordeaux justify-center disabled:opacity-60 flex items-center gap-2"
            >
              {busy === 'activate' ? <Loader2 size={18} className="animate-spin" /> : <Stethoscope size={18} />}
              {busy === 'activate'
                ? t('admin.pract_activating', 'Activation…')
                : sameAsCurrent
                  ? t('admin.pract_update', 'Enregistrer les modifications')
                  : t('admin.pract_activate', "Activer l'accès médecin")}
            </button>
            {/* A locked button always says why — a grey button with no reason is
                how staff conclude the screen is broken. */}
            {lockReason && busy === null && (
              <p className="text-xs text-[var(--text-secondary)]">{lockReason}</p>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            {t(
              'admin.pract_rule_hint',
              "Le médecin ne verra que les bilans qu'il a lui-même prescrits : c'est le serveur du laboratoire qui applique cette règle."
            )}
          </p>
        </form>
      )}
    </div>
  );
}
