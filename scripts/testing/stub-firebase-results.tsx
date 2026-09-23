/**
 * Doublure de Firebase pour les bancs « résultats » et « médecin ».
 *
 * Remplace `@/config/firebase`, `firebase/functions`, `firebase/firestore` et
 * `firebase/analytics`. Rien ne part sur le réseau, rien n'est écrit.
 *
 * Le point central : `httpsCallable(fns, nom)` ENREGISTRE chaque appel dans
 * `window.__calls` (`{ name, args, at }`) puis délègue à
 * `window.__callables[nom]`. Le pilote peut ainsi vérifier non seulement ce que
 * la page affiche, mais aussi ce qu'elle DEMANDE au serveur — combien d'appels,
 * dans quel ordre, avec quels arguments. C'est ce qui détecte une boucle
 * d'appels, ou un PDF chargé sans que personne l'ait demandé.
 *
 * Un gestionnaire lève une erreur `{ code: 'functions/<code>' }` pour simuler
 * une `HttpsError` : c'est exactement la forme que lisent les pages
 * (`err.code.replace('functions/', '')`).
 */

interface RecordedCall {
  name: string;
  args: unknown;
  at: number;
}

type Handler = (args: unknown) => unknown | Promise<unknown>;

interface FirebaseWindow {
  __calls: RecordedCall[];
  __callables: Record<string, Handler>;
  /** Documents lisibles par `getDoc`, indexés par chemin (`systemStatus/cyberlab`). */
  __docs: Record<string, Record<string, unknown>>;
  /** Collections lisibles par `getDocs` (`analyses` → le catalogue). */
  __collections: Record<string, Record<string, unknown>[]>;
  __writes: { path: string; data: unknown }[];
}

const w = globalThis as unknown as FirebaseWindow;
w.__calls = w.__calls || [];
w.__callables = w.__callables || {};
w.__docs = w.__docs || {};
w.__collections = w.__collections || {};
w.__writes = w.__writes || [];

// -- @/config/firebase --------------------------------------------------------
export const db = { __stub: true };
export const app = { __stub: true };
export const storage = { __stub: true };
export async function getClientFunctions() {
  return { __stub: true };
}
export async function getClientAnalytics() {
  return null;
}
export async function getClientStorage() {
  return storage;
}
export async function getClientAuth() {
  return { __stub: true };
}

// -- firebase/functions -------------------------------------------------------
export function httpsCallable(_functions: unknown, name: string) {
  return async (args?: unknown) => {
    // Copie profonde : la page ne doit pas pouvoir modifier après coup ce qui a
    // été enregistré.
    const recorded = args === undefined ? undefined : JSON.parse(JSON.stringify(args));
    w.__calls.push({ name, args: recorded, at: Date.now() });
    const handler = w.__callables[name];
    if (!handler) return { data: {} };
    return { data: await handler(args) };
  };
}

// -- firebase/firestore -------------------------------------------------------
export function doc(_db: unknown, ...segments: string[]) {
  return { path: segments.join('/') };
}
export async function getDoc(ref: { path: string }) {
  const data = w.__docs[ref.path];
  return {
    id: ref.path.split('/').pop(),
    exists: () => data !== undefined,
    data: () => data,
  };
}
export function collection(_db: unknown, name: string) {
  return { name };
}
export async function getDocs(ref: { name: string }) {
  const list = w.__collections[ref.name] || [];
  const docs = list.map((d, i) => ({
    id: typeof d.id === 'string' ? d.id : String(i),
    data: () => d,
  }));
  return { docs, empty: docs.length === 0, forEach: (fn: (d: unknown) => void) => docs.forEach(fn) };
}
export async function setDoc(ref: { path: string }, data: unknown) {
  w.__writes.push({ path: ref.path, data });
}
export function serverTimestamp() {
  return '<serverTimestamp>';
}

// -- firebase/analytics -------------------------------------------------------
export function logEvent() {
  /* rien : l'analytique n'a pas sa place dans un banc d'essai */
}
