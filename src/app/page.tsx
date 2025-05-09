"use client";

import HeroBanner from '@/components/features/home/HeroBanner';
import { Clock, CheckCircle, Award, FlaskConical, HeartPulse, HomeIcon, Info, MapPin, ChevronRight, Navigation } from 'lucide-react';
import Link from 'next/link';
import { useEffect, Suspense } from "react";
import dynamic from 'next/dynamic';

// Dynamically import the map component with SSR disabled
const LocationMap = dynamic(
  () => import('@/components/features/maps/LocationMap'),
  { ssr: false }
);

export default function HomePage() {
  // On peut faire un check pour savoir si le labo est ouvert actuellement
  const currentHour = new Date().getHours();
  const currentDay = new Date().getDay(); // 0 = Dimanche, 6 = Samedi
  const isWeekday = currentDay > 0 && currentDay < 6;
  const isSaturday = currentDay === 6;
  const isSunday = currentDay === 0;
  
  const isOpen = (isWeekday && currentHour >= 7.5 && currentHour < 18.5) || 
                 (isSaturday && currentHour >= 7.5 && currentHour < 18.5) ||
                 (isSunday && currentHour >= 8 && currentHour < 18);

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

  return (
    <>
      {/* Hero Banner */}
      <HeroBanner />
      
      <div className="container mx-auto px-4 pb-12">
        {/* Status Widget */}
        <div className="card flex flex-col md:flex-row items-center justify-between mb-8 gap-4 border-l-4 border-[#FF4081]">
  <div className="flex-1 w-full md:w-auto">
    <h3 className="text-lg font-bold text-[#800020] mb-1 flex items-center">
      <Clock size={20} className="mr-2 text-[#FF4081]" />
      Horaires d&apos;ouverture
    </h3>
    <p className="text-sm text-gray-700">Lun-Sam : 7h30 - 18h30<br/>Dim : 08h00 - 18h00</p>
  </div>
  <div className="flex items-center justify-center md:ml-8">
    <div className={`${isOpen ? 'bg-green-700' : 'bg-[#B71C1C]'} text-white px-5 py-2 rounded-full font-semibold text-base shadow transition-colors duration-200 flex items-center gap-2`}>
      <span className={`w-3 h-3 ${isOpen ? 'bg-green-300' : 'bg-red-300'} rounded-full`}></span>
      {isOpen ? 'Ouvert' : 'Fermé'}
    </div>
  </div>
</div>
        
        {/* Why Choose Us Section */}
        <section id="why-us" className="mb-12 fade-in-section">
          <h2 className="text-2xl font-bold text-[#800020] mb-6">Pourquoi Nous Choisir?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <Award className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Qualité Certifiée</h3>
                  <p className="text-gray-600">Laboratoire accrédité aux normes internationales pour des résultats fiables.</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <FlaskConical className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Équipement de Pointe</h3>
                  <p className="text-gray-600">Technologies avancées pour des analyses précises et rapides.</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <HeartPulse className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Équipe Expérimentée</h3>
                  <p className="text-gray-600">Biologistes et techniciens hautement qualifiés à votre service.</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-start">
                <div className="bg-[#F7E7EA] p-3 rounded-full mr-3">
                  <CheckCircle className="text-[#FF4081]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Service Patient Dédié</h3>
                  <p className="text-gray-600">Attention personnalisée et accompagnement à chaque étape.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Services Section */}
        <section id="services" className="mb-12 fade-in-section">
          <h2 className="text-2xl font-bold text-[#800020] mb-6">Nos Services Principaux</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[#F7E7EA]">
                  <FlaskConical className="text-[#800020]" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">Analyses de Sang</h3>
                <p className="text-gray-600 mb-4">Analyses complètes et spécialisées avec résultats rapides et précis.</p>
                <Link href="#" className="btn-text" aria-label="En savoir plus sur les analyses de sang">
                  En savoir plus
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
                <h3 className="text-xl font-semibold mb-2">Bilans de Santé</h3>
                <p className="text-gray-600 mb-4">Bilans personnalisés pour le suivi préventif de votre santé.</p>
                <Link href="#" className="btn-text" aria-label="En savoir plus sur les bilans de santé">
                  En savoir plus
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
                <h3 className="text-xl font-semibold mb-2">GLABO - À Domicile</h3>
                <p className="text-gray-600 mb-4">Service de prélèvement à domicile pour votre confort et sécurité.</p>
                <Link href="#" className="btn-text" aria-label="En savoir plus sur le service à domicile">
                  En savoir plus
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
          <h2 className="text-2xl font-bold text-[#800020] mb-6">Notre Localisation</h2>
          <div className="card p-0 overflow-hidden">
            <div className="bg-gray-200 relative">
              <Suspense fallback={<div className="h-64 md:h-96 flex items-center justify-center"><MapPin size={48} className="text-gray-500" /> <span className="ml-2 text-gray-500">Chargement de la carte...</span></div>}>
                <LocationMap 
                  latitude={30.4173116} 
                  longitude={-9.589799900000001} 
                  name="Laboratoire El Allali d&apos;Analyses Médicales" 
                  address="CC86+W3, Agadir, Maroc" 
                />
              </Suspense>
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-xl mb-2">Laboratoire El Allali</h3>
              <p className="text-gray-600 mb-4">
                61 Bis, Rue de Marrakech, 80020, Agadir, Maroc
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-wrap gap-4 items-center">
                  <a
                    href="https://maps.app.goo.gl/NUiSsY2AQjeNHcDeA"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center min-w-[160px] h-12 px-6 bg-[var(--accent-fuchsia)] text-white font-semibold rounded-lg shadow transition-colors text-center text-lg hover:bg-[#F50057] focus:bg-[#F50057] gap-2"
                  >
                    <MapPin size={22} className="mr-2 -ml-1" />
                    Itinéraire
                  </a>
                  <a
                    href="https://www.google.com/maps/dir/?api=1&destination=61+Bis+Rue+de+Marrakech+80020+Agadir"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center min-w-[220px] h-12 px-6 bg-[var(--accent-fuchsia)] text-white font-semibold rounded-lg shadow transition-colors text-center text-lg hover:bg-[#F50057] focus:bg-[#F50057] gap-2"
                  >
                    <Navigation size={22} className="mr-2 -ml-1" />
                    Naviguer vers le labo
                  </a>
                </div>
                <a 
                  href="https://wa.me/212634293900" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="mr-2" viewBox="0 0 16 16">
                      <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                    </svg>
                    WhatsApp
                  </span>
                </a>
              </div>
            </div>
          </div>
        </section>
        
        {/* Info Pratiques Preview */}
        <section id="info" className="mb-12">
          <h2 className="text-2xl font-bold text-[#800020] mb-6">Infos Pratiques</h2>
          <div className="card">
            <div className="flex items-start">
              <div className="bg-[#F7E7EA] p-3 rounded-full mr-4">
                <Info className="text-[#800020]" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Conseils pour vos analyses</h3>
                <div className="space-y-3 mb-4">
                  <p className="text-gray-600">Pour la plupart des analyses sanguines, un jeûne de 8 à 12 heures est recommandé. N&apos;hésitez pas à nous consulter pour des instructions spécifiques à votre analyse.</p>
                  <p className="text-gray-600">Apportez votre pièce d&apos;identité, votre ordonnance et votre carte d&apos;assurance lors de votre visite.</p>
                </div>
                <Link href="#" className="btn-text">
                  Plus d&apos;informations
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}