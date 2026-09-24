/**
 * The doctors who HOLD an access — the admin « Médecins » tab and the
 * dashboard's « Les médecins » section (owner's request, 24/09/2026: « un
 * onglet médecins… on voit les médecins déjà accordés, sans devoir les
 * chercher manuellement »).
 *
 * One row per account holding a valid `practitioner` access (the same test as
 * `fetchResults`, so the list never shows an access the server would not
 * honour), with what the lab needs to manage it: the account, the code, who
 * activated it and when, the confidentiality engagement, whether the code is
 * shared with other accounts, and the usage (`practitionerUsage`).
 *
 * Staff level: the list names doctors and their contact details — nothing the
 * Patients tab search does not already show a stagiaire. Acting on an access
 * (activate, edit, withdraw) stays `adminSetPractitioner`, admin level.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { LEVEL, requireLevel, REGION } from "./roles";
import { practitionerIdentity } from "../cyberlab/identities";
import { engagementOf } from "./practitionerEngagement";
import { PRACTITIONER_USAGE, UsageSummary, usageSummary } from "./practitionerUsage";

/** Far above any lab's doctors; a guard, not a page size. */
const MAX_PRACTITIONERS = 300;

export interface PractitionerRow {
  uid: string;
  fullName: string;
  email: string | null;
  phone: string;
  /** Canonical Qalam code. */
  requester_id: string;
  type: string;
  label: string;
  linkedAt: number | null;
  /** Who activated it (name or e-mail), "" when unknown. */
  linkedByName: string;
  /** A team account (any role): the lab's own tests, or a doctor on the staff. */
  team: boolean;
  /** Other accounts holding the same code (a secretary, a second account). */
  sharedWith: number;
  engaged: boolean;
  engagementAt: number | null;
  /**
   * Last visit: the usage document, or the older `practitioner.lastUsedAt`
   * stamp for visits made before that document existed.
   */
  lastVisitAt: number | null;
  usage: UsageSummary;
}

const toMs = (v: unknown): number | null => {
  const ts = v as { toMillis?: () => number } | null | undefined;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
};

const latest = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.max(a, b);

/**
 * Every account holding a valid doctor access, by display name.
 * @param {Date} now the reference date for « ce mois-ci ».
 * @return {Promise<PractitionerRow[]>} the rows.
 */
export async function listPractitionerRows(now: Date = new Date()): Promise<PractitionerRow[]> {
  const db = admin.firestore();
  // Any non-empty code. A single-field range on a map sub-field: served by the
  // automatic index, like `accountsHolding`'s equality in adminPractitioner.ts.
  const snap = await db
    .collection("users")
    .where("practitioner.requester_id", ">", "")
    .limit(MAX_PRACTITIONERS)
    .get();
  const docs = snap.docs.filter((d) => practitionerIdentity(d.data()) !== null);
  if (docs.length === 0) return [];

  const usageSnaps = await db.getAll(...docs.map((d) => db.doc(`${PRACTITIONER_USAGE}/${d.id}`)));
  const usageById = new Map(usageSnaps.map((s) => [s.id, s.data()]));

  // Who activated each access: one read per distinct admin.
  const adminUids = [
    ...new Set(
      docs
        .map((d) => String(((d.data().practitioner || {}) as Record<string, unknown>).linkedBy || ""))
        .filter(Boolean)
    ),
  ];
  const adminNames = new Map<string, string>();
  if (adminUids.length > 0) {
    const snaps = await db.getAll(...adminUids.map((u) => db.doc(`users/${u}`)));
    for (const s of snaps) {
      const a = s.data() || {};
      adminNames.set(s.id, String(a.fullName || a.email || ""));
    }
  }

  const holders = new Map<string, number>();
  for (const d of docs) {
    const code = practitionerIdentity(d.data())!.requester_id;
    holders.set(code, (holders.get(code) || 0) + 1);
  }

  return docs
    .map((d) => {
      const data = d.data();
      const identity = practitionerIdentity(data)!;
      const p = (data.practitioner || {}) as Record<string, unknown>;
      const usage = usageSummary(usageById.get(d.id), now);
      const engagement = engagementOf(data);
      return {
        uid: d.id,
        fullName: String(data.fullName || ""),
        email: data.email == null ? null : String(data.email),
        phone: String(data.phone || ""),
        requester_id: identity.requester_id,
        type: identity.type,
        label: typeof p.label === "string" ? p.label : "",
        linkedAt: toMs(p.linkedAt),
        linkedByName: adminNames.get(String(p.linkedBy || "")) || "",
        team: String(data.role || "") !== "",
        sharedWith: (holders.get(identity.requester_id) || 1) - 1,
        engaged: engagement !== null,
        engagementAt: engagement?.acceptedAt ?? null,
        lastVisitAt: latest(usage.lastAt, toMs(p.lastUsedAt)),
        usage,
      };
    })
    .sort((a, b) => (a.label || a.fullName).localeCompare(b.label || b.fullName, "fr"));
}

/** Staff: the doctors who hold an access. Acting on one stays admin level. */
export const adminListPractitioners = onCall(
  { region: REGION },
  async (request: CallableRequest<unknown>) => {
    await requireLevel(request, LEVEL.staff);
    try {
      return { practitioners: await listPractitionerRows() };
    } catch (err) {
      // Counts and uids only — never a name in a log line.
      logger.error("adminListPractitioners failed", {
        message: err instanceof Error ? err.message : String(err),
      });
      throw new HttpsError("internal", "Impossible de lister les médecins pour le moment.");
    }
  }
);
