'use client';

/**
 * "Rappel de bilan" — a gentle, always-on nudge inviting a logged-in patient to
 * book their next bilan (home page + results page). Shown whenever their results
 * are ready and the newest bilan has a parseable date — no minimum-age threshold.
 *
 * Self-contained: does its own auth + results gating and returns null when not
 * applicable (incl. médecin/correspondant accounts, whose "votre bilan" copy would
 * be wrong), so host pages stay free of auth code. Data comes from the shared
 * ResultsContext (prefetched at login) — no extra network call.
 *
 * Deliberately a `.card` (NOT a gradient banner): on the home page it sits right
 * above ServicesHub's fuchsia "Consultez vos résultats" banner and must not read
 * as a duplicate of it.
 */

import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BILANS_ENABLED } from '@/constants/features';
import { useAuth } from '@/contexts/AuthContext';
import { useResults } from '@/contexts/ResultsContext';
import { computeResultsStats } from '@/lib/results/stats';

// `monthsSince` moved to the shared pure module; re-exported for back-compat.
export { monthsSince } from '@/lib/results/stats';

export default function CheckupReminder({
  lang,
  variant,
}: {
  lang: string;
  variant: 'home' | 'results';
}) {
  const { t } = useTranslation('common');
  const { user, userProfile } = useAuth();
  const { results, status } = useResults();

  // Linked patients only. The copy is personal & directive ("Votre dernier bilan"),
  // so it is wrong for médecin/correspondant accounts that view OTHERS' dossiers —
  // hide it for them. Legacy patients (type undefined) still see it.
  if (!user || !userProfile?.requester_id) return null;
  if (userProfile.type === 'medecin' || userProfile.type === 'correspondant') return null;
  // `status !== 'ready'` covers idle/loading/empty/error/need_access in one check.
  if (status !== 'ready') return null;

  // Bilan date comes from the newest dossier's date_dossier (NOT `lastUpdated`, the
  // server-sync time). Shown always now — no minimum-age threshold.
  const { newestMonthsAgo: months } = computeResultsStats(results);
  if (months === null) return null; // no parseable date → can't phrase it

  const years = Math.floor(months / 12);
  const title =
    months === 0
      ? t('resultats.checkup_title_recent', 'Votre dernier bilan date de moins d’un mois')
      : months < 12
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
  const nudge = t(
    'resultats.checkup_nudge_gentle',
    'Pensez à programmer votre prochain bilan pour surveiller votre santé.'
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
            {/* "Découvrir nos bilans" is dropped while the bilans are hidden
                (BILANS_ENABLED, 26/08/2026) rather than repointed at the
                catalogue: the label promises the bundles specifically. The
                "Prendre rendez-vous" button above still carries the reminder. */}
            {BILANS_ENABLED && (
              <Link
                href={`/${lang}/analyses?tab=bilans`}
                className="button-bordeaux-outline justify-center"
              >
                {t('resultats.checkup_cta_bilans', 'Découvrir nos bilans')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
