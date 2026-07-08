// src/app/[lang]/HomeClient.tsx
"use client";
import HeroBanner from '@/components/features/home/HeroBanner';
import ServicesHub from '@/components/features/home/ServicesHub';
import LabStatusWidget from '@/components/features/home/LabStatusWidget';
import CheckupReminder from '@/components/features/results/CheckupReminder';
import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";
import { useInView } from 'react-intersection-observer';
import { useTranslation } from 'react-i18next';

// Below-the-fold sections: no SSR + code-split → JS loaded only when near viewport
const WhyChooseUs = dynamic(() => import('@/components/features/home/WhyChooseUs'), { ssr: false });
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
        {/* Discreet open/closed badge overlaid on the hero (top-right desktop,
            top-centre mobile). Expands to the full hours card on hover / tap. */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 lg:left-auto lg:right-4 lg:translate-x-0">
          <LabStatusWidget />
        </div>
      </div>
      
      <div className="container mx-auto px-4 pb-12">
        {/* Personal checkup reminder — renders only for linked patients whose
            newest bilan is ≥ 6 months old (self-gated, null otherwise) */}
        <CheckupReminder lang={lang} variant="home" />
        {/* Flagship services hub (Résultats banner + quick-access grid) — eager, priority CTA */}
        <ServicesHub lang={lang} />
        <LazySection minHeight="300px"><WhyChooseUs /></LazySection>
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