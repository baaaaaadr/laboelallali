"use client";

/**
 * /admin — staff space.
 *  - Encode a patient's CyberLab identity (requester_id + type). All team members.
 *  - Manage the team (owner/admin): add/remove staff; owner can add/remove admins.
 *
 * Roles: owner (3) > admin (2) > staff (1). Gated on the page AND re-checked
 * server-side by the callables (adminPatients.ts).
 */

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import { getClientFunctions } from '@/config/firebase';
import { ShieldAlert, Search, UserCog, CheckCircle, AlertCircle, User, Users, UserPlus, Trash2, Crown, Inbox, Check, X } from 'lucide-react';

type RequesterType = 'patient' | 'medecin' | 'correspondant';
const TYPES: RequesterType[] = ['patient', 'medecin', 'correspondant'];
const LEVEL: Record<string, number> = { owner: 3, admin: 2, staff: 1 };

interface LookupResult {
  found: boolean;
  uid?: string;
  email?: string | null;
  hasProfile?: boolean;
  fullName?: string;
  phone?: string;
  requester_id?: string;
  type?: string;
  role?: string;
}
interface SetResult { success: boolean; uid: string; fullName: string; requester_id: string; type: string; }
interface Member { uid: string; email: string; fullName: string; role: string; }
interface ListResult { members: Member[]; callerLevel: number; }
interface AccessRequest { uid: string; fullName: string; email: string; phone: string; createdAt: number | null; }

async function callFn<T>(name: string, data: object): Promise<T> {
  const functions = await getClientFunctions();
  if (!functions) throw new Error('functions-unavailable');
  const fn = httpsCallable<object, T>(functions, name);
  return (await fn(data)).data;
}

