'use client';

/**
 * « Mes patients » — the doctor's workspace. See docs/pages/mes-patients.md.
 *
 * Data: ONE call lists the dossiers the doctor prescribed (`useResultsFor(code)`
 * → `fetchResults` with the practitioner selector; the server forces
 * `include_pdf: "none"`, 0.25 s measured). They are grouped by patient HERE
 * (`groupByPatient`) — the lab returns no patient id. A patient's PDF is only
 * fetched when the doctor opens that patient (his most recent one), older ones
 * on demand. Everything stays in memory, in the shared results context.
 *
 * ⚠ Rules this component keeps:
 *  - `practitioner.requester_id` is REQUIRED. `useResultsFor(null)` would mean
 *    the account's PRIMARY identity — the doctor's own results, not his roster;
 *  - the page keys this component by uid + code: another account or another code
 *    never inherits a selection or a query;
 *  - no patient name ever goes into the URL, the page title, the browser history
 *    state or a file name (download folders and chat previews keep them);
 *  - on phones, opening a patient pushes ONE history entry (same URL) so the
 *    Android back button returns to the list instead of leaving the page.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Phone, RefreshCw, Search, Stethoscope, Users, X } from 'lucide-react';
import { useResultsFor } from '@/contexts/ResultsContext';
import { useAuth } from '@/contexts/AuthContext';
import LastUpdatedLabel from '@/components/features/results/LastUpdatedLabel';
import PdfViewerModal from '@/components/features/results/PdfViewerModal';
import OutageOptIn, { useOutageStatus } from '@/components/features/results/OutageOptIn';
import MedicalLoader from '@/components/ui/MedicalLoader';
import VerdictPanel from '@/components/ui/VerdictPanel';
import { LAB_CONTACT } from '@/constants/contact';
import { displayName, groupByPatient, isCapped, LIST_CAP, matchesQuery } from '@/lib/practitioner/patients';
import type { PractitionerIdentity } from '@/lib/results/identities';
import PatientList from './PatientList';
import PatientDetail from './PatientDetail';
import ResultsSpaceSwitch from './ResultsSpaceSwitch';
import { usePractitionerPdfActions } from './usePractitionerPdfActions';

interface Props {
  lang: string;
  practitioner: PractitionerIdentity;
}

/** Phone + WhatsApp to the lab front desk — the way out of every blocked state. */
function ContactActions() {
  const { t } = useTranslation('common');
  const link =
    'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-[var(--border-default)] text-[var(--text-primary)] font-medium hover:bg-[var(--background-tertiary)] hover:border-[var(--color-bordeaux-primary)] transition-all';
  return (
    <div className="flex flex-wrap gap-2">
      <a href={LAB_CONTACT.LANDLINE.url} className={link}>
        <Phone size={18} />
        <span dir="ltr">{LAB_CONTACT.LANDLINE.display}</span>
      </a>
      <a href={LAB_CONTACT.WHATSAPP[0].url} target="_blank" rel="noopener noreferrer" className={link}>
        <MessageCircle size={18} />
        {t('mes_patients.contact_whatsapp', 'WhatsApp du laboratoire')}
      </a>
    </div>
  );
}

