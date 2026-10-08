/**
 * « Emploi & Stage » — the RULES of a job / internship application (devis
 * lines 27 and 40, Dr Aziz, 08/10/2026). PURE: no Firebase import, so
 * `scripts/test-applications.js` drives it directly and the client twin
 * (`src/lib/emploi/applicationFields.ts`) can be checked against it.
 *
 * What is validated here, once, for the server:
 *  - the closed lists (type of request, position, diploma level…) — the client
 *    twin MUST hold the same values (parity checked by `npm run test:emploi`);
 *  - which fields are required for which type of request;
 *  - the files' REAL format, read from their first bytes (`sniffFile`): a renamed
 *    executable is refused whatever its name or declared type;
 *  - the anti-spam rate limits (`throttle`);
 *  - the retention: an application and its files are erased 6 months after it
 *    was sent (`expiryFrom`), whatever its status.
 *
 * No national ID number (CIN) anywhere: sensitive, and useless before hiring.
 */

export const KINDS = ["observation", "preembauche", "emploi", "spontanee"] as const;
export const SCHOOL_LEVELS = ["college_lycee", "universite", "formation_pro"] as const;
export const POSITIONS = [
  "technicien",
  "prelevement",
  "accueil",
  "coursier",
  "entretien",
  "biologiste",
  "autre",
] as const;
export const DURATIONS = ["1_semaine", "2_semaines", "1_mois", "2_mois", "3_mois_plus"] as const;
export const AVAILABILITIES = ["immediate", "date"] as const;
export const DIPLOMA_LEVELS = [
  "aucun",
  "niveau_bac",
  "bac",
  "bac2",
  "licence",
  "master",
  "doctorat",
  "autre",
] as const;
export const EXPERIENCES = ["debutant", "moins_1", "1_3", "plus_3"] as const;
export const VEHICLES = ["aucun", "moto", "voiture"] as const;
export const LANGUAGES = ["arabe", "amazighe", "francais", "anglais", "espagnol"] as const;
export const SOURCES = [
  "bouche_a_oreille",
  "facebook",
  "instagram",
  "google",
  "ecole",
  "affiche",
  "autre",
] as const;
/** The lab's decision on an application (admin tab). First one = on arrival. */
export const STATUSES = ["a_etudier", "entretien", "retenu", "refuse"] as const;
export const FILE_KINDS = ["cv", "letter"] as const;

export type Kind = (typeof KINDS)[number];
export type Status = (typeof STATUSES)[number];
export type FileKind = (typeof FILE_KINDS)[number];

/** The real formats accepted for a CV or a letter, and their MIME type. */
export const FILE_FORMATS = {
  pdf: { mime: "application/pdf", ext: "pdf" },
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  doc: { mime: "application/msword", ext: "doc" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
  },
} as const;
export type FileFormat = keyof typeof FILE_FORMATS;

/** Where an application lives — all three server-only (default deny in
 *  `firestore.rules` / `storage.rules`; the Admin SDK bypasses both). */
export const APPLICATIONS = "applications";
export const THROTTLE = "applicationThrottle";
export const STORAGE_PREFIX = "candidatures";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Kept 6 months (≈ 183 days), then the application AND its files are erased. */
export const RETENTION_DAYS = 183;
const DAY_MS = 86_400_000;
/** A human needs more than this to fill the form; a script does not. */
export const MIN_FILL_MS = 8_000;

export const AGE_MIN = 13;
export const AGE_MAX = 75;
const NAME_MAX = 60;
const TEXT_MAX = 100;
const EMAIL_MAX = 120;
const PHONE_MAX = 20;
const PHONE_MIN_DIGITS = 8;
export const NOTE_MAX = 2000;

/** Why a field is refused — the client shows `emploi.err_<code>`. */
export type FieldError = "required" | "invalid" | "too_long" | "age" | "dates";

/** A validated application, as stored (`applications/{id}`, minus the server fields). */
export interface ApplicationForm {
  lastName: string;
  firstName: string;
  dateOfBirth: string; // YYYY-MM-DD
  city: string;
  district: string;
  phone: string;
  email: string;
  kind: Kind;
  schoolLevel: string; // observation only
  position: string; // "" for an observation internship without a target position
  positionOther: string;
  duration: string; // internships only
  startDate: string; // internships, optional
  endDate: string; // internships, optional
  availability: string; // job / spontaneous only
  availableFrom: string; // when availability === "date"
  diplomaLevel: string;
  diplomaTitle: string;
  diplomaYear: number | null;
  school: string;
  experience: string;
  lastEmployer: string;
  license: boolean;
  vehicle: string;
  languages: string[];
  languagesOther: string;
  source: string;
}

export type ParseResult =
  | { ok: true; value: ApplicationForm }
  | { ok: false; errors: Record<string, FieldError> };

const clean = (v: unknown, max = TEXT_MAX * 2): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max + 1) : "";

