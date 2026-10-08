'use client';

/**
 * "Dossiers d'un proche" — the front-desk screen that attaches a relative's lab
 * dossier to a patient's account (the "ayant droit" case: an adult child
 * consulting their parents' results).
 *
 * Presentational only, like `RelancesTab` and `AdminDashboard`: every callable
 * lives in `/admin/page.tsx` and arrives here as a handler.
 *
 * Two details carry most of the value:
 *  - **"Tester d'abord"** jumps to the Tester tab with the id prefilled. A wrong
 *    id here shows patient X's medical results to patient Y, and nothing in the
 *    patient's own screen would reveal the mistake — so staff must confirm the
 *    id returns the right dossiers BEFORE attaching it.
 *  - **The reassurance line.** Staff (and patients) assume attaching a dossier
 *    moves it. It does not: the holder's own account keeps working identically.
 *    Saying so on screen prevents a refusal born of a misunderstanding.
 *
 * And one repair (07/10/2026): « Le passer en dossier d'un proche ». A parent
 * who never had a test came with his daughter; the front desk typed HER number
 * as HIS main dossier. It worked, but the app presented her results as his
 * (« votre dernier bilan », her number on his barcode), and his first own test
 * would have overwritten it. This moves the main dossier into the relatives,
 * with a label, in one server transaction (`adminLinkRequester` + `fromOwn`).
 *
 * And the relative's IDENTITY (Dr Aziz, 08/10/2026): last name, first name and
 * date of birth, typed as in Qalam, required on every new attachment and
 * completable on the old ones (« Compléter l'identité » → `adminSetLinkIdentity`).
 * Aziz typed the mother's name in the search and found nothing: the app knew
 * her only as « Maman » of her daughter. A row found THROUGH the search is
 * highlighted (`highlightIds`).
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowDownToLine, CheckCircle, Link2, Loader2, Pencil, Search, Trash2, Users } from 'lucide-react';
import type { RequesterType } from '@/types/cyberlab';
import RelativeIdentityFields from './RelativeIdentityFields';
import {
  EMPTY_IDENTITY,
  identityLabel,
  parseRelativeIdentity,
  type IdentityField,
  type RelativeIdentity,
} from '@/lib/results/relativeIdentity';

export interface LinkRow {
  requester_id: string;
  type: string;
  label: string;
  linkedAt: number | null;
  /** The relative's identity ("" / absent on links made before 08/10/2026). */
  lastName?: string;
  firstName?: string;
  dateOfBirth?: string;
}

export interface AuditAccount {
  uid: string;
  fullName: string;
  email: string | null;
  isSelf: boolean;
  label: string;
  linkedAt: number | null;
}

/** The attach form's fields. Held by the PAGE, not by this component. */
export interface LinkDraft {
  requester_id: string;
  type: RequesterType;
  label: string;
  /** The relative's identity, as in Qalam (08/10/2026). */
  lastName: string;
  firstName: string;
  dateOfBirth: string;
}

interface Props {
  /** null while loading. */
  links: LinkRow[] | null;
  error: string | null;
  /** 'add', or the requester_id currently being removed. */
  busy: string | null;
  notice: string | null;
  /** Who else can read the dossier that was just attached. null = not asked. */
  audit: AuditAccount[] | null;
  /**
   * What is currently typed in the attach form.
   *
   * ⚠ It lives in the page on purpose. These three fields used to be local
   * `useState` here — and the Patients tab is rendered as
   * `{activeTab === 'patients' && …}`, so clicking "Tester d'abord" unmounted
   * this component and destroyed everything the operator had typed. Dr Aziz hit
   * exactly that on the first real use: he came back to an empty form.
   */
  draft: LinkDraft;
  onDraft: (patch: Partial<LinkDraft>) => void;
  onAdd: (requesterId: string, type: RequesterType, label: string, identity: RelativeIdentity) => void;
  onRemove: (requesterId: string) => void;
  onTest: (requesterId: string, type: RequesterType) => void;
  fmtDate: (ms: number) => string;
  /** "YYYY-MM-DD" → long date (a relative's date of birth). */
  fmtDob?: (iso: string) => string;
  /** The account's MAIN dossier (null when it has none) — offered to be moved here. */
  ownDossier?: string | null;
  /** Move the main dossier into the relatives, with this label and identity. */
  onMoveOwn?: (label: string, identity: RelativeIdentity) => void;
  /** Complete or correct the identity of an attached relative. */
  onSetIdentity?: (requesterId: string, identity: RelativeIdentity) => void;
  /** The name the lab returned for a probed dossier (« Tester »), if any. */
  labNameFor?: (requesterId: string) => string | undefined;
  /** Rows the admin search matched (found by the relative's name or date). */
  highlightIds?: string[];
}

