import type { Metadata } from 'next';

/**
 * « Scannez-moi » — reached by scanning, not by searching: kept out of search
 * engines (it would compete with the home page). Title from the locale files.
 */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const code = lang === 'ar' ? 'ar' : 'fr';
  const dict = (await import(`../../../../public/locales/${code}/common.json`)).default as {
    qr?: { meta_title?: string };
  };
  return {
    title: dict.qr?.meta_title,
    robots: { index: false, follow: true },
  };
}

export default function QrLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
