'use client';

/**
 * The admin « Candidatures » tab (devis line 40, Dr Aziz, 08/10/2026) — every
 * application sent from the public « Emploi & Stage » page, to sort and decide.
 * ADMIN and OWNER only (owner's decision: a CV is a lot of personal data — the
 * stagiaires never see one); the server enforces it on every callable.
 *
 * SELF-CONTAINED, unlike the other tabs (state in the page): the page keeps it
 * MOUNTED but hidden while another tab is shown — so it loads once when the
 * admin space opens (the tab's badge = applications « à étudier »), and a note
 * being typed or a filter survives a look at another tab.
 *
 *  - filters: type, period, decision (with counts) + a search (name, phone,
 *    city, reference), all applied to the list AND to the Excel export;
 *  - a card per application, unfolded on click: every answer, Appeler /
 *    WhatsApp / E-mail, « Voir le CV » / « Voir la lettre » (PDF in the app's
 *    viewer, photo in an overlay, Word downloaded), the decision chips (saved
 *    on click), the internal note, and « Effacer » in two clicks;
 *  - the link of the public page, to post on social networks.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { getClientFunctions } from '@/config/firebase';
import MedicalLoader from '@/components/ui/MedicalLoader';
import PdfViewerModal from '@/components/features/results/PdfViewerModal';
import { useSiteOrigin } from '@/hooks/useSiteOrigin';
import { waId } from '@/lib/email/appointmentEmail';
import { KINDS, NOTE_MAX, STATUSES, ageOn, type ApplicationRecord, type FileKind } from '@/lib/emploi/applicationFields';
import { downloadApplicationsXlsx } from '@/lib/emploi/exportApplications';

async function call<T>(name: string, data: object): Promise<T> {
  const functions = await getClientFunctions();
  if (!functions) throw new Error('functions-unavailable');
  return (await httpsCallable<object, T>(functions, name)(data)).data;
}

type Period = '7' | '30' | '90' | 'all';
const PERIOD_DAYS: Record<Period, number | null> = { '7': 7, '30': 30, '90': 90, all: null };
const DAY_MS = 86_400_000;

const STATUS_COLOR: Record<string, string> = {
  a_etudier: 'var(--color-fuchsia-accent)',
  entretien: 'var(--status-info)',
  retenu: 'var(--status-success)',
  refuse: 'var(--text-tertiary)',
};

// Inline colours: the global button rules beat Tailwind colour utilities.
const chipClass = 'min-h-[40px] px-3 rounded-lg border text-sm font-medium';
const chipStyle = (on: boolean): React.CSSProperties =>
  on
    ? { background: 'var(--color-bordeaux-primary)', color: 'var(--background-default)', borderColor: 'var(--color-bordeaux-primary)', transition: 'none' }
    : { background: 'transparent', color: 'var(--text-primary)', borderColor: 'var(--border-default)', transition: 'none' };
const linkClass =
  'inline-flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-[var(--border-default)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--color-bordeaux-primary)]';

/** Lower case, no accents, no spaces in numbers — for the search. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

interface FilePayload {
  base64: string;
  contentType: string;
  fileName: string;
}

interface Viewer {
  kind: 'pdf' | 'image';
  base64: string;
  contentType: string;
  title: string;
  fileName: string;
  ref: string;
}

function ImageViewer({ viewer, onClose, closeLabel }: { viewer: Viewer; onClose: () => void; closeLabel: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(base64ToBlob(viewer.base64, viewer.contentType));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [viewer]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={viewer.title}
      className="fixed inset-0 z-[1000] flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      data-testid="cand-image-viewer"
    >
      <div className="flex items-center justify-between gap-3 p-3">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-white)' }}>
          {viewer.title}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg"
          style={{ color: 'var(--color-white)', background: 'transparent' }}
        >
          <X size={20} />
          {closeLabel}
        </button>
      </div>
      <div className="flex-1 overflow-auto flex items-start justify-center p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL, not an optimisable asset */}
        {url && <img src={url} alt={viewer.title} className="max-w-full h-auto" />}
      </div>
    </div>,
    document.body
  );
}

