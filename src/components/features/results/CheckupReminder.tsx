'use client';

/**
 * "Rappel de bilan" — nudges logged-in patients whose most recent bilan is
 * ≥ MIN_MONTHS old to book a new one (home page + results page).
 *
 * Self-contained: does its own auth + results gating and returns null when not
 * applicable, so host pages stay free of auth code. Data comes from the shared
 * ResultsContext (prefetched at login) — no extra network call.
 *
 * Deliberately a `.card` (NOT a gradient banner): on the home page it sits right
 * above ServicesHub's fuchsia "Consultez vos résultats" banner and must not read
 * as a duplicate of it.
 */

import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useResults } from '@/contexts/ResultsContext';

/** Full calendar months elapsed since `iso`. Null for missing/invalid/future dates. */
export function monthsSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() > now.getTime()) return null;
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m -= 1; // current month not complete yet
  return Math.max(0, m);
}

/** Hide the reminder while the last bilan is more recent than this (full months). */
const MIN_MONTHS = 6;

export default function CheckupReminder({
  lang,
  variant,
}: {
  lang: string;
  variant: 'home' | 'results';
}) {
  const { t } = useTranslation('common');
  const { user, userProfile } = useAuth();
  const { results, status, newestDossierId } = useResults();

  // Only linked patients with loaded results. `status !== 'ready'` covers
  // idle/loading/empty/error/need_access in one check.
  if (!user || !userProfile?.requester_id) return null;
  if (status !== 'ready' || !newestDossierId) return null;

  // `results` is unsorted and `lastUpdated` is the server-sync time — the bilan
  // date MUST come from the newest dossier's date_dossier.
  const newestIso = results.find((r) => r.dossier_id === newestDossierId)?.date_dossier;
  const months = monthsSince(newestIso);
  if (months === null || months < MIN_MONTHS) return null;

  const years = Math.floor(months / 12);
  const title =
    months < 12
      ? t('resultats.checkup_title_months', {
          count: months,
          defaultValue: 'Votre dernier bilan remonte à plus de {{count}} mois',
        })
      : months < 24
        ? t('resultats.checkup_title_year', 'Votre dernier bilan remonte à plus d’un an')
        : t('resultats.checkup_title_years', {
            count: years,
            defaultValue: 'Votre dernier bilan remonte à plus de {{count}} ans',
          });
  const nudge =
    months >= 12
      ? t(
          'resultats.checkup_nudge_yearly',
          'Il est recommandé de faire un bilan une fois par an. Pensez à en refaire un pour surveiller votre santé.'
        )
      : t(
          'resultats.checkup_nudge_gentle',
          'Il est peut-être temps d’en refaire un pour surveiller votre santé.'
        );

  const isHome = variant === 'home';

  return (
    <section
      aria-label={title}
      className={`card border-s-4 border-s-[var(--color-fuchsia-accent)] ${isHome ? 'mt-6 p-6' : 'p-5'}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex-shrink-0 rounded-xl bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 flex items-center justify-center ${
            isHome ? 'w-14 h-14' : 'w-10 h-10'
          }`}
        >
          <CalendarClock size={isHome ? 26 : 20} className="text-[var(--color-bordeaux-primary)]" />
        </div>
        <div className="min-w-0 text-start">
          {isHome ? (
            <h2 className="text-lg font-bold text-[var(--text-primary)] leading-snug">{title}</h2>
          ) : (
            <p className="font-semibold text-[var(--text-primary)] leading-snug">{title}</p>
          )}
          <p className={`text-[var(--text-secondary)] mt-1 ${isHome ? 'text-base' : 'text-sm'}`}>
            {nudge}
          </p>
          <div className="flex flex-wrap gap-3 pt-3">
            <Link
              href={`/${lang}/rendez-vous`}
              className={`button-bordeaux justify-center ${isHome ? '' : 'px-4 py-2 text-sm'}`}
            >
              {t('resultats.checkup_cta_appointment', 'Prendre rendez-vous')}
            </Link>
            <Link
              href={`/${lang}/analyses?tab=bilans`}
              className={`flex items-center justify-center font-medium rounded-lg border-2 border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--color-bordeaux-primary)] hover:bg-[var(--background-tertiary)] transition-all ${
                isHome ? 'px-6 py-3' : 'px-4 py-2 text-sm'
              }`}
            >
              {t('resultats.checkup_cta_bilans', 'Découvrir nos bilans')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
