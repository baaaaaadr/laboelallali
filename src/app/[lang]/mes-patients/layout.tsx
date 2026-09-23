import type { Metadata } from 'next';

/**
 * « Mes patients » — the prescribing doctors' space. Private: it shows named
 * medical results (see docs/pages/mes-patients.md).
 *
 * ⚠ The `noindex` lives in this SERVER layout because `page.tsx` is a client
 * component, which cannot export `metadata` (the lesson of /test-rdv, see
 * test-rdv2/layout.tsx): here the tag is in the very first HTML response.
 *
 * Three layers, none sufficient alone:
 *  1. this `robots` tag;
 *  2. the exclusion from the sitemap (`next-sitemap.config.js`);
 *  3. the `Disallow` rule of `robots.txt`.
 * The page renders nothing medical without a signed-in account holding a
 * practitioner access — these layers only keep its shell out of search engines.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function MesPatientsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
