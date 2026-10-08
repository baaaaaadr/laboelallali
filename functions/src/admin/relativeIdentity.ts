/**
 * The IDENTITY of an attached relative (Dr Aziz, 08/10/2026).
 *
 * Until now a relative's dossier was known only by its number and the label
 * the account holder sees (« Maman »). The lab server never sends a patient's
 * name for `type: "patient"`, so typing the mother's name in the admin search
 * found nothing: the app knew her only as « Maman » of her daughter.
 *
 * Every attachment now records the relative's last name, first name and date
 * of birth, typed by the front desk AS IN QALAM. They make the relative
 * searchable, and they let the admin recognise her when she later creates her
 * own account (same date of birth, same name → « peut-être déjà connue comme
 * proche, dossier 183513 »).
 *
 * PURE (no Firebase import): driven by `functions/scripts/test-relative-identity.js`
 * and imported AS-IS by the admin page (`src/lib/results/relativeIdentity.ts`),
 * so the form and the server validate with the same code.
 */

export interface RelativeIdentity {
  lastName: string;
  firstName: string;
  dateOfBirth: string; // YYYY-MM-DD
}

export type IdentityField = keyof RelativeIdentity;

const NAME_MIN = 2;
const NAME_MAX = 60;

const clean = (v: unknown): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";

/** A real calendar day "YYYY-MM-DD", between 1900 and `today`. */
export function isBirthDay(v: string, today: Date = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const real = d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  return real && +m[1] >= 1900 && v <= today.toISOString().slice(0, 10);
}

/**
 * Validate what the front desk typed. Returns the FIRST refused field, in the
 * order of the form, so the screen can say exactly what is missing.
 * @param {unknown} raw `{lastName, firstName, dateOfBirth}`.
 * @param {Date} today reference day for the date of birth.
 * @return {object} the cleaned identity, or the refused field.
 */
export function parseRelativeIdentity(
  raw: unknown,
  today: Date = new Date()
): { ok: true; value: RelativeIdentity } | { ok: false; field: IdentityField } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lastName = clean(r.lastName);
  const firstName = clean(r.firstName);
  const dateOfBirth = clean(r.dateOfBirth);
  if (lastName.length < NAME_MIN || lastName.length > NAME_MAX) return { ok: false, field: "lastName" };
  if (firstName.length < NAME_MIN || firstName.length > NAME_MAX) return { ok: false, field: "firstName" };
  if (!isBirthDay(dateOfBirth, today)) return { ok: false, field: "dateOfBirth" };
  return { ok: true, value: { lastName, firstName, dateOfBirth } };
}

/**
 * Lower case, no accents; Latin letters, digits and Arabic letters only.
 * (Explicit ranges, not `\p{L}`: the functions compile to ES2017.)
 */
export function normName(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim();
}

/** The words of a name, as compared: « EL-ALLALI  Zoé » → ["el", "allali", "zoe"]. */
export function nameTokens(s: string): string[] {
  return normName(s).split(" ").filter(Boolean);
}

/**
 * Does a search query designate this name? Every word typed must appear in the
 * name, in any order — « fatima nia » and « NIA Fatima » both find NIA Fatima,
 * « fat » finds Fatima. Accents and case ignored.
 */
export function queryMatchesName(query: string, name: string): boolean {
  const words = nameTokens(query);
  if (!words.length) return false;
  const hay = normName(name);
  return words.every((w) => hay.includes(w));
}

/**
 * Do two names share a real word (3 letters or more)? Used for « peut-être la
 * même personne » hints, ALWAYS together with an identical date of birth —
 * never alone. Short particles (« el », « ou ») do not count.
 */
export function namesOverlap(a: string, b: string): boolean {
  const ta = new Set(nameTokens(a).filter((w) => w.length >= 3));
  return nameTokens(b).some((w) => w.length >= 3 && ta.has(w));
}

/**
 * The lab writes names « NOM prénom » — family name in capitals, first names
 * in lower case (« EL ALLALI mohamed aziz »). Split it that way so the front
 * desk can copy the name the lab returned in one click. `null` when the
 * capitals do not tell (all lower or all upper case).
 */
export function splitLabName(name: string): { lastName: string; firstName: string } | null {
  const words = String(name || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const isUpper = (w: string) => w === w.toUpperCase() && w !== w.toLowerCase();
  let i = 0;
  while (i < words.length && isUpper(words[i])) i++;
  if (i === 0 || i === words.length) return null;
  if (words.slice(i).some(isUpper)) return null;
  return { lastName: words.slice(0, i).join(" "), firstName: words.slice(i).join(" ") };
}

/**
 * The attached relatives a search query designates: by name (any word order)
 * or by date of birth (« 1955 », « 1955-03 »). Relatives without an identity
 * (attached before 08/10/2026) cannot match — that is the whole point of it.
 * @param {string} query what the staff typed.
 * @param {T[]} links the account's attached relatives.
 * @return {T[]} the ones the query designates.
 */
export function relativeMatches<T extends { lastName?: string; firstName?: string; dateOfBirth?: string }>(
  query: string,
  links: T[]
): T[] {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  return links.filter(
    (l) =>
      (identityLabel(l) !== "" && queryMatchesName(q, identityLabel(l))) ||
      (typeof l.dateOfBirth === "string" && l.dateOfBirth !== "" && l.dateOfBirth.includes(q))
  );
}

/** « NIA Fatima » — how a relative's identity is shown. */
export function identityLabel(x: { lastName?: string; firstName?: string }): string {
  return [x.lastName || "", x.firstName || ""].filter(Boolean).join(" ");
}

/** The dates of birth of the identified relatives — the field the hint query reads. */
export function relativeDobs(links: Array<{ dateOfBirth?: unknown }>): string[] {
  const out: string[] = [];
  for (const l of links) {
    const d = typeof l.dateOfBirth === "string" ? l.dateOfBirth : "";
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}
