'use client';

/**
 * « Vue patient » — admin, Tester tab (Dr Aziz, 08/10/2026): see the app EXACTLY
 * as a patient sees it, read-only. Find the account (dossier number, name,
 * e-mail, phone), then navigate his real screens:
 *  - « Résultats »: the production `/resultats` page — his own dossier, the
 *    tabs of his attached relatives, the PDFs;
 *  - « Mes patients » (a doctor account, ADMIN level only): the production
 *    doctor workspace, his roster as he sees it.
 *
 * How: the production pages are mounted under `ViewAsAuthProvider` (they read
 * the viewed account instead of the admin) and their own `ResultsProvider`,
 * which then calls `adminViewAs` instead of `fetchResults` (server side: same
 * identity rules, no usage stamp, every list read traced). Every write action
 * on those pages (access request, share, relative request, outage opt-in,
 * space switch links) is hidden when `viewAs` is set. The admin's own session
 * is never touched.
 *
 * The plain server probe (a number with no account yet) stays below this
 * component, in the same tab.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { ArrowLeft, Eye, FileText, Search, Stethoscope, User } from 'lucide-react';
import { getClientFunctions } from '@/config/firebase';
import { ViewAsAuthProvider, type UserProfile } from '@/contexts/AuthContext';
import { ResultsProvider } from '@/contexts/ResultsContext';
import ResultatsPage from '@/app/[lang]/resultats/page';
import PractitionerWorkspace from '@/components/features/practitioner/PractitionerWorkspace';
import { readPractitioner } from '@/lib/results/identities';
import type { RequesterType } from '@/types/cyberlab';
import { PRACTITIONER_ENGAGEMENT_VERSION } from '@/lib/practitioner/engagement';

/** What `adminSearchPatients` returns, as far as this view needs it. */
export interface ViewAsAccount {
  uid: string;
  email: string | null;
  hasProfile: boolean;
  fullName: string;
  phone?: string;
  dateOfBirth?: string;
  createdAt?: string;
  requester_id?: string;
  type?: string;
  links?: { requester_id: string; type: string; label: string }[];
  practitioner?: { requester_id: string; type: string; label: string; engaged?: boolean } | null;
}

/** The account as the patient-side pages read it (no timestamps needed). */
function toProfile(a: ViewAsAccount): UserProfile {
  return {
    uid: a.uid,
    fullName: a.fullName,
    email: a.email,
    phone: a.phone,
    dateOfBirth: a.dateOfBirth || '',
    createdAt: a.createdAt || '',
    requester_id: a.requester_id,
    type: a.type as RequesterType | undefined,
    linkedRequesters: (a.links || []).map((l) => ({ requester_id: l.requester_id, type: l.type as RequesterType, label: l.label })),
    practitioner: a.practitioner
      ? { requester_id: a.practitioner.requester_id, type: a.practitioner.type as RequesterType, label: a.practitioner.label }
      : undefined,
    // Never the engagement screen here: its button would write on the ADMIN's
    // own account. Whether the doctor signed it is shown in the « Médecins » tab.
    practitionerEngagement: a.practitioner ? { version: PRACTITIONER_ENGAGEMENT_VERSION, via: 'request' } : undefined,
  } as UserProfile;
}

interface Props {
  lang: string;
  /** Admin or owner: may open a doctor's « Mes patients » (a whole named roster). */
  canSeeDoctor: boolean;
  fmtDate: (iso: string) => string;
}

