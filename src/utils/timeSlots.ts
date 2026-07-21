import { getHoursForDay } from '@/constants/labHours';

/** Appointment slots are offered every 15 minutes. */
export const SLOT_INTERVAL_MINUTES = 15;

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
 * `date.getDay()` is deliberate: the visitor picks a day in a calendar grid
 * rendered in their own timezone, so the weekday must be read the same way.
 */
export function generateTimeSlots(date: Date | null): string[] {
  if (!date) return [];

  const hours = getHoursForDay(date.getDay());
  if (!hours) return [];

  const slots: string[] = [];
  const lastSlot = hours.closeMinutes - SLOT_INTERVAL_MINUTES;

  for (let minutes = hours.openMinutes; minutes <= lastSlot; minutes += SLOT_INTERVAL_MINUTES) {
    const hh = Math.floor(minutes / 60).toString().padStart(2, '0');
    const mm = (minutes % 60).toString().padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }

  return slots;
}
