/**
 * Point d'entrée du banc « résultats » : monte une page de PRODUCTION, sans
 * modification, sous le vrai `ResultsProvider`, avec les seules frontières
 * externes doublées (voir `scripts/testing/README.md`).
 *
 * Le pilote pose, AVANT `window.__mount(page)` :
 *   - `window.__lang`   : 'fr' | 'ar'
 *   - `window.__server` : le serveur de résultats simulé (voir `ServerConfig`)
 *   - le compte, via `window.__setAuth(profil)` (doublure `stub-auth-store`)
 *
 * Tous les appels aux fonctions Firebase sont enregistrés dans `window.__calls`
 * par la doublure : c'est la mesure principale de ce banc.
 */
import React, { Suspense, use, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { ResultsProvider } from '../../src/contexts/ResultsContext';
import { ThemeProvider } from '../../src/contexts/ThemeContext';
import ResultatsPage from '../../src/app/[lang]/resultats/page';
import MesPatientsPage from '../../src/app/[lang]/mes-patients/page';
import ProfilePage from '../../src/app/[lang]/profile/page';
import Header from '../../src/components/layout/Header';
import HeroPersonalPanel from '../../src/components/features/home/HeroPersonalPanel';
import PractitionerCard, {
  type PractitionerCheck,
  type PractitionerDraft,
} from '../../src/components/features/admin/PractitionerCard';

// ── Le serveur de résultats simulé ──────────────────────────────────────────
interface Dossier {
  dossier_id: string;
  patient_nom: string;
  patient_prenom: string;
  date_dossier: string;
  etat: string;
  analyses_summary: string;
}

interface ServerIdentity {
  list: Dossier[];
  /** Dossiers dont le laboratoire n'a pas joint de PDF (réponse 200, base64 vide). */
  noPdf?: string[];
}

interface ServerConfig {
  /** L'identité que le serveur résout quand la page n'envoie pas de `requester_id`. */
  primary?: string | null;
  identities: Record<string, ServerIdentity>;
  /** Code d'erreur Firebase renvoyé pour TOUTE liste (ex. 'internal', 'resource-exhausted'). */
  listError?: string | null;
  /** Code d'erreur renvoyé pour tout chargement de PDF. */
  pdfError?: string | null;
  /** Identifiants que le serveur du laboratoire ne connaît pas (404 → `unknown_id`). */
  notFound?: string[];
  /** Latence simulée, en millisecondes. */
  delayMs?: number;
  /** Plafond du serveur réel. */
  cap?: number;
}

type AnyWindow = Window &
  typeof globalThis & {
    __lang?: string;
    __server?: ServerConfig;
    __callables: Record<string, (args: unknown) => unknown>;
    __mount?: (page?: string) => void;
    __unmount?: () => void;
  };

const w = window as AnyWindow;

/** Un PDF minimal : la visionneuse est doublée, seul le passage du document compte. */
const FAKE_PDF_B64 =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2c+PgplbmRvYmoKdHJhaWxlcgo8PC9Sb290IDEgMCBSPj4KJSVFT0YK';

function fnError(code: string): Error {
  const e = new Error(code) as Error & { code: string };
  e.code = `functions/${code}`;
  return e;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Reproduit les règles du vrai serveur (`functions/src/cyberlab/fetchResults.ts`
 * + le serveur du laboratoire) : identité résolue depuis le « profil » simulé,
 * `requester_id` inconnu → refusé, `dossier_id` hors périmètre → 404, plafond.
 */
async function fetchResults(raw: unknown) {
  const args = (raw ?? {}) as { requester_id?: string; dossier_id?: string; include_pdf?: string };
  const s = w.__server ?? { identities: {} };
  await sleep(s.delayMs ?? 40);

  const id = args.requester_id ?? s.primary ?? null;
  if (!id) throw fnError('failed-precondition');
  if (s.notFound?.includes(id)) throw fnError('not-found');
  const ident = s.identities[id];
  if (!ident) throw fnError(args.requester_id ? 'permission-denied' : 'failed-precondition');

  if (args.dossier_id) {
    if (s.pdfError) throw fnError(s.pdfError);
    const d = ident.list.find((x) => x.dossier_id === args.dossier_id);
    if (!d) throw fnError('not-found');
    const pdf = ident.noPdf?.includes(d.dossier_id) ? '' : FAKE_PDF_B64;
    return { type: 'patient', requester_id: id, results: [{ ...d, pdf_base64: pdf }] };
  }

  if (s.listError) throw fnError(s.listError);
  const inc = args.include_pdf ?? 'all';
  const list = ident.list.slice(0, s.cap ?? 50).map((d, i) => ({
    ...d,
    pdf_base64:
      inc === 'all' || (inc === 'latest' && i === 0)
        ? ident.noPdf?.includes(d.dossier_id)
          ? ''
          : FAKE_PDF_B64
        : '',
  }));
  return { type: 'patient', requester_id: id, results: list };
}

// Les autres callables que les pages appellent en passant. Réponses neutres :
// aucune demande en cours, aucune panne connue.
w.__callables.fetchResults = fetchResults;
w.__callables.myAccessRequest = () => ({ status: null });
w.__callables.myRelativeRequests = () => ({ requests: [] });
w.__callables.recordShare = () => ({});
w.__callables.joinOutageWaitlist = () => ({ status: 'joined' });

// ── La carte admin « Accès médecin », seule ─────────────────────────────────
// Présentationnelle : son brouillon et ses callables vivent dans la page admin,
// que ce banc ne monte pas. Cet habillage tient le brouillon, laisse le pilote
// injecter le résultat d'une vérification (`__setPractCheck`) et enregistre les
// actions demandées (`__practActions`) — c'est le VERROU qu'on éprouve.
type CardWindow = typeof window & {
  __setPractCheck?: (c: PractitionerCheck | null) => void;
  __practActions?: string[];
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PractitionerCardHarness(_props: { params: Promise<{ lang: string }> }) {
  const [draft, setDraft] = useState<PractitionerDraft>({
    requester_id: '',
    type: 'medecin',
    label: '',
    allowUnknown: false,
    allowShared: false,
  });
  const [check, setCheck] = useState<PractitionerCheck | null>(null);
  const cw = window as CardWindow;
  cw.__setPractCheck = setCheck;
  cw.__practActions = cw.__practActions || [];
  return (
    <PractitionerCard
      current={null}
      canEdit
      draft={draft}
      onDraft={(p) => setDraft((d) => ({ ...d, ...p }))}
      check={check}
      busy={null}
      error={null}
      notice={null}
      onCheck={() => cw.__practActions!.push('check')}
      onActivate={() => cw.__practActions!.push('activate')}
      onRemove={() => cw.__practActions!.push('remove')}
      fmtDate={(ms) => new Date(ms).toISOString().slice(0, 10)}
    />
  );
}

// ── Les points d'entrée de l'espace médecin ─────────────────────────────────
// L'en-tête (barre desktop ET tiroir mobile : sans feuille de style, les deux
// sont dans le DOM) — `ThemeSwitcher` exige le vrai `ThemeProvider`.
function HeaderHarness() {
  return (
    <ThemeProvider>
      <Header />
    </ThemeProvider>
  );
}

// Le panneau personnel du héros d'accueil, seul : il reçoit `lang`, pas `params`.
function HeroPanelHarness({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  return <HeroPersonalPanel lang={lang} />;
}

// ── Montage ─────────────────────────────────────────────────────────────────
let root: Root | null = null;

// `page: string` explicite : les bancs du parcours et de la PWA déclarent
// globalement `window.__mount` SANS paramètre ; intersecté avec le type d'ici,
// le paramètre perd son type contextuel (TS2538 sur `pages[page]`).
w.__mount = (page: string = 'resultats') => {
  const el = document.getElementById('app')!;
  root = createRoot(el);
  const lang = w.__lang === 'ar' ? 'ar' : 'fr';
  // Une seule promesse, créée hors rendu : `use(params)` exige la MÊME instance
  // d'un rendu à l'autre, sinon la page resterait suspendue indéfiniment.
  const params = Promise.resolve({ lang });
  const pages: Record<string, React.ComponentType<{ params: Promise<{ lang: string }> }>> = {
    resultats: ResultatsPage,
    'mes-patients': MesPatientsPage,
    'practitioner-card': PractitionerCardHarness,
    profile: ProfilePage,
    header: HeaderHarness,
    'home-panel': HeroPanelHarness,
  };
  const Page = pages[page];
  if (!Page) throw new Error(`page inconnue du banc : ${page}`);
  root.render(
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      <Suspense fallback={<p data-testid="suspense">…</p>}>
        <ResultsProvider>
          <Page params={params} />
        </ResultsProvider>
      </Suspense>
    </div>
  );
};

w.__unmount = () => {
  root?.unmount();
  root = null;
};
