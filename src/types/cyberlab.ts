// Shared CyberLab results types (mirrors functions/src/cyberlab/client.ts).
// For type "patient", patient_nom / patient_prenom come back empty (data minimisation).
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
