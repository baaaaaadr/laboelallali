'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons - only on client side
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/images/leaflet/marker-icon-2x.png',
    iconUrl: '/images/leaflet/marker-icon.png',
    shadowUrl: '/images/leaflet/marker-shadow.png',
  });
}

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
  const [isMounted, setIsMounted] = useState(false);

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
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={[latitude, longitude]}>
          {markerText && <Popup>{markerText}</Popup>}
        </Marker>
      </MapContainer>
    </div>
  );
};

export default SimpleMap;
