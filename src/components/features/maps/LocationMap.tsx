"use client";

import React, { useEffect, useRef } from 'react';
import type { Map } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationMapProps {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
}

const LocationMap = ({ latitude, longitude, name, address }: LocationMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  // Generate a unique id for the map container
  const mapContainerId = React.useMemo(() => `leaflet-map-${Math.random().toString(36).substr(2, 9)}`, []);

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
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => void })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });

      // Remove any previous map instance attached to this container (for hot reloads or remounts)
      if (mapRef.current && mapContainerId) {
        try {
          // Use Leaflet's DomUtil.get to find any existing map instance by id
          if ((window as unknown as { L?: { DomUtil?: { get?: (id: string) => unknown } } }).L && (window as unknown as { L?: { DomUtil?: { get?: (id: string) => unknown } } }).L!.DomUtil) {
            const container = (window as unknown as { L?: { DomUtil?: { get?: (id: string) => unknown } } }).L!.DomUtil!.get!(mapContainerId) as { _leaflet_id?: number | null } | null;
            if (container && container._leaflet_id) {
              // Remove the old map instance
              container._leaflet_id = null;
            }
          }
        } catch {}
        // Remove all child nodes from the container
        while (mapRef.current.firstChild) {
          mapRef.current.removeChild(mapRef.current.firstChild);
        }
      }
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
  }, [latitude, longitude, name, address, mapContainerId]);

  return (
    <div className="relative w-full h-64 md:h-96 z-0">
      <div ref={mapRef} id={mapContainerId} className="absolute inset-0" />
    </div>
  );
};

export default LocationMap;