const isIn = <T extends readonly string[]>(list: T, v: unknown): v is T[number] =>
  typeof v === "string" && (list as readonly string[]).includes(v);

/** A real calendar day "YYYY-MM-DD" (31/02 is refused). */
export function isIsoDay(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Full years between a birth day and `now` (calendar, not 365-day blocks). */
export function ageOn(dob: string, now: Date): number | null {
  if (!isIsoDay(dob)) return null;
  const [y, m, d] = dob.split("-").map(Number);
  let age = now.getUTCFullYear() - y;
  const before = now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  if (before) age -= 1;
  return age;
}

/** Moroccan numbers written every way (06…, +2126…, 002126…) → one key. */
export function phoneKey(phone: string): string {
  let digits = String(phone || "").replace(/\D+/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("212") && digits.length === 12) digits = "0" + digits.slice(3);
  return digits;
}

export function isPhone(phone: string): boolean {
  return (
    phone.length <= PHONE_MAX &&
    /^\+?[\d\s.()-]+$/.test(phone) &&
    phone.replace(/\D+/g, "").length >= PHONE_MIN_DIGITS
  );
}

export function isEmail(email: string): boolean {
  return email.length <= EMAIL_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Position required for every request except an observation internship. */
export const needsPosition = (kind: Kind): boolean => kind !== "observation";
/** Duration (and wished dates) for the two internships. */
export const isInternship = (kind: Kind): boolean => kind === "observation" || kind === "preembauche";
/** A CV is required, except for a school observation internship (CV OR the school's letter). */
export const cvRequired = (kind: Kind): boolean => kind !== "observation";

/**
 * Validate the form as sent by the page. Never throws: returns every refused
 * field at once, so the page can show them all.
 * @param {unknown} raw the `form` object of the callable input.
 * @param {Date} now the reference day (age, dates).
 * @return {ParseResult} the cleaned application, or the refused fields.
 */
export function parseApplication(raw: unknown, now: Date = new Date()): ParseResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, FieldError> = {};

  const text = (key: string, max: number, required: boolean): string => {
    const v = clean(r[key], max);
    if (!v) {
      if (required) errors[key] = "required";
      return "";
    }
    if (v.length > max) errors[key] = "too_long";
    return v.slice(0, max);
  };
  const pick = <T extends readonly string[]>(key: string, list: T, required: boolean): string => {
    const v = r[key];
    if (v === undefined || v === null || v === "") {
      if (required) errors[key] = "required";
      return "";
    }
    if (!isIn(list, v)) {
      errors[key] = "invalid";
      return "";
    }
    return v;
  };
  const day = (key: string, required: boolean): string => {
    const v = clean(r[key], 10);
    if (!v) {
      if (required) errors[key] = "required";
      return "";
    }
    if (!isIsoDay(v)) {
      errors[key] = "invalid";
      return "";
    }
    return v;
  };

  const lastName = text("lastName", NAME_MAX, true);
  const firstName = text("firstName", NAME_MAX, true);
  if (lastName && lastName.length < 2) errors.lastName = "invalid";
  if (firstName && firstName.length < 2) errors.firstName = "invalid";

  const dateOfBirth = day("dateOfBirth", true);
  if (dateOfBirth && !errors.dateOfBirth) {
    const age = ageOn(dateOfBirth, now);
    if (age === null || age < AGE_MIN || age > AGE_MAX) errors.dateOfBirth = "age";
  }

  const city = text("city", NAME_MAX, true);
  const district = text("district", NAME_MAX, false);

  const phone = text("phone", PHONE_MAX, true);
  if (phone && !errors.phone && !isPhone(phone)) errors.phone = "invalid";
  const email = text("email", EMAIL_MAX, false).toLowerCase();
  if (email && !errors.email && !isEmail(email)) errors.email = "invalid";

  const kind = pick("kind", KINDS, true) as Kind | "";
  const k = (kind || "emploi") as Kind; // drives the conditional checks below

  const schoolLevel = kind === "observation" ? pick("schoolLevel", SCHOOL_LEVELS, true) : "";
  const position = pick("position", POSITIONS, !!kind && needsPosition(k));
  const positionOther = position === "autre" ? text("positionOther", NAME_MAX, true) : "";

  let duration = "";
  let startDate = "";
  let endDate = "";
  let availability = "";
  let availableFrom = "";
  if (kind && isInternship(k)) {
    duration = pick("duration", DURATIONS, true);
    startDate = day("startDate", false);
    endDate = day("endDate", false);
    if (startDate && endDate && endDate < startDate) errors.endDate = "dates";
  } else if (kind) {
    availability = pick("availability", AVAILABILITIES, true);
    if (availability === "date") availableFrom = day("availableFrom", true);
  }

  const diplomaLevel = pick("diplomaLevel", DIPLOMA_LEVELS, true);
  const diplomaTitle = text("diplomaTitle", TEXT_MAX, false);
  let diplomaYear: number | null = null;
  if (r.diplomaYear !== undefined && r.diplomaYear !== null && r.diplomaYear !== "") {
    const y = Number(r.diplomaYear);
    if (!Number.isInteger(y) || y < 1960 || y > now.getUTCFullYear() + 1) errors.diplomaYear = "invalid";
    else diplomaYear = y;
  }
  const school = text("school", TEXT_MAX, false);
  const experience = pick("experience", EXPERIENCES, true);
  const lastEmployer = text("lastEmployer", TEXT_MAX, false);

  let license = false;
  if (typeof r.license === "boolean") license = r.license;
  else errors.license = "required";
  const vehicle = pick("vehicle", VEHICLES, true);

  let languages: string[] = [];
  if (Array.isArray(r.languages)) {
    if (r.languages.some((l) => !isIn(LANGUAGES, l))) errors.languages = "invalid";
    languages = LANGUAGES.filter((l) => (r.languages as unknown[]).includes(l));
  }
  const languagesOther = text("languagesOther", NAME_MAX, false);
  if (!languages.length && !languagesOther && !errors.languages) errors.languages = "required";

  const source = pick("source", SOURCES, false);

  if (r.consent !== true) errors.consent = "required";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      lastName,
      firstName,
      dateOfBirth,
      city,
      district,
      phone,
      email,
      kind: kind as Kind,
      schoolLevel,
      position,
      positionOther,
      duration,
      startDate,
      endDate,
      availability,
      availableFrom,
      diplomaLevel,
      diplomaTitle,
      diplomaYear,
      school,
      experience,
      lastEmployer,
      license,
      vehicle,
      languages,
      languagesOther,
      source,
    },
  };
}

