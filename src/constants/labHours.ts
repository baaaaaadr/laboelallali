/**
 * Single source of truth for the laboratory's opening hours.
 *
 * These MUST stay in sync with what the patient is shown:
 *  - `LAB_HOURS` in `./contact` (used by the contact modal / footer)
 *  - the `opening_hours_text` key in `public/locales/{fr,ar}/common.json`
 *
 * Advertised hours:
 *    Lundi → Vendredi : 7h30 – 18h30
 *    Samedi           : 7h30 – 13h00
 *    Dimanche         : fermé
 *
 * Everything here is a PURE function of the `Date` it receives, and every
 * computation goes through the lab's own timezone — never the visitor's, never
 * the server's. That matters because the SSR runtime (Cloud Run) is on UTC
 * while the lab is in Morocco (UTC+1, and UTC+0 during Ramadan): reading
 * `new Date().getHours()` directly would report the wrong hour by one hour.
 */

/** IANA timezone of the laboratory (handles the Ramadan UTC+0 shift on its own). */
export const LAB_TIMEZONE = 'Africa/Casablanca';

/** Opening window of one day, expressed in minutes since local midnight. */
export interface LabDayHours {
  openMinutes: number;
  closeMinutes: number;
}

const at = (hours: number, minutes = 0) => hours * 60 + minutes;

/**
 * Opening hours indexed by day of week, JS convention (0 = Sunday … 6 = Saturday).
 * `null` means closed all day.
 */
export const LAB_WEEKLY_HOURS: readonly (LabDayHours | null)[] = [
  null, // Dimanche — fermé
  { openMinutes: at(7, 30), closeMinutes: at(18, 30) }, // Lundi
  { openMinutes: at(7, 30), closeMinutes: at(18, 30) }, // Mardi
  { openMinutes: at(7, 30), closeMinutes: at(18, 30) }, // Mercredi
  { openMinutes: at(7, 30), closeMinutes: at(18, 30) }, // Jeudi
  { openMinutes: at(7, 30), closeMinutes: at(18, 30) }, // Vendredi
  { openMinutes: at(7, 30), closeMinutes: at(13, 0) }, // Samedi
];

const MINUTES_PER_DAY = 24 * 60;

/**
 * Opening window of a given day of week (0 = Sunday), or `null` if closed.
 *
 * Callers dealing with a CALENDAR date (a date picker, an appointment slot)
 * must pass `date.getDay()` — the day the visitor sees in the calendar grid.
 * Only "is the lab open right NOW" goes through `getLabClock`, which resolves
 * the current instant in the lab's own timezone.
 */
export function getHoursForDay(dayOfWeek: number): LabDayHours | null {
  return LAB_WEEKLY_HOURS[dayOfWeek] ?? null;
}

/** Is the lab open at all on that day of week? */
export function isOpenDay(dayOfWeek: number): boolean {
  return getHoursForDay(dayOfWeek) !== null;
}

/**
 * `from` itself if the lab opens that day, otherwise the next calendar day
 * that it does (used to seed date pickers so they never land on a closed day).
 */
export function nextOpenDate(from: Date): Date {
  const date = new Date(from);
  for (let offset = 0; offset < 7 && !isOpenDay(date.getDay()); offset++) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

/** Wall-clock reading in the lab's timezone. */
export interface LabClock {
  /** 0 = Sunday … 6 = Saturday, as observed in `LAB_TIMEZONE`. */
  dayOfWeek: number;
  /** Minutes since local midnight in `LAB_TIMEZONE`. */
  minutes: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Reads the day + time-of-day as seen *in Agadir*, whatever timezone the
 * runtime is on. Falls back to the runtime's local time if `Intl` cannot
 * resolve the timezone (very old engines).
 */
export function getLabClock(now: Date): LabClock {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: LAB_TIMEZONE,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';

    const dayOfWeek = WEEKDAY_INDEX[get('weekday')];
    // `hour12: false` yields "24" for midnight on some ICU versions.
    const hour = Number(get('hour')) % 24;
    const minute = Number(get('minute'));

    if (dayOfWeek !== undefined && Number.isFinite(hour) && Number.isFinite(minute)) {
      return { dayOfWeek, minutes: hour * 60 + minute };
    }
  } catch {
    // ignore — fall through to the local-time fallback below
  }

  return {
    dayOfWeek: now.getDay(),
    minutes: now.getHours() * 60 + now.getMinutes(),
  };
}

export interface LabOpeningStatus {
  isOpen: boolean;
  /** Wall-clock minutes until the lab opens (if closed) or closes (if open). */
  minutesUntilChange: number;
  /** Approximate timestamp of that change — for display only. */
  nextChangeTime: Date;
}

/**
 * Computes whether the lab is open at `now`, and how long until that changes.
 *
 * The countdown is wall-clock arithmetic in the lab's timezone, so it can be
 * off by one hour across the two Ramadan clock changes each year — acceptable
 * for a "ferme dans 2h15" badge, and never wrong about open/closed itself.
 */
export function getLabOpeningStatus(now: Date): LabOpeningStatus {
  const { dayOfWeek, minutes } = getLabClock(now);
  const today = LAB_WEEKLY_HOURS[dayOfWeek];

  const isOpen =
    !!today && minutes >= today.openMinutes && minutes < today.closeMinutes;

  let minutesUntilChange: number;

  if (isOpen && today) {
    minutesUntilChange = today.closeMinutes - minutes;
  } else {
    // Walk forward until we find the next day that is still going to open.
    // Bounded by 8 so a fully-closed week cannot loop forever.
    minutesUntilChange = MINUTES_PER_DAY * 7;
    for (let offset = 0; offset < 8; offset++) {
      const hours = LAB_WEEKLY_HOURS[(dayOfWeek + offset) % 7];
      if (!hours) continue;
      const candidate = offset * MINUTES_PER_DAY + hours.openMinutes - minutes;
      if (candidate > 0) {
        minutesUntilChange = candidate;
        break;
      }
    }
  }

  return {
    isOpen,
    minutesUntilChange,
    nextChangeTime: new Date(now.getTime() + minutesUntilChange * 60_000),
  };
}