interface Props {
  lang: string;
  /** "YYYY-MM-DD" → long date, in the admin's language. */
  fmtDate: (iso: string) => string;
  /** ms → short date and time. */
  fmtWhenTime: (ms: number) => string;
  /** The tab's badge: applications still « à étudier » (undefined while loading). */
  onPending: (n: number | undefined) => void;
}

export default function ApplicationsTab({ lang, fmtDate, fmtWhenTime, onPending }: Props) {
  const { t } = useTranslation('common');
  const origin = useSiteOrigin();
  const [list, setList] = useState<ApplicationRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kindF, setKindF] = useState<string>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [statusF, setStatusF] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setList(null);
    try {
      const res = await call<{ applications?: ApplicationRecord[] }>('adminListApplications', {});
      setList(Array.isArray(res?.applications) ? res.applications : []);
    } catch {
      setLoadError(t('admin.cand_load_error', 'Les candidatures n’ont pas pu être chargées.'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onPending(list ? list.filter((a) => a.status === 'a_etudier').length : undefined);
  }, [list, onPending]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const label = (prefix: string, v: string) => (v ? t(`emploi.${prefix}_${v}`, v) : '');
  const positionOf = (a: ApplicationRecord) =>
    a.position === 'autre' && a.positionOther ? a.positionOther : label('position', a.position);

  // Every filter but the decision — the decision chips count inside it.
  const base = useMemo(() => {
    const now = Date.now();
    const words = norm(query.trim()).split(/\s+/).filter(Boolean);
    return (list || []).filter((a) => {
      if (kindF !== 'all' && a.kind !== kindF) return false;
      const days = PERIOD_DAYS[period];
      if (days && (!a.createdAt || a.createdAt < now - days * DAY_MS)) return false;
      if (words.length) {
        const hay = norm(`${a.lastName} ${a.firstName} ${a.city} ${a.district} ${a.ref} ${a.email}`) + ' ' + a.phone.replace(/\D/g, '');
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [list, kindF, period, query]);
  const shown = useMemo(() => (statusF === 'all' ? base : base.filter((a) => a.status === statusF)), [base, statusF]);
  const countOf = (s: string) => base.filter((a) => a.status === s).length;

  const patch = (id: string, p: Partial<ApplicationRecord>) =>
    setList((l) => (l ? l.map((a) => (a.id === id ? { ...a, ...p } : a)) : l));
  const fail = (id: string, msg: string) => setRowError((e) => ({ ...e, [id]: msg }));
  const clearFail = (id: string) =>
    setRowError((e) => {
      const copy = { ...e };
      delete copy[id];
      return copy;
    });

  const setStatus = async (a: ApplicationRecord, status: string) => {
    if (a.status === status || busy) return;
    setBusy(`${a.id}:status`);
    clearFail(a.id);
    try {
      const res = await call<{ updatedAt?: number; updatedByName?: string }>('adminUpdateApplication', { id: a.id, status });
      patch(a.id, { status, updatedAt: res?.updatedAt ?? Date.now(), updatedByName: res?.updatedByName ?? a.updatedByName });
    } catch {
      fail(a.id, t('admin.cand_save_error', 'Le changement n’a pas pu être enregistré. Réessayez.'));
    } finally {
      setBusy(null);
    }
  };

  const saveNote = async (a: ApplicationRecord) => {
    const note = (notes[a.id] ?? a.note).trim();
    if (note === a.note || busy) return;
    setBusy(`${a.id}:note`);
    clearFail(a.id);
    try {
      const res = await call<{ updatedAt?: number; updatedByName?: string }>('adminUpdateApplication', { id: a.id, note });
      patch(a.id, { note, updatedAt: res?.updatedAt ?? Date.now(), updatedByName: res?.updatedByName ?? a.updatedByName });
      setNotes((n) => {
        const copy = { ...n };
        delete copy[a.id];
        return copy;
      });
    } catch {
      fail(a.id, t('admin.cand_save_error', 'Le changement n’a pas pu être enregistré. Réessayez.'));
    } finally {
      setBusy(null);
    }
  };

  const openFile = async (a: ApplicationRecord, kind: FileKind) => {
    if (busy) return;
    setBusy(`${a.id}:${kind}`);
    clearFail(a.id);
    try {
      const f = await call<FilePayload>('adminGetApplicationFile', { id: a.id, kind });
      if (!f?.base64) throw new Error('empty');
      const who = `${a.lastName} ${a.firstName}`.trim();
      const title =
        kind === 'cv'
          ? t('admin.cand_cv_title', 'CV — {{name}}', { name: who })
          : t('admin.cand_letter_title', 'Lettre — {{name}}', { name: who });
      if (f.contentType === 'application/pdf') {
        setViewer({ kind: 'pdf', base64: f.base64, contentType: f.contentType, title, fileName: `${kind}-${a.ref}.pdf`, ref: a.ref });
      } else if (f.contentType.startsWith('image/')) {
        setViewer({ kind: 'image', base64: f.base64, contentType: f.contentType, title, fileName: f.fileName, ref: a.ref });
      } else {
        // Word: the browser cannot show it — hand the file over.
        const url = URL.createObjectURL(base64ToBlob(f.base64, f.contentType));
        const link = document.createElement('a');
        link.href = url;
        link.download = f.fileName || `${kind}-${a.ref}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      fail(a.id, t('admin.cand_file_error', 'Le fichier n’a pas pu être ouvert. Réessayez.'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (a: ApplicationRecord) => {
    if (busy) return;
    setBusy(`${a.id}:delete`);
    clearFail(a.id);
    try {
      await call('adminDeleteApplication', { id: a.id });
      setList((l) => (l ? l.filter((x) => x.id !== a.id) : l));
      setConfirmDelete(null);
      setOpenId(null);
      setNotice(t('admin.cand_deleted', 'La candidature de {{name}} a été effacée, avec ses fichiers.', { name: `${a.firstName} ${a.lastName}` }));
    } catch {
      fail(a.id, t('admin.cand_delete_error', 'L’effacement n’a pas abouti. Réessayez.'));
    } finally {
      setBusy(null);
    }
  };

  const exportXlsx = async () => {
    if (exporting || !shown.length) return;
    setExporting(true);
    setNotice(null);
    try {
      await downloadApplicationsXlsx(shown, t, lang === 'ar');
    } catch {
      setNotice(t('admin.cand_export_error', 'Le fichier Excel n’a pas pu être créé. Réessayez.'));
    } finally {
      setExporting(false);
    }
  };

  const publicLink = `${origin}/${lang}/emploi`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
    } catch {
      /* the link is on screen, selectable */
    }
  };

  const filterRow = (
    name: string,
    items: { value: string; label: string }[],
    value: string,
    onChange: (v: string) => void,
    testId: string
  ) => (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={name} data-testid={testId}>
      <span className="text-sm text-[var(--text-secondary)] me-1">{name}</span>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="radio"
          aria-checked={value === it.value}
          className={chipClass}
          style={chipStyle(value === it.value)}
          onClick={() => onChange(it.value)}
          data-value={it.value}
        >
          {it.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="cand-tab">
      {/* Header: what this is, the public link, the export. */}
      <section className="card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bordeaux-primary)]/10 flex items-center justify-center flex-shrink-0">
              <Briefcase size={20} className="text-[var(--color-bordeaux-primary)]" />
            </div>
            <div className="min-w-0">
              {/* A <p>: base/reset.css sizes and colours h2 unlayered. */}
              <p className="font-semibold text-[var(--text-primary)]">{t('admin.cand_title', 'Candidatures — Emploi & Stage')}</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {t(
                  'admin.cand_intro',
                  'Les candidatures envoyées depuis la page « Emploi & Stage ». Chacune est effacée automatiquement, avec ses fichiers, 6 mois après son envoi.'
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className={linkClass} style={{ background: 'transparent' }} data-testid="cand-refresh">
              <RefreshCw size={16} className={list === null && !loadError ? 'animate-spin' : ''} />
              {t('admin.cand_refresh', 'Actualiser')}
            </button>
            <button
              type="button"
              onClick={() => void exportXlsx()}
              disabled={exporting || !shown.length}
              className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="cand-export"
            >
              <Download size={18} className="flex-shrink-0" />
              {exporting
                ? t('admin.cand_exporting', 'Préparation…')
                : t('admin.cand_export', 'Exporter en Excel ({{count}})', { count: shown.length })}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="cand-public-link" className="block text-sm font-medium text-[var(--text-secondary)]">
            {t('admin.cand_link_label', 'Lien de la page à partager (Facebook, WhatsApp…)')}
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="cand-public-link"
              type="text"
              readOnly
              value={publicLink}
              dir="ltr"
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-secondary)] text-[var(--text-primary)] sm:text-sm"
              data-testid="cand-public-link"
            />
            <button type="button" onClick={() => void copyLink()} className={linkClass} style={{ background: 'transparent' }} data-testid="cand-copy-link">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t('admin.invite_copied', 'Lien copié') : t('admin.invite_copy', 'Copier le lien')}
            </button>
          </div>
        </div>
        {notice && (
          <p className="text-sm font-medium text-[var(--status-success)]" role="status" data-testid="cand-notice">
            {notice}
          </p>
        )}
      </section>

      {loadError ? (
        <section className="card p-6 space-y-3" data-testid="cand-error">
          <p className="text-sm text-[var(--status-error)]">{loadError}</p>
          <button type="button" onClick={() => void load()} className="button-bordeaux justify-center flex items-center gap-2">
            <RefreshCw size={16} />
            {t('retry', 'Réessayer')}
          </button>
        </section>
      ) : list === null ? (
        <section className="card p-6">
          <MedicalLoader />
        </section>
      ) : (
        <section className="space-y-4">
          {/* Filters — applied to the list AND to the export. */}
          <div className="card p-4 space-y-3" data-testid="cand-filters">
            {filterRow(
              t('admin.cand_f_kind', 'Type'),
              [{ value: 'all', label: t('admin.cand_f_all', 'Tous') }, ...KINDS.map((k) => ({ value: k, label: label('kind', k) }))],
              kindF,
              setKindF,
              'cand-f-kind'
            )}
            {filterRow(
              t('admin.cand_f_period', 'Période'),
              [
                { value: '7', label: t('admin.cand_f_7', '7 derniers jours') },
                { value: '30', label: t('admin.cand_f_30', '30 derniers jours') },
                { value: '90', label: t('admin.cand_f_90', '3 derniers mois') },
                { value: 'all', label: t('admin.cand_f_all_time', 'Tout') },
              ],
              period,
              (v) => setPeriod(v as Period),
              'cand-f-period'
            )}
            {filterRow(
              t('admin.cand_f_status', 'Décision'),
              [
                { value: 'all', label: `${t('admin.cand_f_all', 'Tous')} (${base.length})` },
                ...STATUSES.map((s) => ({ value: s, label: `${t(`admin.cand_status_${s}`, s)} (${countOf(s)})` })),
              ],
              statusF,
              setStatusF,
              'cand-f-status'
            )}
            <div className="relative">
              <Search size={18} className="absolute top-1/2 -translate-y-1/2 start-3 text-[var(--text-tertiary)] pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('admin.cand_search', 'Nom, téléphone, ville ou référence')}
                className="w-full rounded-lg ps-10 pe-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
                data-testid="cand-search"
              />
            </div>
          </div>

          {!list.length ? (
            <p className="card p-6 text-sm text-[var(--text-secondary)]" data-testid="cand-empty">
              {t('admin.cand_empty', 'Aucune candidature pour le moment. Partagez le lien de la page ci-dessus pour en recevoir.')}
            </p>
          ) : !shown.length ? (
            <p className="card p-6 text-sm text-[var(--text-secondary)]" data-testid="cand-none">
              {t('admin.cand_none', 'Aucune candidature ne correspond à ces filtres.')}
            </p>
          ) : (
            <ul className="space-y-3" data-testid="cand-list">
              {shown.map((a) => {
                const open = openId === a.id;
                const age = ageOn(a.dateOfBirth, new Date());
                const pos = positionOf(a);
                const colour = STATUS_COLOR[a.status] || 'var(--text-tertiary)';
                const draft = notes[a.id] ?? a.note;
                const internship = a.kind === 'observation' || a.kind === 'preembauche';
                const rows: Array<[string, string]> = [
                  [t('admin.cand_x_kind', 'Demande'), label('kind', a.kind)],
                  [t('emploi.position_label', 'Poste visé'), pos],
                  [t('emploi.school_level_label', 'Scolarité'), label('school', a.schoolLevel)],
                  internship
                    ? [
                        t('emploi.duration_label', 'Durée souhaitée'),
                        [
                          label('duration', a.duration),
                          a.startDate ? t('admin.cand_from', 'du {{date}}', { date: fmtDate(a.startDate) }) : '',
                          a.endDate ? t('admin.cand_to', 'au {{date}}', { date: fmtDate(a.endDate) }) : '',
                        ]
                          .filter(Boolean)
                          .join(' '),
                      ]
                    : [
                        t('emploi.availability_label', 'Disponibilité'),
                        a.availability === 'date' && a.availableFrom
                          ? t('admin.cand_available_from', 'à partir du {{date}}', { date: fmtDate(a.availableFrom) })
                          : t('emploi.availability_immediate', 'Immédiate'),
                      ],
                  [
                    t('emploi.dob', 'Date de naissance'),
                    a.dateOfBirth
                      ? `${fmtDate(a.dateOfBirth)}${age !== null ? ` (${t('admin.cand_age', '{{age}} ans', { age })})` : ''}`
                      : '',
                  ],
                  [t('emploi.city', 'Ville'), a.district ? `${a.city} (${a.district})` : a.city],
                  [t('emploi.diploma_level_label', 'Niveau d’études'), label('diploma', a.diplomaLevel)],
                  [
                    t('emploi.diploma_title', 'Intitulé du diplôme'),
                    [a.diplomaTitle, a.diplomaYear ? String(a.diplomaYear) : '', a.school].filter(Boolean).join(' — '),
                  ],
                  [t('emploi.experience_label', 'Expérience'), label('experience', a.experience)],
                  [t('emploi.last_employer', 'Dernier employeur'), a.lastEmployer],
                  [t('emploi.license_label', 'Permis de conduire'), a.license ? t('emploi.yes', 'Oui') : t('emploi.no', 'Non')],
                  [t('emploi.vehicle_label', 'Véhicule'), label('vehicle', a.vehicle)],
                  [
                    t('emploi.languages_label', 'Langues parlées'),
                    [...a.languages.map((l) => label('lang', l)), a.languagesOther].filter(Boolean).join(', '),
                  ],
                  [t('emploi.source_label', 'Comment nous avez-vous connus ?'), label('source', a.source)],
                  [
                    t('admin.cand_x_expires', 'Effacement prévu le'),
                    a.expiresAt ? fmtDate(new Date(a.expiresAt).toISOString().slice(0, 10)) : '',
                  ],
                ];
                return (
                  <li key={a.id} className="rounded-lg border border-[var(--border-default)] bg-[var(--background-default)]" data-testid="cand-card" data-id={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenId(open ? null : a.id);
                        setConfirmDelete(null);
                      }}
                      aria-expanded={open}
                      className="w-full text-start p-4 flex items-start gap-3 rounded-lg"
                      style={{ background: 'transparent', color: 'inherit' }}
                      data-testid="cand-toggle"
                    >
                      <span className="h-10 w-10 rounded-lg bg-[var(--color-fuchsia-accent)]/10 text-[var(--color-fuchsia-accent)] flex items-center justify-center flex-shrink-0">
                        <User size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-[var(--text-primary)]" data-testid="cand-name">
                          {a.lastName} {a.firstName}
                          {age !== null && (
                            <span className="font-normal text-[var(--text-secondary)]"> · {t('admin.cand_age', '{{age}} ans', { age })}</span>
                          )}
                        </span>
                        <span className="block text-sm text-[var(--text-secondary)]">
                          {[label('kind', a.kind), pos].filter(Boolean).join(' — ')}
                        </span>
                        <span className="block text-xs text-[var(--text-tertiary)] mt-0.5">
                          {[a.city, a.createdAt ? t('admin.cand_received', 'reçue le {{date}}', { date: fmtWhenTime(a.createdAt) }) : '', a.ref]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span
                          className="text-xs font-semibold px-2 py-1 rounded-lg border"
                          style={{ color: colour, borderColor: colour, background: 'var(--background-secondary)' }}
                          data-testid="cand-status"
                        >
                          {t(`admin.cand_status_${a.status}`, a.status)}
                        </span>
                        {open ? <ChevronUp size={18} className="text-[var(--text-tertiary)]" /> : <ChevronDown size={18} className="text-[var(--text-tertiary)]" />}
                      </span>
                    </button>

                    {open && (
                      <div className="border-t border-[var(--border-default)] p-4 space-y-5" data-testid="cand-details">
                        {/* Reach the candidate. */}
                        <div className="flex flex-wrap gap-2">
                          <a href={`tel:${a.phone.replace(/[^\d+]/g, '')}`} className={linkClass} data-testid="cand-call">
                            <Phone size={16} />
                            <span dir="ltr">{a.phone}</span>
                          </a>
                          {waId(a.phone) && (
                            <a href={`https://wa.me/${waId(a.phone)}`} target="_blank" rel="noopener noreferrer" className={linkClass} data-testid="cand-whatsapp">
                              <MessageCircle size={16} />
                              WhatsApp
                            </a>
                          )}
                          {a.email && (
                            <a href={`mailto:${a.email}`} className={linkClass} data-testid="cand-mail">
                              <Mail size={16} />
                              <span dir="ltr" className="truncate max-w-[16rem]">{a.email}</span>
                            </a>
                          )}
                        </div>

                        {/* The documents. */}
                        <div className="flex flex-wrap gap-2">
                          {(['cv', 'letter'] as FileKind[]).map((k) =>
                            a.files[k] ? (
                              <button
                                key={k}
                                type="button"
                                onClick={() => void openFile(a, k)}
                                disabled={!!busy}
                                className="button-bordeaux justify-center flex items-center gap-2 disabled:opacity-60"
                                data-testid={`cand-open-${k}`}
                              >
                                <FileText size={18} className="flex-shrink-0" />
                                {busy === `${a.id}:${k}`
                                  ? t('admin.cand_opening', 'Ouverture…')
                                  : k === 'cv'
                                    ? t('admin.cand_open_cv', 'Voir le CV')
                                    : t('admin.cand_open_letter', 'Voir la lettre')}
                              </button>
                            ) : null
                          )}
                          {!a.files.cv && !a.files.letter && (
                            <p className="text-sm text-[var(--text-tertiary)]">{t('admin.cand_no_files', 'Aucun document joint.')}</p>
                          )}
                        </div>

                        {/* Every answer. */}
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                          {rows
                            .filter(([, v]) => v)
                            .map(([k, v]) => (
                              <div key={k}>
                                <dt className="text-xs text-[var(--text-tertiary)]">{k}</dt>
                                <dd className="text-[var(--text-primary)]">{v}</dd>
                              </div>
                            ))}
                        </dl>

                        {/* The lab's decision — saved on click. */}
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t('admin.cand_decision', 'Décision')} data-testid="cand-decision">
                            <span className="text-sm text-[var(--text-secondary)] me-1">{t('admin.cand_decision', 'Décision')}</span>
                            {STATUSES.map((s) => (
                              <button
                                key={s}
                                type="button"
                                role="radio"
                                aria-checked={a.status === s}
                                disabled={!!busy}
                                className={chipClass}
                                style={chipStyle(a.status === s)}
                                onClick={() => void setStatus(a, s)}
                                data-value={s}
                              >
                                {t(`admin.cand_status_${s}`, s)}
                              </button>
                            ))}
                          </div>
                          <div className="space-y-1">
                            <label htmlFor={`cand-note-${a.id}`} className="block text-sm font-medium text-[var(--text-secondary)]">
                              {t('admin.cand_note', 'Note interne')}
                            </label>
                            <textarea
                              id={`cand-note-${a.id}`}
                              value={draft}
                              maxLength={NOTE_MAX}
                              rows={3}
                              onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                              placeholder={t('admin.cand_note_placeholder', 'Ex. : entretien prévu jeudi 10 h, à rappeler après le bac…')}
                              className="w-full rounded-lg px-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] sm:text-sm"
                              data-testid="cand-note"
                            />
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={() => void saveNote(a)}
                                disabled={!!busy || draft.trim() === a.note}
                                className={linkClass}
                                style={{ background: 'transparent' }}
                                data-testid="cand-note-save"
                              >
                                <Check size={16} />
                                {busy === `${a.id}:note` ? t('admin.cand_saving', 'Enregistrement…') : t('admin.cand_note_save', 'Enregistrer la note')}
                              </button>
                              {a.updatedByName && a.updatedAt && (
                                <span className="text-xs text-[var(--text-tertiary)]" data-testid="cand-updated">
                                  {t('admin.cand_updated', 'Dernière mise à jour par {{name}}, le {{date}}', {
                                    name: a.updatedByName,
                                    date: fmtWhenTime(a.updatedAt),
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {rowError[a.id] && (
                          <p className="text-sm text-[var(--status-error)]" role="alert" data-testid="cand-row-error">
                            {rowError[a.id]}
                          </p>
                        )}

                        {/* Erase now — two clicks, never window.confirm(). */}
                        <div className="pt-2 border-t border-[var(--border-default)]">
                          {confirmDelete === a.id ? (
                            <div className="flex flex-wrap items-center gap-2" data-testid="cand-delete-confirm">
                              <span className="text-sm text-[var(--text-primary)]">
                                {t('admin.cand_delete_confirm', 'Effacer définitivement cette candidature et ses fichiers ?')}
                              </span>
                              <button
                                type="button"
                                onClick={() => void remove(a)}
                                disabled={!!busy}
                                className={chipClass}
                                style={{ background: 'var(--status-error)', color: 'var(--color-white)', borderColor: 'var(--status-error)', transition: 'none' }}
                                data-testid="cand-delete-yes"
                              >
                                {busy === `${a.id}:delete` ? t('admin.cand_deleting', 'Effacement…') : t('admin.cand_delete_yes', 'Oui, effacer')}
                              </button>
                              <button type="button" onClick={() => setConfirmDelete(null)} className={chipClass} style={chipStyle(false)}>
                                {t('admin.cand_delete_no', 'Annuler')}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(a.id)}
                              className="inline-flex items-center gap-2 min-h-[40px] text-sm text-[var(--text-secondary)] hover:text-[var(--status-error)]"
                              style={{ background: 'transparent' }}
                              data-testid="cand-delete"
                            >
                              <Trash2 size={16} />
                              {t('admin.cand_delete', 'Effacer cette candidature')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {viewer?.kind === 'pdf' && (
        <PdfViewerModal
          base64={viewer.base64}
          dossierId={viewer.ref}
          onClose={() => setViewer(null)}
          title={viewer.title}
          shareTitle={viewer.title}
          shareText={viewer.title}
          fileName={viewer.fileName}
        />
      )}
      {viewer?.kind === 'image' && (
        <ImageViewer viewer={viewer} onClose={() => setViewer(null)} closeLabel={t('admin.cand_close', 'Fermer')} />
      )}
    </div>
  );
}
