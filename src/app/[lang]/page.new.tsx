import { Metadata } from 'next';
import { useTranslation } from '@/app/i18n';
import dynamic from 'next/dynamic';

// Import components with SSR disabled where needed
const HeroBanner = dynamic(
  () => import('@/components/features/home/HeroBanner'),
  { ssr: false }
);

type PageProps = {
  params: { lang: string };
};

export async function generateMetadata({ params: { lang } }: PageProps): Promise<Metadata> {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { t } = await useTranslation(lang, 'home');
  
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    keywords: t('meta.keywords'),
    openGraph: {
      title: t('meta.og_title'),
      description: t('meta.og_description'),
      type: 'website',
      locale: lang,
      siteName: 'Laboratoire El Allali',
    },
  };
}

export default async function Home({ params: { lang } }: PageProps) {
  const { t } = await useTranslation(lang, 'home');
  
  return (
    <main className="flex-1">
      <HeroBanner />
    </main>
  );
}
