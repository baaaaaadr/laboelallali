"use client";

import React, { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BilanItem } from './AnalysisCard';
import BilanCard from './BilanCard';

interface BilanCarouselProps {
  bilans: BilanItem[];
  lang: string;
  selectedBilans: BilanItem[];
  onSelectBilan: (bilan: BilanItem) => void;
  onShowDetails: (bilan: BilanItem) => void;
}

export function BilanCarousel({
  bilans,
  lang,
  selectedBilans,
  onSelectBilan,
  onShowDetails
}: BilanCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isArabic = lang === "ar";

  // Check if a bilan is selected
  const isBilanSelected = (bilan: BilanItem) => {
    return selectedBilans.some(selected => selected.id === bilan.id);
  };

  // Update scroll button states
  const updateScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10); // 10px tolerance
    }
  };

  // Handle scroll
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8; // Scroll 80% of visible width
      const targetScroll = direction === 'left' ? -scrollAmount : scrollAmount;

      scrollContainerRef.current.scrollBy({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  // Set up scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      updateScrollButtons();
      container.addEventListener('scroll', updateScrollButtons);
      window.addEventListener('resize', updateScrollButtons);

      return () => {
        container.removeEventListener('scroll', updateScrollButtons);
        window.removeEventListener('resize', updateScrollButtons);
      };
    }
  }, [bilans]);

  if (bilans.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Left arrow */}
      <button
        onClick={() => scroll(isArabic ? 'right' : 'left')}
        disabled={isArabic ? !canScrollRight : !canScrollLeft}
        className={`
          absolute ${isArabic ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 z-10
          h-10 w-10 rounded-lg
          bg-white/90 dark:bg-gray-800/90
          shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1)]
          flex items-center justify-center
          hover:bg-white dark:hover:bg-gray-700
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-[#E3004F] focus:ring-offset-2
          disabled:opacity-30 disabled:cursor-not-allowed
          ${isArabic ? '-mr-5' : '-ml-5'}
        `}
        aria-label={isArabic ? "التالي" : "Précédent"}
      >
        {isArabic ? (
          <ChevronRight className="h-6 w-6 text-[#E3004F]" />
        ) : (
          <ChevronLeft className="h-6 w-6 text-[#E3004F]" />
        )}
      </button>

      {/* Carousel container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide px-2 py-4 scroll-smooth"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {bilans.map((bilan) => (
          <div
            key={bilan.id}
            className="flex-shrink-0 w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
            style={{
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always'
            }}
          >
            <BilanCard
              bilan={bilan}
              lang={lang}
              isSelected={isBilanSelected(bilan)}
              onSelect={onSelectBilan}
              onShowDetails={onShowDetails}
            />
          </div>
        ))}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scroll(isArabic ? 'left' : 'right')}
        disabled={isArabic ? !canScrollLeft : !canScrollRight}
        className={`
          absolute ${isArabic ? 'left-0' : 'right-0'} top-1/2 -translate-y-1/2 z-10
          h-10 w-10 rounded-lg
          bg-white/90 dark:bg-gray-800/90
          shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1)]
          flex items-center justify-center
          hover:bg-white dark:hover:bg-gray-700
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-[#E3004F] focus:ring-offset-2
          disabled:opacity-30 disabled:cursor-not-allowed
          ${isArabic ? '-ml-5' : '-mr-5'}
        `}
        aria-label={isArabic ? "السابق" : "Suivant"}
      >
        {isArabic ? (
          <ChevronLeft className="h-6 w-6 text-[#E3004F]" />
        ) : (
          <ChevronRight className="h-6 w-6 text-[#E3004F]" />
        )}
      </button>

      {/* Custom CSS to hide scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

export default BilanCarousel;
