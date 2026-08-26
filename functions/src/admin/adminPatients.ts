/**
 * Admin space callables — manage patient CyberLab identities AND staff roles.
 *
 * Role hierarchy (single `role` field on users/{uid}); higher does all of lower:
 *   staff (1): encode requester_id/type on a patient.
 *   admin (2): staff + add/remove staff (stagiaires).
 *   owner (3): admin + add/remove admins.
 *
 * Security: every call re-checks the caller's role server-side (never trusts the
 * client). Writes use the Admin SDK, which bypasses Firestore rules — so no broad
 * client write permission on the users collection is needed.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
// Role gate + region live in a side-effect-free leaf module, shared with the
// CyberLab staff callable (adminTestResults) so both use the exact same check.
import { LEVEL, levelOf, requireLevel, REGION } from "./roles";
// Ids are typed by hand at the front desk; strip any whitespace (Qalam shows big
// ids as "67 305") before storing, or the lab server answers requester_not_found.
import { normalizeRequesterId } from "../cyberlab/client";
// Staff alert when a patient asks for results access (best-effort, see
// requestResultsAccess below). Same shared mailer as the CyberLab monitoring.
import {
  SMTP_USER,
  SMTP_PASS,
  APP_URL,
  sendMail,
  renderAlertEmail,
  alertRecipients,
  fmtCasablanca,
} from "../email/mailer";

const VALID_TYPES = ["patient", "medecin", "correspondant"] as const;
type RequesterType = (typeof VALID_TYPES)[number];

async function getUidByEmail(email: string, subject: string): Promise<string> {
  try {
    const rec = await admin.auth().getUserByEmail(email);
    return rec.uid;
  } catch {
    throw new HttpsError(
      "not-found",
      `Aucun compte pour cet email. ${subject} doit se connecter une fois à l'application d'abord.`
    );
  }
}

// ── Encode requester_id / type (staff and up) ────────────────────────────────
interface LookupData {
  email?: string;
}
export const adminLookupPatient = onCall(
  { region: REGION },
  async (request: CallableRequest<LookupData>) => {
    await requireLevel(request, LEVEL.staff);
    const email = (request.data?.email || "").trim();
    if (!email) throw new HttpsError("invalid-argument", "Email requis.");
    let rec;
    try {
      rec = await admin.auth().getUserByEmail(email);
    } catch {
      return { found: false };
    }
    const uid = rec.uid;
    const doc = await admin.firestore().doc(`users/${uid}`).get();
    const d = doc.data() || {};
    return {
      found: true,
      uid,
      email: rec.email || null,
      hasProfile: doc.exists,
      fullName: d.fullName || "",
      phone: d.phone || "",
      requester_id: d.requester_id || "",
      type: d.type || "",
      role: d.role || "",
    };
  }
);

interface SetData {
  email?: string;
  requester_id?: string;
  type?: string;
}
export const adminSetRequester = onCall(
  { region: REGION },
  async (request: CallableRequest<SetData>) => {
    await requireLevel(request, LEVEL.staff);
    const email = (request.data?.email || "").trim();
    const requesterId = normalizeRequesterId(request.data?.requester_id);
    const type = (request.data?.type || "").trim();
    if (!email) throw new HttpsError("invalid-argument", "Email requis.");
    if (!requesterId) {
      throw new HttpsError("invalid-argument", "Identifiant patient requis.");
    }
    if (!VALID_TYPES.includes(type as RequesterType)) {
      throw new HttpsError("invalid-argument", "Type invalide.");
    }
    const uid = await getUidByEmail(email, "Le patient");
    await admin
      .firestore()
      .doc(`users/${uid}`)
      .set(
        {
          requester_id: requesterId,
          type,
          // When the access was activated — lets the dashboard measure the delay
          // between activation and the patient's first real use.
          requesterLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    const doc = await admin.firestore().doc(`users/${uid}`).get();
    const d = doc.data() || {};
    return {
      success: true,
      uid,
      fullName: d.fullName || "",
      requester_id: d.requester_id || "",
      type: d.type || "",
    };
  }
);

// ── Multi-field patient search (staff and up) ────────────────────────────────
// Staff/interns often don't know the patient's exact email. This scans the users
// collection server-side (the Admin SDK bypasses the "own doc only" Firestore
// rule) and matches a free-text query against fullName / email / requester_id /
// phone / dateOfBirth, returning a capped, ranked list. Read-heavy but bounded
// by SCAN_LIMIT — fine for this lab's size; see the scale caveat in
// docs/pages/admin.md. Like the rest of this file, it never logs PII.
interface SearchData {
  query?: string;
}
const SCAN_LIMIT = 5000; // max user docs scanned per search (cost guard)
const MAX_RESULTS = 25; // max matches returned to the client

/** lowercase + strip diacritics, so "Zoé"/"zoe" and "Béchir"/"bechir" match. */
const stripAccents = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface PatientMatch {
  uid: string;
  email: string | null;
  hasProfile: boolean;
  fullName: string;
  phone: string;
  requester_id: string;
  type: string;
  role: string;
  createdAt: string;
  dateOfBirth: string;
  exact: boolean; // exact email or requester_id hit — ranked first
}

