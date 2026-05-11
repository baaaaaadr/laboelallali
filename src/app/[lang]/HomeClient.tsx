// src/app/[lang]/HomeClient.tsx
"use client";
import HeroBanner from '@/components/features/home/HeroBanner';
import { Clock } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";
import { useInView } from 'react-intersection-observer';
import { useTranslation } from 'react-i18next';
import { useLabStatus } from '@/hooks/useLabStatus';

// Below-the-fold sections: no SSR + code-split → JS loaded only when near viewport
const WhyChooseUs = dynamic(() => import('@/components/features/home/WhyChooseUs'), { ssr: false });
const MainServices = dynamic(() => import('@/components/features/home/MainServices'), { ssr: false });
const LocationInfo = dynamic(() => import('@/components/features/home/LocationInfo'), { ssr: false });
const PracticalInfo = dynamic(() => import('@/components/features/home/PracticalInfo'), { ssr: false });
const ContactModal = dynamic(() => import('@/components/ui/ContactModal'), { ssr: false });

function LazySection({ children, minHeight = '200px' }: { children: React.ReactNode; minHeight?: string }) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '350px 0px' });
  return (
    <div ref={ref} style={{ minHeight: inView ? undefined : minHeight }}>
      {inView && children}
    </div>
  );
}

export default function HomeClient({ lang }: { lang: string }) {
  const { t, i18n } = useTranslation(['common', 'glabo']);
  const labStatus = useLabStatus();

  // Ensure i18n language is set based on the lang prop
  useEffect(() => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  // Track if we're on the client side for map rendering
  const [isClient, setIsClient] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const [isMobile, setIsMobile] = useState(true); // Default to true for SSR safety
  
  useEffect(() => {
    setIsClient(true);
    // Determine actual device on mount
    const checkMobile = () => {
      const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const widthMobile = window.innerWidth < 768;
      setIsMobile(uaMobile || widthMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleCallClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    // Si ce n'est pas un mobile, on bloque le comportement par défaut et on ouvre la modale
    if (!isMobile) {
      e.preventDefault();
      e.stopPropagation();
      setIsContactModalOpen(true);
    }
  };

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
      {/* Hero Banner with Opening Hours Widget */}
      <div className="relative">
        <HeroBanner onCallClick={handleCallClick} isMobile={isMobile} />
        {/* Opening Hours Widget - Positioned at top right on large screens, always visible */}
        <div className="lg:absolute lg:top-4 lg:right-4 lg:z-20 lg:max-w-80 w-full">
          <div className="card bg-[var(--background-card)]/95 backdrop-blur-sm shadow-lg border border-[var(--border-default)] mx-4 mt-4 lg:mx-0 lg:mt-0">
            <div className="flex flex-col md:flex-row lg:flex-col items-center justify-between gap-4">
              <div className="flex-1 w-full">
                <h3 className="text-lg font-bold text-[var(--color-bordeaux-primary)] mb-1 flex items-center">
                  <Clock size={20} className="mr-2 text-[var(--color-fuchsia-accent)]" />
                  {t('opening_hours')}
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">{t('opening_hours_text')}</p>
              </div>
              <div className="flex flex-col items-center justify-center gap-2" suppressHydrationWarning>
                <div 
                  className={`${labStatus.isOpen ? 'bg-[var(--status-success)]' : 'bg-[var(--status-error)]'} text-white px-5 py-2 rounded-lg font-semibold text-base shadow transition-colors flex items-center gap-2`}
                  suppressHydrationWarning
                >
                  <span className={`w-3 h-3 ${labStatus.isOpen ? 'opacity-100' : 'opacity-80'} bg-white rounded-lg ${labStatus.isOpen ? 'animate-pulse' : ''}`} suppressHydrationWarning></span>
                  {labStatus.statusText || '...'}
                </div>
                {/* Only show countdown on client side to prevent hydration mismatch */}
                {labStatus.isClient && labStatus.countdownText && (
                  <div className="text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] dark:bg-[var(--background-tertiary)] px-3 py-1 rounded-lg border border-[var(--border-default)]">
                    {labStatus.countdownText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 pb-12">
        <LazySection minHeight="300px"><WhyChooseUs /></LazySection>
        <LazySection minHeight="400px"><MainServices lang={lang} /></LazySection>
        <LazySection minHeight="400px"><LocationInfo isClient={isClient} isMobile={isMobile} onCallClick={handleCallClick} /></LazySection>
        <LazySection minHeight="300px"><PracticalInfo lang={lang} /></LazySection>
      </div>

      <ContactModal 
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </>
  );
}