/**
 * Time elapsed since a bilan, broken into months / days / hours / minutes /
 * seconds — the arithmetic behind the home hero's live counter.
 *
 * Pure, no React, like `./stats`.
 */

import { monthsSince } from './stats';

export interface Elapsed {
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const ZERO: Elapsed = { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

/**
 * Elapsed time since `iso`, as of `nowMs`.
 *
 * The month count comes from `monthsSince` rather than a second computation, so
 * the counter and the sentence right above it ("Votre dernier bilan remonte à
 * plus de 4 mois") can never disagree — two independent calculations of the same
 * number would eventually diverge on the 31st of a month.
 *
 * Always defined, never negative. A `date_dossier` slightly in the future (the
 * lab's UTC+1 quirk — see the clock-skew note in `./stats`) yields zeros that
 * start running once real time catches up, rather than a countdown or a gap.
 *
 * ⚠ The month anchor is computed in LOCAL time (`setMonth`), so the h/m/s
 * remainder can be an hour off on either side of Morocco's two Ramadan clock
 * changes — the same caveat `getLabClock()` carries for the opening-hours badge.
 */
export function elapsedSince(iso: string, nowMs: number): Elapsed {
  const from = new Date(iso);
  if (Number.isNaN(from.getTime())) return ZERO;
  if (from.getTime() >= nowMs) return ZERO;

  const months = monthsSince(iso, new Date(nowMs)) ?? 0;

  // `setMonth` overflows (31 Jan + 1 month → 3 Mar); if the anchor lands past
  // `now` we return a zero remainder rather than a negative one.
  const anchor = new Date(from.getTime());
  anchor.setMonth(from.getMonth() + months);
  let rest = nowMs - anchor.getTime();
  if (rest < 0) rest = 0;

  const days = Math.floor(rest / 86_400_000);
  rest -= days * 86_400_000;
  const hours = Math.floor(rest / 3_600_000);
  rest -= hours * 3_600_000;
  const minutes = Math.floor(rest / 60_000);
  rest -= minutes * 60_000;
  const seconds = Math.floor(rest / 1000);

  return { months, days, hours, minutes, seconds };
}