export const adminSearchPatients = onCall(
  { region: REGION },
  async (request: CallableRequest<SearchData>) => {
    await requireLevel(request, LEVEL.staff);
    const q = (request.data?.query || "").trim();
    if (q.length < 2) return { results: [], truncated: false };

    const nq = stripAccents(q);
    const digits = q.replace(/\D/g, "");

    const snap = await admin
      .firestore()
      .collection("users")
      .limit(SCAN_LIMIT)
      .get();

    const matches: PatientMatch[] = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const fullName = String(d.fullName || "");
      const email = d.email == null ? "" : String(d.email);
      const rid = String(d.requester_id || "");
      const phone = String(d.phone || "").replace(/\D/g, "");
      const dob = String(d.dateOfBirth || "");

      const emailExact = email !== "" && stripAccents(email) === nq;
      const ridExact = rid !== "" && rid === q;
      const hit =
        stripAccents(fullName).includes(nq) ||
        (email !== "" && stripAccents(email).includes(nq)) ||
        ridExact ||
        (digits.length >= 1 && rid !== "" && rid.includes(digits)) ||
        (digits.length >= 4 && phone !== "" && phone.includes(digits)) ||
        (dob !== "" && dob.includes(q));
      if (!hit) return;

      matches.push({
        uid: doc.id,
        email: d.email ?? null,
        hasProfile: true,
        fullName,
        phone: String(d.phone || ""),
        requester_id: rid,
        type: String(d.type || ""),
        role: String(d.role || ""),
        createdAt: String(d.createdAt || ""),
        dateOfBirth: dob,
        exact: emailExact || ridExact,
      });
    });

    // Exact matches first, then alphabetical by name.
    matches.sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) || a.fullName.localeCompare(b.fullName)
    );
    const truncated = matches.length > MAX_RESULTS;
    const results = matches.slice(0, MAX_RESULTS);

    // Fallback: an exact-email account that has authenticated but has no Firestore
    // profile yet (so it wasn't in the scan). Mirrors the old adminLookupPatient
    // path so staff can still attach a requester_id to a freshly-created account.
    if (
      q.includes("@") &&
      !results.some((m) => (m.email || "").toLowerCase() === q.toLowerCase())
    ) {
      try {
        const rec = await admin.auth().getUserByEmail(q);
        const profile = await admin.firestore().doc(`users/${rec.uid}`).get();
        const d = profile.data() || {};
        results.unshift({
          uid: rec.uid,
          email: rec.email ?? null,
          hasProfile: profile.exists,
          fullName: String(d.fullName || ""),
          phone: String(d.phone || ""),
          requester_id: String(d.requester_id || ""),
          type: String(d.type || ""),
          role: String(d.role || ""),
          createdAt: String(d.createdAt || ""),
          dateOfBirth: String(d.dateOfBirth || ""),
          exact: true,
        });
      } catch {
        // No Auth user for this email — nothing to add.
      }
    }

    return { results, truncated };
  }
);

// ── Team / role management ───────────────────────────────────────────────────
interface RoleData {
  email?: string;
  grant?: boolean;
}

/** Grant/revoke STAFF (stagiaire). Requires admin (>=2). Cannot touch admin/owner. */
export const adminSetStaff = onCall(
  { region: REGION },
  async (request: CallableRequest<RoleData>) => {
    await requireLevel(request, LEVEL.admin);
    const email = (request.data?.email || "").trim();
    const grant = request.data?.grant !== false;
    if (!email) throw new HttpsError("invalid-argument", "Email requis.");
    const uid = await getUidByEmail(email, "La personne");
    const ref = admin.firestore().doc(`users/${uid}`);
    const cur = (await ref.get()).data()?.role;
    if (cur === "owner" || cur === "admin") {
      throw new HttpsError(
        "failed-precondition",
        "Cette personne est admin ou propriétaire ; seul un propriétaire peut changer son rôle."
      );
    }
    await ref.set({ role: grant ? "staff" : null }, { merge: true });
    return { success: true, uid, email: email, role: grant ? "staff" : "" };
  }
);