export default function PatientViewAs({ lang, canSeeDoctor, fmtDate }: Props) {
  const { t } = useTranslation('common');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<ViewAsAccount[] | null>(null);
  const [viewed, setViewed] = useState<ViewAsAccount | null>(null);
  const [space, setSpace] = useState<'mine' | 'patients'>('mine');
  // One promise per language: `use(params)` needs the SAME instance across renders.
  const params = useMemo(() => Promise.resolve({ lang }), [lang]);
  const profile = useMemo(() => (viewed ? toProfile(viewed) : null), [viewed]);
  const practitioner = useMemo(() => readPractitioner(profile), [profile]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setBusy(true);
    setError(null);
    setHits(null);
    try {
      const functions = await getClientFunctions();
      if (!functions) throw new Error('functions-unavailable');
      const res = await httpsCallable<{ query: string }, { results: ViewAsAccount[] }>(functions, 'adminSearchPatients')({ query: q });
      const list = (res.data.results || []).filter((a) => a.hasProfile);
      setHits(list);
      if (list.length === 1) open(list[0]);
    } catch {
      setError(t('admin.viewas_error', 'La recherche n’a pas abouti. Réessayez.'));
    } finally {
      setBusy(false);
    }
  };

  const open = (a: ViewAsAccount) => {
    setViewed(a);
    setSpace('mine');
  };

  const tabClass = 'flex items-center gap-2 min-h-[44px] px-4 rounded-lg border text-sm font-medium';
  const tabStyle = (on: boolean): React.CSSProperties =>
    on
      ? { background: 'var(--color-bordeaux-primary)', color: 'var(--color-white)', borderColor: 'var(--color-bordeaux-primary)' }
      : { background: 'transparent', color: 'var(--text-primary)', borderColor: 'var(--border-default)' };

  // ── Viewing an account ────────────────────────────────────────────────────
  if (viewed && profile) {
    const doctorTab = !!practitioner;
    return (
      <div className="space-y-4" data-testid="viewas">
        <div
          className="rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 border-2"
          style={{ borderColor: 'var(--color-fuchsia-accent)', background: 'var(--background-secondary)' }}
          data-testid="viewas-banner"
        >
          <p className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <Eye size={18} className="flex-shrink-0" style={{ color: 'var(--color-fuchsia-accent)' }} />
            <span>
              {t('admin.viewas_banner', 'Vous voyez l’application comme {{name}} — lecture seule.', { name: viewed.fullName || viewed.email || '' })}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setViewed(null)}
            className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-[var(--border-default)] text-sm font-medium text-[var(--text-primary)]"
            data-testid="viewas-close"
          >
            <ArrowLeft size={16} className={lang === 'ar' ? 'rotate-180' : undefined} />
            {t('admin.viewas_change', 'Changer de compte')}
          </button>
        </div>

        {doctorTab && (
          <div className="flex flex-wrap gap-2" role="tablist">
            <button type="button" role="tab" aria-selected={space === 'mine'} className={tabClass} style={tabStyle(space === 'mine')} onClick={() => setSpace('mine')} data-testid="viewas-tab-mine">
              <FileText size={16} />
              {t('mes_patients.switch_mine', 'Moi et ma famille')}
            </button>
            <button type="button" role="tab" aria-selected={space === 'patients'} className={tabClass} style={tabStyle(space === 'patients')} onClick={() => setSpace('patients')} data-testid="viewas-tab-patients">
              <Stethoscope size={16} />
              {t('mes_patients.nav', 'Mes patients')}
            </button>
          </div>
        )}

        <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
          {/* key: another account never inherits a previous one's state. */}
          <ViewAsAuthProvider key={viewed.uid} profile={profile}>
            <ResultsProvider>
              {space === 'patients' && practitioner ? (
                canSeeDoctor ? (
                  <PractitionerWorkspace key={`${viewed.uid}:${practitioner.requester_id}`} lang={lang} practitioner={practitioner} />
                ) : (
                  <p className="p-6 text-sm text-[var(--text-secondary)]" data-testid="viewas-doctor-locked">
                    {t('admin.viewas_doctor_admin_only', 'La vue « Mes patients » d’un médecin est réservée aux administrateurs.')}
                  </p>
                )
              ) : (
                <ResultatsPage params={params} />
              )}
            </ResultsProvider>
          </ViewAsAuthProvider>
        </div>
      </div>
    );
  }

  // ── Finding the account ───────────────────────────────────────────────────
  return (
    <div className="card p-6 space-y-4" data-testid="viewas-search">
      <div>
        {/* A <p>: reset.css colours and sizes h2 unlayered. */}
        <p className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Eye size={20} className="text-[var(--color-bordeaux-primary)]" />
          {t('admin.viewas_title', 'Vue patient')}
        </p>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t(
            'admin.viewas_intro',
            'Voyez l’application exactement comme le patient : ses résultats, ceux de sa famille rattachée et, pour un médecin, « Mes patients ». En lecture seule : rien n’est modifié ni compté à son nom.'
          )}
        </p>
      </div>
      <form onSubmit={search} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.viewas_placeholder', 'N° de dossier, nom, e-mail ou téléphone')}
          className="flex-1 rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
          data-testid="viewas-query"
        />
        <button type="submit" disabled={busy || query.trim().length < 2} className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-60">
          <Search size={18} className="flex-shrink-0" />
          {busy ? t('admin.searching', 'Recherche…') : t('admin.search', 'Rechercher')}
        </button>
      </form>
      {error && <p className="text-sm text-[var(--status-error)]">{error}</p>}
      {hits && hits.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]" data-testid="viewas-none">
          {t('admin.viewas_none', 'Aucun compte trouvé. Pour un numéro sans compte, utilisez le test du serveur ci-dessous.')}
        </p>
      )}
      {hits && hits.length > 1 && (
        <ul className="space-y-2" data-testid="viewas-hits">
          {hits.map((a) => (
            <li key={a.uid}>
              <button
                type="button"
                onClick={() => open(a)}
                className="w-full text-start rounded-lg border border-[var(--border-default)] p-3 flex items-start gap-3 hover:border-[var(--color-fuchsia-accent)]"
              >
                <User size={18} className="flex-shrink-0 mt-0.5 text-[var(--color-fuchsia-accent)]" />
                <span className="min-w-0">
                  <span className="block font-medium text-[var(--text-primary)]">{a.fullName || a.email}</span>
                  <span className="block text-xs text-[var(--text-secondary)]">
                    {[a.email, a.phone, a.dateOfBirth ? fmtDate(a.dateOfBirth) : '', a.requester_id ? `#${a.requester_id}` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
