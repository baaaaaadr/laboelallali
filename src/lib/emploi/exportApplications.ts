/**
 * « Exporter en Excel » of the admin « Candidatures » tab (devis line 40:
 * « pour décider tranquillement hors ligne »). Every column of the form, one
 * row per application — the list AS FILTERED on screen.
 *
 * A real .xlsx (not a CSV: a French Excel splits CSV columns on « ; », mangles
 * accents and Arabic without a BOM, and turns phone numbers into numbers that
 * lose their leading 0). `write-excel-file` is loaded only on click.
 *
 * The CV and letter themselves are never in the file — a column says whether
 * they exist; they open in the admin tab.
 */
import type { TFunction } from 'i18next';
import { ageOn, type ApplicationRecord } from './applicationFields';

type Cell = { value: string | number | Date | null; type?: StringConstructor | NumberConstructor | DateConstructor; format?: string; fontWeight?: 'bold'; wrap?: boolean } | null;

const DATE_FMT = 'dd/mm/yyyy';
const DATETIME_FMT = 'dd/mm/yyyy hh:mm';

/** "2026-10-08" → a Date at noon UTC (no day shift whatever the time zone). */
function dayDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : null;
}

const text = (v: string | null | undefined): Cell => ({ value: v || '', type: String });
const day = (iso: string): Cell => {
  const d = dayDate(iso);
  return d ? { value: d, type: Date, format: DATE_FMT } : text('');
};
const when = (ms: number | null): Cell => (ms ? { value: new Date(ms), type: Date, format: DATETIME_FMT } : text(''));
const num = (n: number | null): Cell => (n === null || n === undefined ? text('') : { value: n, type: Number });