/** Grant/revoke ADMIN. Requires owner (>=3). Cannot touch another owner. */
export const adminSetAdmin = onCall(
  { region: REGION },
  async (request: CallableRequest<RoleData>) => {
    await requireLevel(request, LEVEL.owner);
    const email = (request.data?.email || "").trim();
    const grant = request.data?.grant !== false;
    if (!email) throw new HttpsError("invalid-argument", "Email requis.");
    const uid = await getUidByEmail(email, "La personne");
    const ref = admin.firestore().doc(`users/${uid}`);
    const cur = (await ref.get()).data()?.role;
    if (cur === "owner") {
      throw new HttpsError("failed-precondition", "Impossible de modifier un propriétaire.");
    }
    await ref.set({ role: grant ? "admin" : null }, { merge: true });
    return { success: true, uid, email: email, role: grant ? "admin" : "" };
  }
);

/** List all team members (staff/admin/owner). Requires admin (>=2). */
export const adminListStaff = onCall(
  { region: REGION },
  async (request: CallableRequest) => {
    const { level } = await requireLevel(request, LEVEL.admin);
    const snap = await admin
      .firestore()
      .collection("users")
      .where("role", "in", ["owner", "admin", "staff"])
      .limit(200)
      .get();
    const members = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        uid: doc.id,
        email: d.email || "",
        fullName: d.fullName || "",
        role: d.role || "",
      };
    });
    // Sort: owner, admin, staff, then by name.
    members.sort(
      (a, b) => levelOf(b.role) - levelOf(a.role) || a.fullName.localeCompare(b.fullName)
    );
    return { members, callerLevel: level };
  }
);

// ── Patient results-access requests ──────────────────────────────────────────
// A patient asks the lab to activate online results access; staff fulfills it
// (attaches requester_id) after verifying identity, typically face-to-face.
// Requests live in resultAccessRequests/{uid} (one per patient), only touched
// via these callables (Admin SDK) — clients never read/write them directly.

// Where the request came from — shown in the staff alert so whoever calls the
// patient back knows whether they asked explicitly or were enrolled at signup.
// Client input, so it is matched against this whitelist and never interpolated raw.
const REQUEST_SOURCES: Record<string, string> = {
  signup: "Inscription (demande envoyée automatiquement)",
  results_page: "Bouton « demander l'accès » sur la page Résultats",
  admin: "Espace admin",
};

/** Patient: create/refresh my access request (pending). Auth only. */
export const requestResultsAccess = onCall(
  // SMTP secrets are bound here for the staff alert below. Region MUST stay
  // REGION (europe-southwest1): the client calls getFunctions(app, region), so
  // changing it would create a second function and break every existing client.
  { region: REGION, secrets: [SMTP_USER, SMTP_PASS] },
  async (request: CallableRequest<{ source?: string }>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const uid = request.auth.uid;
    const u = (await admin.firestore().doc(`users/${uid}`).get()).data() || {};
    if (!u.fullName || !u.phone) {
      throw new HttpsError(
        "failed-precondition",
        "Complétez d'abord votre profil (nom et téléphone)."
      );
    }
    if (u.requester_id) return { status: "already_granted" };

    const ref = admin.firestore().doc(`resultAccessRequests/${uid}`);
    if ((await ref.get()).data()?.status === "pending") return { status: "pending" };
    const email = u.email || request.auth.token?.email || null;
    await ref.set(
      {
        uid,
        fullName: u.fullName,
        email,
        phone: u.phone,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        fulfilledBy: admin.firestore.FieldValue.delete(),
        fulfilledAt: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );

    // ── Staff alert (best-effort, never blocks the patient) ──────────────────
    // Placed AFTER the write and reached only once per genuinely new request:
    // the two early returns above (already_granted / pending) ARE the anti-spam
    // guard — a re-click or a re-login sends nothing. Do not change them without
    // realising you are also changing this.
    // Everything is wrapped: a dead SMTP, a missing param, anything — the patient
    // must still get their "pending" answer. The 10s race stops a slow SMTP from
    // holding the callable open (the client already gives up after 2.5s anyway).
    try {
      // renderAlertEmail escapes every value itself — pass raw strings here, or
      // the staff reads "L&#39;Allali" in their inbox.
      const html = renderAlertEmail({
        title: "Nouvelle demande d'accès aux résultats",
        lead: "Un patient attend l'activation de son accès aux résultats en ligne.",
        rows: [
          ["Nom", String(u.fullName)],
          ["Téléphone", String(u.phone)],
          ["E-mail", email ? String(email) : "—"],
          ["Origine", REQUEST_SOURCES[String(request.data?.source || "")] || "Non précisée"],
          ["Demandé le", fmtCasablanca(Date.now())],
          ["Identifiant du compte", uid],
          // Bare URL, not an <a>: the footer/rows are escaped, so markup would
          // show literally. Gmail and Outlook auto-link a plain URL.
          ["Espace admin", `${APP_URL.value()}/fr/admin`],
        ],
        todo:
          "À faire : vérifier l'identité du patient, puis renseigner son identifiant " +
          "de dossier dans l'espace admin, onglet « Demandes d'accès ».",
      });
      await Promise.race([
        sendMail({
          to: alertRecipients(),
          subject: `Nouvelle demande d'accès aux résultats — ${u.fullName}`,
          html,
          replyTo: email ? String(email) : undefined,
          fromName: "Labo El Allali — Demandes d'accès",
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
      ]);
    } catch {
      // uid only: never log a patient's email or phone number.
      logger.error("requestResultsAccess: staff alert email failed", { uid });
    }

    return { status: "pending" };
  }
);

/** Patient: my current access-request status. Auth only. */
export const myAccessRequest = onCall(
  { region: REGION },
  async (request: CallableRequest) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const snap = await admin
      .firestore()
      .doc(`resultAccessRequests/${request.auth.uid}`)
      .get();
    return { status: snap.data()?.status || null };
  }
);

/** Staff: list pending access requests (oldest first). */
export const adminListAccessRequests = onCall(
  { region: REGION },
  async (request: CallableRequest) => {
    await requireLevel(request, LEVEL.staff);
    const snap = await admin
      .firestore()
      .collection("resultAccessRequests")
      .where("status", "==", "pending")
      .limit(200)
      .get();
    const requests = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        uid: doc.id,
        fullName: d.fullName || "",
        email: d.email || "",
        phone: d.phone || "",
        createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : null,
      };
    });
    requests.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return { requests };
  }
);

