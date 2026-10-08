import type { Metadata } from 'next';

/**
 * « Emploi & Stage » — PUBLIC and indexable on purpose: a candidate who
 * searches « stage laboratoire Agadir » should land here. (Unlike the private
 * spaces, no `robots` tag, and the sitemap picks the route up by itself.)
 *
 * This SERVER layout only carries the page's title and description: `page.tsx`
 * is a client component, which cannot export metadata. The texts come from the
 * same locale files as the page (`emploi.meta_*`), never typed here.
 */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const code = lang === 'ar' ? 'ar' : 'fr';
  const dict = (await import(`../../../../public/locales/${code}/common.json`)).default as {
    emploi?: { meta_title?: string; meta_description?: string };
  };
  return {
    title: dict.emploi?.meta_title,
    description: dict.emploi?.meta_description,
  };
}

export default function EmploiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
