import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const HeroBanner = () => {
  return (
    <div className="relative overflow-hidden mb-8">
      {/* Banner Image */}
      <div className="absolute inset-0 z-0">
        <Image 
          src="/images/hero-banner.jpg" 
          alt="Laboratoire El Allali Banner" 
          fill 
          priority
          className="object-cover" 
          sizes="100vw"
        />
        {/* Overlay to ensure text is readable */}
        <div className="absolute inset-0 bg-[#800020] opacity-60"></div>
      </div>
      
      {/* Content */}
      <div className="container mx-auto px-2 py-16 sm:px-4 sm:py-20 md:py-32 relative z-10">
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 break-words text-white">
            Bienvenue au Laboratoire El Allali
          </h1>
          <p className="text-base sm:text-lg md:text-xl mb-8 opacity-90 break-words text-white">
            Votre santé, notre priorité. Analyses médicales précises et rapides à Agadir.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 w-full">
            <Link href="#services" className="btn-primary min-h-[44px] min-w-[44px] text-center w-full sm:w-auto">
              Nos Services
            </Link>
            <Link href="#contact" className="btn-outline bg-transparent text-white border-white hover:bg-white hover:text-[#800020] hover:border-white min-h-[44px] min-w-[44px] text-center w-full sm:w-auto">
              Nous Contacter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;