/** Staff: fulfill a request — attach requester_id/type + mark fulfilled. */
export const adminFulfillAccessRequest = onCall(
  { region: REGION },
  async (
    request: CallableRequest<{ uid?: string; requester_id?: string; type?: string }>
  ) => {
    const { uid: adminUid } = await requireLevel(request, LEVEL.staff);
    const targetUid = (request.data?.uid || "").trim();
    const requesterId = normalizeRequesterId(request.data?.requester_id);
    const type = (request.data?.type || "").trim();
    if (!targetUid) throw new HttpsError("invalid-argument", "Patient requis.");
    if (!requesterId) {
      throw new HttpsError("invalid-argument", "Identifiant patient requis.");
    }
    if (!VALID_TYPES.includes(type as RequesterType)) {
      throw new HttpsError("invalid-argument", "Type invalide.");
    }
    await admin
      .firestore()
      .doc(`users/${targetUid}`)
      .set(
        {
          requester_id: requesterId,
          type,
          // Activation date — see adminSetRequester.
          requesterLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    await admin
      .firestore()
      .doc(`resultAccessRequests/${targetUid}`)
      .set(
        {
          status: "fulfilled",
          requester_id: requesterId,
          type,
          fulfilledBy: adminUid,
          fulfilledByEmail: request.auth?.token?.email || null,
          fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return { success: true };
  }
);

/** Staff: reject a pending request. */
export const adminRejectAccessRequest = onCall(
  { region: REGION },
  async (request: CallableRequest<{ uid?: string }>) => {
    const { uid: adminUid } = await requireLevel(request, LEVEL.staff);
    const targetUid = (request.data?.uid || "").trim();
    if (!targetUid) throw new HttpsError("invalid-argument", "Patient requis.");
    await admin
      .firestore()
      .doc(`resultAccessRequests/${targetUid}`)
      .set(
        {
          status: "rejected",
          fulfilledBy: adminUid,
          fulfilledByEmail: request.auth?.token?.email || null,
          fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return { success: true };
  }
);

// ── Dashboard ────────────────────────────────────────────────────────────────
// One call powering the "Tableau de bord" tab: adoption of the online-results
// service. Same bounded scan as adminSearchPatients (Admin SDK, SCAN_LIMIT).
// Team members (any `role`) are excluded from the patient counts.
//
// The usage half reads `lastResultsAt`, stamped by fetchResults when the patient's
// results are loaded (see functions/src/cyberlab/fetchResults.ts). It is a DATE
// only — this dashboard never sees a result. Accounts stamped before the feature
// shipped simply have no value yet, so they read as "never consulted" until their
// owner next opens the app; the UI shows a "suivi depuis" caption for that.

/** Considered active when the account was used within this window. */
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_LIST = 10; // rows in the "latest ..." tables
const DORMANT_LIST = 40; // rows in the relance list
const REQUEST_SCAN = 1000; // access requests scanned for delays/statuses
const GROWTH_MONTHS = 6; // months on the growth curve
const ACTIVITY_WEEKS = 10; // weeks on the activity chart
const RELANCE_WINDOW_MS = 60 * DAY_MS; // relances counted as "recent"

interface AccountRow {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string; // ISO string as written at signup ("" when missing)
  dateOfBirth: string;
  signupRef: string;
  hasAccess: boolean;
  lastResultsMs: number | null;
  firstResultsMs: number | null;
  linkedMs: number | null;
  lastRelanceMs: number | null;
  viewCount: number;
}

/** Firestore Timestamp | anything → millis, or null. */
function toMillis(v: unknown): number | null {
  const ts = v as admin.firestore.Timestamp | undefined;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
}

/** "2026-07" for a Date. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** "2026-07-21" for a Date (UTC, same convention as the usageDaily doc ids). */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
/** Age in whole years from a YYYY-MM-DD string, or null when unusable. */
function ageFrom(dob: string): number | null {
  if (!dob) return null;
  const t = Date.parse(dob);
  if (Number.isNaN(t)) return null;
  const years = (Date.now() - t) / (365.25 * DAY_MS);
  return years > 0 && years < 130 ? Math.floor(years) : null;
}
/** Average of a number list, rounded to one decimal (0 when empty). */
function avg1(xs: number[]): number {
  if (!xs.length) return 0;
  return Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10;
}

interface DashboardData {
  /**
   * Count team members (staff/admin/owner) as patients too. Off by default so the
   * adoption rate isn't inflated by the lab's own accounts — but anyone opening
   * this dashboard necessarily HAS a role, so without this they can never see
   * themselves while testing. Display-only: it changes no stored data.
   */
  includeTeam?: boolean;
}

/**
 * Read every user doc once and turn it into the rows the dashboard works on.
 * Shared by `adminDashboardStats` and `adminListDormant` so both see the same
 * definition of "a patient account". Returns the raw uid→name map too (team
 * members included) because the team-activity chart needs to name staff.
 */
async function scanAccounts(includeTeam: boolean): Promise<{
  accounts: AccountRow[];
  byType: Record<string, number>;
  teamAccounts: number;
  nameByUid: Record<string, string>;
  truncated: boolean;
}> {
  const snap = await admin.firestore().collection("users").limit(SCAN_LIMIT).get();

  const accounts: AccountRow[] = [];
  const byType: Record<string, number> = { patient: 0, medecin: 0, correspondant: 0 };
  const nameByUid: Record<string, string> = {};
  let teamAccounts = 0;

  snap.forEach((doc) => {
    const d = doc.data() || {};
    nameByUid[doc.id] = String(d.fullName || d.email || "");

    // Staff/admin/owner are team members, not patients — keep them out of the
    // adoption numbers so the denominator stays meaningful (unless asked).
    if (String(d.role || "")) {
      teamAccounts += 1;
      if (!includeTeam) return;
    }

    const hasAccess = String(d.requester_id || "").trim() !== "";
    const type = String(d.type || "");
    if (hasAccess && type in byType) byType[type] += 1;

    accounts.push({
      uid: doc.id,
      fullName: String(d.fullName || ""),
      email: d.email == null ? "" : String(d.email),
      phone: String(d.phone || ""),
      createdAt: String(d.createdAt || ""),
      dateOfBirth: String(d.dateOfBirth || ""),
      signupRef: String(d.signupRef || ""),
      hasAccess,
      lastResultsMs: toMillis(d.lastResultsAt),
      firstResultsMs: toMillis(d.firstResultsAt),
      linkedMs: toMillis(d.requesterLinkedAt),
      lastRelanceMs: toMillis(d.lastRelanceAt),
      viewCount: Number(d.resultsViewCount || 0),
    });
  });

  return { accounts, byType, teamAccounts, nameByUid, truncated: snap.size >= SCAN_LIMIT };
}

/**
 * ALL the dormant accounts, worst first — shared by the Relances tab.
 * Deliberately not truncated here: the dashboard publishes this length as a
 * factual count ("N dormants"), so capping it at display size would silently
 * understate the backlog past that threshold, and contradict the "Santé de la
 * base" chart which counts the same population without a cap. Callers that
 * render a list slice it themselves.
 */
function dormantOf(accounts: AccountRow[], now: number): AccountRow[] {
  return accounts
    .filter(
      (a) =>
        a.hasAccess &&
        (a.lastResultsMs === null || now - a.lastResultsMs >= ACTIVE_WINDOW_MS)
    )
    .sort((a, b) => (a.lastResultsMs || 0) - (b.lastResultsMs || 0));
}

/**
 * Staff: the accounts to relance. Lives in its own callable (and its own tab)
 * because the dashboard is admin-only, while relancing patients is exactly the
 * front-desk's job — the people who must NOT see the adoption figures.
 */
export const adminListDormant = onCall(
  { region: REGION },
  async (request: CallableRequest) => {
    await requireLevel(request, LEVEL.staff);
    const { accounts } = await scanAccounts(false);
    const now = Date.now();
    return {
      dormantList: dormantOf(accounts, now)
        .slice(0, DORMANT_LIST)
        .map((a) => ({
          uid: a.uid,
          fullName: a.fullName,
          email: a.email,
          phone: a.phone,
          createdAt: a.createdAt,
          lastResultsAt: a.lastResultsMs, // null → jamais consulté
          lastRelanceAt: a.lastRelanceMs,
        })),
    };
  }
);

/** Staff: remember that this patient was contacted (powers "relancé il y a X j"). */
export const adminRecordRelance = onCall(
  { region: REGION },
  async (request: CallableRequest<{ uid?: string }>) => {
    await requireLevel(request, LEVEL.staff);
    const targetUid = (request.data?.uid || "").trim();
    if (!targetUid) throw new HttpsError("invalid-argument", "Patient requis.");
    await admin
      .firestore()
      .doc(`users/${targetUid}`)
      .set(
        {
          lastRelanceAt: admin.firestore.FieldValue.serverTimestamp(),
          relanceCount: admin.firestore.FieldValue.increment(1),
        },
        { merge: true }
      );
    return { success: true };
  }
);

/**
 * Any signed-in patient: count one "share" of the referral card. Anonymous — it
 * only bumps a global daily counter, nothing is written on the patient.
 */
export const recordShare = onCall(
  { region: REGION },
  async (request: CallableRequest) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    await admin
      .firestore()
      .doc(`usageDaily/${dayKey(new Date())}`)
      .set(
        { shares: admin.firestore.FieldValue.increment(1) },
        { merge: true }
      );
    return { success: true };
  }
);

export const adminDashboardStats = onCall(
  { region: REGION },
  async (request: CallableRequest<DashboardData>) => {
    // Admin and owner only: these are steering figures for the lab's management,
    // not a front-desk tool (the relance list lives in its own staff-level tab).
    await requireLevel(request, LEVEL.admin);
    const includeTeam = request.data?.includeTeam === true;

    try {
      return await buildDashboard(includeTeam);
    } catch (err) {
      // This aggregates a dozen computations over three collections; without an
      // explicit log a failure surfaces as an opaque 500 with nothing to debug.
      // Aggregates only — no patient data is ever put in a log line.
      logger.error("adminDashboardStats failed", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw new HttpsError(
        "internal",
        "Impossible de calculer le tableau de bord pour le moment."
      );
    }
  }
);

/** The whole computation, extracted so the callable can log what breaks. */
async function buildDashboard(includeTeam: boolean) {
  {
    const { accounts, byType, teamAccounts, nameByUid, truncated } =
      await scanAccounts(includeTeam);

    const now = Date.now();
    const withAccess = accounts.filter((a) => a.hasAccess);
    const consulted = withAccess.filter((a) => a.lastResultsMs !== null);
    const active = withAccess.filter(
      (a) => a.lastResultsMs !== null && now - a.lastResultsMs < ACTIVE_WINDOW_MS
    );
    const dormant = dormantOf(accounts, now);

    // ── A1 growth + B4 month-over-month ──────────────────────────────────────
    const months: { key: string; created: number; cumulative: number }[] = [];
    for (let i = GROWTH_MONTHS - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      const key = monthKey(d);
      months.push({
        key,
        created: accounts.filter((a) => a.createdAt.slice(0, 7) === key).length,
        // createdAt is an ISO string → a lexicographic compare is chronological.
        cumulative: accounts.filter(
          (a) => a.createdAt && a.createdAt.slice(0, 7) <= key
        ).length,
      });
    }
    const thisMonth = months[months.length - 1]?.created ?? 0;
    const prevMonth = months[months.length - 2]?.created ?? 0;

    // ── A3 freshness buckets (among activated accounts) ──────────────────────
    const freshness = { d7: 0, d30: 0, d90: 0, older: 0, never: 0 };
    for (const a of withAccess) {
      if (a.lastResultsMs === null) freshness.never += 1;
      else {
        const days = (now - a.lastResultsMs) / DAY_MS;
        if (days < 7) freshness.d7 += 1;
        else if (days < 30) freshness.d30 += 1;
        else if (days < 90) freshness.d90 += 1;
        else freshness.older += 1;
      }
    }

    // ── A5 usage by age bracket ──────────────────────────────────────────────
    const AGE_BUCKETS: { key: string; min: number; max: number }[] = [
      { key: "18-30", min: 0, max: 30 },
      { key: "31-45", min: 31, max: 45 },
      { key: "46-60", min: 46, max: 60 },
      { key: "61-75", min: 61, max: 75 },
      { key: "76+", min: 76, max: 200 },
    ];
    const ages = AGE_BUCKETS.map((b) => {
      const inBucket = withAccess.filter((a) => {
        const age = ageFrom(a.dateOfBirth);
        return age !== null && age >= b.min && age <= b.max;
      });
      const act = inBucket.filter(
        (a) => a.lastResultsMs !== null && now - a.lastResultsMs < ACTIVE_WINDOW_MS
      ).length;
      return {
        key: b.key,
        total: inBucket.length,
        active: act,
        rate: inBucket.length ? Math.round((act / inBucket.length) * 100) : 0,
      };
    });

    // ── C3 how often each account is used ────────────────────────────────────
    const frequency = { once: 0, f2_5: 0, f6_15: 0, f16: 0 };
    for (const a of consulted) {
      const n = a.viewCount || 1;
      if (n <= 1) frequency.once += 1;
      else if (n <= 5) frequency.f2_5 += 1;
      else if (n <= 15) frequency.f6_15 += 1;
      else frequency.f16 += 1;
    }

    // ── C4 delay between activation and first real use ───────────────────────
    const firstDelays = accounts
      .filter((a) => a.linkedMs !== null && a.firstResultsMs !== null)
      .map((a) => (a.firstResultsMs as number) - (a.linkedMs as number))
      .filter((ms) => ms >= 0)
      .map((ms) => ms / DAY_MS);
    const firstView = {
      avgDays: avg1(firstDelays),
      overWeekPct: firstDelays.length
        ? Math.round(
          (firstDelays.filter((d) => d > 7).length / firstDelays.length) * 100
        )
        : 0,
      sample: firstDelays.length,
    };

    // ── C2 relance effectiveness ─────────────────────────────────────────────
    const relanced = accounts.filter(
      (a) => a.lastRelanceMs !== null && now - a.lastRelanceMs < RELANCE_WINDOW_MS
    );
    const returned = relanced.filter(
      (a) => a.lastResultsMs !== null && a.lastResultsMs > (a.lastRelanceMs as number)
    );
    const relance = {
      relanced: relanced.length,
      returned: returned.length,
      rate: relanced.length
        ? Math.round((returned.length / relanced.length) * 100)
        : 0,
      windowDays: 60,
    };

    // ── A4 activation delay + B1/B2 request statuses + B3 team activity ──────
    const reqSnap = await admin
      .firestore()
      .collection("resultAccessRequests")
      .limit(REQUEST_SCAN)
      .get();

    // A request document is keyed by the requester's own uid, so `accounts` —
    // already filtered by `includeTeam` — is exactly the scope to honour here.
    // Without this, the team's own test requests would inflate "Devenir des
    // demandes" and drag the activation delay down, while the on-screen note
    // claims team accounts are excluded. The alert banner would also name a
    // colleague who appears nowhere else on the screen.
    const scopeUids = new Set(accounts.map((a) => a.uid));

    const requests = { fulfilled: 0, rejected: 0, pending: 0 };
    let oldestPendingMs: number | null = null;
    let oldestPendingName = "";
    const delaysAll: { at: number; days: number }[] = [];
    const teamCount: Record<string, number> = {};
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    reqSnap.forEach((doc) => {
      if (!scopeUids.has(doc.id)) return;
      const d = doc.data() || {};
      const status = String(d.status || "");
      const createdMs = toMillis(d.createdAt);
      const doneMs = toMillis(d.fulfilledAt);

      if (status === "pending") {
        requests.pending += 1;
        if (createdMs !== null && (oldestPendingMs === null || createdMs < oldestPendingMs)) {
          oldestPendingMs = createdMs;
          oldestPendingName = String(d.fullName || d.email || "");
        }
      } else if (status === "rejected") {
        requests.rejected += 1;
      } else if (status === "fulfilled") {
        requests.fulfilled += 1;
        if (createdMs !== null && doneMs !== null && doneMs >= createdMs) {
          delaysAll.push({ at: doneMs, days: (doneMs - createdMs) / DAY_MS });
        }
        if (doneMs !== null && doneMs >= startOfMonth.getTime()) {
          const by = String(d.fulfilledBy || "");
          if (by) teamCount[by] = (teamCount[by] || 0) + 1;
        }
      }
    });

    // Average over the last 30 days, plus a 6-week trend so progress is visible.
    const activationWeeks: { label: string; avgDays: number; n: number }[] = [];
    for (let w = 5; w >= 0; w--) {
      const end = now - w * 7 * DAY_MS;
      const start = end - 7 * DAY_MS;
      const inWeek = delaysAll.filter((x) => x.at > start && x.at <= end);
      activationWeeks.push({
        label: dayKey(new Date(start + DAY_MS)).slice(5),
        avgDays: avg1(inWeek.map((x) => x.days)),
        n: inWeek.length,
      });
    }
    const recentDelays = delaysAll
      .filter((x) => now - x.at < ACTIVE_WINDOW_MS)
      .map((x) => x.days);
    const activation = {
      avgDays: avg1(recentDelays.length ? recentDelays : delaysAll.map((x) => x.days)),
      sample: recentDelays.length || delaysAll.length,
      weeks: activationWeeks,
    };

    const team = Object.entries(teamCount)
      .map(([uid, count]) => ({ uid, name: nameByUid[uid] || "—", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ── C1 weekly activity + C5 shares (anonymous daily counters) ────────────
    // Read the exact day documents by id rather than ordering the collection.
    // `orderBy(documentId(), "desc")` needs a dedicated descending __name__ index
    // (Firestore only auto-creates ascending ones) and fails at RUNTIME with
    // FAILED_PRECONDITION — invisible at build time. These keys are perfectly
    // predictable, so getAll() is simpler, index-free and cheaper. Missing days
    // simply come back as non-existent and count as zero.
    const consultByDay: Record<string, number> = {};
    const sharesByDay: Record<string, number> = {};
    try {
      const dayRefs = Array.from({ length: ACTIVITY_WEEKS * 7 + 7 }, (_, i) =>
        admin.firestore().doc(`usageDaily/${dayKey(new Date(now - i * DAY_MS))}`)
      );
      const dayDocs = await admin.firestore().getAll(...dayRefs);
      dayDocs.forEach((doc) => {
        const d = doc.data() || {};
        consultByDay[doc.id] = Number(d.consultations || 0);
        sharesByDay[doc.id] = Number(d.shares || 0);
      });
    } catch (err) {
      // A single missing metric must never blank the whole dashboard — that is
      // exactly how this section took the entire screen down once already.
      logger.warn("adminDashboardStats: usageDaily unavailable", {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const weekly: { label: string; consultations: number }[] = [];
    for (let w = ACTIVITY_WEEKS - 1; w >= 0; w--) {
      let sum = 0;
      let label = "";
      for (let day = 6; day >= 0; day--) {
        const d = new Date(now - (w * 7 + day) * DAY_MS);
        const key = dayKey(d);
        if (day === 6) label = key.slice(5); // MM-DD of the week start
        sum += consultByDay[key] || 0;
      }
      weekly.push({ label, consultations: sum });
    }

    const monthPrefix = monthKey(new Date());
    const sharesThisMonth = Object.entries(sharesByDay)
      .filter(([k]) => k.slice(0, 7) === monthPrefix)
      .reduce((s, [, v]) => s + v, 0);
    const signupsFromShare = accounts.filter(
      (a) => a.signupRef === "partage" && a.createdAt.slice(0, 7) === monthPrefix
    ).length;

    // ── Detail lists (dashboard-side; the relance list has its own callable) ──
    const latestCreated = [...accounts]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, RECENT_LIST)
      .map((a) => ({
        uid: a.uid,
        fullName: a.fullName,
        email: a.email,
        createdAt: a.createdAt,
        hasAccess: a.hasAccess,
      }));

    const latestActive = [...active]
      .sort((a, b) => (b.lastResultsMs || 0) - (a.lastResultsMs || 0))
      .slice(0, RECENT_LIST)
      .map((a) => ({
        uid: a.uid,
        fullName: a.fullName,
        email: a.email,
        lastResultsAt: a.lastResultsMs,
      }));

    return {
      totals: {
        accounts: accounts.length,
        withAccess: withAccess.length,
        withoutAccess: accounts.length - withAccess.length,
        pendingRequests: requests.pending,
        byType,
      },
      usage: {
        active: active.length,
        dormant: dormant.length,
        // Share of ACTIVATED accounts actually used (0 when none activated yet).
        rate: withAccess.length
          ? Math.round((active.length / withAccess.length) * 100)
          : 0,
        windowDays: 30,
      },
      growth: { months },
      monthDelta: {
        current: thisMonth,
        previous: prevMonth,
        pct: prevMonth ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : 0,
      },
      funnel: {
        created: accounts.length,
        activated: withAccess.length,
        consulted: consulted.length,
      },
      freshness,
      ages,
      frequency,
      firstView,
      relance,
      activation,
      requests: {
        ...requests,
        oldestPendingDays:
          oldestPendingMs === null
            ? null
            : Math.floor((now - oldestPendingMs) / DAY_MS),
        oldestPendingName,
      },
      team,
      weekly,
      shares: { month: sharesThisMonth, signups: signupsFromShare },
      latestCreated,
      latestActive,
      truncated,
      // How many team accounts exist, and whether they are part of the numbers
      // above — the UI states this so admins don't wonder why they can't see
      // themselves after testing with their own account.
      teamAccounts,
      includeTeam,
    };
  }
}
