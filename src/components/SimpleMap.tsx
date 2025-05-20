'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

interface SimpleMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  markerText?: string;
  className?: string;
  height?: string | number;
}

const SimpleMap: React.FC<SimpleMapProps> = ({
  latitude,
  longitude,
  zoom = 16,
  markerText,
  className = '',
  height = '400px',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize map and handle updates
  useEffect(() => {
    if (!isClient || !mapContainerRef.current) return;

    // Store the container reference in a variable to avoid null checks
    const mapContainer = mapContainerRef.current;
    if (!mapContainer) return;

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then((L_instance) => {
      try {
        // Fix for default marker icons
        // @ts-ignore
        delete L_instance.Icon.Default.prototype._getIconUrl;
        L_instance.Icon.Default.mergeOptions({
          iconRetinaUrl: '/images/leaflet/marker-icon-2x.png',
          iconUrl: '/images/leaflet/marker-icon.png',
          shadowUrl: '/images/leaflet/marker-shadow.png',
        });

        // Initialize map if not already done
        if (!mapRef.current) {
          const mapInstance = L_instance.map(mapContainer, {
            center: [latitude, longitude],
            zoom: zoom,
            zoomControl: true,
          });

          // Add OpenStreetMap tile layer
          L_instance.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(mapInstance);

          // Store map instance
          mapRef.current = mapInstance;
        } else {
          // Update map view if coordinates change
          mapRef.current.setView([latitude, longitude], zoom);
        }

        // Add or update marker
        if (mapRef.current) {
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          } else {
            markerRef.current = L_instance.marker([latitude, longitude]).addTo(mapRef.current);
          }

          // Handle popup
          if (markerText && markerRef.current) {
            markerRef.current.bindPopup(markerText).openPopup();
          } else if (markerRef.current) {
            markerRef.current.unbindPopup();
          }
        }
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    }).catch(error => {
      console.error('Failed to load Leaflet:', error);
    });

    // Handle window resize
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    // Add resize listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Cleanup map on unmount if needed
      // if (mapRef.current) {
      //   mapRef.current.remove();
      //   mapRef.current = null;
      //   markerRef.current = null;
      // }
    };
  }, [isClient, latitude, longitude, zoom, markerText]);

  // Handle container classes and inline styles
  const containerStyle: React.CSSProperties = {
    height: height,
    width: '100%',
    borderRadius: '8px',
    overflow: 'hidden',
  };

  return (
    <div 
      ref={mapContainerRef} 
      style={containerStyle}
      className={`leaflet-container ${className}`}
      aria-label="Interactive map"
    />
  );
};

export default SimpleMap;
