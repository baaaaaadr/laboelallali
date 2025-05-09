"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Search, User, ChevronDown } from 'lucide-react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="bg-[#800020] text-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          {/* Logo et nom */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <div className="bg-white p-1.5 rounded-md mr-2">
                <span className="text-[#800020] font-bold text-lg">L</span>
              </div>
              <h1 className="text-xl font-bold hidden sm:block">Laboratoire El Allali</h1>
            </Link>
          </div>

          {/* Navigation desktop */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/" className="hover:text-rose-200 transition-colors">
              Accueil
            </Link>

            <Link href="/rendez-vous" className="hover:text-rose-200 transition-colors font-semibold">
              Prendre RDV
            </Link>

            <Link href="/contact" className="hover:text-rose-200 transition-colors">
              Contact
            </Link>
          </nav>

          {/* Boutons d'action */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <button className="flex items-center text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded hover:bg-[#600018]">
                FR
                <ChevronDown size={16} className="ml-1" />
              </button>
            </div>
            <button className="p-3 rounded-full min-h-[44px] min-w-[44px] hover:bg-[#600018] flex items-center justify-center">
              <Search size={20} />
            </button>
            <button className="p-3 rounded-full min-h-[44px] min-w-[44px] hover:bg-[#600018] flex items-center justify-center">
              <User size={20} />
            </button>
            <button 
              className="md:hidden p-3 rounded-full min-h-[44px] min-w-[44px] hover:bg-[#600018] flex items-center justify-center"
              onClick={toggleMenu}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden">
          <div className={`bg-white h-full w-64 p-4 shadow-lg absolute right-0 mobile-menu-transition ${isMenuOpen ? 'open' : ''}`}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                <span className="bg-[#800020] text-white p-1 rounded text-lg font-bold">LA</span>
              </div>
              <button onClick={toggleMenu}>
                <X size={24} className="text-gray-700" />
              </button>
            </div>
            
            <nav className="flex flex-col space-y-4">
              <Link 
                href="/" 
                className="text-gray-800 hover:text-[#800020] transition-colors"
                onClick={toggleMenu}
              >
                Accueil
              </Link>

              <Link 
                href="/rendez-vous" 
                className="text-gray-800 hover:text-[#800020] font-semibold transition-colors"
                onClick={toggleMenu}
              >
                Prendre RDV
              </Link>

              <Link 
                href="/contact" 
                className="text-gray-800 hover:text-[#800020] transition-colors"
                onClick={toggleMenu}
              >
                Contact
              </Link>
              <div className="border-t border-gray-200 my-2 pt-2">
                <button className="w-full text-left text-gray-700 py-2">
                  Changer de langue: FR
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;