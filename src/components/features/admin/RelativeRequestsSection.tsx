'use client';

/**
 * "Demandes de dossier d'un proche" — the staff queue for patients who asked, in
 * the app, to consult a relative's results.
 *
 * Presentational only, like the other admin sub-components: every callable lives
 * in `/admin/page.tsx`.
 *
 * Two things this screen does that the direct-attach card does not:
 *  - it shows the relative's NAME and DATE OF BIRTH, because the patient never
 *    supplies a dossier number — the staff looks the record up from these;
 *  - it REQUIRES a proof before granting. "On what basis was this access
 *    opened?" is the question the lab will be asked if an access is ever
 *    contested, and a link that only records who created it answers nothing.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, Loader2, UserPlus, X } from 'lucide-react';
import type { RequesterType } from '@/types/cyberlab';

export type LinkProof = 'present' | 'procuration' | 'autorite_parentale';

export interface RelativeRequest {
  id: string;
  uid: string;
  fullName: string;
  email: string | null;
  phone: string;
  relationship: string;
  relativeName: string;
  relativeDob: string;
  relativePhone: string;
  createdAt: number | null;
}

export interface RelativeInputs {
  requester_id: string;
  type: RequesterType;
  proof: LinkProof | '';
  /** Staff ticked "this really is the same person" despite differing names. */
  confirmed?: boolean;
}

/** What a staff probe returned for one requester_id. */
export interface TestedId {
  status: 'ok' | 'empty' | 'error';
  name: string;
  count: number;
}

interface Props {
  requests: RelativeRequest[];
  inputs: Record<string, RelativeInputs>;
  onInput: (id: string, patch: Partial<RelativeInputs>) => void;
  busyId: string | null;
  error: string | null;
  message: string | null;
  onFulfill: (req: RelativeRequest) => void;
  onReject: (req: RelativeRequest) => void;
  onTest: (requesterId: string, type: RequesterType) => void;
  /** requester_ids probed in this session, keyed by id. */
  tested: Record<string, TestedId>;
  fmtDate: (iso: string) => string;
  fmtWhenTime: (ms?: number | null) => string;
}

const PROOFS: LinkProof[] = ['present', 'procuration', 'autorite_parentale'];

/** lowercase, no accents, single spaces. */
const norm = (x: string): string =>
  x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Do the name the patient typed and the name the lab returned designate the
 * same person?
 *
 * Compares the SET of words, ignoring order, case and accents — the lab writes
 * "EL ALLALI mohamed aziz", a patient may write "Mohamed Aziz El Allali", and
 * those are the same person.
 *
 * ⚠ It used to compare only the FIRST word, which inside a family is the family
 * name and is therefore identical for everyone: "EL ALLALI mohamed aziz" vs
 * "El Allali Hassan" compared equal, so the warning never fired in the one
 * situation it existed for. Any difference now counts as a difference, and the
 * staff has to tick a box. A false alarm costs one click; a missed homonym
 * opens a stranger's medical record.
 */
function namesAgree(asked: string, returned: string): boolean {
  if (!returned.trim()) return false;
  const words = (x: string) => new Set(norm(x).split(' ').filter(Boolean));
  const a = words(asked);
  const b = words(returned);
  if (a.size === 0 || b.size === 0) return false;
  if (a.size !== b.size) return false;
  for (const w of a) if (!b.has(w)) return false;
  return true;
}