export default function PractitionerWorkspace({ lang, practitioner }: Props) {
  const { t } = useTranslation('common');
  const isArabic = lang === 'ar';

  // Admin « Vue patient »: read-only, no opt-in written in the admin's name.
  const { viewAs } = useAuth();
  const view = useResultsFor(practitioner.requester_id);
  const { results, status, errorCode, lastUpdated, pdfState, loadPdf, ensureLoaded, refresh } = view;

  const accessRemoved = status === 'need_access' || (status === 'error' && errorCode === 'permission-denied');
  const outage = useOutageStatus(status === 'error' && errorCode !== 'resource-exhausted' && !accessRemoved);

  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // `ensureLoaded` is stable (see useView): this runs once per identity.
  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  const groups = useMemo(() => groupByPatient(results), [results]);
  const visible = useMemo(() => groups.filter((g) => matchesQuery(g, query)), [groups, query]);
  const selected = useMemo(() => groups.find((g) => g.key === selectedKey) ?? null, [groups, selectedKey]);
  const capped = isCapped(results);

  const actions = usePractitionerPdfActions(
    view,
    t('mes_patients.share_title', "Résultat d'analyses"),
    t('mes_patients.share_text', "Résultat d'analyses — Laboratoire El Allali")
  );

  // ── Phone back button ─────────────────────────────────────────────────────
  // On a phone the detail REPLACES the list. Without a history entry, the
  // Android back button would leave « Mes patients » altogether. One entry, same
  // URL, nothing identifying in its state; Next.js patches pushState and keeps
  // its own router state in the entry, so this is not a navigation.
  const pushedRef = useRef(false);
  const listScrollRef = useRef(0);

  const openPatient = useCallback((key: string) => {
    const phone = typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches;
    if (phone) {
      listScrollRef.current = window.scrollY;
      if (!pushedRef.current) {
        window.history.pushState({ mpDetail: 1 }, '');
        pushedRef.current = true;
      }
      window.scrollTo({ top: 0 });
    }
    setSelectedKey(key);
  }, []);

  const closePatient = useCallback(() => {
    if (pushedRef.current) {
      window.history.back(); // the popstate handler below does the rest
      return;
    }
    setSelectedKey(null);
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (!pushedRef.current) return;
      pushedRef.current = false;
      setSelectedKey(null);
      const y = listScrollRef.current;
      requestAnimationFrame(() => window.scrollTo({ top: y }));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // A patient that vanished after « Actualiser » (or an access change) must not
  // linger on screen.
  useEffect(() => {
    if (selectedKey && !groups.some((g) => g.key === selectedKey)) setSelectedKey(null);
  }, [groups, selectedKey]);

  const viewerGroup =
    actions.viewerId ? groups.find((g) => g.dossiers.some((d) => d.dossier_id === actions.viewerId)) : null;

  // ── Blocked states ────────────────────────────────────────────────────────
  let body: React.ReactNode;
  if (status === 'idle' || status === 'loading') {
    body = (
      <div className="card">
        <MedicalLoader label={t('mes_patients.loading', 'Chargement de vos patients…')} />
      </div>
    );
  } else if (accessRemoved) {
    body = (
      <VerdictPanel
        tone="warning"
        title={t('mes_patients.removed_title', 'Votre accès médecin a été retiré ou modifié')}
        body={t('mes_patients.removed_body', 'Cet espace n’est plus disponible avec votre compte.')}
        todo={t('mes_patients.removed_todo', 'Si c’est une erreur, contactez le laboratoire.')}
        actions={<ContactActions />}
      />
    );
  } else if (status === 'unknown_id') {
    body = (
      <VerdictPanel
        tone="warning"
        title={t('mes_patients.unknown_title', 'Votre accès n’est pas encore actif côté laboratoire')}
        body={t(
          'mes_patients.unknown_body',
          'Le serveur de résultats ne connaît pas encore votre code médecin : aucun de vos bilans n’y a encore été envoyé.'
        )}
        todo={t(
          'mes_patients.unknown_todo',
          'Vos bilans apparaîtront d’eux-mêmes dès le premier envoi du laboratoire. Si cela dure, contactez-le.'
        )}
        actions={<ContactActions />}
      />
    );
  } else if (status === 'error') {
    const rateLimited = errorCode === 'resource-exhausted';
    const down = outage.known && outage.down;
    body = (
      <VerdictPanel
        tone={rateLimited ? 'warning' : 'error'}
        title={t('resultats.error_title', 'Panne temporaire')}
        body={
          rateLimited
            ? t('mes_patients.rate_limited_body', 'Trop de demandes en peu de temps.')
            : down && outage.downSince
              ? t('mes_patients.outage_body', {
                  time: outage.downSince.toLocaleTimeString(isArabic ? 'ar-MA' : 'fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  defaultValue: 'Le serveur de résultats du laboratoire est en panne depuis {{time}}. Le laboratoire est déjà alerté.',
                })
              : t('mes_patients.error_body', 'Impossible de charger vos patients pour le moment.')
        }
        todo={t('mes_patients.error_todo', 'Réessayez dans quelques minutes.')}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={refresh} className="button-bordeaux justify-center flex items-center gap-2">
              <RefreshCw size={18} />
              {t('resultats.retry', 'Réessayer')}
            </button>
            {down && !viewAs && <OutageOptIn lang={lang} />}
          </div>
        }
      />
    );
  } else if (status === 'empty') {
    body = (
      <div className="card p-8 text-center flex flex-col items-center gap-3" data-testid="mp-empty">
        <Users size={40} className="text-[var(--text-tertiary)]" />
        <p className="font-semibold text-[var(--text-primary)]">
          {t('mes_patients.empty_title', 'Aucun bilan pour le moment')}
        </p>
        <p className="text-sm text-[var(--text-secondary)] max-w-md">
          {t(
            'mes_patients.empty_desc',
            'Les bilans que vous prescrivez apparaîtront ici dès leur validation par le laboratoire.'
          )}
        </p>
      </div>
    );
  } else {
    // ── Ready ────────────────────────────────────────────────────────────────
    body = (
      <div className="space-y-4">
        <div className={`space-y-2 ${selected ? 'hidden lg:block' : ''}`}>
          <div className="relative">
            <Search
              className={`absolute ${isArabic ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]`}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('mes_patients.search_placeholder', 'Rechercher un patient ou un n° de dossier')}
              aria-label={t('mes_patients.search_placeholder', 'Rechercher un patient ou un n° de dossier')}
              // A patient's name typed here must not be remembered by the browser.
              autoComplete="off"
              dir={isArabic ? 'rtl' : 'ltr'}
              data-testid="mp-search"
              className={`w-full ${isArabic ? 'pr-12 pl-10' : 'pl-12 pr-10'} py-3 rounded-lg bg-[var(--background-default)] text-[var(--text-primary)] border border-[var(--border-default)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent placeholder:text-[var(--text-tertiary)]`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('mes_patients.search_clear', 'Effacer la recherche')}
                className={`absolute ${isArabic ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)]`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)]" data-testid="mp-summary">
            {t('mes_patients.patients_count', { count: groups.length, defaultValue: '{{count}} patients' })}
            {' · '}
            {t('mes_patients.bilans_count', { count: results.length, defaultValue: '{{count}} bilans' })}
          </p>
          {capped && (
            <p className="text-xs text-[var(--text-tertiary)]" data-testid="mp-capped">
              {/* `n`, not `count`: a constant needs no plural forms. */}
              {t('mes_patients.capped', {
                n: LIST_CAP,
                defaultValue: 'Seuls vos {{n}} bilans les plus récents sont affichés.',
              })}
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] items-start">
          <div className={selected ? 'hidden lg:block' : ''}>
            {visible.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] card p-4" data-testid="mp-no-match">
                {t('mes_patients.no_match', 'Aucun patient ne correspond à « {{query}} ».', { query })}
              </p>
            ) : (
              <PatientList groups={visible} selectedKey={selectedKey} onSelect={openPatient} lang={lang} />
            )}
          </div>
          <div className={selected ? '' : 'hidden lg:block'}>
            {selected ? (
              <PatientDetail
                key={selected.key}
                group={selected}
                lang={lang}
                pdfState={pdfState}
                loadPdf={loadPdf}
                canShare={actions.canShare}
                onView={actions.openViewer}
                onDownload={actions.download}
                onShare={actions.share}
                onBack={closePatient}
              />
            ) : (
              <div className="card p-8 text-center text-sm text-[var(--text-secondary)]">
                {t('mes_patients.select_hint', 'Sélectionnez un patient pour voir ses bilans.')}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] py-10 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
      <style>{`@keyframes mpBar { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* « Moi et ma famille | Mes patients » — back to his own results in one tap. */}
        <ResultsSpaceSwitch lang={lang} current="patients" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-bordeaux-primary)] flex items-center gap-2">
              <Stethoscope size={26} />
              {t('mes_patients.title', 'Mes patients')}
            </h1>
            <p className="text-[var(--text-secondary)] mt-1">
              {practitioner.label
                ? t('mes_patients.subtitle_label', '{{label}} — les bilans que vous avez prescrits.', {
                    label: practitioner.label,
                  })
                : t('mes_patients.subtitle', 'Les bilans que vous avez prescrits.')}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <button
              type="button"
              onClick={refresh}
              disabled={status === 'loading'}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-[var(--border-default)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--background-tertiary)] hover:border-[var(--color-bordeaux-primary)] transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw size={18} className={status === 'loading' ? 'animate-spin' : ''} />
              {t('resultats.refresh', 'Actualiser')}
            </button>
            {lastUpdated && (
              <span className="text-xs text-[var(--text-tertiary)] font-medium">
                <LastUpdatedLabel timestamp={lastUpdated} />
              </span>
            )}
          </div>
        </div>

        {body}

        <div className="space-y-1 text-xs text-[var(--text-tertiary)]">
          <p>
            {t(
              'mes_patients.rule_note',
              'Vous ne voyez que les bilans que vous avez vous-même prescrits. Rien n’est conservé sur votre appareil : les résultats sont lus à la demande auprès du laboratoire.'
            )}
          </p>
          {status === 'ready' && (
            <p>
              {t(
                'mes_patients.homonym_note',
                'Deux patients portant exactement le même nom apparaissent ensemble : fiez-vous à la date et au numéro de dossier.'
              )}
            </p>
          )}
        </div>
      </div>

      {actions.viewerId && actions.viewerBase64 && (
        <PdfViewerModal
          base64={actions.viewerBase64}
          dossierId={actions.viewerId}
          onClose={actions.closeViewer}
          title={
            viewerGroup && !viewerGroup.nameless
              ? t('mes_patients.viewer_title', '{{name}} — dossier {{id}}', {
                  name: displayName(viewerGroup),
                  id: actions.viewerId,
                })
              : undefined
          }
          shareTitle={t('mes_patients.share_title', "Résultat d'analyses")}
          shareText={t('mes_patients.share_text', "Résultat d'analyses — Laboratoire El Allali")}
        />
      )}
    </div>
  );
}
