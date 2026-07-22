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
import MedicalLoader from '@/components/ui/MedicalLoader';
import VerdictPanel from '@/components/ui/VerdictPanel';
import type { CyberlabResponse } from '@/types/cyberlab';
import ResultsIndicators from '@/components/features/results/ResultsIndicators';
import AnalysesDetails from '@/components/features/results/AnalysesDetails';
import TabsNavigation, { type TabItem } from '@/components/features/catalog/TabsNavigation';
import AdminDashboard, { type DashboardStats } from '@/components/features/admin/AdminDashboard';
import RelancesTab, { type DormantAccount } from '@/components/features/admin/RelancesTab';
import { ShieldAlert, Search, UserCog, CheckCircle, AlertCircle, User, Users, UserPlus, Trash2, Crown, Inbox, Check, X, FlaskConical, FileText, Eye, Loader2, LayoutDashboard, MessageCircle } from 'lucide-react';

type RequesterType = 'patient' | 'medecin' | 'correspondant';
const TYPES: RequesterType[] = ['patient', 'medecin', 'correspondant'];
const LEVEL: Record<string, number> = { owner: 3, admin: 2, staff: 1 };

// `dashboard` and `team` need level >= 2; everything else is staff-level.
type AdminTab = 'dashboard' | 'patients' | 'requests' | 'relances' | 'test' | 'team';

/**
 * Callable errors whose `message` is just the status code — the SDK does this for
 * transport failures (function not deployed yet, offline, CORS). They carry no
 * information for a human, so the UI shows the generic sentence instead.
 */
const OPAQUE_ERROR_MESSAGES = new Set([
  'internal',
  'unavailable',
  'unknown',
  'cancelled',
  'deadline-exceeded',
]);

// Usage tracking (lastResultsAt) started shipping on this date — before it, no
// account has a value, so everyone would read as "jamais consulté". The dashboard
// shows this as a caption so the numbers aren't misread during the ramp-up.
const USAGE_SINCE = '2026-07-20';


/**
 * `adminTestResults` response = the lab payload + the identity staff need to confirm
 * the id. `name_source` says where the name came from ('lab' = the laboratory itself,
 * 'account' = the linked app account) so the UI never implies the lab confirmed it.
 */
type AdminTestResponse = CyberlabResponse & {
  patient_name?: string;
  name_source?: 'lab' | 'account';
};

interface SearchResult {
  uid: string;
  email: string | null;
  hasProfile: boolean;
  fullName: string;
  phone?: string;
  requester_id?: string;
  type?: string;
  role?: string;
  createdAt?: string;
  dateOfBirth?: string;
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
  const isArabic = lang === 'ar';

  // Tabs
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Dashboard tab
  const [dash, setDash] = useState<DashboardStats | null>(null);
  const [dashError, setDashError] = useState<string | null>(null);
  // Detail lists start COLLAPSED: the tiles + usage gauge are what staff read at a
  // glance; the long lists are opened on demand (absent key = closed).
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({});
  // Team accounts are excluded by default (they'd inflate the adoption rate), but
  // whoever opens this page HAS a role — so this lets them see themselves to test.
  const [includeTeam, setIncludeTeam] = useState(false);

  // Relances tab (staff level and up) — its own callable, so the front desk gets
  // the working list without seeing the management figures.
  const [dormant, setDormant] = useState<DormantAccount[] | null>(null);
  const [dormantError, setDormantError] = useState<string | null>(null);
  const [relanceBusy, setRelanceBusy] = useState<string | null>(null);

  // Encode section — multi-field patient search + attach requester_id
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
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

  // Test-a-requester-id section (onboarding probe — see adminTestResults callable)
  const [testId, setTestId] = useState('');
  const [testType, setTestType] = useState<RequesterType>('patient');
  const [testBusy, setTestBusy] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'empty' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [testResp, setTestResp] = useState<AdminTestResponse | null>(null);
  // Per-dossier PDF probe state (reproduces the patient "Voir", incl. the empty-PDF case).
  const [pdfProbe, setPdfProbe] = useState<Record<string, 'loading' | 'ok' | 'empty' | 'error'>>({});

  const errMsg = useCallback(
    (err: unknown): string => {
      const msg = ((err as { message?: string })?.message || '').trim();
      // A transport failure (function not deployed, offline, CORS…) surfaces from
      // the callable SDK with message === the bare status code, e.g. "internal".
      // Showing that token to staff means nothing — fall back to a real sentence.
      return msg && !OPAQUE_ERROR_MESSAGES.has(msg.toLowerCase())
        ? msg
        : t('admin.error', 'Une erreur est survenue. Réessayez.');
    },
    [t]
  );

