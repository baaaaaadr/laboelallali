'use client';

/**
 * Hero quick-access tiles — the five shortcuts requested in demande n° 15,
 * in the order the lab set: bilan, prescription, results, Dr's WhatsApp, install.
 * Rendered inside the hero, right under the welcome text and ABOVE the three
 * existing fuchsia buttons (Appeler / Whatsapp / Localisation).
 *
 * Styling comes from the semantic `.hero-tile*` classes in `src/styles/index.css`,
 * not from Tailwind utilities: the tiles sit on the hero photo and need the
 * frosted-glass treatment plus a `color: !important` that beats the unlayered
 * global `a { color: var(--text-accent) }` rule. See the CSS for the full why.
 *
 * The install tile is `PWAInstallButton variant="tile"`, which RENDERS NOTHING
 * when the browser fires no `beforeinstallprompt` (iOS Safari, or an app already
 * installed): the grid then shows four tiles. That is the intended degradation —
 * a dead install button would be worse. Careful when checking this: the button
 * is ALWAYS visible under `npm run dev` (NODE_ENV check inside the component),
 * so the four-tile case only shows up in a production build.
 */
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { FlaskConical, Upload, FileText, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LAB_CONTACT } from '@/constants/contact';

const PWAInstallButton = dynamic<{ variant?: 'button' | 'banner' | 'footer' | 'icon' | 'tile' }>(
  () => import('@/components/features/pwa/PWAInstallButton'),
  { ssr: false }
);

export default function HeroShortcuts({ lang }: { lang: string }) {
  const { t } = useTranslation('common');

  // Internal destinations. `?tab=bilans` is required: the analyses page now opens
  // on the full catalogue by default (see docs/pages/analyses.md).
  const tiles = [
    {
      key: 'bilan',
      href: `/${lang}/analyses?tab=bilans`,
      icon: FlaskConical,
      label: t('hero_shortcuts.bilan'),
      desc: t('hero_shortcuts.bilan_desc'),
    },
    {
      key: 'prescription',
      href: `/${lang}/rendez-vous`,
      icon: Upload,
      label: t('hero_shortcuts.prescription'),
      desc: t('hero_shortcuts.prescription_desc'),
    },
    {
      key: 'results',
      href: `/${lang}/resultats`,
      icon: FileText,
      label: t('hero_shortcuts.results'),
      desc: t('hero_shortcuts.results_desc'),
    },
  ];

  return (
    <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
      {tiles.map(({ key, href, icon: Icon, label, desc }) => (
        <Link key={key} href={href} className="hero-tile">
          <span className="hero-tile__icon">
            <Icon size={22} aria-hidden="true" />
          </span>
          <span className="hero-tile__label">{label}</span>
          <span className="hero-tile__desc">{desc}</span>
        </Link>
      ))}

      {/* Dr El Allali's own WhatsApp — external link, so <a> and not <Link>.
          Distinct number from the front-desk WhatsApp button below. */}
      <a
        href={LAB_CONTACT.DR_WHATSAPP.url}
        target="_blank"
        rel="noopener noreferrer"
        className="hero-tile"
      >
        <span className="hero-tile__icon">
          <MessageCircle size={22} aria-hidden="true" />
        </span>
        <span className="hero-tile__label">{t('hero_shortcuts.wa_dr')}</span>
        <span className="hero-tile__desc">{t('hero_shortcuts.wa_dr_desc')}</span>
      </a>

      <PWAInstallButton variant="tile" />
    </div>
  );
}
