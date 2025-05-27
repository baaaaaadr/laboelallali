"use client";

import React, { useState, useEffect } from 'react';

const ImageTest = () => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  return (
    <div className="p-8 bg-white dark:bg-[var(--background-default)] rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-[var(--color-bordeaux-primary)] dark:text-[var(--text-primary)]">
        Image Test
      </h2>
      
      <div className="space-y-6">
        <div className="border border-gray-300 dark:border-gray-700 p-4 rounded-md">
          <h3 className="font-medium mb-2 text-[var(--text-primary)]">1. Direct Image Tag (No Overlay)</h3>
          <div className="relative h-64 overflow-hidden rounded-md">
            <img
              src="/images/hero-banner.jpg"
              alt="Hero Banner"
              className="object-cover w-full h-full"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-100 text-red-700 p-4">
                Error loading image
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Status: {imageLoaded ? "✅ Image loaded successfully" : imageError ? "❌ Failed to load" : "⏳ Loading..."}
          </p>
        </div>
        
        <div className="border border-gray-300 dark:border-gray-700 p-4 rounded-md">
          <h3 className="font-medium mb-2 text-[var(--text-primary)]">2. With Semi-Transparent Overlay</h3>
          <div className="relative h-64 overflow-hidden rounded-md">
            <img
              src="/images/hero-banner.jpg"
              alt="Hero Banner with Overlay"
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-[var(--color-bordeaux-primary)] bg-opacity-50 dark:bg-opacity-60"></div>
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xl">
              This text is over a 50% opacity overlay
            </div>
          </div>
        </div>
        
        <div className="border border-gray-300 dark:border-gray-700 p-4 rounded-md">
          <h3 className="font-medium mb-2 text-[var(--text-primary)]">3. Using Next.js Image (if available)</h3>
          <div className="relative h-64 overflow-hidden rounded-md">
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              Add Next Image component here if desired
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
        <h3 className="font-medium mb-2 text-yellow-800 dark:text-yellow-200">Troubleshooting Notes</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
          <li>Confirm the image exists at: <code>/public/images/hero-banner.jpg</code></li>
          <li>Check browser console for any errors</li>
          <li>Verify that public assets are being served correctly</li>
          <li>Try a different image format (PNG, WEBP) if JPG isn't working</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageTest;
