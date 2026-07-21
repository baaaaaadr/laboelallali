import { getHoursForDay } from '@/constants/labHours';

/** Appointment slots are offered every 15 minutes. */
export const SLOT_INTERVAL_MINUTES = 15;

const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Available appointment slots for a given date.
 *
 * The opening hours come from `src/constants/labHours.ts` — the single source
 * of truth shared with the home page's open/closed badge — so the booking form
 * can never offer a slot on a day or at an hour the lab is closed:
 *   - Lundi → Vendredi : 07:30 → 18:15 (last slot 15 min before closing)
 *   - Samedi           : 07:30 → 12:45
 *   - Dimanche         : aucun créneau (fermé)
 *
 * `now` is optional and, when the requested date is TODAY, drops the slots that
 * have already passed — at 16:03 the form must not still offer 07:30. Pass
 * `null` (the value of `useNow()` before mount) to get the unfiltered day, so
 * the server render and the first client render agree.
 *
 * Everything is read in the visitor's own timezone (`getDay`, `getHours`),
 * deliberately: they pick a day in a calendar grid rendered in that timezone.
 * Only "is the lab open right now" resolves the lab's timezone, in `labHours`.
 */
export function generateTimeSlots(date: Date | null, now?: Date | null): string[] {
  if (!date) return [];

  const hours = getHoursForDay(date.getDay());
  if (!hours) return [];

  const pastCutoff = now && isSameCalendarDay(date, now) ? minutesOfDay(now) : null;

  const slots: string[] = [];
  const lastSlot = hours.closeMinutes - SLOT_INTERVAL_MINUTES;

  for (let minutes = hours.openMinutes; minutes <= lastSlot; minutes += SLOT_INTERVAL_MINUTES) {
    if (pastCutoff !== null && minutes <= pastCutoff) continue;
    const hh = Math.floor(minutes / 60).toString().padStart(2, '0');
    const mm = (minutes % 60).toString().padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }

  return slots;
}

/**
 * Can this date still be booked? Drives the date picker's `filterDate`, so a
 * closed day — or today once its last slot has passed — cannot be selected.
 */
export function hasBookableSlots(date: Date, now?: Date | null): boolean {
  return generateTimeSlots(date, now).length > 0;
}

/**
 * First date from `now` that still has a bookable slot: today if some of its
 * slots are ahead, otherwise the next open day. Used to seed the date pickers.
 */
export function nextBookableDate(now: Date): Date {
  const date = new Date(now);
  for (let offset = 0; offset < 8; offset++) {
    if (hasBookableSlots(date, now)) break;
    date.setDate(date.getDate() + 1);
  }
  return date;
}
