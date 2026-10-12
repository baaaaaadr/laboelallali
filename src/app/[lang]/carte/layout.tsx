import type { Metadata } from 'next';

/** Business card page: title and description from the locale files. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const code = lang === 'ar' ? 'ar' : 'fr';
  const dict = (await import(`../../../../public/locales/${code}/common.json`)).default as {
    carte?: { meta_title?: string; meta_description?: string };
  };
  return { title: dict.carte?.meta_title, description: dict.carte?.meta_description };
}

export default function CarteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
