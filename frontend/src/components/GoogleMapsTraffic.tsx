'use client';

import { useEffect, useRef, useState } from 'react';

// Extend Window interface for Google Maps
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
  }
}

interface GoogleMapsTrafficProps {
  visible: boolean;
  onClose: () => void;
}

export default function GoogleMapsTraffic({ visible, onClose }: GoogleMapsTrafficProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trafficLayerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!visible || !mapRef.current) return;

    const initMap = () => {
      if (!window.google?.maps) {
        setTimeout(initMap, 100);
        return;
      }

      setIsLoading(false);

      // Sri Lanka center coordinates
      const sriLankaCenter = { lat: 7.8731, lng: 80.7718 };

      // Create the map
      googleMapRef.current = new window.google.maps.Map(mapRef.current!, {
        center: sriLankaCenter,
        zoom: 8,
        mapTypeId: 'roadmap',
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: window.google.maps.ControlPosition.TOP_RIGHT,
        },
        fullscreenControl: true,
        streetViewControl: false,
      });

      // Add traffic layer
      trafficLayerRef.current = new window.google.maps.TrafficLayer();
      trafficLayerRef.current.setMap(googleMapRef.current);
    };

    initMap();

    return () => {
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-[1001] bg-white rounded-lg overflow-hidden">
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white/95 backdrop-blur-sm px-4 py-2 flex items-center justify-between border-b shadow-sm">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="font-semibold text-gray-700">Google Maps Traffic</span>
          <span className="text-xs text-gray-500 ml-2">Real-time traffic conditions</span>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading Google Maps...</p>
          </div>
        </div>
      )}

      {/* Map container */}
      <div ref={mapRef} className="w-full h-full pt-12" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs">
        <div className="font-semibold text-gray-700 mb-2">Traffic Legend</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-2 rounded" style={{ backgroundColor: '#30ac3e' }}></div>
            <span className="text-gray-600">Fast / Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-2 rounded" style={{ backgroundColor: '#f5a623' }}></div>
            <span className="text-gray-600">Slow moving</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-2 rounded" style={{ backgroundColor: '#e34133' }}></div>
            <span className="text-gray-600">Heavy / Congested</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-2 rounded" style={{ backgroundColor: '#8b0000' }}></div>
            <span className="text-gray-600">Very slow / Blocked</span>
          </div>
        </div>
      </div>
    </div>
  );
}
