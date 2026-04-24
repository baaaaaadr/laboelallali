"use client";

import React, { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

interface TabsNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isRtl?: boolean;
}

export function TabsNavigation({
  tabs,
  activeTab,
  onTabChange,
  isRtl = false
}: TabsNavigationProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Update scroll button states
  const updateScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  // Handle scroll
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200; // Scroll 200px
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
  }, [tabs]);

  return (
    <div className="relative">
      {/* Left arrow - Desktop only, visible when can scroll */}
      {canScrollLeft && (
        <button
          onClick={() => scroll(isRtl ? 'right' : 'left')}
          className={`
            hidden lg:flex
            absolute ${isRtl ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 z-10
            h-8 w-8 rounded-lg
            bg-[var(--background-default)]
            shadow-md
            items-center justify-center
            hover:bg-[var(--background-hover)]
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-[#E3004F] focus:ring-offset-2
            ${isRtl ? '-mr-4' : '-ml-4'}
          `}
          aria-label={isRtl ? "التالي" : "Précédent"}
        >
          {isRtl ? (
            <ChevronRight className="h-5 w-5 text-[#E3004F]" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-[#E3004F]" />
          )}
        </button>
      )}

      {/* Tabs container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-1 py-2 scroll-smooth"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;

          // DEBUG: Log tab state
          console.log(`🔍 TAB DEBUG: "${tab.label}"`, {
            tabId: tab.id,
            activeTab: activeTab,
            isActive: isActive,
            shouldBeRose: isActive,
            classes: isActive ? 'bg-[#E3004F] text-white (ROSE BRAND)' : 'bg-[var(--background-card)] text-[var(--text-primary)] (CARD)'
          });

          return (
            <button
              key={tab.id}
              onClick={() => {
                console.log(`🖱️ TAB CLICKED: "${tab.label}" (${tab.id})`);
                onTabChange(tab.id);
              }}
              className={`
                flex items-center gap-2 px-8 py-3 rounded-lg
                whitespace-nowrap flex-shrink-0 min-w-max
                min-h-[44px]
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-[#E3004F] focus:ring-offset-2
                ${isActive
                  ? 'bg-[#E3004F] text-white shadow-md font-semibold'
                  : 'bg-[var(--background-card)] text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[#E3004F]'
                }
              `}
              style={isActive ? { backgroundColor: '#E3004F', color: 'white' } : {}}
            >
              <IconComponent className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#E3004F]'}`} />
              <span className="text-sm">
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-1 ${isActive ? 'text-white/90' : 'text-[var(--text-secondary)]'}`}>
                    ({tab.count})
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right arrow - Desktop only, visible when can scroll */}
      {canScrollRight && (
        <button
          onClick={() => scroll(isRtl ? 'left' : 'right')}
          className={`
            hidden lg:flex
            absolute ${isRtl ? 'left-0' : 'right-0'} top-1/2 -translate-y-1/2 z-10
            h-8 w-8 rounded-lg
            bg-[var(--background-default)]
            shadow-md
            items-center justify-center
            hover:bg-[var(--background-hover)]
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-[#E3004F] focus:ring-offset-2
            ${isRtl ? '-ml-4' : '-mr-4'}
          `}
          aria-label={isRtl ? "السابق" : "Suivant"}
        >
          {isRtl ? (
            <ChevronLeft className="h-5 w-5 text-[#E3004F]" />
          ) : (
            <ChevronRight className="h-5 w-5 text-[#E3004F]" />
          )}
        </button>
      )}

      {/* Custom CSS to hide scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

export default TabsNavigation;
