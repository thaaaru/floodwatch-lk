'use client';

import { useEffect, useRef, useState } from 'react';

// Extend Window interface for Google Maps
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
  }
}

export default function GoogleMapsTraffic() {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trafficLayerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const initMap = () => {
      if (!window.google?.maps) {
        // Wait for Google Maps to load
        setTimeout(initMap, 100);
        return;
      }

      try {
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
          zoomControl: true,
        });

        // Add traffic layer
        trafficLayerRef.current = new window.google.maps.TrafficLayer();
        trafficLayerRef.current.setMap(googleMapRef.current);
      } catch (err) {
        console.error('Failed to initialize Google Maps:', err);
        setError('Failed to load Google Maps');
      }
    };

    // Start initialization
    initMap();

    return () => {
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <p className="text-gray-500 text-sm mt-2">Please check your internet connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading Google Maps Traffic...</p>
          </div>
        </div>
      )}

      {/* Map container */}
      <div ref={mapRef} className="w-full h-full rounded-lg" />

      {/* Traffic Legend */}
      {!isLoading && (
        <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10">
          <div className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Traffic Legend
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-2 rounded" style={{ backgroundColor: '#30ac3e' }}></div>
              <span className="text-gray-600">Fast / Normal flow</span>
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
              <div className="w-8 h-2 rounded" style={{ backgroundColor: '#811f1f' }}></div>
              <span className="text-gray-600">Very slow / Blocked</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t text-xs text-gray-400">
            Data: Google Maps
          </div>
        </div>
      )}
    </div>
  );
}
