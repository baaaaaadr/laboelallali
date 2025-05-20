'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet with no SSR
const LazyMap = dynamic(
  () => import('leaflet').then((L) => {
    // Fix for default marker icons
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/images/leaflet/marker-icon-2x.png',
      iconUrl: '/images/leaflet/marker-icon.png',
      shadowUrl: '/images/leaflet/marker-shadow.png',
    });
    
    // Return the map component
    return function MapComponent({ mapRef, ...props }: any) {
      const { MapContainer, TileLayer, Marker, Popup } = require('react-leaflet');
      return (
        <MapContainer ref={mapRef} {...props}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Marker position={[props.center[0], props.center[1]]}>
            {props.children && <Popup>{props.children}</Popup>}
          </Marker>
        </MapContainer>
      );
    };
  }),
  { 
    ssr: false,
    loading: () => (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: '8px'
      }}>
        <p>Loading map...</p>
      </div>
    )
  }
);

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
  const mapRef = React.useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted flag
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div 
        className={className} 
        style={{ 
          height: typeof height === 'number' ? `${height}px` : height,
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px'
        }}
      >
        <p>Loading map...</p>
      </div>
    );
  }

  return (
    <div 
      className={className} 
      style={{ 
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <LazyMap 
        center={[latitude, longitude]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        ref={mapRef}
      >
        {markerText}
      </LazyMap>
    </div>
  );
};

export default SimpleMap;
