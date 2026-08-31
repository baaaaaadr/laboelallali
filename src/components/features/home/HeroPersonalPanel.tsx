'use client';

/**
 * The personalised block inside the home hero — one panel, four messages.
 *
 * Asked for by the lab (août 2026): "show the 'your last bilan was 4 months ago'
 * reminder on the home page for logged-in patients, and an invitation to create
 * an account for everyone else". The reminder was in fact ALREADY on the home
 * page, mounted just under the hero — but the hero is `min-h-screen` and, since
 * the shortcut tiles were added, its content runs to ~1100px on a phone. Anything
 * "below the hero" needs more than a full screen of scrolling to reach, which is
 * why nobody ever saw it. Hence: inside the hero, above the fold.
 *
 * ── The four states ──────────────────────────────────────────────────────────
 *   guest     no session            → create an account (+ a quiet link to the catalogue)
 *   noaccess  session, no dossier   → activate results access
 *   reminder  results loaded        → "your last bilan was N months ago" → book
 *   generic   anything else linked  → "think about your next bilan" → book
 * médecin / correspondant accounts get nothing (the copy says "votre bilan",
 * which is wrong for someone consulting other people's dossiers).
 *
 * ── Three invariants, each of which took a bug to learn ──────────────────────
 * 1. **`loading` is the only trustworthy gate.** `AuthContext` calls `setUser()`
 *    BEFORE awaiting `fetchProfile()`, so there is a render where `user` exists
 *    and `userProfile` is still null. Gating `noaccess` on `user && !userProfile`
 *    would flash "activate your access" at a perfectly linked patient.
 * 2. **Never gate on `status === 'need_access'`.** `ResultsContext` only starts
 *    its prefetch when `requester_id` exists, so on the home page that status is
 *    unreachable; a linked-less account simply sits at `idle` forever.
 * 3. **Never call `computeResultsStats` outside `status === 'ready'`.** Its
 *    default `new Date()` is not deterministic between server and client; we are
 *    safe only because it runs after hydration. Do not move it earlier.
 *
 * ── Why the slot, the hint and the fade ──────────────────────────────────────
 * The page is statically prerendered, so the server HTML cannot know who is
 * looking (reading a cookie would turn the whole home page dynamic), and Firebase
 * resolves `loading` 300ms–1.5s after first paint. Rendering nothing and popping
 * the panel in would shove the tiles and buttons down — a layout shift on the
 * most visible element of the site. Rendering the guest state server-side would
 * serve "create your account" to a regular patient for a full second.
 *
 * So: the slot is always emitted with its height reserved (zero shift, identical
 * SSR and first client render, no hydration mismatch), and a coarse localStorage
 * hint lets us paint the *likely* state at hydration instead of waiting for
 * Firebase. The hint holds a category and nothing else — never a month count,
 * never a date, never an id: when the last bilan was taken is health metadata.
 * A stale hint costs at most ~500ms of a generic, always-true sentence.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, KeyRound, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useResults } from '@/contexts/ResultsContext';
import { computeResultsStats } from '@/lib/results/stats';
import { checkupTitle } from '@/lib/results/checkupCopy';

type PanelState = 'guest' | 'noaccess' | 'reminder' | 'generic' | 'none';
/** What we remember between visits. A category, never a value. */
type Hint = 'guest' | 'linked' | 'noaccess';

const HINT_KEY = 'laboElAllali_heroPanel';

