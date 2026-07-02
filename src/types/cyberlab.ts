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
export type ResultsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'need_access';
