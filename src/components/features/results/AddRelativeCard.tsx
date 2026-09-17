'use client';

/**
 * "Consulter les résultats d'un proche" — the patient's way of ASKING.
 *
 * Attaching a relative's dossier has always been staff-only, and stays so. What
 * was missing was the other half: a way to ask at all. Until now the patient had
 * to say it out loud at the counter — nothing was recorded, staff had no queue,
 * and the patient could not tell whether the request had been seen.
 *
 * ⚠ The form deliberately does NOT ask for the relative's dossier number. The
 * patient does not know it, and asking would invite typing numbers until one
 * works. Name + date of birth is what the front desk needs to find the record,
 * and it is useless to anyone trying to fish.
 *
 * The date of birth is required for the same reason: it is what separates
 * homonyms, and this lab has plenty.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { AlertCircle, Check, Clock, UserPlus, X } from 'lucide-react';
import { getClientFunctions } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';

type Relationship = 'pere' | 'mere' | 'enfant' | 'conjoint' | 'autre';

const RELATIONSHIPS: Relationship[] = ['pere', 'mere', 'enfant', 'conjoint', 'autre'];

interface MyRequest {
  id: string;
  relativeName: string;
  relationship: string;
  status: string;
  createdAt: number | null;
}

async function callFn<T>(name: string, data: object): Promise<T> {
  const functions = await getClientFunctions();
  if (!functions) throw new Error('functions-unavailable');
  const fn = httpsCallable<object, T>(functions, name);
  return (await fn(data)).data;
}

export default function AddRelativeCard({ lang }: { lang: string }) {
  const { t } = useTranslation('common');
  const { user, userProfile } = useAuth();

  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<MyRequest[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const [relationship, setRelationship] = useState<Relationship>('mere');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');

  const isRtl = lang === 'ar';

  const load = useCallback(async () => {
    try {
      const res = await callFn<{ requests: MyRequest[] }>('myRelativeRequests', {});
      setRequests(res.requests || []);
    } catch {
      // A failed status read must not hide the "ask" button — the patient can
      // still submit, and the server de-duplicates identical requests.
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (!user) return null;
  // Doctors and correspondents do not have relatives in this sense.
  if (userProfile?.type === 'medecin' || userProfile?.type === 'correspondant') return null;

  const pending = (requests ?? []).filter((r) => r.status === 'pending');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await callFn('requestRelativeAccess', {
        relationship,
        relativeName: name.trim(),
        relativeDob: dob,
        relativePhone: phone.trim(),
      });
      setSent(true);
      setOpen(false);
      setName('');
      setDob('');
      setPhone('');
      await load();
    } catch (err: unknown) {
      const msg = ((err as { message?: string })?.message || '').trim();
      setError(msg || t('resultats.relative_error', "Votre demande n'a pas pu être envoyée."));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm';

  return (
    <section className="card p-5" aria-label={t('resultats.relative_title', "Résultats d'un proche")}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-[var(--color-fuchsia-accent)]/10 text-[var(--color-fuchsia-accent)] flex items-center justify-center flex-shrink-0">
          <UserPlus size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-[var(--text-primary)]">
            {t('resultats.relative_title', "Consulter les résultats d'un proche")}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t(
              'resultats.relative_desc',
              "Vous pouvez suivre les analyses d'un parent âgé ou de votre enfant depuis votre propre compte, sans créer d'autre compte."
            )}
          </p>
        </div>
      </div>

      {/* Requests already sent */}
      {pending.length > 0 && (
        <ul className="mt-4 space-y-2">
          {pending.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 text-sm rounded-lg p-3 bg-[var(--background-secondary)]"
            >
              <Clock size={16} className="flex-shrink-0 text-[var(--text-tertiary)]" />
              <span className="text-[var(--text-secondary)]">
                {t('resultats.relative_pending', 'Demande en cours pour {{name}}', {
                  name: r.relativeName,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {sent && (
        <div className="mt-4 flex items-start gap-2 text-sm text-[var(--color-bordeaux-primary)]">
          <Check size={18} className="flex-shrink-0 mt-0.5" />
          <span>
            {t(
              'resultats.relative_sent',
              "Demande envoyée. Le laboratoire vous recontactera : la vérification se fait sur place, elle ne peut pas être faite en ligne."
            )}
          </span>
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSent(false);
          }}
          className="mt-4 flex items-center gap-2 min-h-[44px] px-4 rounded-lg border border-[var(--border-default)] text-[var(--text-primary)]"
        >
          <UserPlus size={18} />
          {t('resultats.relative_cta', 'Demander pour un proche')}
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('resultats.relative_relationship', 'Cette personne est')}
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as Relationship)}
              className={inputClass}
            >
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>
                  {t(`resultats.relative_rel_${r}`, r)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('resultats.relative_name', 'Son nom complet')}
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('resultats.relative_dob', 'Sa date de naissance')}
            </label>
            <input
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t(
                'resultats.relative_dob_hint',
                "C'est ce qui permet au laboratoire de retrouver le bon dossier."
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('resultats.relative_phone', 'Son téléphone (facultatif)')}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Said before the button, not after: the patient should know a trip to
              the lab is coming BEFORE they send, not discover it afterwards. */}
          <p className="text-sm text-[var(--text-secondary)]">
            {t(
              'resultats.relative_notice',
              "Le laboratoire vérifiera sur place que vous avez le droit de consulter ce dossier : présentez-vous avec cette personne, ou avec une autorisation écrite de sa part. Pour un enfant mineur, le livret de famille suffit."
            )}
          </p>

          {error && (
            <div className="flex items-start gap-2 text-sm text-[var(--status-error)]">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy || name.trim().length < 3 || !dob}
              className="button-bordeaux justify-center disabled:opacity-60"
            >
              {busy
                ? t('resultats.relative_sending', 'Envoi…')
                : t('resultats.relative_submit', 'Envoyer la demande')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 min-h-[44px] px-4 rounded-lg text-[var(--text-secondary)]"
            >
              <X size={18} />
              {t('cancel', 'Annuler')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
