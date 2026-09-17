// Shared CyberLab results types (mirrors functions/src/cyberlab/client.ts).
// For type "patient", patient_nom / patient_prenom come back empty (data minimisation).

export type RequesterType = 'patient' | 'medecin' | 'correspondant';

/**
 * A lab dossier attached to an account that does NOT own it — the "ayant droit"
 * case: a son consulting the results of his two parents.
 *
 * Stored in `users/{uid}.linkedRequesters`, written ONLY by the staff callables
 * (`adminLinkRequester` / `adminUnlinkRequester`) and locked against client
 * writes in `firestore.rules`. Attaching a parent's dossier to their child's
 * account never touches the parent's own document: two accounts can point at the
 * same `requester_id`, and the holder keeps their access untouched.
 *
 * `label` exists because the lab server deliberately returns no `patient_nom`
 * for `type: "patient"` — there is no other way to know whose dossier this is,
 * so the front desk types it in ("Maman — Fatima").
 */
export interface LinkedRequester {
  requester_id: string;
  type: RequesterType;
  label: string;
  /**
   * Firestore Timestamp. Never read client-side — the admin screen gets
   * milliseconds from the callable instead. Kept here so the shape of the stored
   * document is documented in one place.
   */
  linkedAt?: unknown;
  /** uid of the staff member who attached it. Never their email. */
  linkedBy?: string;
}

export interface CyberlabResult {
  dossier_id: string;
  patient_nom: string;
  patient_prenom: string;
  date_dossier: string;
  etat: string;
  analyses_summary: string;
  pdf_base64: string;
}

export interface CyberlabResponse {
  type: string;
  requester_id: string;
  results: CyberlabResult[];
}

// idle  → nothing attempted yet
// need_access → logged in but no requester_id (offer the online-access request)
// unknown_id → the lab server does not recognize the requester_id (HTTP 404
//   requester_not_found): the account is linked in the app but was never
//   created/published in CyberLab lab-side. DISTINCT from 'empty' (valid id,
//   200 + empty list = genuinely no dossier yet) — merging them showed a
//   "no results" screen to patients whose account simply wasn't activated.
export type ResultsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'unknown_id' | 'error' | 'need_access';

// Which PDFs the server embeds in the list response (perf optimisation).
export type IncludePdf = 'latest' | 'none' | 'all';

// Per-dossier PDF fetch state (PDFs are loaded on demand, one at a time).
// 'unavailable' = the lab server answered OK but returned no PDF for this dossier
// (distinct from 'error' = the fetch itself failed) — lets the UI show a clearer,
// non-alarming message ("le laboratoire n'a pas encore joint le PDF").
export interface PdfState {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
  base64?: string;
}
