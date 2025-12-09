/**
 * Generate available time slots based on the selected date
 * Lab hours:
 * - Saturday: 7:30 to 12:00
 * - Other days: 7:30 to 18:30
 * - Slots are in 15-minute intervals
 */
export function generateTimeSlots(date: Date | null): string[] {
  if (!date) return [];

  const day = date.getDay(); // 0=Sunday, 6=Saturday
  const startHour = 7;
  const startMinute = 30;

  // Saturday has shorter hours
  const endHour = day === 6 ? 12 : 18;
  const endMinute = day === 6 ? 0 : 30;

  const slots: string[] = [];
  let h = startHour;
  let m = startMinute;

  while (h < endHour || (h === endHour && m <= endMinute - 15)) {
    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    slots.push(`${hh}:${mm}`);

    m += 15;
    if (m === 60) {
      m = 0;
      h++;
    }
  }

  return slots;
}
