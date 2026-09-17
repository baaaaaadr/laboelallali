/**
 * Which lab identities a caller is allowed to read — the authorization boundary
 * for the "ayant droit" feature.
 *
 * Firebase-free and clock-free (same philosophy as `client.ts` and
 * `monitoring/stateMachine.ts`) so `functions/scripts/test-identities.js` can
 * drive it directly.
 *
 * THE RULE: the client sends a *selector*, never a value. `fetchResults` reads
 * the caller's profile from Firestore, builds the authorized list here, and only
 * then decides which identity to query. A `requester_id` coming from the client
 * is matched against that list — it is never used as-is. This preserves the
 * anti-spoof property the single-identity version had for free.
 *
 * `src/lib/results/identities.ts` is the display-side twin. It must stay in
 * sync, but it is not a security boundary: this file is.
 */
import {normalizeRequesterId, RequesterType} from "./client";

const VALID_TYPES: readonly RequesterType[] = [
  "patient",
  "medecin",
  "correspondant",
];

/**
 * Hard cap on attached dossiers, enforced on write by `adminLinkRequester` and
 * on read here. The profile is fetched on every results call, so an unbounded
 * array would grow the hot path; ten relatives is far beyond any real family.
 */
export const MAX_LINKED_REQUESTERS = 10;

export interface ProfileIdentity {
  requester_id: string;
  type: RequesterType;
  /** True only for the profile's own `requester_id`. */
  isSelf: boolean;
}

/** Minimal shape read from `users/{uid}` — a Firestore DocumentData in practice. */
export interface IdentityData {
  requester_id?: unknown;
  type?: unknown;
  linkedRequesters?: unknown;
}

/**
 * Narrow an unknown value to a valid requester type.
 * @param {unknown} t candidate value.
 * @return {boolean} true when it is one of the three accepted types.
 */
function isValidType(t: unknown): t is RequesterType {
  return typeof t === "string" && VALID_TYPES.includes(t as RequesterType);
}

/**
 * Every identity this profile may read, own dossier first.
 *
 * Ids are normalized on BOTH sides before comparison: a profile saved before the
 * whitespace fix can still hold "67 305", and an id typed into the app would
 * then never match its stored twin.
 *
 * Malformed entries are skipped rather than throwing — a single bad row written
 * by a future bug must not lock a patient out of their own results.
 * @param {IdentityData} data the `users/{uid}` document data.
 * @return {ProfileIdentity[]} authorized identities, own dossier first.
 */
export function authorizedIdentities(data: IdentityData): ProfileIdentity[] {
  const out: ProfileIdentity[] = [];
  const seen = new Set<string>();

  const ownId = normalizeRequesterId(data.requester_id);
  if (ownId !== "" && isValidType(data.type)) {
    out.push({requester_id: ownId, type: data.type, isSelf: true});
    seen.add(ownId);
  }

  const linked = Array.isArray(data.linkedRequesters) ?
    data.linkedRequesters.slice(0, MAX_LINKED_REQUESTERS) :
    [];

  for (const raw of linked) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as {requester_id?: unknown; type?: unknown};
    const id = normalizeRequesterId(entry.requester_id);
    if (id === "" || seen.has(id) || !isValidType(entry.type)) continue;
    out.push({requester_id: id, type: entry.type, isSelf: false});
    seen.add(id);
  }

  return out;
}

/**
 * Pick the identity to query.
 *
 * No `requested` id → the PRIMARY identity, which is the own dossier when there
 * is one, otherwise the first attached relative. That fallback is what lets an
 * account with no dossier of its own (someone who never had a test but manages
 * their parents') still land on results instead of an activation screen.
 *
 * A `requested` id → that identity, and only if it is in the authorized list.
 * `null` otherwise, which the caller maps to `permission-denied`.
 *
 * An unknown id and an unauthorized id are indistinguishable from outside, so
 * this cannot be used to enumerate other patients' dossier numbers.
 * @param {IdentityData} data the `users/{uid}` document data.
 * @param {string|undefined} requested normalized id asked for by the client.
 * @return {ProfileIdentity|null} the identity to query, or null if refused.
 */
export function resolveIdentity(
  data: IdentityData,
  requested?: string
): ProfileIdentity | null {
  const identities = authorizedIdentities(data);
  if (identities.length === 0) return null;

  const wanted = normalizeRequesterId(requested);
  if (wanted === "") return identities[0];

  return identities.find((x) => x.requester_id === wanted) ?? null;
}

/**
 * Did the caller ask for an identity that exists but is not theirs?
 *
 * Lets `fetchResults` tell "this account never had access" (→ the activation
 * card) from "this link was revoked" (→ drop back to the primary identity and
 * say so), which are two very different messages for the patient.
 * @param {IdentityData} data the `users/{uid}` document data.
 * @param {string|undefined} requested normalized id asked for by the client.
 * @return {boolean} true when an explicit id was asked for and refused.
 */
export function wasRefused(data: IdentityData, requested?: string): boolean {
  const wanted = normalizeRequesterId(requested);
  if (wanted === "") return false;
  return resolveIdentity(data, wanted) === null;
}
