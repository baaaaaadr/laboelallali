/**
 * Which lab dossiers an account may consult, in display order.
 *
 * Until now a profile carried exactly one identity (`requester_id` + `type`).
 * It can now also carry `linkedRequesters` — dossiers of relatives the lab has
 * attached to this account. This module is the single place that turns a raw
 * profile into the list the UI shows, so `/resultats`, `/profile` and the home
 * hero never disagree about who the account can see.
 *
 * Pure, no React — like `./stats` and `./checkupCopy`. The server has a twin
 * (`functions/src/cyberlab/identities.ts`) that answers the same question for
 * authorization. **The two must stay in sync**, but they are deliberately
 * separate: this one is for display and can be wrong without consequence; the
 * server one is the security boundary and never trusts client input.
 *
 * ⚠ Ordering is meaningful. `identities[0]` is the PRIMARY: the one the home
 * page shows, and the one selected by default on `/resultats`.
 */

import type { LinkedRequester, RequesterType } from '@/types/cyberlab';

const VALID_TYPES: readonly RequesterType[] = ['patient', 'medecin', 'correspondant'];

/**
 * Canonical form of a `requester_id` — mirror of `normalizeRequesterId` in
 * `functions/src/cyberlab/client.ts`.
 *
 * Staff type lab ids by hand and Qalam shows large ones with a thousands
 * separator ("67 305" was really saved on a patient profile, and the lab server
 * answers 404 for it). Ids never legitimately contain whitespace, so every space
 * is stripped — on read as well as on write, so already-corrupted documents are
 * rescued.
 */
export function normalizeRequesterId(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return typeof raw === 'string' ? raw.replace(/\s+/g, '') : '';
}

/** One dossier this account may consult. */
export interface Identity {
  requester_id: string;
  type: RequesterType;
  /** What to show in the selector. For the holder's own dossier, `selfLabel`. */
  label: string;
  /** True only for the account holder's OWN dossier. */
  isSelf: boolean;
}

/** The subset of the profile this module reads. */
export interface IdentityProfile {
  requester_id?: string;
  type?: RequesterType;
  linkedRequesters?: LinkedRequester[];
}

function isValidType(t: unknown): t is RequesterType {
  return typeof t === 'string' && VALID_TYPES.includes(t as RequesterType);
}

/**
 * Every dossier the account may consult, primary first.
 *
 * Order:
 *  1. the holder's own dossier, when they have one;
 *  2. the attached relatives, in the order the lab created them.
 *
 * When the account has NO dossier of its own — someone who never had a test but
 * manages their parents' — the first attached relative becomes the primary and
 * is what the home page shows. Without this, that person would sit forever on
 * "activate your access" for a dossier that does not exist.
 *
 * Deduplicated by `requester_id`, first occurrence wins: the front desk can
 * attach a dossier the account already owns, and showing it twice would be
 * confusing rather than harmful.
 *
 * Returns `[]` when the account has nothing — callers keep their existing
 * `need_access` behaviour.
 */
export function resolveIdentities(
  profile: IdentityProfile | null | undefined,
  selfLabel: string
): Identity[] {
  if (!profile) return [];

  const out: Identity[] = [];
  const seen = new Set<string>();

  const ownId = normalizeRequesterId(profile.requester_id);
  if (ownId !== '' && isValidType(profile.type)) {
    out.push({ requester_id: ownId, type: profile.type, label: selfLabel, isSelf: true });
    seen.add(ownId);
  }

  const linked = Array.isArray(profile.linkedRequesters) ? profile.linkedRequesters : [];
  for (const entry of linked) {
    if (!entry) continue;
    const id = normalizeRequesterId(entry.requester_id);
    if (id === '' || seen.has(id) || !isValidType(entry.type)) continue;
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    out.push({
      requester_id: id,
      type: entry.type,
      // A link saved without a label would render a nameless tab; fall back to
      // the id so the selector stays usable and the gap is obvious to the lab.
      label: label || id,
      isSelf: false,
    });
    seen.add(id);
  }

  return out;
}

/**
 * The identity the home page shows and `/resultats` selects by default.
 * `null` when the account has no dossier at all.
 */
export function primaryIdentity(
  profile: IdentityProfile | null | undefined,
  selfLabel: string
): Identity | null {
  return resolveIdentities(profile, selfLabel)[0] ?? null;
}

/**
 * Look an identity up by id, e.g. to resolve a selection back to a label.
 * `null` when the id is not (or no longer) authorized — which is exactly what
 * happens when the lab revokes a link while the patient has the tab open.
 */
export function findIdentity(identities: Identity[], requesterId: string | null): Identity | null {
  if (!requesterId) return null;
  const id = normalizeRequesterId(requesterId);
  return identities.find((x) => x.requester_id === id) ?? null;
}

/** True when the account can see more than its own dossier — drives the selector. */
export function hasMultipleIdentities(identities: Identity[]): boolean {
  return identities.length > 1;
}
