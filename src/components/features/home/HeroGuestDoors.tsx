'use client';

/**
 * The `guest` state of the hero panel: a value proposition, then TWO doors —
 * one per audience.
 *
 * Dr Aziz asked for "two bubbles": the returning patient who needs an account,
 * and the first-time visitor who needs to see what the lab offers. The previous
 * single block buried the second audience in a text link under the button, and
 * the two messages competed for one call to action.
 *
 * **The headline carries no button of its own on purpose.** The second bubble
 * already leads to the catalog, and the hero on a 390x844 phone is already
 * ~1100px tall — a third call to action would say the same thing twice and cost
 * another row. Two doors, two destinations, nothing repeated.
 *
 * **Both doors go through a page, never straight to `signInWithGoogle()`** —
 * same invariant as the rest of the app: an account created outside `/login`
 * has no phone number and never enters the lab's activation queue.
 *
 * ⚠ This is the state that sizes the reserved slot. French `guest` was already
 * the tallest panel in the base tier (204px at 320px for 208px reserved), and
 * two stacked bubbles make it taller still — hence its OWN tier,
 * `.hero-panel-slot--guest`. Heights are measured with the Playwright driver
 * (`?heroPanel=guest`), never guessed. See docs/pages/home.md.
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function HeroGuestDoors({ lang, headline }: { lang: string; headline: string }) {
  const { t } = useTranslation('common');

  const doors = [
    {
      key: 'account',
      question: t('hero_panel.guest_door_account_q', 'Déjà venu au laboratoire ?'),
      answer: t('hero_panel.guest_door_account_a', 'Créer mon compte'),
      href: `/${lang}/login`,
    },
    {
      key: 'first',
      question: t('hero_panel.guest_door_first_q', 'Première visite ?'),
      answer: t(
        'hero_panel.guest_door_first_a',
        'Faites votre première analyse et recevez vos résultats ici'
      ),
      href: `/${lang}/analyses`,
    },
  ];

  // No leading icon here, unlike the other panel states. At 320px it costs ~44px
  // of width, which pushes the headline to a third line and narrows both doors
  // — measured: the icon alone is worth ~30px of panel height on a small phone,
  // on a hero that already overflows the screen. The two doors give this state
  // its own identity; it does not need a glyph as well.
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="hero-panel__title">{headline}</p>

        <div className="hero-panel__doors">
          {doors.map((d) => (
            <Link key={d.key} href={d.href} className="hero-panel__door">
              <span className="hero-panel__door-q">{d.question}</span>
              <span className="hero-panel__door-a">
                {d.answer}
                <ChevronRight size={14} aria-hidden="true" className="hero-panel__door-chevron" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
