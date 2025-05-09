"use client";

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

interface LocationMapProps {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
}

const LocationMap = ({ latitude, longitude, name, address }: LocationMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Only import Leaflet on the client side
    if (typeof window === 'undefined') {
      return;
    }

    // Dynamic import of Leaflet
    const initializeMap = async () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      // Import Leaflet dynamically
      const L = (await import('leaflet')).default;
      
      // Fix Leaflet marker icon issue in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });

      // Create map instance
      const map = L.map(mapRef.current).setView([latitude, longitude], 16);
      mapInstanceRef.current = map;

      // Add tile layer (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add marker with popup
      const marker = L.marker([latitude, longitude]).addTo(map);
      marker.bindPopup(`
        <strong>${name}</strong><br>
        ${address}
      `).openPopup();
    };

    initializeMap();

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, name, address]);

  return (
    <div className="relative w-full h-64 md:h-96 z-0">
      <div ref={mapRef} className="absolute inset-0" />
    </div>
  );
};

export default LocationMap;
