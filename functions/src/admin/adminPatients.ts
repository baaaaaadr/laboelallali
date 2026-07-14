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
import * as admin from "firebase-admin";
// Role gate + region live in a side-effect-free leaf module, shared with the
// CyberLab staff callable (adminTestResults) so both use the exact same check.
import { LEVEL, levelOf, requireLevel, REGION } from "./roles";

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
    const requesterId = (request.data?.requester_id || "").trim();
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
      .set({ requester_id: requesterId, type }, { merge: true });
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

/** Patient: create/refresh my access request (pending). Auth only. */
export const requestResultsAccess = onCall(
  { region: REGION },
  async (request: CallableRequest) => {
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
    await ref.set(
      {
        uid,
        fullName: u.fullName,
        email: u.email || request.auth.token?.email || null,
        phone: u.phone,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        fulfilledBy: admin.firestore.FieldValue.delete(),
        fulfilledAt: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );
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
    const requesterId = (request.data?.requester_id || "").trim();
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
      .set({ requester_id: requesterId, type }, { merge: true });
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
