/**
 * `adminViewAs` — the admin « Vue patient » (Dr Aziz, 08/10/2026): the front
 * desk opens the app AS a patient, read-only — his own results, his relatives'
 * tabs, and, for a doctor, his « Mes patients » — to check what he really sees.
 *
 * Exactly `fetchResults`, with three differences:
 *  - the identity comes from the VIEWED account's profile (`uid` in the input),
 *    resolved by the same `resolveIdentity` — a relative or a doctor code the
 *    account does not hold is refused the same way;
 *  - NO usage stamp: viewing as someone must never count as his visit (patient
 *    dashboard, relances, doctor usage);
 *  - every LIST read is traced in `adminViewAsLog` (who, whose account, which
 *    side, when) — server only, default deny. The doctor side (a whole named
 *    roster) needs the ADMIN level, like activating it.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { LEVEL, requireLevel, REGION } from "./roles";
import { callCyberlab, CyberlabError, CyberlabRequest, IncludePdf, normalizeRequesterId } from "../cyberlab/client";
import { hasAnyIdentity, resolveIdentity } from "../cyberlab/identities";
import { withDossierDates } from "../cyberlab/dossierDate";

const CYBERLAB_API_KEY = defineSecret("CYBERLAB_API_KEY");
const CYBERLAB_HMAC_SECRET = defineSecret("CYBERLAB_HMAC_SECRET");
const CYBERLAB_API_URL = defineString("CYBERLAB_API_URL");

export const VIEW_AS_LOG = "adminViewAsLog";
const MAX_RESULTS = 50;

interface ViewAsInput {
  uid?: unknown;
  requester_id?: unknown;
  include_pdf?: unknown;
  dossier_id?: unknown;
}

export const adminViewAs = onCall(
  { region: REGION, secrets: [CYBERLAB_API_KEY, CYBERLAB_HMAC_SECRET] },
  async (request: CallableRequest<ViewAsInput>) => {
    try {
      request.rawRequest.res?.setHeader("Cache-Control", "no-store");
    } catch {
      /* best-effort */
    }
    const { uid: adminUid, level } = await requireLevel(request, LEVEL.staff);
    const d = request.data || {};
    const uid = typeof d.uid === "string" ? d.uid.trim() : "";
    if (!uid) throw new HttpsError("invalid-argument", "Compte requis.");
    const selector = d.requester_id === undefined ? "" : normalizeRequesterId(d.requester_id);
    const dossierId = typeof d.dossier_id === "string" ? d.dossier_id.trim() : "";
    const includePdf: IncludePdf | undefined =
      d.include_pdf === "latest" || d.include_pdf === "none" || d.include_pdf === "all" ? d.include_pdf : undefined;

    const snap = await admin.firestore().doc(`users/${uid}`).get();
    if (!snap.exists) throw new HttpsError("not-found", "Ce compte n'existe pas.");
    const data = snap.data() || {};
    const identity = resolveIdentity(data, selector || undefined);
    if (!identity) {
      if (selector && hasAnyIdentity(data)) {
        throw new HttpsError("permission-denied", "Ce compte n'a pas accès à ce dossier.");
      }
      // Same answer as fetchResults for an account with no access yet.
      throw new HttpsError("failed-precondition", "Ce compte n'a encore aucun dossier activé.");
    }
    if (identity.kind === "practitioner" && level < LEVEL.admin) {
      throw new HttpsError("permission-denied", "La vue « Mes patients » d'un médecin est réservée aux administrateurs.");
    }

    const req: CyberlabRequest = { type: identity.type, requester_id: identity.requester_id };
    if (dossierId) {
      req.dossier_id = dossierId;
    } else {
      req.max_results = MAX_RESULTS;
      const include = identity.kind === "practitioner" ? "none" : includePdf;
      if (include) req.include_pdf = include;
      // Trace the LIST reads only (one per screen opened), never a value.
      try {
        await admin.firestore().collection(VIEW_AS_LOG).add({
          by: adminUid,
          uid,
          kind: identity.kind,
          at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch {
        logger.warn("adminViewAs: trace not written", { uid, by: adminUid });
      }
    }

    try {
      return withDossierDates(
        await callCyberlab(
          { apiUrl: CYBERLAB_API_URL.value(), apiKey: CYBERLAB_API_KEY.value(), hmacSecret: CYBERLAB_HMAC_SECRET.value() },
          req
        )
      );
    } catch (err) {
      if (err instanceof CyberlabError) {
        logger.warn("adminViewAs: lab error", { kind: err.kind, status: err.status ?? null });
        if (err.kind === "not_found") throw new HttpsError("not-found", "Aucun résultat disponible.");
        if (err.kind === "rate_limited") throw new HttpsError("resource-exhausted", "Trop de requêtes. Réessayez dans quelques instants.");
        if (err.kind === "network") throw new HttpsError("unavailable", "Service de résultats momentanément indisponible.");
        throw new HttpsError("internal", "Impossible de récupérer les résultats pour le moment.");
      }
      logger.error("adminViewAs: unexpected error");
      throw new HttpsError("internal", "Une erreur inattendue est survenue.");
    }
  }
);
