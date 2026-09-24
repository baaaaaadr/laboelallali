/**
 * The doctor's confidentiality engagement — client twin of
 * `functions/src/admin/practitionerEngagement.ts` (the version, and the test
 * « has he accepted the CURRENT text? »).
 *
 * `scripts/test-practitioner.js` checks that both files carry the same version:
 * a client ahead of the server would be refused, a client behind it would skip
 * a new text. Bump them together.
 *
 * Pure, no React.
 */

export const PRACTITIONER_ENGAGEMENT_VERSION = 1;

/**
 * Has this account accepted the current engagement text?
 * Same test as the server's `engagementOf` (a number, at least the current
 * version); anything malformed reads as « not yet ».
 */
export function hasEngagement(profile: { practitionerEngagement?: unknown } | null | undefined): boolean {
  const e = profile?.practitionerEngagement;
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
  const version = (e as { version?: unknown }).version;
  return typeof version === 'number' && version >= PRACTITIONER_ENGAGEMENT_VERSION;
}
