'use client';

/**
 * "Rappel de bilan" — a gentle, always-on nudge inviting a logged-in patient to
 * book their next bilan. Shown whenever their results are ready and the newest
 * bilan has a parseable date — no minimum-age threshold.
 *
 * **`/resultats` ONLY since août 2026.** It used to have a `variant="home"` too,
 * but on the home page the message now lives inside the hero, where the patient
 * actually sees it without scrolling (`HeroPersonalPanel`, state 4). Mounting
 * this component on the home page again would print the same sentence twice.
 *
 * Self-contained: does its own auth + results gating and returns null when not
 * applicable (incl. médecin/correspondant accounts, whose "votre bilan" copy would
 * be wrong), so host pages stay free of auth code. Data comes from the shared
 * ResultsContext (prefetched at login) — no extra network call.
 *
 * Deliberately a `.card` and not a gradient banner, so it does not read as a
 * duplicate of the fuchsia results banners used elsewhere.
 */

import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BILANS_ENABLED } from '@/constants/features';
import { useAuth } from '@/contexts/AuthContext';
import { useResults } from '@/contexts/ResultsContext';
import { computeResultsStats } from '@/lib/results/stats';
import { checkupTitle } from '@/lib/results/checkupCopy';

// `monthsSince` moved to the shared pure module; re-exported for back-compat.
export { monthsSince } from '@/lib/results/stats';

export default function CheckupReminder({
  lang,
}: {
  lang: string;
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

  // Thresholds and keys live in the shared helper so this page and the home hero
  // panel can never phrase the same bilan differently.
  const titleSpec = checkupTitle(months);
  if (!titleSpec) return null;
  const title = titleSpec.count !== undefined
    ? t(titleSpec.key, { count: titleSpec.count })
    : t(titleSpec.key);
  const nudge = t(
    'resultats.checkup_nudge_gentle',
    'Pensez à programmer votre prochain bilan pour surveiller votre santé.'
  );

  return (
    <section
      aria-label={title}
      className="card border-s-4 border-s-[var(--color-fuchsia-accent)] p-5"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-bordeaux-primary)]/10 dark:bg-[var(--color-bordeaux-primary)]/20 flex items-center justify-center"
        >
          <CalendarClock size={20} className="text-[var(--color-bordeaux-primary)]" />
        </div>
        <div className="min-w-0 text-start">
          <p className="font-semibold text-[var(--text-primary)] leading-snug">{title}</p>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">{nudge}</p>
          <div className="flex flex-wrap gap-3 pt-3">
            <Link
              href={`/${lang}/rendez-vous`}
              className="button-bordeaux justify-center px-4 py-2 text-sm"
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