/** The sheet: a bold header row, then one row per application. */
export function buildApplicationsSheet(list: ApplicationRecord[], t: TFunction, now: Date = new Date()): { rows: Cell[][]; widths: number[] } {
  const label = (prefix: string, v: string) => (v ? t(`emploi.${prefix}_${v}`, v) : '');
  const yesNo = (b: boolean) => (b ? t('emploi.yes', 'Oui') : t('emploi.no', 'Non'));
  const columns: Array<{ header: string; width: number; cell: (a: ApplicationRecord) => Cell }> = [
    { header: t('admin.cand_x_received', 'Reçue le'), width: 17, cell: (a) => when(a.createdAt) },
    { header: t('admin.cand_x_ref', 'Référence'), width: 11, cell: (a) => text(a.ref) },
    { header: t('admin.cand_x_status', 'Statut'), width: 12, cell: (a) => text(t(`admin.cand_status_${a.status}`, a.status)) },
    { header: t('admin.cand_x_note', 'Note interne'), width: 40, cell: (a) => ({ value: a.note || '', type: String, wrap: true }) },
    { header: t('admin.cand_x_kind', 'Demande'), width: 24, cell: (a) => text(label('kind', a.kind)) },
    {
      header: t('emploi.position_label', 'Poste visé'),
      width: 26,
      cell: (a) => text(a.position === 'autre' && a.positionOther ? a.positionOther : label('position', a.position)),
    },
    { header: t('emploi.last_name', 'Nom'), width: 18, cell: (a) => text(a.lastName) },
    { header: t('emploi.first_name', 'Prénom'), width: 18, cell: (a) => text(a.firstName) },
    { header: t('emploi.dob', 'Date de naissance'), width: 14, cell: (a) => day(a.dateOfBirth) },
    { header: t('admin.cand_x_age', 'Âge'), width: 6, cell: (a) => num(ageOn(a.dateOfBirth, now)) },
    { header: t('emploi.city', 'Ville'), width: 16, cell: (a) => text(a.city) },
    { header: t('emploi.district', 'Quartier'), width: 16, cell: (a) => text(a.district) },
    // Text, not a number: « 0612… » must keep its leading zero.
    { header: t('emploi.phone', 'Téléphone'), width: 16, cell: (a) => text(a.phone) },
    { header: t('emploi.email', 'E-mail'), width: 26, cell: (a) => text(a.email) },
    { header: t('emploi.school_level_label', 'Scolarité'), width: 20, cell: (a) => text(label('school', a.schoolLevel)) },
    { header: t('emploi.duration_label', 'Durée souhaitée'), width: 14, cell: (a) => text(label('duration', a.duration)) },
    { header: t('emploi.start_date', 'Du'), width: 12, cell: (a) => day(a.startDate) },
    { header: t('emploi.end_date', 'Au'), width: 12, cell: (a) => day(a.endDate) },
    {
      header: t('emploi.availability_label', 'Disponibilité'),
      width: 14,
      cell: (a) =>
        text(
          a.availability === 'immediate'
            ? t('emploi.availability_immediate', 'Immédiate')
            : a.availability === 'date'
              ? t('emploi.availability_date', 'À partir d’une date')
              : ''
        ),
    },
    { header: t('emploi.available_from', 'Disponible à partir du'), width: 14, cell: (a) => day(a.availableFrom) },
    { header: t('emploi.diploma_level_label', 'Niveau d’études'), width: 20, cell: (a) => text(label('diploma', a.diplomaLevel)) },
    { header: t('emploi.diploma_title', 'Intitulé du diplôme'), width: 26, cell: (a) => text(a.diplomaTitle) },
    { header: t('emploi.diploma_year', 'Année d’obtention'), width: 9, cell: (a) => num(a.diplomaYear) },
    { header: t('emploi.school', 'Établissement'), width: 24, cell: (a) => text(a.school) },
    { header: t('emploi.experience_label', 'Expérience'), width: 14, cell: (a) => text(label('experience', a.experience)) },
    { header: t('emploi.last_employer', 'Dernier employeur'), width: 22, cell: (a) => text(a.lastEmployer) },
    { header: t('emploi.license_label', 'Permis de conduire'), width: 9, cell: (a) => text(yesNo(a.license)) },
    { header: t('emploi.vehicle_label', 'Véhicule'), width: 13, cell: (a) => text(label('vehicle', a.vehicle)) },
    {
      header: t('emploi.languages_label', 'Langues parlées'),
      width: 26,
      cell: (a) => text([...a.languages.map((l) => label('lang', l)), a.languagesOther].filter(Boolean).join(', ')),
    },
    { header: t('emploi.source_label', 'Comment nous avez-vous connus ?'), width: 20, cell: (a) => text(label('source', a.source)) },
    { header: t('emploi.cv_label', 'CV'), width: 6, cell: (a) => text(yesNo(!!a.files.cv)) },
    { header: t('emploi.letter_label', 'Lettre de motivation'), width: 8, cell: (a) => text(yesNo(!!a.files.letter)) },
    { header: t('admin.cand_x_account', 'Compte dans l’app'), width: 9, cell: (a) => text(yesNo(a.hasAccount)) },
    { header: t('admin.cand_x_form_lang', 'Langue du formulaire'), width: 9, cell: (a) => text(a.lang === 'ar' ? 'العربية' : 'Français') },
    { header: t('admin.cand_x_updated', 'Dernière décision par'), width: 18, cell: (a) => text(a.updatedByName) },
    { header: t('admin.cand_x_expires', 'Effacement prévu le'), width: 13, cell: (a) => (a.expiresAt ? { value: new Date(a.expiresAt), type: Date, format: DATE_FMT } : text('')) },
  ];
  const header: Cell[] = columns.map((c) => ({ value: c.header, type: String, fontWeight: 'bold', wrap: true }));
  return {
    rows: [header, ...list.map((a) => columns.map((c) => c.cell(a)))],
    widths: columns.map((c) => c.width),
  };
}

/** Build the sheet and hand the file to the browser. */
export async function downloadApplicationsXlsx(list: ApplicationRecord[], t: TFunction, rtl: boolean): Promise<void> {
  const { rows, widths } = buildApplicationsSheet(list, t);
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const stamp = new Date().toISOString().slice(0, 10);
  await writeExcelFile(rows as never, {
    columns: widths.map((width) => ({ width })),
    stickyRowsCount: 1,
    rightToLeft: rtl,
    sheet: t('admin.cand_x_sheet', 'Candidatures'),
  } as never).toFile(`candidatures-${stamp}.xlsx`);
}