export default function HeroPersonalPanel({ lang }: { lang: string }) {
  const { t } = useTranslation('common');
  const { user, userProfile, loading } = useAuth();
  const { results, status } = useResults();

  // null until mounted → server and first client render both emit an empty slot.
  const [hint, setHint] = useState<Hint | null>(null);
  const [forced, setForced] = useState<PanelState | null>(null);
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    // Dev-only state override, so the four states can be driven from a Playwright
    // script without real accounts. Same trick as PWAInstallButton's NODE_ENV
    // check; the branch is eliminated at build time in production.
    // `window.location.search` and NOT `useSearchParams()`: that hook forces a
    // <Suspense> boundary and would drop the home page out of static rendering.
    if (process.env.NODE_ENV === 'development') {
      const param = new URLSearchParams(window.location.search).get('heroPanel');
      if (param === 'guest' || param === 'noaccess' || param === 'reminder' || param === 'generic' || param === 'none') {
        setForced(param);
        return;
      }
    }
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(HINT_KEY);
    } catch {
      // private mode / storage disabled — fall through to the guest assumption
    }
    // No hint means this browser never signed in here: Firebase persistence lives
    // in IndexedDB, so a returning patient always has one.
    setHint(stored === 'linked' || stored === 'noaccess' ? stored : 'guest');
  }, []);

  const monthsTitle = useMemo(() => {
    if (status !== 'ready') return null; // invariant 3
    return checkupTitle(computeResultsStats(results).newestMonthsAgo);
  }, [status, results]);

  const state: PanelState | null = useMemo(() => {
    if (forced) return forced;
    if (loading) {
      if (hint === null) return null; // not mounted yet → empty slot
      if (hint === 'linked') return 'generic';
      if (hint === 'noaccess') return 'noaccess';
      return 'guest';
    }
    if (!user) return 'guest';
    if (userProfile?.type === 'medecin' || userProfile?.type === 'correspondant') return 'none';
    if (!userProfile?.requester_id) return 'noaccess'; // invariants 1 and 2
    return monthsTitle ? 'reminder' : 'generic';
  }, [forced, loading, hint, user, userProfile, monthsTitle]);

  // Refresh the hint once the truth is known. Written here rather than in
  // AuthContext so nothing else has to care; a hint left over from a signed-out
  // session is corrected on the next visit to the home page.
  useEffect(() => {
    if (loading || forced) return;
    const next: Hint = !user ? 'guest' : userProfile?.requester_id ? 'linked' : 'noaccess';
    try {
      window.localStorage.setItem(HINT_KEY, next);
    } catch {
      // nothing to do — the panel still works, it just re-guesses next time
    }
  }, [loading, forced, user, userProfile]);

  const showsPanel = state !== null && state !== 'none';

  useEffect(() => {
    if (!showsPanel) return;
    // Two frames, otherwise the element mounts already opaque and never fades.
    const id = requestAnimationFrame(() => setFaded(true));
    return () => cancelAnimationFrame(id);
  }, [showsPanel]);

  const content = (() => {
    switch (state) {
      case 'guest':
        return {
          Icon: UserPlus,
          title: t('hero_panel.guest_title', 'Déjà venu au laboratoire ?'),
          desc: t('hero_panel.guest_desc', 'Créez votre compte pour retrouver tous vos résultats en ligne.'),
          cta: t('hero_panel.guest_cta', 'Créer mon compte'),
          // Always /login, never signInWithGoogle() straight from here: account
          // creation has to go through that page or the profile ends up with no
          // phone number and never enters the lab's onboarding queue.
          href: `/${lang}/login`,
          link: t('hero_panel.guest_link', 'Première visite ? Voir nos analyses et nos tarifs'),
          linkHref: `/${lang}/analyses`,
        };
      case 'noaccess':
        return {
          Icon: KeyRound,
          title: t('resultats.access_title', 'Accédez à vos résultats en ligne'),
          desc: t('hero_panel.access_desc', "Activez l'accès à vos résultats : le laboratoire vérifie votre identité, puis tout est en ligne."),
          cta: t('hero_panel.access_cta', 'Activer mon accès'),
          href: `/${lang}/resultats`,
          link: null,
          linkHref: '',
        };
      case 'reminder':
        return {
          Icon: CalendarClock,
          title: monthsTitle?.count !== undefined
            ? t(monthsTitle.key, { count: monthsTitle.count })
            : t(monthsTitle?.key ?? 'hero_panel.checkup_generic_title'),
          desc: t('resultats.checkup_nudge_gentle', 'Pensez à programmer votre prochain bilan pour surveiller votre santé.'),
          cta: t('resultats.checkup_cta_appointment', 'Prendre rendez-vous'),
          href: `/${lang}/rendez-vous`,
          link: null,
          linkHref: '',
        };
      default:
        return {
          Icon: CalendarClock,
          title: t('hero_panel.checkup_generic_title', 'Pensez à votre prochain bilan'),
          desc: t('resultats.checkup_nudge_gentle', 'Pensez à programmer votre prochain bilan pour surveiller votre santé.'),
          cta: t('resultats.checkup_cta_appointment', 'Prendre rendez-vous'),
          href: `/${lang}/rendez-vous`,
          link: null,
          linkHref: '',
        };
    }
  })();

  const { Icon } = content;

  return (
    <div className={`hero-panel-slot${state === 'none' ? ' hero-panel-slot--collapsed' : ''}`}>
      {showsPanel && (
        <section
          aria-label={content.title}
          className={`hero-panel hero-panel-enter${faded ? ' is-visible' : ''}`}
        >
          <span className="hero-panel__icon">
            <Icon size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="hero-panel__title">{content.title}</p>
            <p className="hero-panel__desc mt-0.5">{content.desc}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href={content.href} className="hero-panel__cta">
                {content.cta}
              </Link>
              {content.link && (
                <Link href={content.linkHref} className="hero-panel__link">
                  {content.link}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
