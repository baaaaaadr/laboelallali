'use client';

/**
 * « Demandes d'accès médecin » — the queue of doctors who asked from the app
 * (invitation link → « Demander mon accès médecin »). Top of the « Médecins »
 * tab, when requests wait. See docs/pages/admin.md and docs/pages/mes-patients.md.
 *
 * Presentational only, like the other admin sub-components: state and callables
 * live in `/admin/page.tsx`.
 *
 * The request carries what the lab needs to find the doctor in Qalam: his name
 * AS PRINTED ON HIS PRESCRIPTIONS, plus his specialty and city when he gave
 * them. « Ouvrir la fiche » jumps to the Patients tab with his account selected
 * and the « Accès médecin » card prefilled with that name — the admin types the
 * Qalam code, « Vérifier », « Activer »; the activation closes the request.
 *
 * Activating and refusing are ADMIN acts (the server enforces it); a stagiaire
 * sees the queue and can open the account, read-only.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, CheckCircle, ExternalLink, Stethoscope } from 'lucide-react';

export interface PractitionerRequest {
  uid: string;
  fullName: string;
  email: string | null;
  phone: string;
  /** His name as printed on his prescriptions. */
  label: string;
  specialty: string;
  place: string;
  createdAt: number | null;
  /** He ticked the confidentiality engagement (optional: older function). */
  engagementAt?: number | null;
}

interface Props {
  requests: PractitionerRequest[];
  /** Admin level: may activate (from the account) and refuse. */
  canAct: boolean;
  busyUid: string | null;
  error: string | null;
  message: string | null;
  onOpen: (req: PractitionerRequest) => void;
  onReject: (req: PractitionerRequest) => void;
  fmtWhenTime: (ms: number) => string;
}

export default function PractitionerRequestsSection({
  requests,
  canAct,
  busyUid,
  error,
  message,
  onOpen,
  onReject,
  fmtWhenTime,
}: Props) {
  const { t } = useTranslation('common');
  // Refusing is two clicks on purpose, and never next to « Ouvrir » (same rule
  // as the relative-request queue: a double click must not refuse a doctor).
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="space-y-4" data-testid="pract-requests">
      <div>
        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Stethoscope size={18} className="text-[var(--color-bordeaux-primary)]" />
          {t('admin.pract_req_title', 'Demandes d’accès médecin')}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t(
            'admin.pract_req_intro',
            'Trouvez le code du médecin dans Qalam (fiche Prescripteur, « Serveur Résultat » = Oui), puis activez son accès depuis sa fiche.'
          )}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-[var(--status-error)]">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg p-3 bg-[var(--background-tertiary)] text-[var(--status-success)]"
        >
          <Check size={18} className="flex-shrink-0 mt-0.5" />
          <span className="font-medium">{message}</span>
        </div>
      )}

      {requests.length === 0 && (
        <div className="card p-6 text-center text-sm text-[var(--text-secondary)]" data-testid="pract-requests-empty">
          {t('admin.pract_req_empty', 'Aucune demande d’accès médecin en attente.')}
        </div>
      )}

      {requests.map((req) => {
        const busy = busyUid === req.uid;
        const details = [req.specialty, req.place].filter(Boolean).join(' · ');
        return (
          <div key={req.uid} className="card p-6 space-y-4" data-testid="pract-request">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                {t('admin.pract_req_label', 'Nom sur ses ordonnances')}
              </p>
              <p className="font-semibold text-[var(--text-primary)]">{req.label}</p>
              {details && <p className="text-sm text-[var(--text-secondary)]">{details}</p>}
            </div>
            <div className="text-sm text-[var(--text-secondary)] pb-3 border-b border-[var(--border-default)] space-y-0.5">
              <p>
                {t('admin.pract_req_account', 'Compte')} : <span className="text-[var(--text-primary)]">{req.fullName}</span>
              </p>
              <p>
                {req.email && <span className="break-all">{req.email}</span>}
                {req.email && req.phone && ' · '}
                {req.phone && <span dir="ltr">{req.phone}</span>}
              </p>
              {req.createdAt != null && (
                <p>
                  {t('admin.req_created_at', 'Demandé le')} {fmtWhenTime(req.createdAt)}
                </p>
              )}
              {req.engagementAt != null && (
                <p className="flex items-center gap-1.5 text-[var(--status-success)]" data-testid="pract-request-engaged">
                  <CheckCircle size={14} className="flex-shrink-0" />
                  {t('admin.pract_req_engaged', 'Engagement de confidentialité accepté')}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onOpen(req)}
              disabled={busy}
              className="button-bordeaux justify-center w-full sm:w-auto disabled:opacity-60"
              data-testid="pract-request-open"
            >
              <ExternalLink size={18} />
              {canAct
                ? t('admin.pract_req_open', 'Ouvrir sa fiche et activer')
                : t('admin.pract_req_open_readonly', 'Ouvrir sa fiche')}
            </button>

            {canAct ? (
              <div className="pt-3 border-t border-[var(--border-default)]">
                {confirming === req.uid ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                        onReject(req);
                      }}
                      disabled={busy}
                      className="font-semibold text-[var(--status-error)] underline"
                      data-testid="pract-request-reject-confirm"
                    >
                      {t('admin.pract_req_reject_confirm', 'Oui, refuser la demande')}
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className="text-[var(--text-secondary)] underline">
                      {t('cancel', 'Annuler')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(req.uid)}
                    disabled={busy}
                    className="text-sm text-[var(--text-secondary)] underline"
                    data-testid="pract-request-reject"
                  >
                    {t('admin.pract_req_reject', 'Refuser la demande')}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">
                {t('admin.pract_admin_only', 'Seul un administrateur peut modifier l’accès médecin.')}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
