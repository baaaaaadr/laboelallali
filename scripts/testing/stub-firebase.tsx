/**
 * Doublure des quatre frontières Firebase.
 *
 * ⚠ Rien n'est écrit nulle part. `addDoc` pousse dans `window.__firestore`, ce
 * qui permet au pilote de vérifier le document EXACT que la page produirait —
 * `buildFirestoreDoc` étant, lui, le vrai code de production.
 */
const w = globalThis as unknown as {
  __firestore: { collection: string; doc: Record<string, unknown> }[];
  __uploads: string[];
};
w.__firestore = w.__firestore || [];
w.__uploads = w.__uploads || [];

// -- @/config/firebase --------------------------------------------------------
export const db = { __stub: true };
export const app = { __stub: true };
export const storage = { __stub: true };
export async function getClientStorage() { return storage; }
export async function getClientFunctions() { return { __stub: true }; }
export async function getClientAuth() { return { __stub: true }; }

// -- firebase/firestore -------------------------------------------------------
export function collection(_db: unknown, name: string) { return { name }; }
export async function addDoc(ref: { name: string }, doc: Record<string, unknown>) {
  w.__firestore.push({ collection: ref.name, doc });
  return { id: `doc-${w.__firestore.length}` };
}
export function serverTimestamp() { return '<serverTimestamp>'; }
export async function getDocs() { return { docs: [], empty: true }; }

// -- firebase/storage ---------------------------------------------------------
export function ref(_s: unknown, path: string) { return { path }; }
export async function uploadBytes(r: { path: string }) {
  w.__uploads.push(r.path);
  return { ref: r };
}
export async function getDownloadURL(r: { path: string }) {
  return `https://storage.test/${encodeURIComponent(r.path)}`;
}

// -- firebase/functions -------------------------------------------------------
export function httpsCallable() {
  return async () => ({ data: { status: 'none' } });
}