/** Which files must be present for this request: `null` when the set is fine. */
export function filesError(kind: Kind, present: { cv: boolean; letter: boolean }): FileKind | null {
  if (cvRequired(kind)) return present.cv ? null : "cv";
  return present.cv || present.letter ? null : "cv";
}

const startsWith = (b: Uint8Array, sig: number[], at = 0): boolean =>
  b.length >= at + sig.length && sig.every((x, i) => b[at + i] === x);

function containsAscii(b: Uint8Array, needle: string): boolean {
  const n = Array.from(needle, (c) => c.charCodeAt(0));
  outer: for (let i = 0; i + n.length <= b.length; i++) {
    for (let j = 0; j < n.length; j++) if (b[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * The file's REAL format, read from its first bytes — never from its name or
 * the type the browser declared. `null` = refused.
 * @param {Uint8Array} b the file content.
 * @return {FileFormat | null} the format, or null.
 */
export function sniffFile(b: Uint8Array): FileFormat | null {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "doc";
  // A .docx is a zip whose directory names Word's main part. Any other zip
  // (an archive, a disguised program) is refused.
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) && containsAscii(b, "word/document.xml")) return "docx";
  return null;
}

/** Every control character (tab, line breaks, NUL…) becomes a space. */
export function withoutControls(s: string): string {
  return Array.from(s, (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c)).join("");
}

/** A file name safe to show and to store as metadata (never used as a path). */
export function safeFileName(name: unknown, format: FileFormat): string {
  const base = withoutControls(String(name ?? ""))
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const ext = FILE_FORMATS[format].ext;
  const stem = base.replace(/\.[A-Za-z0-9]{1,5}$/, "") || "document";
  return `${stem}.${ext}`;
}

/** When an application sent at `createdMs` must be erased. */
export function expiryFrom(createdMs: number): number {
  return createdMs + RETENTION_DAYS * DAY_MS;
}

/**
 * Sliding-window rate limit: keep the hits of the last `windowMs`, allow when
 * fewer than `max`. Pure — the caller stores `kept` (+ now when allowed).
 * @param {number[]} hits previous hit times (ms).
 * @param {number} now current time (ms).
 * @param {number} windowMs window length.
 * @param {number} max hits allowed in the window.
 * @return {{allowed: boolean, kept: number[]}} decision and pruned hits.
 */
export function throttle(
  hits: unknown,
  now: number,
  windowMs: number,
  max: number
): { allowed: boolean; kept: number[] } {
  const kept = (Array.isArray(hits) ? hits : [])
    .filter((t): t is number => typeof t === "number" && t > now - windowMs && t <= now)
    .slice(-max * 2);
  return { allowed: kept.length < max, kept };
}

/** The anti-spam limits, per 24 h. A mobile operator puts many people behind
 *  one address, hence a generous per-address cap. */
export const LIMITS = {
  windowMs: DAY_MS,
  perAddress: 10,
  perPhone: 2,
  /** Acknowledgement e-mails to one address — or the form would let anyone
   *  flood a third party's mailbox with our e-mails. */
  ackPerEmail: 1,
} as const;

/** A short reference the candidate can quote on the phone. */
export function applicationRef(id: string): string {
  return id.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase();
}
