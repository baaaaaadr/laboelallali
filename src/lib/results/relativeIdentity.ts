/**
 * The identity of an attached relative (last name, first name, date of birth —
 * 08/10/2026), client side. The rules are the SERVER's, imported as-is from the
 * pure module `functions/src/admin/relativeIdentity.ts` (no Firebase import):
 * the admin forms accept exactly what `adminLinkRequester` & co. accept.
 */
export {
  parseRelativeIdentity,
  queryMatchesName,
  splitLabName,
  identityLabel,
  namesOverlap,
  isBirthDay,
} from '../../../functions/src/admin/relativeIdentity';
export type { RelativeIdentity, IdentityField } from '../../../functions/src/admin/relativeIdentity';

/** An empty identity form. */
export const EMPTY_IDENTITY = { lastName: '', firstName: '', dateOfBirth: '' } as const;

/**
 * « Peut-être déjà connu comme proche » — a relative attached to ANOTHER
 * account who may be this person (returned by `adminSearchPatients` and
 * `adminListAccessRequests`, rule `hintsFor` in `functions/src/admin/adminPatients.ts`).
 */
export interface RelativeOfHint {
  holderUid: string;
  holderName: string;
  requester_id: string;
  label: string;
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  /** This account's own dossier is attached there — certain. */
  shared: boolean;
  /** Same date of birth AND a name word in common. */
  nameMatch: boolean;
}