  // ── Test a requester_id (onboarding probe) ──────────────────────────────────
  // Calls the staff-only `adminTestResults` callable with a client-supplied id and
  // shows what the patient would see (list only, no PDFs). Reusable so both the form
  // submit and any future shortcut can trigger the same preview.
  const runTest = useCallback(
    async (id: string, type: RequesterType) => {
      const requesterId = id.trim();
      if (!requesterId) return;
      setTestError(null);
      setTestResp(null);
      setTestStatus('idle');
      setPdfProbe({});
      setTestBusy(true);
      try {
        const res = await callFn<AdminTestResponse>('adminTestResults', { requester_id: requesterId, type });
        setTestResp(res);
        setTestStatus(res.results.length > 0 ? 'ok' : 'empty');
      } catch (err: unknown) {
        // Backend maps "unknown id / no results" to not-found → treat as the empty state.
        const code = ((err as { code?: string })?.code || '').replace('functions/', '');
        if (code === 'not-found') {
          setTestStatus('empty');
        } else {
          setTestStatus('error');
          setTestError(errMsg(err));
        }
      } finally {
        setTestBusy(false);
      }
    },
    [errMsg]
  );

  // Localized date for the preview cards (mirrors the /resultats formatting).
  const fmtDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(isArabic ? 'ar-MA' : 'fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  };
  // Map the known lab status to i18n; pass any other value through verbatim.
  const etatLabel = (raw: string) =>
    raw.trim().toLowerCase() === 'final' ? t('resultats.etat_final', 'Finalisé') : raw;

  // ── Dashboard helpers ───────────────────────────────────────────────────────
  /** Epoch ms → short localized date+time (dashboard activity columns). */
  const fmtWhen = (ms?: number | null) => {
    if (!ms) return '—';
    const d = new Date(ms);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString(isArabic ? 'ar-MA' : 'fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
  };
  /** Whole days since an epoch ms (used for "inactif depuis N j"). */
  const daysSince = (ms: number) => Math.floor((Date.now() - ms) / 86400000);

  /**
   * Moroccan phone → wa.me digits: strip formatting, turn a leading 0 into 212.
   * Lets staff relance a dormant patient in one tap (Aziz's preferred channel).
   */
  const waLink = (phone: string, name: string) => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const intl = digits.startsWith('212') ? digits : digits.replace(/^0/, '212');
    const msg = t('admin.dash_relance_msg', {
      name: name || '',
      defaultValue:
        'Bonjour {{name}}, le Laboratoire El Allali vous informe que vous pouvez consulter vos résultats en ligne depuis notre application. Besoin d\'aide pour vous connecter ?',
    });
    return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
  };

  // base64 → in-memory PDF blob URL (never persisted to disk).
  const base64ToBlobUrl = (b64: string) => {
    const clean = (b64 || '').replace(/\s+/g, '');
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  };

  // Fetch ONE dossier's PDF (exactly like the patient "Voir") and open it in a new tab.
  // An empty PDF from the lab server → 'empty' — that is the real onboarding failure we
  // want staff to catch here instead of the patient discovering it at home.
  const viewTestPdf = async (dossierId: string) => {
    setPdfProbe((m) => ({ ...m, [dossierId]: 'loading' }));
    try {
      const res = await callFn<CyberlabResponse>('adminTestResults', {
        requester_id: testId.trim(),
        type: testType,
        dossier_id: dossierId,
      });
      // Strict id match, no results[0] fallback: a probe that opened another
      // dossier's PDF would make staff validate an onboarding that is broken.
      const match = res.results?.find((x) => x.dossier_id === dossierId);
      const base64 = match?.pdf_base64 || '';
      if (!base64) {
        setPdfProbe((m) => ({ ...m, [dossierId]: 'empty' }));
        return;
      }
      const url = base64ToBlobUrl(base64);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setPdfProbe((m) => ({ ...m, [dossierId]: 'ok' }));
    } catch {
      setPdfProbe((m) => ({ ...m, [dossierId]: 'error' }));
    }
  };

  useEffect(() => {
    if (!loading && !user) router.push(`/${lang}/login`);
  }, [loading, user, router, lang]);

  // `dashboard` is the default tab but is managers-only: a stagiaire landing here
  // would otherwise face an empty screen with no tab selected.
  useEffect(() => {
    if (!loading && !isManager && activeTab === 'dashboard') setActiveTab('patients');
  }, [loading, isManager, activeTab]);

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

  const loadDash = useCallback(async () => {
    try {
      setDashError(null);
      setDash(await callFn<DashboardStats>('adminDashboardStats', { includeTeam }));
    } catch (err: unknown) {
      setDashError(errMsg(err));
    }
  }, [errMsg, includeTeam]);

  // Steering figures are for managers only — never fetched for a stagiaire.
  useEffect(() => {
    if (!loading && isManager) loadDash();
  }, [loading, isManager, loadDash]);

  const loadDormant = useCallback(async () => {
    try {
      setDormantError(null);
      const res = await callFn<{ dormantList: DormantAccount[] }>('adminListDormant', {});
      setDormant(res.dormantList || []);
    } catch (err: unknown) {
      setDormantError(errMsg(err));
    }
  }, [errMsg]);

  useEffect(() => {
    if (!loading && isStaff) loadDormant();
  }, [loading, isStaff, loadDormant]);

  /**
   * The WhatsApp link opens natively (this runs from the <a> click), and we record
   * the contact in parallel — fire-and-forget so nothing delays the message.
   */
  const handleRelance = useCallback(
    (a: DormantAccount) => {
      setRelanceBusy(a.uid);
      callFn('adminRecordRelance', { uid: a.uid })
        .then(() => loadDormant())
        .catch(() => { /* the message still went out — don't block the user */ })
        .finally(() => setRelanceBusy(null));
    },
    [loadDormant]
  );

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
  // Prefill the attach form from a chosen search result.
  const selectPatient = (p: SearchResult) => {
    setSelected(p);
    setSaved(null);
    setError(null);
    setRequesterId(p.requester_id || '');
    setType(TYPES.includes(p.type as RequesterType) ? (p.type as RequesterType) : 'patient');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(null);
    setSelected(null);
    setResults([]);
    setTruncated(false);
    setSearched(false);
    const q = query.trim();
    if (q.length < 2) {
      setError(t('admin.search_min', 'Tapez au moins 2 caractères pour lancer la recherche.'));
      return;
    }
    setBusy('search');
    try {
      const res = await callFn<{ results: SearchResult[]; truncated: boolean }>('adminSearchPatients', { query: q });
      const list = res.results || [];
      setResults(list);
      setTruncated(!!res.truncated);
      setSearched(true);
      if (list.length === 1) selectPatient(list[0]); // single hit → open the attach form directly
    } catch (err: unknown) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected?.email) return; // attach is keyed on email; disabled in the UI when missing
    const targetEmail = selected.email;
    const targetUid = selected.uid;
    setError(null);
    setSaved(null);
    setBusy('save');
    try {
      const res = await callFn<SetResult>('adminSetRequester', {
        email: targetEmail,
        requester_id: requesterId.trim(),
        type,
      });
      setSaved(t('admin.saved', { name: res.fullName || targetEmail, id: res.requester_id }));
      setSelected((s) => (s ? { ...s, requester_id: res.requester_id, type: res.type } : s));
      setResults((rs) => rs.map((r) => (r.uid === targetUid ? { ...r, requester_id: res.requester_id, type: res.type } : r)));
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
        <MedicalLoader />
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

  const tabs: TabItem[] = [
    // Steering figures: managers only. The front desk gets "Relances" instead.
    ...(isManager
      ? [{ id: 'dashboard', label: t('admin.tab_dashboard', 'Tableau de bord'), icon: LayoutDashboard }]
      : []),
    { id: 'patients', label: t('admin.tab_patients', 'Patients'), icon: User },
    { id: 'requests', label: t('admin.tab_requests', 'Demandes'), icon: Inbox, count: accessReqs.length },
    { id: 'relances', label: t('admin.tab_relances', 'Relances'), icon: MessageCircle, count: dormant?.length },
    { id: 'test', label: t('admin.tab_test', 'Tester'), icon: FlaskConical },
    ...(isManager ? [{ id: 'team', label: t('admin.tab_team', 'Équipe'), icon: Users }] : []),
  ];

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
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] flex items-center gap-2">
            <UserCog size={26} />
            {t('admin.title', 'Espace administrateur')}
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            {t('admin.subtitle', 'Associer un identifiant de résultats à un compte patient.')}
          </p>
        </div>

        {/* Tab bar — a normal in-flow element: it scrolls away with the page, so it
            takes zero fixed screen space. To switch tabs, scroll back to the top. */}
        <div className="border-b border-[var(--border-default)]">
          <TabsNavigation
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as AdminTab)}
            isRtl={isArabic}
          />
        </div>

        <div className="space-y-8 pt-8">
        {/* ── Tableau de bord — steering figures, admin + owner ONLY ───────── */}
        {activeTab === 'dashboard' && isManager && (
          dashError ? (
            <div className="card p-4 flex items-center gap-3">
              <AlertCircle size={20} className="text-[var(--status-error)] flex-shrink-0" />
              <span className="text-[var(--text-primary)]">{dashError}</span>
            </div>
          ) : !dash ? (
            <div className="card">
              <MedicalLoader label={t('admin.dash_loading', 'Chargement du tableau de bord…')} />
            </div>
          ) : (
            <AdminDashboard
              dash={dash}
              isArabic={isArabic}
              usageSince={USAGE_SINCE}
              includeTeam={includeTeam}
              onToggleTeam={setIncludeTeam}
              openSec={openSec}
              onToggleSec={(k) => setOpenSec((s) => ({ ...s, [k]: !s[k] }))}
              fmtDate={fmtDate}
              fmtWhen={fmtWhen}
            />
          )
        )}

        {/* ── Relances — the front-desk tool, staff level and up ───────────── */}
        {activeTab === 'relances' && (
          <RelancesTab
            list={dormant}
            error={dormantError}
            busyUid={relanceBusy}
            onRelance={handleRelance}
            waLink={waLink}
            daysSince={daysSince}
          />
        )}

        {/* ── Demandes tab: pending access requests ───────────────────────── */}
        {activeTab === 'requests' && (
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Inbox size={20} className="text-[var(--color-bordeaux-primary)]" />
              {t('admin.req_title', "Demandes d'accès en attente")}
              {accessReqs.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[var(--color-bordeaux-primary)] text-white">
                  {accessReqs.length}
                </span>
              )}
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
              {accessReqs.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('admin.req_empty', "Aucune demande d'accès en attente.")}
                </p>
              )}
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

        {/* ── Patients tab: multi-field search + attach requester_id ──────── */}
        {activeTab === 'patients' && (
          <>
            <form onSubmit={handleSearch} className="card p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  {t('admin.search_label', 'Rechercher un patient')}
                </label>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {t('admin.search_hint', 'Par email, nom/prénom, téléphone, date de naissance ou identifiant patient.')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('admin.search_placeholder', 'Email, nom, téléphone, date de naissance ou identifiant')}
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

            {searched && results.length === 0 && !error && (
              <div className="card p-6 text-center text-[var(--text-secondary)]">
                {t('admin.not_found', "Aucun patient trouvé. Essayez un autre nom, email, téléphone ou identifiant. Si le patient vient de s'inscrire, il doit se connecter une fois à l'application.")}
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-3">
                {truncated && (
                  <div className="flex items-center gap-2 text-sm text-[var(--status-warning)]">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <span>{t('admin.results_truncated', 'Beaucoup de résultats — précisez votre recherche pour affiner.')}</span>
                  </div>
                )}
                {results.map((r) => {
                  const isSel = selected?.uid === r.uid;
                  return (
                    <button
                      key={r.uid}
                      type="button"
                      onClick={() => selectPatient(r)}
                      className={`w-full text-start rounded-lg border p-4 transition bg-[var(--background-default)] ${
                        isSel
                          ? 'border-[var(--color-fuchsia-accent)] ring-2 ring-[var(--color-fuchsia-accent)]'
                          : 'border-[var(--border-default)] hover:border-[var(--color-fuchsia-accent)]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[var(--color-fuchsia-accent)]/10 text-[var(--color-fuchsia-accent)] flex items-center justify-center flex-shrink-0">
                          <User size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[var(--text-primary)] truncate">{r.fullName || t('admin.name', 'Nom')}</p>
                          {r.email && <p className="text-sm text-[var(--text-secondary)] truncate">{r.email}</p>}
                          {r.phone && <p className="text-sm text-[var(--text-secondary)]">{r.phone}</p>}
                          {(r.dateOfBirth || r.createdAt) && (
                            <p className="text-xs text-[var(--text-secondary)] mt-1">
                              {r.dateOfBirth && <span>{t('admin.dob_label', 'Date de naissance')} : {fmtDate(r.dateOfBirth)}</span>}
                              {r.dateOfBirth && r.createdAt && <span className="mx-1">·</span>}
                              {r.createdAt && <span>{t('admin.created_at_label', 'Compte créé le')} {fmtDate(r.createdAt)}</span>}
                            </p>
                          )}
                          {r.requester_id && (
                            <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2 py-0.5 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                              <CheckCircle size={12} className="text-[var(--status-success)]" />
                              {t('admin.requester_id_label', 'Identifiant patient (requester_id)')} : {r.requester_id}
                            </span>
                          )}
                          {!r.hasProfile && (
                            <p className="text-sm text-[var(--status-error)] mt-1">
                              {t('admin.no_profile_warning', "Ce compte existe mais le profil n'est pas encore complété.")}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selected && (
              <div className="card p-6 space-y-5">
                <div className="flex items-start gap-3 pb-4 border-b border-[var(--border-default)]">
                  <div className="h-11 w-11 rounded-lg bg-[var(--color-fuchsia-accent)]/10 text-[var(--color-fuchsia-accent)] flex items-center justify-center flex-shrink-0">
                    <User size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)]">{selected.fullName || t('admin.name', 'Nom')}</p>
                    {selected.email && <p className="text-sm text-[var(--text-secondary)] break-all">{selected.email}</p>}
                    {selected.phone && <p className="text-sm text-[var(--text-secondary)]">{selected.phone}</p>}
                    {selected.dateOfBirth && (
                      <p className="text-sm text-[var(--text-secondary)]">{t('admin.dob_label', 'Date de naissance')} : {fmtDate(selected.dateOfBirth)}</p>
                    )}
                    {selected.createdAt && (
                      <p className="text-sm text-[var(--text-secondary)]">{t('admin.created_at_label', 'Compte créé le')} {fmtDate(selected.createdAt)}</p>
                    )}
                    {!selected.hasProfile && (
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
                  <button type="submit" disabled={busy !== false || !selected.email} className="button-bordeaux justify-center w-full disabled:opacity-60">
                    {busy === 'save' ? t('admin.saving', 'Enregistrement…') : t('admin.save', 'Enregistrer')}
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {/* ── Tester tab: results-ID onboarding probe ─────────────────────── */}
        {activeTab === 'test' && (
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <FlaskConical size={20} className="text-[var(--color-bordeaux-primary)]" />
              {t('admin.test_title', 'Tester un identifiant de résultats')}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {t('admin.test_subtitle', "Vérifiez qu'un identifiant renvoie bien des résultats avant d'inviter le patient à se connecter.")}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runTest(testId, testType);
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              type="text"
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              placeholder={t('admin.requester_id_label', 'Identifiant patient (requester_id)')}
              className="flex-1 rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
            />
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value as RequesterType)}
              aria-label={t('admin.type_label', 'Type')}
              className="rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
            >
              <option value="patient">{t('admin.type_patient', 'Patient')}</option>
              <option value="medecin">{t('admin.type_medecin', 'Médecin')}</option>
              <option value="correspondant">{t('admin.type_correspondant', 'Correspondant')}</option>
            </select>
            <button
              type="submit"
              disabled={testBusy || !testId.trim()}
              className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-60"
            >
              <FlaskConical size={18} />
              {testBusy ? t('admin.test_running', 'Test en cours…') : t('admin.test_run', 'Tester')}
            </button>
          </form>

          {/* Status banner */}
          {testStatus === 'ok' && (
            <VerdictPanel
              tone="success"
              title={t('admin.test_ok', 'Les analyses remontent bien ✓')}
              body={t(
                'admin.test_ok_body',
                "Cet identifiant est bien reconnu par le laboratoire. Le patient verra la liste ci-dessous en se connectant."
              )}
              todo={t(
                'admin.test_ok_todo',
                "Vérifiez que le nom affiché est bien celui du patient, puis associez l'identifiant à son compte."
              )}
            />
          )}
          {testStatus === 'empty' && (
            <VerdictPanel
              tone="warning"
              title={t('admin.test_empty_title', "Ce patient n'est pas encore reconnu par le laboratoire")}
              body={t(
                'admin.test_empty_body',
                "Deux causes possibles : soit le numéro de dossier est erroné, soit le compte CyberLab du patient n'a pas encore été créé dans Qalam."
              )}
              todo={t(
                'admin.test_empty_todo',
                "À faire : vérifiez le numéro. S'il est correct, créez le compte CyberLab du patient dans Qalam puis refaites ce test. Sans cette étape, le patient se connectera et son écran restera vide."
              )}
            />
          )}
          {testStatus === 'error' && (
            <VerdictPanel
              tone="error"
              title={t('admin.test_error', 'Test impossible pour le moment. Réessayez.')}
              body={testError || t('admin.test_error_body', "Le test n'a pas pu aboutir : la liaison avec le laboratoire n'a pas répondu.")}
              todo={t(
                'admin.test_error_todo',
                "À faire : patientez une minute et refaites le test. Si le message revient, prévenez l'administrateur — cela ne vient pas du dossier du patient."
              )}
            />
          )}

          {/* Preview — what the patient would see (list only, no PDFs) */}
          {testStatus === 'ok' && testResp && (
            <div className="space-y-4 pt-1">
              {/* Identity — lets staff confirm the id really belongs to the right person.
                  For a patient id the lab returns no name (data minimisation), so this is
                  normally the linked app account; `name_source` keeps that explicit. */}
              {testResp.patient_name ? (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] px-3 py-2">
                  <User size={16} className="text-[var(--color-bordeaux-primary)] flex-shrink-0" />
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {testResp.patient_name}
                  </span>
                  <span className="ms-auto flex-shrink-0 text-xs text-[var(--text-tertiary)]">
                    {testResp.name_source === 'lab'
                      ? t('admin.test_name_src_lab', 'selon le laboratoire')
                      : t('admin.test_name_src_account', 'compte lié')}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t('admin.test_name_unknown', 'Nom indisponible — aucun compte lié à cet identifiant.')}
                </p>
              )}
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                {t('admin.test_count', '{{count}} bilans trouvés', { count: testResp.results.length })}
              </p>
              <ResultsIndicators results={testResp.results} lang={lang} />
              <div className="space-y-3">
                {testResp.results.map((r) => (
                  <div key={r.dossier_id} className="rounded-lg border border-[var(--border-default)] p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[var(--color-bordeaux-primary)]/10 text-[var(--color-bordeaux-primary)] flex items-center justify-center flex-shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[var(--text-primary)] truncate">
                            {t('resultats.dossier', 'Dossier')} {r.dossier_id}
                          </p>
                          {r.etat && (
                            <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                              {etatLabel(r.etat)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">{fmtDate(r.date_dossier)}</p>
                      </div>
                    </div>
                    {r.analyses_summary && <AnalysesDetails summary={r.analyses_summary} isArabic={isArabic} />}

                    {/* PDF probe — reproduces the patient "Voir" for this dossier. */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => viewTestPdf(r.dossier_id)}
                        disabled={pdfProbe[r.dossier_id] === 'loading'}
                        className="button-bordeaux-outline justify-center flex items-center gap-2 disabled:opacity-60"
                      >
                        {pdfProbe[r.dossier_id] === 'loading' ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Eye size={16} />
                        )}
                        {pdfProbe[r.dossier_id] === 'loading'
                          ? t('admin.test_pdf_loading', 'Chargement…')
                          : t('admin.test_pdf_view', 'Voir le PDF')}
                      </button>
                      {pdfProbe[r.dossier_id] === 'ok' && (
                        <span className="flex items-center gap-1.5 text-sm text-[var(--status-success)]">
                          <CheckCircle size={15} /> {t('admin.test_pdf_ok', 'PDF récupéré ✓')}
                        </span>
                      )}
                      {pdfProbe[r.dossier_id] === 'empty' && (
                        <span className="flex flex-col gap-1 text-sm">
                          <span className="flex items-center gap-1.5 text-[var(--status-warning)]">
                            <AlertCircle size={15} className="flex-shrink-0" />
                            {t('admin.test_pdf_empty', "Le serveur n'a pas renvoyé de PDF pour ce dossier.")}
                          </span>
                          <span className="text-[var(--text-secondary)] ps-[1.4rem]">
                            {t(
                              'admin.test_pdf_empty_todo',
                              "Le patient verra ce bilan dans sa liste mais ne pourra pas l'ouvrir. Le dossier existe au laboratoire, seul le document manque : signalez ce numéro de dossier au laboratoire pour qu'il le republie."
                            )}
                          </span>
                        </span>
                      )}
                      {pdfProbe[r.dossier_id] === 'error' && (
                        <span className="flex items-center gap-1.5 text-sm text-[var(--status-error)]">
                          <AlertCircle size={15} /> {t('admin.test_pdf_error', 'Échec de la récupération du PDF.')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

        {/* ── Équipe tab: team management (admin + owner) ──────────────────── */}
        {activeTab === 'team' && isManager && (
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
    </div>
  );
}
