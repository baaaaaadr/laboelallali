import { Metadata } from 'next';

// Metadata generation function remains on the server side
export async function generateMetadata({ params }: { params: { lang: string } }): Promise<Metadata> {
  const { lang } = params;
  
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
