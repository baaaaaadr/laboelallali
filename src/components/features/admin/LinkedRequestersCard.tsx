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
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Link2, Loader2, Trash2, Users } from 'lucide-react';
import type { RequesterType } from '@/types/cyberlab';

export interface LinkRow {
  requester_id: string;
  type: string;
  label: string;
  linkedAt: number | null;
}

export interface AuditAccount {
  uid: string;
  fullName: string;
  email: string | null;
  isSelf: boolean;
  label: string;
  linkedAt: number | null;
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
  onAdd: (requesterId: string, type: RequesterType, label: string) => void;
  onRemove: (requesterId: string, label: string) => void;
  onTest: (requesterId: string, type: RequesterType) => void;
  fmtDate: (ms: number) => string;
}

export default function LinkedRequestersCard({
  links,
  error,
  busy,
  notice,
  audit,
  onAdd,
  onRemove,
  onTest,
  fmtDate,
}: Props) {
  const { t } = useTranslation('common');
  const [newId, setNewId] = useState('');
  const [newType, setNewType] = useState<RequesterType>('patient');
  const [newLabel, setNewLabel] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newLabel.trim()) return;
    onAdd(newId.trim(), newType, newLabel.trim());
    setNewId('');
    setNewLabel('');
  };

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
        <div className="flex items-start gap-2 text-sm text-[var(--color-bordeaux-primary)]">
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
          {links.map((l) => (
            <li
              key={l.requester_id}
              className="flex items-center justify-between gap-3 rounded-lg p-3 bg-[var(--background-secondary)]"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--text-primary)] truncate">{l.label}</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  <span dir="ltr">{l.requester_id}</span>
                  {' · '}
                  {l.type}
                  {l.linkedAt ? ` · ${fmtDate(l.linkedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onTest(l.requester_id, l.type as RequesterType)}
                  className="text-sm underline text-[var(--text-secondary)] min-h-[44px] px-2"
                >
                  {t('admin.link_test', 'Tester')}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(l.requester_id, l.label)}
                  disabled={busy === l.requester_id}
                  aria-label={t('admin.link_remove', 'Retirer')}
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[var(--status-error)] disabled:opacity-50"
                >
                  {busy === l.requester_id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
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
            onChange={(e) => setNewId(e.target.value)}
            placeholder="7587"
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
            onChange={(e) => setNewLabel(e.target.value)}
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
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            {t('admin.type_label', 'Type')}
          </label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as RequesterType)}
            className={inputClass}
          >
            <option value="patient">{t('admin.type_patient', 'Patient')}</option>
            <option value="medecin">{t('admin.type_medecin', 'Médecin')}</option>
            <option value="correspondant">{t('admin.type_correspondant', 'Correspondant')}</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy === 'add' || !newId.trim() || !newLabel.trim()}
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