export default function RelativeRequestsSection({
  requests,
  inputs,
  onInput,
  busyId,
  error,
  message,
  onFulfill,
  onReject,
  onTest,
  tested,
  fmtDate,
  fmtWhenTime,
}: Props) {
  const { t } = useTranslation('common');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const inputClass =
    'w-full rounded-lg px-3 py-2.5 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm';

  // ⚠ There used to be an early return for the empty list, ABOVE the message
  // block below. Granting or refusing the LAST request empties the list, so the
  // component took that branch and the confirmation message — correctly
  // computed — was never rendered. The operator saw the card vanish in silence
  // after handing someone access to a third party's medical record. The empty
  // state is now part of the normal render, after the message.
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-[var(--text-primary)]">
          {t('admin.rel_req_title', "Demandes de dossier d'un proche")}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t(
            'admin.rel_req_intro',
            "Le patient ne connaît pas le numéro de dossier de son proche : retrouvez-le à partir du nom et de la date de naissance ci-dessous."
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
          className="flex items-start gap-2 rounded-lg p-3 bg-[var(--background-tertiary)] text-[var(--color-bordeaux-primary)]"
        >
          <Check size={18} className="flex-shrink-0 mt-0.5" />
          <span className="font-medium">{message}</span>
        </div>
      )}

      {requests.length === 0 && (
        <div className="card p-6">
          <p className="text-sm text-[var(--text-secondary)]">
            {t('admin.rel_req_none', 'Aucune demande en attente.')}
          </p>
        </div>
      )}

      {requests.map((req) => {
        const v = inputs[req.id] ?? { requester_id: '', type: 'patient' as RequesterType, proof: '' };
        const id = v.requester_id.trim();
        const probe = id ? tested[id] : undefined;
        // Three conditions, and the probe is the one that matters: the patient
        // supplied only a name and a date of birth, so the ONLY way to know the
        // id belongs to the right person is to look at the name the lab returns.
        const agree = probe ? namesAgree(req.relativeName, probe.name) : false;
        // The tick is required whenever the two names are not the same set of
        // words. The probe alone is no longer enough: it proved the operator
        // clicked "Tester", not that they READ the answer -- and reading it is
        // the entire point when the patient only supplied a name.
        const ready =
          id !== '' && v.proof !== '' && probe !== undefined && (agree || v.confirmed === true);
        return (
          <div key={req.id} className="card p-6 space-y-4">
            {/* Who is asking */}
            <div className="pb-3 border-b border-[var(--border-default)]">
              <p className="font-semibold text-[var(--text-primary)]">{req.fullName}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {req.email && <span className="break-all">{req.email}</span>}
                {req.email && req.phone && ' · '}
                {req.phone}
              </p>
              {req.createdAt && (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('admin.req_created_at', 'Demandé le')} {fmtWhenTime(req.createdAt)}
                </p>
              )}
            </div>

            {/* Who they want to consult — the search key for the staff */}
            <div className="rounded-lg p-3 bg-[var(--background-secondary)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
                {t('admin.rel_req_who', 'Proche concerné')}
              </p>
              <p className="font-medium text-[var(--text-primary)]">{req.relativeName}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {t(`admin.rel_req_rel_${req.relationship}`, req.relationship)}
                {req.relativeDob && ` · ${t('admin.dob_label', 'Date de naissance')} : ${fmtDate(req.relativeDob)}`}
                {req.relativePhone && ` · ${req.relativePhone}`}
              </p>
            </div>

            {/* Grant */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t('admin.rel_req_id', 'Identifiant du dossier trouvé')}
                </label>
                <input
                  type="text"
                  value={v.requester_id}
                  onChange={(e) => onInput(req.id, { requester_id: e.target.value })}
                  placeholder={t('admin.link_id_placeholder', 'Ex. : 12345')}
                  dir="ltr"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t('admin.type_label', 'Type')}
                </label>
                <select
                  value={v.type}
                  onChange={(e) => onInput(req.id, { type: e.target.value as RequesterType })}
                  className={inputClass}
                >
                  <option value="patient">{t('admin.type_patient', 'Patient')}</option>
                  <option value="medecin">{t('admin.type_medecin', 'Médecin')}</option>
                  <option value="correspondant">{t('admin.type_correspondant', 'Correspondant')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {t('admin.rel_req_proof', "Sur quelle base accordez-vous l'accès ?")}
              </label>
              <select
                value={v.proof}
                onChange={(e) => onInput(req.id, { proof: e.target.value as LinkProof | '' })}
                className={inputClass}
              >
                <option value="">{t('admin.rel_req_proof_choose', '— Choisir —')}</option>
                {PROOFS.map((p) => (
                  <option key={p} value={p}>
                    {t(`admin.rel_req_proof_${p}`, p)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t(
                  'admin.rel_req_proof_hint',
                  "Cette mention est conservée. C'est la seule trace dont disposera le laboratoire si cet accès est un jour contesté."
                )}
              </p>
            </div>

            {/* What the lab server answered for this id. This is the homonym
                check: the patient never gave a dossier number, so the returned
                name is the only evidence the id belongs to the right person. */}
            {probe && (
              <div
                className={`rounded-lg p-3 text-sm ${
                  agree
                    ? 'bg-[var(--background-tertiary)] text-[var(--text-secondary)]'
                    : 'bg-[var(--status-error)]/10'
                }`}
              >
                {/* The two names SIDE BY SIDE, same size, same weight. They used
                    to sit 250px apart in different typography, which is how
                    "EL ALLALI mohamed aziz" and "El Allali Hassan" read as the
                    same thing to someone in a hurry. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                      {t('admin.rel_req_name_asked', 'Nom demandé par le patient')}
                    </p>
                    <p className="font-semibold text-[var(--text-primary)]">{req.relativeName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                      {t('admin.rel_req_name_lab', 'Nom renvoyé par le laboratoire')}
                    </p>
                    <p
                      className={`font-semibold ${
                        agree ? 'text-[var(--text-primary)]' : 'text-[var(--status-error)]'
                      }`}
                    >
                      {probe.name ||
                        t('admin.rel_req_tested_noname', 'Aucun nom renvoyé pour cet identifiant.')}
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-[var(--text-secondary)]">
                  {probe.status === 'ok'
                    // `n`, not `count`: i18next treats `count` as a plural
                    // selector and would demand the six Arabic CLDR forms.
                    ? t('admin.rel_req_tested_count', '{{n}} dossier(s) trouvé(s).', {
                      n: probe.count,
                    })
                    : t('admin.rel_req_tested_empty', 'Aucun dossier pour cet identifiant — vérifiez le numéro.')}
                </p>

                {agree ? (
                  <p className="mt-2 flex items-center gap-2 text-[var(--color-bordeaux-primary)]">
                    <Check size={16} />
                    {t('admin.rel_req_name_match', 'Les deux noms correspondent.')}
                  </p>
                ) : (
                  <div className="mt-3 pt-3 border-t border-[var(--status-error)]/30">
                    <p className="font-semibold text-[var(--status-error)]">
                      {t(
                        'admin.rel_req_name_differ',
                        "Ces deux noms ne sont pas identiques. Il peut s'agir d'un homonyme."
                      )}
                    </p>
                    <label className="mt-2 flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={v.confirmed === true}
                        onChange={(e) => onInput(req.id, { confirmed: e.target.checked })}
                        className="mt-1 h-4 w-4 flex-shrink-0"
                      />
                      <span className="text-[var(--text-primary)]">
                        {t(
                          'admin.rel_req_confirm_same',
                          "Je confirme qu'il s'agit bien de la même personne."
                        )}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Grant row. "Refuser" is NOT here: two buttons side by side, one
                confirming in the same spot, is how a legitimate request gets
                refused by a double click. */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => id && onTest(id, v.type)}
                disabled={!id}
                className="min-h-[44px] px-4 rounded-lg border border-[var(--border-default)] text-[var(--text-primary)] disabled:opacity-50"
              >
                {probe
                  ? t('admin.rel_req_test_again', 'Retester')
                  : t('admin.link_test_first', "Tester d'abord")}
              </button>
              <button
                type="button"
                onClick={() => onFulfill(req)}
                disabled={!ready || busyId === req.id}
                className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-60"
              >
                {busyId === req.id ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                {t('admin.rel_req_grant', 'Rattacher')}
              </button>
            </div>

            {/* Say WHY the button is locked, rather than leaving a grey button. */}
            {!ready && (
              <p className="text-xs text-[var(--text-secondary)]">
                {!id
                  ? t('admin.rel_req_need_id', "Renseignez l'identifiant du dossier.")
                  : !probe
                    ? t('admin.rel_req_need_test', "Testez l'identifiant avant de rattacher : c'est le seul moyen de vérifier que le dossier est bien celui de cette personne.")
                    : !agree && v.confirmed !== true
                      ? t('admin.rel_req_need_confirm', "Les deux noms diffèrent : confirmez qu'il s'agit de la même personne.")
                      : t('admin.rel_req_need_proof', "Indiquez sur quelle base vous accordez l'accès.")}
              </p>
            )}

            {/* Refusal, on its own row, below a separator and visually quiet. */}
            <div className="pt-3 border-t border-[var(--border-default)]">
              {confirmingId === req.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[var(--text-secondary)]">
                    {t('admin.rel_req_reject_confirm', 'Refuser la demande de {{name}} ?', {
                      name: req.fullName,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingId(null);
                      onReject(req);
                    }}
                    className="min-h-[44px] px-4 rounded-lg text-sm font-semibold text-[var(--color-white)] bg-[var(--status-error)]"
                  >
                    {t('admin.rel_req_reject_yes', 'Oui, refuser')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="min-h-[44px] px-3 rounded-lg text-sm text-[var(--text-secondary)]"
                  >
                    {t('cancel', 'Annuler')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(req.id)}
                  className="flex items-center gap-2 min-h-[44px] text-sm underline text-[var(--text-secondary)]"
                >
                  <X size={16} />
                  {t('admin.rel_req_reject', 'Refuser cette demande')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
