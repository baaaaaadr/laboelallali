"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Map, TileLayer, Marker, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Import custom leaflet styles
import '@/styles/leaflet.css';

// Fix for Leaflet marker icons in Next.js
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Type for the window with Leaflet
declare global {
  interface Window {
    L?: {
      DomUtil?: {
        get?: (id: string) => HTMLElement | null;
      };
    };
  }
}

interface LocationMapProps {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
  zoom?: number;
  className?: string;
  height?: string | number;
}

const LocationMap: React.FC<LocationMapProps> = ({ 
  latitude, 
  longitude, 
  name, 
  address, 
  zoom = 16,
  className = '',
  height = '24rem'
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Generate a stable ID for the map container
  const mapContainerId = useMemo(
    () => `leaflet-map-${Math.random().toString(36).substr(2, 9)}`,
    []
  );

  // Cleanup function
  const cleanupMap = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.off();
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    tileLayerRef.current = null;
    markerRef.current = null;
  }, []);

  // Initialize the map
  const initializeMap = useCallback(async () => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    try {
      // Dynamic import of Leaflet
      const L = (await import('leaflet')).default;
      
      // Fix Leaflet marker icon issue in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x.src,
        iconUrl: markerIcon.src,
        shadowUrl: markerShadow.src,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      // Clean up any existing map
      cleanupMap();

      // Create map instance with better defaults
      const map = L.map(mapRef.current!, {
        center: [latitude, longitude] as LatLngExpression,
        zoom,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true, // Better performance for markers
        renderer: L.canvas() // Use canvas renderer for better performance
      });

      // Add zoom control with custom position
      L.control.zoom({
        position: 'topright'
      }).addTo(map);

      // Add tile layer with error handling
      tileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          minZoom: 2,
          crossOrigin: 'anonymous',
          errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==',
          detectRetina: true,
          tileSize: 256,
          subdomains: ['a', 'b', 'c'] // Use multiple subdomains for better loading
        }
      );

      // Set up event handlers
      const handleTileError = () => {
        console.warn('Failed to load map tiles');
        setHasError(true);
      };

      const handleTileLoad = () => {
        setIsLoading(false);
        setHasError(false);
      };

      tileLayerRef.current
        .on('tileerror', handleTileError)
        .on('tileload', handleTileLoad)
        .addTo(map);

      // Add marker with popup
      const popupContent = `
        <div class="p-2">
          <h3 class="font-semibold text-gray-800">${name}</h3>
          <p class="text-sm text-gray-600">${address}</p>
        </div>
      `;

      markerRef.current = L.marker([latitude, longitude], {
        title: name,
        alt: `Location of ${name}`,
        riseOnHover: true
      })
        .bindPopup(popupContent, {
          maxWidth: 300,
          minWidth: 200,
          className: 'custom-popup'
        })
        .openPopup()
        .addTo(map);

      mapInstanceRef.current = map;

      // Set up resize observer for container
      if (mapRef.current) {
        resizeObserverRef.current = new ResizeObserver(() => {
          map.invalidateSize();
        });
        resizeObserverRef.current.observe(mapRef.current);
      }

      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
        }
      };
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setHasError(true);
      setIsLoading(false);
    }
  }, [latitude, longitude, name, address, zoom, cleanupMap]);

  // Effect to handle map initialization and cleanup
  useEffect(() => {
    initializeMap();

    // Cleanup on unmount
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      cleanupMap();
    };
  }, [initializeMap, cleanupMap]);

  return (
    <div 
      className={`relative w-full ${className} isolate`}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="flex flex-col items-center">
            <div 
              className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"
              aria-hidden="true"
            ></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-yellow-50 p-4 z-10">
          <div className="text-center max-w-md">
            <div className="text-yellow-600 mb-2">
              <svg 
                className="w-12 h-12 mx-auto" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            </div>
            <h3 className="font-medium text-yellow-800 mb-1">Map Unavailable</h3>
            <p className="text-sm text-yellow-700">
              We're having trouble loading the map. Please check your internet connection or try refreshing the page.
            </p>
            <button
              onClick={() => {
                setIsLoading(true);
                setHasError(false);
                initializeMap();
              }}
              className="mt-3 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-md text-sm font-medium hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
              aria-label="Retry loading map"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      <div
        ref={mapRef}
        id={mapContainerId}
        className={`w-full h-full ${isLoading || hasError ? 'opacity-0' : 'opacity-100'}`}
        aria-label="Interactive map"
        aria-hidden={isLoading || hasError}
      />
    </div>
  );
};

export default React.memo(LocationMap, (prevProps, nextProps) => {
  return (
    prevProps.latitude === nextProps.latitude &&
    prevProps.longitude === nextProps.longitude &&
    prevProps.name === nextProps.name &&
    prevProps.address === nextProps.address &&
    prevProps.zoom === nextProps.zoom &&
    prevProps.className === nextProps.className &&
    prevProps.height === nextProps.height
  );
});