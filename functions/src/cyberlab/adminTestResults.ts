/**
 * `adminTestResults` — staff-only "does this requester_id return results?" probe.
 *
 * Purpose: during patient onboarding, a stagiaire wants to confirm that a CyberLab
 * `requester_id` actually brings back results BEFORE asking the patient to log in on
 * their own phone — avoiding a bad first impression / back-and-forth.
 *
 * Why this is NOT `fetchResults`: the patient bridge reads `requester_id`/`type`
 * EXCLUSIVELY from the caller's own profile (anti-spoof), so it cannot test another
 * patient's id. This callable takes them as client input, and is therefore gated to
 * ≥ staff via `requireLevel` (server-side, re-checked on every call).
 *
 * Two phases (mirrors the patient bridge):
 *  - no `dossier_id` → list only (`include_pdf: "none"`), no PDFs. Confirms the analyses
 *    "remontent" without shipping documents.
 *  - with `dossier_id` → fetch that single dossier's PDF on demand, so staff can
 *    reproduce EXACTLY what the patient sees when tapping "Voir" (incl. the case where
 *    the lab server returns an empty PDF — the actual onboarding failure we hunt).
 *
 * Data minimisation:
 *  - patient names are scrubbed from the response, so testing a `medecin`/`correspondant`
 *    id never ships that practitioner's whole nominative patient roster to the browser;
 *  - nothing is written to Firestore or logged (only the error kind/status).
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {
  callCyberlab,
  CyberlabConfig,
  CyberlabError,
  CyberlabRequest,
  CyberlabResponse,
  RequesterType,
} from "./client";
import { LEVEL, requireLevel, REGION } from "../admin/roles";

// Same secret/param names as fetchResults — defineSecret is idempotent by name, so
// both callables resolve to the same Secret Manager entries.
const CYBERLAB_API_KEY = defineSecret("CYBERLAB_API_KEY");
const CYBERLAB_HMAC_SECRET = defineSecret("CYBERLAB_HMAC_SECRET");
const CYBERLAB_API_URL = defineString("CYBERLAB_API_URL");

const MAX_RESULTS = 50;
const VALID_TYPES: readonly RequesterType[] = [
  "patient",
  "medecin",
  "correspondant",
];

interface TestData {
  requester_id?: string;
  type?: string;
  /** Optional: fetch a single dossier's PDF on demand (same as the patient "Voir"). */
  dossier_id?: string;
}

export const adminTestResults = onCall(
  {
    region: REGION,
    secrets: [CYBERLAB_API_KEY, CYBERLAB_HMAC_SECRET],
  },
  async (request: CallableRequest<TestData>): Promise<CyberlabResponse> => {
    // Medical data must never be cached by any intermediary or the browser.
    try {
      request.rawRequest.res?.setHeader("Cache-Control", "no-store");
    } catch {
      /* best-effort only */
    }

    // Staff and up only; re-checked server-side (never trusts the client UI gate).
    await requireLevel(request, LEVEL.staff);

    const requesterId = (request.data?.requester_id || "").trim();
    const type = (request.data?.type || "").trim();
    const dossierId = (request.data?.dossier_id || "").trim();
    if (!requesterId) {
      throw new HttpsError("invalid-argument", "Identifiant requis.");
    }
    if (!VALID_TYPES.includes(type as RequesterType)) {
      throw new HttpsError("invalid-argument", "Type invalide.");
    }

    const cfg: CyberlabConfig = {
      apiUrl: CYBERLAB_API_URL.value(),
      apiKey: CYBERLAB_API_KEY.value(),
      hmacSecret: CYBERLAB_HMAC_SECRET.value(),
    };
    const req: CyberlabRequest = {
      type: type as RequesterType,
      requester_id: requesterId,
    };
    if (dossierId) {
      // Single-dossier PDF fetch (on-demand "Voir"), no list needed.
      req.dossier_id = dossierId;
    } else {
      req.max_results = MAX_RESULTS;
      req.include_pdf = "none";
    }

    try {
      const resp = await callCyberlab(cfg, req);
      // Scrub names — the preview only needs to confirm the analyses come back, not
      // reveal identities (no-op for type "patient", which already returns empty).
      return {
        ...resp,
        results: resp.results.map((r) => ({
          ...r,
          patient_nom: "",
          patient_prenom: "",
        })),
      };
    } catch (err) {
      if (err instanceof CyberlabError) {
        // Log the kind/status only — never the response body.
        logger.error("adminTestResults: lab API error", {
          kind: err.kind,
          status: err.status ?? null,
        });
        switch (err.kind) {
          case "not_found":
            // Unknown id, or known id under the wrong type → surfaced to staff as
            // "aucun résultat" (a useful onboarding signal, not a hard error).
            throw new HttpsError("not-found", "Aucun résultat pour cet identifiant.");
          case "rate_limited":
            throw new HttpsError(
              "resource-exhausted",
              "Trop de requêtes. Réessayez dans quelques instants."
            );
          case "network":
            throw new HttpsError(
              "unavailable",
              "Service de résultats momentanément indisponible."
            );
          // "unauthorized" (our key/signature) and "server" are our problem, not the
          // staff member's — surface a neutral message.
          default:
            throw new HttpsError(
              "internal",
              "Impossible de tester cet identifiant pour le moment."
            );
        }
      }
      logger.error("adminTestResults: unexpected error");
      throw new HttpsError("internal", "Une erreur inattendue est survenue.");
    }
  }
);
