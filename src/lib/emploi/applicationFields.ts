/**
 * « Emploi & Stage » — the client side reads the SAME rules as the server.
 *
 * `functions/src/hr/applicationRules.ts` is pure (no Firebase import), so the
 * page imports it directly instead of keeping a twin: the lists of values,
 * the required fields per type of request and the age limits can never drift
 * between what the page asks and what `submitApplication` accepts. (The doctor
 * space keeps a twin + a parity test because its server module is not pure.)
 */
export {
  KINDS,
  SCHOOL_LEVELS,
  POSITIONS,
  DURATIONS,
  AVAILABILITIES,
  DIPLOMA_LEVELS,
  EXPERIENCES,
  VEHICLES,
  LANGUAGES,
  SOURCES,
  STATUSES,
  FILE_KINDS,
  MAX_FILE_BYTES,
  RETENTION_DAYS,
  MIN_FILL_MS,
  AGE_MIN,
  AGE_MAX,
  NOTE_MAX,
  ageOn,
  cvRequired,
  filesError,
  isInternship,
  needsPosition,
  parseApplication,
} from '../../../functions/src/hr/applicationRules';
export type { ApplicationForm, FieldError, FileKind, Kind, Status } from '../../../functions/src/hr/applicationRules';

/** The form's order — where the page scrolls on a refused submission. */
export const FIELD_ORDER = [
  'kind',
  'position',
  'positionOther',
  'schoolLevel',
  'duration',
  'startDate',
  'endDate',
  'availability',
  'availableFrom',
  'lastName',
  'firstName',
  'dateOfBirth',
  'phone',
  'email',
  'city',
  'district',
  'diplomaLevel',
  'diplomaTitle',
  'diplomaYear',
  'school',
  'experience',
  'lastEmployer',
  'license',
  'vehicle',
  'languages',
  'languagesOther',
  'source',
  'cv',
  'letter',
  'consent',
] as const;

/** One application as the admin tab receives it (`adminListApplications`). */
export interface ApplicationRecord {
  id: string;
  ref: string;
  createdAt: number | null;
  expiresAt: number | null;
  lang: 'fr' | 'ar';
  status: string;
  note: string;
  updatedAt: number | null;
  updatedByName: string;
  hasAccount: boolean;
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  city: string;
  district: string;
  phone: string;
  email: string;
  kind: string;
  schoolLevel: string;
  position: string;
  positionOther: string;
  duration: string;
  startDate: string;
  endDate: string;
  availability: string;
  availableFrom: string;
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
  files: Partial<Record<'cv' | 'letter', { name: string; contentType: string; size: number }>>;
}
