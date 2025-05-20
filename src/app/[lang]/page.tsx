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

export async function generateMetadata({ params: { lang } }: PageProps): Promise<Metadata> {
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

export default function Home({ params: { lang } }: PageProps) {
  // Log the language for debugging
  console.log(`Page rendered for language: ${lang}`);
  
  // Return the client component with the language prop
  return <HomeClient lang={lang} />;
}

  useEffect(() => {
    const handleScroll = () => {
      document.querySelectorAll('.fade-in-section').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight - 40) {
          el.classList.add('visible');
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // State for controlling the install popup
  const [showInstallPopup, setShowInstallPopup] = useState(false);

  // Show install popup after a delay if conditions are met
  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    // Check if popup was dismissed before
    const popupDismissed = localStorage.getItem('pwaInstallPopupDismissed');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    if (!popupDismissed && !isIOS) {
      const timer = setTimeout(() => {
        // Check if the PWA installation is available
        const isPWAInstalled = window.matchMedia('(display-mode: standalone)').matches;
        const hasInstallPrompt = !!(window as any).deferredInstallPrompt;
        
        if (!isPWAInstalled && hasInstallPrompt) {
          setShowInstallPopup(true);
          console.log('>>> PWA: Showing install popup');
        }
      }, 7000); // Show after 7 seconds

      return () => clearTimeout(timer);
    }
  }, []);

  const handlePopupDismiss = () => {
    localStorage.setItem('pwaInstallPopupDismissed', 'true');
    setShowInstallPopup(false);
    console.log('>>> PWA: Install popup dismissed by user');
  };

  return (
    <>
      {/* Hero Banner - Now truly full width with no constraints */}
      <HeroBanner />
      
      {/* PWA Install Button - Centered below hero banner */}
      <div className="container mx-auto px-4 py-6 text-center">
        <div className="inline-block">
          <PWAInstallButton variant="button" />
        </div>
      </div>
      
      {/* Container for the rest of the content */}
      <div className="container mx-auto px-4 py-8 pb-12">
        {/* Status Widget */}
        <div className="card flex flex-col md:flex-row items-center justify-between mb-8 gap-4 border-l-4 border-[#FF4081]">
  <div className="flex-1 w-full md:w-auto">
    <h3 className="text-lg font-bold text-[#800020] mb-1 flex items-center">
      <Clock size={20} className="mr-2 text-[#FF4081]" />
      {t('opening_hours')}
    </h3>
    <p className="text-sm text-gray-700">{t('opening_hours_text')}</p>
  </div>
  <div className="flex items-center justify-center md:ml-8">
    <div className={`${isOpen ? 'bg-green-700' : 'bg-[#B71C1C]'} text-white px-5 py-2 rounded-full font-semibold text-base shadow transition-colors duration-200 flex items-center gap-2`}>
      <span className={`w-3 h-3 ${isOpen ? 'bg-green-300' : 'bg-red-300'} rounded-full`}></span>
      {isOpen ? t('open') : t('closed')}
    </div>
  </div>
</div>
        
        {/* Why Choose Us Section */}
        <section id="why-us" className="mb-12 fade-in-section">
          <h2 className="text-2xl font-bold text-[#800020] mb-6">{t('why_choose_us')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <Award className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t('certified_quality')}</h3>
                  <p className="text-gray-600">{t('certified_quality_text')}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <FlaskConical className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t('state_of_the_art_equipment')}</h3>
                  <p className="text-gray-600">{t('state_of_the_art_equipment_text')}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <HeartPulse className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t('experienced_team')}</h3>
                  <p className="text-gray-600">{t('experienced_team_text')}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <CheckCircle className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t('dedicated_patient_service')}</h3>
                  <p className="text-gray-600">{t('dedicated_patient_service_text')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Services Section */}
        <section id="services" className="mb-12 fade-in-section">
          <h2 className="text-2xl font-bold text-[#800020] mb-6">{t('our_main_services')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[#F7E7EA]">
                  <FlaskConical className="text-[#800020]" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{t('blood_tests')}</h3>
                <p className="text-gray-600 mb-4">{t('blood_tests_text')}</p>
                <Link href="#" className="btn-text" aria-label={t('learn_more_about_blood_tests')}>
                  {t('learn_more')}
                  <span className="btn-chevron" aria-hidden="true">
                    <ChevronRight className="text-[#800020]" size={16} />
                  </span>
                </Link>
              </div>
            </div>
            
            <div className="card">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[#F7E7EA]">
                  <HeartPulse className="text-[#800020]" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{t('health_checks')}</h3>
                <p className="text-gray-600 mb-4">{t('health_checks_text')}</p>
                <Link href="#" className="btn-text" aria-label={t('learn_more_about_health_checks')}>
                  {t('learn_more')}
                  <span className="btn-chevron" aria-hidden="true">
                    <ChevronRight className="text-[#800020]" size={16} />
                  </span>
                </Link>
              </div>
            </div>
            
            <div className="card">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[#F7E7EA]">
                  <HomeIcon className="text-[#800020]" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{t('home_service')}</h3>
                <p className="text-gray-600 mb-4">{t('home_service_text')}</p>
                <Link href="#" className="btn-text" aria-label={t('learn_more_about_home_service')}>
                  {t('learn_more')}
                  <span className="btn-chevron" aria-hidden="true">
                    <ChevronRight className="text-[#800020]" size={16} />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>
        
        {/* Location Section */}
        <section id="contact" className="mb-12 fade-in-section">
          <h2 className="text-2xl font-bold text-[#800020] mb-6">{t('our_location')}</h2>
          <div className="card p-0 overflow-hidden">
              <div className="w-full" style={{ height: '400px' }}>
                <SimpleMap 
                  latitude={30.4173116} 
                  longitude={-9.5897999} 
                  markerText={`${labName} - ${labAddress}`}
                  height="100%"
                />
              </div>
            <div className="p-6">
              <h3 className="font-semibold text-xl mb-2">{labName}</h3>
              <p className="text-gray-600 mb-4">
                {labAddress}
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-wrap gap-4 items-center">
                  <a
                    href={LAB_COORDINATES.GOOGLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center min-w-[160px] h-12 px-6 bg-[var(--accent-fuchsia)] text-white font-semibold rounded-lg shadow transition-colors text-center text-lg hover:bg-[#F50057] focus:bg-[#F50057] gap-2"
                  >
                    <MapPin size={22} className="mr-2 -ml-1" />
                    {t('get_directions')}
                  </a>
                  <a
                    href={LAB_CONTACT.LANDLINE.url}
                    className="flex items-center justify-center min-w-[160px] h-12 px-6 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm transition-colors text-center text-lg hover:bg-gray-100 focus:bg-gray-100 gap-2"
                  >
                    <Info size={22} className="mr-2 -ml-1" />
                    {t('call_us')}
                  </a>
                   {/*<Link href="/rendez-vous" className="flex items-center justify-center min-w-[160px] h-12 px-6 bg-[var(--accent-fuchsia)] text-white font-semibold rounded-lg shadow transition-colors text-center text-lg hover:bg-[#F50057] focus:bg-[#F50057] gap-2">
                        <Navigation size={22} className="mr-2 -ml-1" />
                        RDV en Ligne
  </Link>*/}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      
      {/* PWA Install Popup */}
      {showInstallPopup && (
        <PWAInstallButton 
          variant="popup" 
          onPopupDismiss={handlePopupDismiss} 
        />
      )}
    </>
  );
}