export default function LinkedRequestersCard({
  links,
  error,
  busy,
  notice,
  audit,
  draft,
  onDraft,
  onAdd,
  onRemove,
  onTest,
  fmtDate,
  fmtDob = (iso) => iso,
  ownDossier = null,
  onMoveOwn,
  onSetIdentity,
  labNameFor,
  highlightIds = [],
}: Props) {
  const { t } = useTranslation('common');
  // « Le passer en dossier d'un proche » — opened on demand, never by default:
  // most main dossiers ARE the account holder's.
  const [moving, setMoving] = useState(false);
  const [moveLabel, setMoveLabel] = useState('');
  const [moveIdentity, setMoveIdentity] = useState<RelativeIdentity>({ ...EMPTY_IDENTITY });
  // The row whose identity is being completed, and what is typed.
  const [identityFor, setIdentityFor] = useState<string | null>(null);
  const [identityDraft, setIdentityDraft] = useState<RelativeIdentity>({ ...EMPTY_IDENTITY });
  const newId = draft.requester_id;
  // Always 'patient', whatever an older draft held: a relative is a patient
  // dossier by definition, and the server refuses anything else.
  const newType: RequesterType = 'patient';
  const newLabel = draft.label;
  // Which row is asking "are you sure?". An IN-PAGE confirmation, not
  // window.confirm(). The native dialog was tried and replaced: it is painted by
  // the browser chrome, outside the page, so nothing but a human at that exact
  // screen can see or dismiss it. Observed on 17/09/2026 — a browser agent
  // running the test hung on it, seeing an unresponsive page, until a person
  // clicked. Same class of problem for screen readers driven remotely and for
  // installed PWAs, where native dialogs render inconsistently. A confirmation
  // that only sometimes exists is worse than none on an action that revokes
  // access to a medical record.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const newIdentity: RelativeIdentity = {
    lastName: draft.lastName ?? '',
    firstName: draft.firstName ?? '',
    dateOfBirth: draft.dateOfBirth ?? '',
  };
  const newCheck = parseRelativeIdentity(newIdentity);
  const fieldName = (f: IdentityField) =>
    f === 'lastName'
      ? t('admin.rel_last_name', 'Nom du proche')
      : f === 'firstName'
        ? t('admin.rel_first_name', 'Prénom du proche')
        : t('admin.rel_dob', 'Date de naissance du proche');
  // A locked button always says why.
  const addWhy = !newId.trim()
    ? null
    : !newLabel.trim()
      ? t('admin.link_need_label', 'Indiquez de qui il s’agit (le libellé que le patient verra).')
      : !newCheck.ok
        ? t('admin.rel_need_field', 'À compléter : {{field}}.', { field: fieldName(newCheck.field) })
        : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newLabel.trim() || !newCheck.ok) return;
    // The page clears the draft once the attach succeeds — clearing it here
    // would wipe the operator's input even when the callable rejects it.
    onAdd(newId.trim(), newType, newLabel.trim(), newCheck.value);
  };
  const moveCheck = parseRelativeIdentity(moveIdentity);
  const editCheck = parseRelativeIdentity(identityDraft);

  const inputClass =
    'w-full rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm';

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-lg bg-[var(--color-fuchsia-accent)]/10 text-[var(--color-fuchsia-accent)] flex items-center justify-center flex-shrink-0">
          <Users size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)]">
            {t('admin.link_title', "Dossiers d'un proche rattachés à ce compte")}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t(
              'admin.link_explain',
              "Cela n'enlève rien au titulaire du dossier : son propre compte continue de fonctionner à l'identique."
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

      {/* Existing links */}
      {links === null ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <Loader2 size={16} className="animate-spin" />
          {t('admin.link_loading', 'Chargement…')}
        </div>
      ) : links.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {t('admin.link_none', 'Aucun dossier rattaché à ce compte.')}
        </p>
      ) : (
        <ul className="space-y-2">
          {links.map((l) => {
            const found = highlightIds.includes(l.requester_id);
            const who = identityLabel(l);
            return (
            <li
              key={l.requester_id}
              className="rounded-lg p-3 bg-[var(--background-secondary)] space-y-3"
              style={found ? { boxShadow: 'inset 0 0 0 2px var(--color-fuchsia-accent)' } : undefined}
              data-testid="link-row"
              data-id={l.requester_id}
            >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-[var(--text-primary)] truncate">{l.label}</p>
                {found && (
                  <p className="flex items-center gap-1 text-xs font-semibold text-[var(--color-fuchsia-accent)]" data-testid="link-found">
                    <Search size={12} className="flex-shrink-0" />
                    {t('admin.rel_found_by_search', 'Trouvé par votre recherche')}
                  </p>
                )}
                {/* The relative's identity — or the invitation to complete it. */}
                {who ? (
                  <p className="text-sm text-[var(--text-primary)]" data-testid="link-identity">
                    {who}
                    {l.dateOfBirth ? ` · ${t('admin.rel_born', 'né(e) le {{date}}', { date: fmtDob(l.dateOfBirth) })}` : ''}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--status-warning)]" data-testid="link-identity-missing">
                    {t('admin.rel_identity_missing', 'Identité non renseignée : introuvable par son nom.')}
                  </p>
                )}
                {confirmingId === l.requester_id ? (
                  <p className="text-sm text-[var(--status-error)]">
                    {t('admin.link_remove_confirm', 'Retirer « {{label}} » de ce compte ?', {
                      label: l.label,
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    <span dir="ltr">{l.requester_id}</span>
                    {' · '}
                    {l.type}
                    {l.linkedAt ? ` · ${fmtDate(l.linkedAt)}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {confirmingId === l.requester_id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingId(null);
                        onRemove(l.requester_id);
                      }}
                      disabled={busy === l.requester_id}
                      className="min-h-[44px] px-3 rounded-lg text-sm font-semibold text-[var(--color-white)] bg-[var(--status-error)] disabled:opacity-50"
                    >
                      {busy === l.requester_id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        t('admin.link_remove_yes', 'Oui, retirer')
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="min-h-[44px] px-3 rounded-lg text-sm text-[var(--text-secondary)]"
                    >
                      {t('cancel', 'Annuler')}
                    </button>
                  </>
                ) : (
                  <>
                    {onSetIdentity && identityFor !== l.requester_id && (
                      <button
                        type="button"
                        onClick={() => {
                          setIdentityFor(l.requester_id);
                          setIdentityDraft({
                            lastName: l.lastName || '',
                            firstName: l.firstName || '',
                            dateOfBirth: l.dateOfBirth || '',
                          });
                        }}
                        aria-label={
                          who
                            ? t('admin.rel_identity_edit', 'Modifier l’identité')
                            : t('admin.rel_identity_complete', 'Compléter l’identité')
                        }
                        title={
                          who
                            ? t('admin.rel_identity_edit', 'Modifier l’identité')
                            : t('admin.rel_identity_complete', 'Compléter l’identité')
                        }
                        className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[var(--text-secondary)]"
                        data-testid="link-identity-open"
                      >
                        <Pencil size={17} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onTest(l.requester_id, l.type as RequesterType)}
                      className="text-sm underline text-[var(--text-secondary)] min-h-[44px] px-2"
                    >
                      {t('admin.link_test', 'Tester')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(l.requester_id)}
                      aria-label={t('admin.link_remove', 'Retirer')}
                      className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[var(--status-error)]"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* Complete / correct the identity — touches nothing else. */}
            {identityFor === l.requester_id && onSetIdentity && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editCheck.ok) onSetIdentity(l.requester_id, editCheck.value);
                }}
                className="space-y-3 pt-3 border-t border-[var(--border-default)]"
                data-testid="link-identity-form"
              >
                <RelativeIdentityFields
                  idPrefix={`link-id-${l.requester_id}`}
                  value={identityDraft}
                  onChange={(patch) => setIdentityDraft((d) => ({ ...d, ...patch }))}
                  labName={labNameFor?.(l.requester_id)}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={!editCheck.ok || busy === `identity:${l.requester_id}`}
                    className="button-bordeaux justify-center disabled:opacity-60 flex items-center gap-2"
                    data-testid="link-identity-save"
                  >
                    {busy === `identity:${l.requester_id}` && <Loader2 size={18} className="animate-spin flex-shrink-0" />}
                    {t('admin.rel_identity_save', 'Enregistrer l’identité')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdentityFor(null)}
                    className="min-h-[44px] px-4 rounded-lg text-sm text-[var(--text-secondary)]"
                  >
                    {t('cancel', 'Annuler')}
                  </button>
                  {!editCheck.ok && (
                    <span className="text-xs text-[var(--text-secondary)]">
                      {t('admin.rel_need_field', 'À compléter : {{field}}.', { field: fieldName(editCheck.field) })}
                    </span>
                  )}
                </div>
              </form>
            )}
            </li>
            );
          })}
        </ul>
      )}

      {/* The main dossier is in fact a relative's (a parent who never had a
          test, his child's number typed as his own): move it here. */}
      {ownDossier && onMoveOwn && (
        <div className="rounded-lg p-3 border border-dashed border-[var(--border-default)] space-y-3" data-testid="link-move-own">
          <p className="text-sm text-[var(--text-secondary)]">
            {t('admin.link_move_intro', 'Dossier principal de ce compte : {{id}}. Est-ce en fait celui d’un proche (son enfant, un parent) ?', {
              id: ownDossier,
            })}
          </p>
          {!moving ? (
            <button
              type="button"
              onClick={() => setMoving(true)}
              className="flex items-center gap-2 min-h-[44px] text-sm font-medium underline text-[var(--text-primary)]"
              data-testid="link-move-open"
            >
              <ArrowDownToLine size={16} />
              {t('admin.link_move_open', 'Le passer en dossier d’un proche')}
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (moveLabel.trim() && moveCheck.ok) onMoveOwn(moveLabel.trim(), moveCheck.value);
              }}
              className="space-y-3"
            >
              <p className="text-xs text-[var(--text-secondary)]">
                {t(
                  'admin.link_move_explain',
                  'Le compte garde l’accès à ce dossier, présenté comme celui d’un proche, avec le libellé ci-dessous. Son dossier principal sera vide jusqu’à sa propre première analyse.'
                )}
              </p>
              <div>
                <label htmlFor="link-move-label" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t('admin.link_label_label', "De qui s'agit-il ?")}
                </label>
                <input
                  id="link-move-label"
                  type="text"
                  required
                  maxLength={60}
                  value={moveLabel}
                  onChange={(e) => setMoveLabel(e.target.value)}
                  placeholder={t('admin.link_move_placeholder', 'Ex. : Mon fils — Adam')}
                  className={inputClass}
                />
              </div>
              <RelativeIdentityFields
                idPrefix="link-move"
                value={moveIdentity}
                onChange={(patch) => setMoveIdentity((d) => ({ ...d, ...patch }))}
                labName={ownDossier ? labNameFor?.(ownDossier) : undefined}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={busy === 'move' || !moveLabel.trim() || !moveCheck.ok}
                  className="button-bordeaux justify-center disabled:opacity-60 flex items-center gap-2"
                  data-testid="link-move-confirm"
                >
                  {busy === 'move' ? <Loader2 size={18} className="animate-spin flex-shrink-0" /> : <ArrowDownToLine size={18} className="flex-shrink-0" />}
                  {busy === 'move'
                    ? t('admin.link_moving', 'Déplacement…')
                    : t('admin.link_move_confirm', 'Passer en dossier d’un proche')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoving(false);
                    setMoveLabel('');
                    setMoveIdentity({ ...EMPTY_IDENTITY });
                  }}
                  className="min-h-[44px] px-4 rounded-lg text-sm text-[var(--text-secondary)]"
                >
                  {t('cancel', 'Annuler')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Who else reads the dossier we just touched — the confidentiality answer */}
      {audit && audit.length > 0 && (
        <div className="rounded-lg p-3 bg-[var(--background-tertiary)]">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
            {t('admin.link_audit_title', 'Ce dossier est consultable par :')}
          </p>
          <ul className="text-sm text-[var(--text-secondary)] space-y-1">
            {audit.map((a) => (
              <li key={a.uid}>
                {a.fullName || a.email || a.uid}
                {' — '}
                {a.isSelf
                  ? t('admin.link_audit_holder', 'titulaire du dossier')
                  : t('admin.link_audit_linked', 'rattaché ({{label}})', { label: a.label })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add a link */}
      <form onSubmit={submit} className="space-y-4 pt-4 border-t border-[var(--border-default)]">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            {t('admin.link_id_label', 'Identifiant du dossier à rattacher')}
          </label>
          <input
            type="text"
            required
            value={newId}
            onChange={(e) => onDraft({ requester_id: e.target.value })}
            // NEVER a real id here. The previous placeholder was "7587", which is
            // an actual patient's dossier — greyed-out text that looks prefilled,
            // in the one form where a wrong number grants access to someone
            // else's medical record.
            placeholder={t('admin.link_id_placeholder', 'Ex. : 12345')}
            dir="ltr"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            {t('admin.link_label_label', "De qui s'agit-il ?")}
          </label>
          <input
            type="text"
            required
            maxLength={60}
            value={newLabel}
            onChange={(e) => onDraft({ label: e.target.value })}
            placeholder={t('admin.link_label_placeholder', 'Ex. : Maman — Fatima')}
            className={inputClass}
          />
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {t(
              'admin.link_label_hint',
              "Ce libellé est ce que le patient verra dans l'application. Le serveur du laboratoire ne transmet pas le nom."
            )}
          </p>
        </div>
        <RelativeIdentityFields
          idPrefix="link-add"
          value={newIdentity}
          onChange={(patch) => onDraft(patch)}
          labName={newId.trim() ? labNameFor?.(newId.trim()) : undefined}
        />
        {/* No type selector: a relative is ALWAYS a patient dossier. A doctor's
            code attached here would drop his whole named roster into the
            family tabs — doctors get the separate « accès médecin » instead.
            The server refuses any other type (assertRelativeType). */}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy === 'add' || !newId.trim() || !newLabel.trim() || !newCheck.ok}
            className="button-bordeaux justify-center disabled:opacity-60 flex items-center gap-2"
          >
            <Link2 size={18} />
            {busy === 'add'
              ? t('admin.link_adding', 'Rattachement…')
              : t('admin.link_add', 'Rattacher')}
          </button>
          <button
            type="button"
            onClick={() => newId.trim() && onTest(newId.trim(), newType)}
            disabled={!newId.trim()}
            className="min-h-[44px] px-4 rounded-lg border border-[var(--border-default)] text-[var(--text-primary)] disabled:opacity-50"
          >
            {t('admin.link_test_first', "Tester d'abord")}
          </button>
        </div>
        {addWhy && (
          <p className="text-xs text-[var(--text-secondary)]" data-testid="link-add-why">
            {addWhy}
          </p>
        )}
        <p className="text-xs text-[var(--text-secondary)]">
          {t(
            'admin.link_test_warning',
            "Vérifiez toujours l'identifiant avant de rattacher : une erreur donnerait à ce compte accès au dossier d'un autre patient, sans que personne ne s'en aperçoive."
          )}
        </p>
      </form>
    </div>
  );
}