export default function AdminPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();

  const level = LEVEL[userProfile?.role || ''] || 0;
  const isStaff = level >= 1;
  const isManager = level >= 2; // admin or owner
  const isOwner = level >= 3;

  // Encode section
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [requesterId, setRequesterId] = useState('');
  const [type, setType] = useState<RequesterType>('patient');
  const [busy, setBusy] = useState<false | 'search' | 'save'>(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Team section
  const [team, setTeam] = useState<Member[]>([]);
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamMsg, setTeamMsg] = useState<string | null>(null);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Access requests section
  const [accessReqs, setAccessReqs] = useState<AccessRequest[]>([]);
  const [arInputs, setArInputs] = useState<Record<string, { requester_id: string; type: RequesterType }>>({});
  const [arBusy, setArBusy] = useState<string | false>(false);
  const [arMsg, setArMsg] = useState<string | null>(null);
  const [arError, setArError] = useState<string | null>(null);

  const errMsg = useCallback(
    (err: unknown): string =>
      (err as { message?: string })?.message || t('admin.error', 'Une erreur est survenue. Réessayez.'),
    [t]
  );

  useEffect(() => {
    if (!loading && !user) router.push(`/${lang}/login`);
  }, [loading, user, router, lang]);

  const loadTeam = useCallback(async () => {
    try {
      const res = await callFn<ListResult>('adminListStaff', {});
      setTeam(res.members);
    } catch (err: unknown) {
      setTeamError(errMsg(err));
    }
  }, [errMsg]);

  useEffect(() => {
    if (!loading && isManager) loadTeam();
  }, [loading, isManager, loadTeam]);

  const loadAccessReqs = useCallback(async () => {
    try {
      const res = await callFn<{ requests: AccessRequest[] }>('adminListAccessRequests', {});
      setAccessReqs(res.requests || []);
    } catch (err: unknown) {
      setArError(errMsg(err));
    }
  }, [errMsg]);

  useEffect(() => {
    if (!loading && isStaff) loadAccessReqs();
  }, [loading, isStaff, loadAccessReqs]);

  const setArInput = (uid: string, patch: Partial<{ requester_id: string; type: RequesterType }>) =>
    setArInputs((m) => {
      const cur = m[uid] || { requester_id: '', type: 'patient' as RequesterType };
      return { ...m, [uid]: { ...cur, ...patch } };
    });

  const fulfillReq = async (req: AccessRequest) => {
    const inp = arInputs[req.uid] || { requester_id: '', type: 'patient' as RequesterType };
    setArError(null);
    setArMsg(null);
    setArBusy(req.uid);
    try {
      await callFn('adminFulfillAccessRequest', { uid: req.uid, requester_id: inp.requester_id.trim(), type: inp.type });
      setArMsg(t('admin.req_fulfilled', { name: req.fullName || req.email }));
      await loadAccessReqs();
    } catch (err: unknown) {
      setArError(errMsg(err));
    } finally {
      setArBusy(false);
    }
  };

  const rejectReq = async (req: AccessRequest) => {
    setArError(null);
    setArMsg(null);
    setArBusy(req.uid);
    try {
      await callFn('adminRejectAccessRequest', { uid: req.uid });
      setArMsg(t('admin.req_rejected', { name: req.fullName || req.email }));
      await loadAccessReqs();
    } catch (err: unknown) {
      setArError(errMsg(err));
    } finally {
      setArBusy(false);
    }
  };

  // ── Encode handlers ─────────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(null);
    setLookup(null);
    setBusy('search');
    try {
      const res = await callFn<LookupResult>('adminLookupPatient', { email: email.trim() });
      setLookup(res);
      if (res.found) {
        setRequesterId(res.requester_id || '');
        setType(TYPES.includes(res.type as RequesterType) ? (res.type as RequesterType) : 'patient');
      }
    } catch (err: unknown) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(null);
    setBusy('save');
    try {
      const res = await callFn<SetResult>('adminSetRequester', {
        email: email.trim(),
        requester_id: requesterId.trim(),
        type,
      });
      setSaved(t('admin.saved', { name: res.fullName || email, id: res.requester_id }));
      setLookup((l) => (l ? { ...l, requester_id: res.requester_id, type: res.type } : l));
    } catch (err: unknown) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  // ── Team handlers ───────────────────────────────────────────────────────────
  const teamAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    setTeamError(null);
    setTeamMsg(null);
    setTeamBusy(true);
    try {
      await fn();
      setTeamMsg(successMsg);
      await loadTeam();
    } catch (err: unknown) {
      setTeamError(errMsg(err));
    } finally {
      setTeamBusy(false);
    }
  };

  const addStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const target = newStaffEmail.trim();
    teamAction(
      () => callFn('adminSetStaff', { email: target, grant: true }),
      t('admin.team_added', { email: target })
    ).then(() => setNewStaffEmail(''));
  };
  const addAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const target = newAdminEmail.trim();
    teamAction(
      () => callFn('adminSetAdmin', { email: target, grant: true }),
      t('admin.team_added', { email: target })
    ).then(() => setNewAdminEmail(''));
  };
  const removeMember = (m: Member) => {
    const fnName = m.role === 'admin' ? 'adminSetAdmin' : 'adminSetStaff';
    teamAction(
      () => callFn(fnName, { email: m.email, grant: false }),
      t('admin.team_removed', { email: m.email || m.fullName })
    );
  };

  // ── Gates ─────────────────────────────────────────────────────────────────
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background-default)]">
        <div className="animate-spin rounded-lg h-12 w-12 border-4 border-[var(--color-bordeaux-primary)] border-t-transparent" />
      </div>
    );
  }
  if (!isStaff) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 bg-[var(--background-default)]">
        <div className="card p-8 max-w-md text-center flex flex-col items-center gap-3">
          <ShieldAlert size={44} className="text-[var(--status-error)]" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('admin.access_denied_title', 'Accès refusé')}</h1>
          <p className="text-[var(--text-secondary)]">{t('admin.access_denied_desc', 'Cet espace est réservé au personnel du laboratoire.')}</p>
        </div>
      </div>
    );
  }

  const notFound = lookup !== null && !lookup.found;

  const roleBadge = (role: string) => {
    const label =
      role === 'owner' ? t('admin.role_owner', 'Propriétaire')
        : role === 'admin' ? t('admin.role_admin', 'Admin')
          : t('admin.role_staff', 'Stagiaire');
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] flex items-center gap-1">
        {role === 'owner' && <Crown size={12} className="text-[var(--color-fuchsia-accent)]" />}
        {label}
      </span>
    );
  };

  return (
    <div className="min-h-[80vh] py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] flex items-center gap-2">
            <UserCog size={26} />
            {t('admin.title', 'Espace administrateur')}
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            {t('admin.subtitle', 'Associer un identifiant de résultats à un compte patient.')}
          </p>
        </div>

        {/* ── Pending access requests ─────────────────────────────────────── */}
        {accessReqs.length > 0 && (
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Inbox size={20} className="text-[var(--color-bordeaux-primary)]" />
              {t('admin.req_title', "Demandes d'accès en attente")}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[var(--color-bordeaux-primary)] text-white">
                {accessReqs.length}
              </span>
            </h2>
            {arError && (
              <div className="flex items-center gap-2 text-sm text-[var(--status-error)]">
                <AlertCircle size={16} /> <span>{arError}</span>
              </div>
            )}
            {arMsg && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-bordeaux-primary)]">
                <CheckCircle size={16} /> <span>{arMsg}</span>
              </div>
            )}
            <div className="space-y-4">
              {accessReqs.map((req) => {
                const inp = arInputs[req.uid] || { requester_id: '', type: 'patient' as RequesterType };
                return (
                  <div key={req.uid} className="rounded-lg border border-[var(--border-default)] p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[var(--color-fuchsia-accent)]/10 text-[var(--color-fuchsia-accent)] flex items-center justify-center flex-shrink-0">
                        <User size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--text-primary)] truncate">{req.fullName || '—'}</p>
                        <p className="text-sm text-[var(--text-secondary)] truncate">{req.email}</p>
                        {req.phone && <p className="text-sm text-[var(--text-secondary)]">{req.phone}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={inp.requester_id}
                        onChange={(e) => setArInput(req.uid, { requester_id: e.target.value })}
                        placeholder={t('admin.requester_id_label', 'Identifiant patient (requester_id)')}
                        className="flex-1 rounded-lg px-3 py-2.5 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
                      />
                      <select
                        value={inp.type}
                        onChange={(e) => setArInput(req.uid, { type: e.target.value as RequesterType })}
                        className="rounded-lg px-3 py-2.5 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
                      >
                        <option value="patient">{t('admin.type_patient', 'Patient')}</option>
                        <option value="medecin">{t('admin.type_medecin', 'Médecin')}</option>
                        <option value="correspondant">{t('admin.type_correspondant', 'Correspondant')}</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fulfillReq(req)}
                        disabled={arBusy === req.uid || !inp.requester_id.trim()}
                        className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-60"
                      >
                        <Check size={16} /> {t('admin.req_validate', "Valider l'accès")}
                      </button>
                      <button
                        onClick={() => rejectReq(req)}
                        disabled={arBusy === req.uid}
                        className="button-outline justify-center flex items-center gap-2 disabled:opacity-60"
                      >
                        <X size={16} /> {t('admin.req_reject', 'Refuser')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Encode requester_id ─────────────────────────────────────────── */}
        <form onSubmit={handleSearch} className="card p-6 space-y-4">
          <label className="block text-sm font-medium text-[var(--text-secondary)]">
            {t('admin.email_label', 'Email du patient')}
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="patient@email.com"
              className="flex-1 rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
            />
            <button type="submit" disabled={busy !== false} className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-60">
              <Search size={18} />
              {busy === 'search' ? t('admin.searching', 'Recherche…') : t('admin.search', 'Rechercher')}
            </button>
          </div>
        </form>

        {error && (
          <div className="card p-4 flex items-center gap-3">
            <AlertCircle size={20} className="text-[var(--status-error)] flex-shrink-0" />
            <span className="text-[var(--text-primary)]">{error}</span>
          </div>
        )}
        {notFound && (
          <div className="card p-6 text-center text-[var(--text-secondary)]">
            {t('admin.not_found', "Aucun compte trouvé pour cet email. Le patient doit se connecter une fois à l'application d'abord.")}
          </div>
        )}

        {lookup?.found && (
          <div className="card p-6 space-y-5">
            <div className="flex items-start gap-3 pb-4 border-b border-[var(--border-default)]">
              <div className="h-11 w-11 rounded-lg bg-[var(--color-fuchsia-accent)]/10 text-[var(--color-fuchsia-accent)] flex items-center justify-center flex-shrink-0">
                <User size={22} />
              </div>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">{lookup.fullName || t('admin.name', 'Nom')}</p>
                <p className="text-sm text-[var(--text-secondary)]">{lookup.email}</p>
                {lookup.phone && <p className="text-sm text-[var(--text-secondary)]">{lookup.phone}</p>}
                {!lookup.hasProfile && (
                  <p className="text-sm text-[var(--status-error)] mt-1">
                    {t('admin.no_profile_warning', "Ce compte existe mais le profil n'est pas encore complété.")}
                  </p>
                )}
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t('admin.requester_id_label', 'Identifiant patient (requester_id)')}
                </label>
                <input
                  type="text"
                  required
                  value={requesterId}
                  onChange={(e) => setRequesterId(e.target.value)}
                  placeholder="7587"
                  className="w-full rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t('admin.type_label', 'Type')}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as RequesterType)}
                  className="w-full rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
                >
                  <option value="patient">{t('admin.type_patient', 'Patient')}</option>
                  <option value="medecin">{t('admin.type_medecin', 'Médecin')}</option>
                  <option value="correspondant">{t('admin.type_correspondant', 'Correspondant')}</option>
                </select>
              </div>
              {saved && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-bordeaux-primary)]">
                  <CheckCircle size={18} />
                  <span>{saved}</span>
                </div>
              )}
              <button type="submit" disabled={busy !== false} className="button-bordeaux justify-center w-full disabled:opacity-60">
                {busy === 'save' ? t('admin.saving', 'Enregistrement…') : t('admin.save', 'Enregistrer')}
              </button>
            </form>
          </div>
        )}

        {/* ── Team management (admin + owner) ──────────────────────────────── */}
        {isManager && (
          <div className="card p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Users size={20} className="text-[var(--color-bordeaux-primary)]" />
              {t('admin.team_title', "Gestion de l'équipe")}
            </h2>

            {teamError && (
              <div className="flex items-center gap-2 text-sm text-[var(--status-error)]">
                <AlertCircle size={16} /> <span>{teamError}</span>
              </div>
            )}
            {teamMsg && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-bordeaux-primary)]">
                <CheckCircle size={16} /> <span>{teamMsg}</span>
              </div>
            )}

            {/* Current members */}
            <ul className="divide-y divide-[var(--border-default)]">
              {team.map((m) => {
                const canRemove =
                  m.role === 'staff' || (m.role === 'admin' && isOwner);
                return (
                  <li key={m.uid} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">{m.fullName || m.email}</p>
                      <p className="text-sm text-[var(--text-secondary)] truncate">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {roleBadge(m.role)}
                      {canRemove && m.email && (
                        <button
                          onClick={() => removeMember(m)}
                          disabled={teamBusy}
                          aria-label={t('admin.team_remove', 'Retirer')}
                          className="p-2 rounded-lg text-[var(--status-error)] hover:bg-[var(--background-secondary)] disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
              {team.length === 0 && (
                <li className="py-3 text-sm text-[var(--text-secondary)]">{t('admin.team_empty', 'Aucun membre pour le moment.')}</li>
              )}
            </ul>

            {/* Add staff (admin + owner) */}
            <form onSubmit={addStaff} className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-[var(--border-default)]">
              <input
                type="email"
                required
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                placeholder={t('admin.team_staff_placeholder', 'email du stagiaire')}
                className="flex-1 rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
              />
              <button type="submit" disabled={teamBusy} className="button-outline justify-center flex items-center gap-2 disabled:opacity-60">
                <UserPlus size={18} />
                {t('admin.team_add_staff', 'Ajouter un stagiaire')}
              </button>
            </form>

            {/* Add admin (owner only) */}
            {isOwner && (
              <form onSubmit={addAdmin} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder={t('admin.team_admin_placeholder', "email de l'admin")}
                  className="flex-1 rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
                />
                <button type="submit" disabled={teamBusy} className="button-outline justify-center flex items-center gap-2 disabled:opacity-60">
                  <UserPlus size={18} />
                  {t('admin.team_add_admin', 'Ajouter un admin')}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
