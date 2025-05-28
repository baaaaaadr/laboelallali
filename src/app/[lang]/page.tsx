import { Metadata } from 'next';

// Constants
import { 
  LAB_NAME, 
  LAB_ADDRESS
} from '@/constants/contact';

// Import the client component
import HomeClient from './HomeClient';

type PageProps = {
  params: { lang: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  // Define metadata based on language
  const metadata = {
    fr: {
      title: 'Laboratoire El Allali - Analyses Médicales',
      description: 'Laboratoire d\'analyses médicales à votre service',
      keywords: 'laboratoire, analyses médicales, biologie médicale, El Allali',
      og_title: 'Laboratoire El Allali',
      og_description: 'Votre partenaire santé pour des analyses médicales fiables'
    },
    ar: {
      title: 'المختبر الطبي العلالي - تحاليل طبية',
      description: 'مختبر التحاليل الطبية في خدمتكم',
      keywords: 'مختبر, تحاليل طبية, بيولوجيا طبية, العلالي',
      og_title: 'المختبر الطبي العلالي',
      og_description: 'شريككم الصحي لتحاليل طبية موثوقة'
    }
  };
  
  // Get metadata for current language or default to French
  const meta = metadata[lang as keyof typeof metadata] || metadata.fr;
  
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    openGraph: {
      title: meta.og_title,
      description: meta.og_description,
      type: 'website',
      locale: lang,
      siteName: 'Laboratoire El Allali',
    },
  };
}

export default async function Home({ params }: PageProps) {
  const { lang } = await params;
  // Log the language for debugging
  console.log(`Page rendered for language: ${lang}`);
  
  // Return the client component with the language prop
  return <HomeClient lang={lang} />;
}
