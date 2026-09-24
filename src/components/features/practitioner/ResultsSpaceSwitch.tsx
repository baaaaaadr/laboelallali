'use client';

/**
 * « Moi et ma famille | Mes patients » — the two halves of « Résultats » for an
 * account holding a doctor access. Owner's decision (24/09/2026): a doctor
 * looks for his patients' results under « Résultats », not in his profile.
 * Rendered at the top of /resultats and /mes-patients — whichever way the
 * doctor arrives (bottom bar, home tile, header), the other half is one tap
 * away. Renders nothing for everyone else, so both pages mount it
 * unconditionally.
 *
 * Two ROUTES, not one page with two tabs: the doctor's roster never shares
 * state with the family selector (docs/pages/mes-patients.md, invariant), and
 * each half keeps its own URL. So these are links.
 *
 * ⚠ Colours are inline styles: the global, unlayered `a { color: … }` beats
 * any Tailwind text utility on an <a> (same trap as the home hero tiles,
 * docs/pages/home.md). An inline style beats that non-important rule.
 */
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { readPractitioner } from '@/lib/results/identities';

export type ResultsSpace = 'mine' | 'patients';

export default function ResultsSpaceSwitch({ lang, current }: { lang: string; current: ResultsSpace }) {
  const { t } = useTranslation('common');
  const { userProfile } = useAuth();
  if (!readPractitioner(userProfile)) return null;

  const item = (space: ResultsSpace, href: string, label: string) => {
    const active = space === current;
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        data-testid={`results-space-${space}`}
        className="flex items-center justify-center min-h-[44px] px-3 rounded-lg text-sm text-center transition-colors"
        style={
          active
            ? {
                background: 'var(--background-default)',
                color: 'var(--color-bordeaux-primary)',
                border: '1px solid var(--border-default)',
                fontWeight: 700,
              }
            : { color: 'var(--text-secondary)', border: '1px solid transparent', fontWeight: 500 }
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label={t('mes_patients.switch_label', 'Quels résultats afficher ?')}
      data-testid="results-space-switch"
      className="grid grid-cols-2 gap-1 p-1 w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)]"
    >
      {item('mine', `/${lang}/resultats`, t('mes_patients.switch_mine', 'Moi et ma famille'))}
      {item('patients', `/${lang}/mes-patients`, t('mes_patients.nav', 'Mes patients'))}
    </nav>
  );
}
