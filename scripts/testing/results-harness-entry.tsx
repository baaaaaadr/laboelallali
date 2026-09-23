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
import React, { Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { ResultsProvider } from '../../src/contexts/ResultsContext';
import ResultatsPage from '../../src/app/[lang]/resultats/page';

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

// ── Montage ─────────────────────────────────────────────────────────────────
let root: Root | null = null;

w.__mount = (page = 'resultats') => {
  const el = document.getElementById('app')!;
  root = createRoot(el);
  const lang = w.__lang === 'ar' ? 'ar' : 'fr';
  // Une seule promesse, créée hors rendu : `use(params)` exige la MÊME instance
  // d'un rendu à l'autre, sinon la page resterait suspendue indéfiniment.
  const params = Promise.resolve({ lang });
  const pages: Record<string, React.ComponentType<{ params: Promise<{ lang: string }> }>> = {
    resultats: ResultatsPage,
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
