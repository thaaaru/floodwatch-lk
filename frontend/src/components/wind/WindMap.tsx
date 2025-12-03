'use client';

/**
 * WindMap Component
 * Main container for wind visualization with Leaflet map
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import type { WindField, WindSource, BBox, WindVisualizationMode } from '@/lib/wind/types';
import { SRI_LANKA_EXTENDED_BBOX } from '@/lib/wind/config';
import { WindVectorsLayer } from './WindVectorsLayer';
import { WindParticlesLayer } from './WindParticlesLayer';
import { WindHeatmapLayer } from './WindHeatmapLayer';
import { WindLegend } from './WindLegend';
import { WindControls } from './WindControls';

interface WindMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
}

interface WindData {
  field: WindField | null;
  loading: boolean;
  error: string | null;
}

// Map event handler component
function MapEventHandler({
  onBoundsChange,
}: {
  onBoundsChange: (bbox: BBox) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      const bbox: BBox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];
      onBoundsChange(bbox);
    };

    map.on('moveend', handleMoveEnd);
    // Trigger initial bounds
    handleMoveEnd();

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, onBoundsChange]);

  return null;
}

export function WindMap({
  initialCenter = [7.8731, 80.7718], // Sri Lanka center
  initialZoom = 7,
  className = '',
}: WindMapProps) {
  const [windData, setWindData] = useState<WindData>({
    field: null,
    loading: false,
    error: null,
  });
  const [source, setSource] = useState<WindSource>('auto');
  const [visualizationMode, setVisualizationMode] = useState<WindVisualizationMode>('particles');
  const [currentBbox, setCurrentBbox] = useState<BBox>(SRI_LANKA_EXTENDED_BBOX);
  const [showLegend, setShowLegend] = useState(true);
  const mapRef = useRef<LeafletMap | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch wind data with debouncing
  // Always fetch the extended region for consistent particle coverage
  const fetchWindData = useCallback(async (_bbox: BBox, selectedSource: WindSource) => {
    // Clear any pending fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Debounce fetch
    fetchTimeoutRef.current = setTimeout(async () => {
      setWindData(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Always use extended bbox for full coverage, with lower resolution to reduce API calls
        const params = new URLSearchParams({
          bbox: SRI_LANKA_EXTENDED_BBOX.join(','),
          source: selectedSource,
          resolutionKm: '50', // Lower resolution for larger area
        });

        const response = await fetch(`/api/wind?${params}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch wind data');
        }

        const data = await response.json();

        setWindData({
          field: {
            metadata: data.metadata,
            points: data.points,
          },
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('Wind fetch error:', error);
        setWindData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    }, 300); // 300ms debounce
  }, []);

  // Handle bounds change - only track bounds, don't refetch
  // We use a fixed extended bbox for wind data to ensure full coverage
  const handleBoundsChange = useCallback((bbox: BBox) => {
    setCurrentBbox(bbox);
    // Don't refetch on every pan/zoom - data covers extended region
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchWindData(SRI_LANKA_EXTENDED_BBOX, source);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle source change
  const handleSourceChange = useCallback((newSource: WindSource) => {
    setSource(newSource);
    fetchWindData(SRI_LANKA_EXTENDED_BBOX, newSource);
  }, [fetchWindData]);

  // Handle visualization mode change
  const handleModeChange = useCallback((mode: WindVisualizationMode) => {
    setVisualizationMode(mode);
  }, []);

  // Refresh data
  const handleRefresh = useCallback(() => {
    fetchWindData(SRI_LANKA_EXTENDED_BBOX, source);
  }, [fetchWindData, source]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        className="w-full h-full z-0"
        ref={mapRef}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapEventHandler onBoundsChange={handleBoundsChange} />

        {/* Wind visualization layers */}
        {windData.field && !windData.loading && (
          <>
            {visualizationMode === 'vectors' && (
              <WindVectorsLayer field={windData.field} />
            )}
            {visualizationMode === 'particles' && (
              <WindParticlesLayer field={windData.field} />
            )}
            {visualizationMode === 'heatmap' && (
              <WindHeatmapLayer field={windData.field} />
            )}
            {visualizationMode === 'low-bandwidth' && (
              <WindVectorsLayer field={windData.field} sparse={true} />
            )}
          </>
        )}
      </MapContainer>

      {/* Controls overlay */}
      <WindControls
        source={source}
        visualizationMode={visualizationMode}
        loading={windData.loading}
        onSourceChange={handleSourceChange}
        onModeChange={handleModeChange}
        onRefresh={handleRefresh}
      />

      {/* Legend overlay */}
      {showLegend && windData.field && (
        <WindLegend
          minSpeed={windData.field.metadata.minSpeed}
          maxSpeed={windData.field.metadata.maxSpeed}
          onClose={() => setShowLegend(false)}
        />
      )}

      {/* Loading overlay */}
      {windData.loading && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gray-900/90 px-4 py-2 rounded-lg text-white flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading wind data...</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {windData.error && !windData.loading && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-900/90 px-4 py-2 rounded-lg text-white flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{windData.error}</span>
            <button
              onClick={handleRefresh}
              className="ml-2 px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Data info */}
      {windData.field && !windData.loading && (
        <div className="absolute bottom-4 left-4 bg-gray-900/80 px-3 py-2 rounded text-xs text-gray-300 z-40">
          <div>Source: {windData.field.metadata.source.toUpperCase()}</div>
          <div>Points: {windData.field.points.length}</div>
          <div>
            Speed: {windData.field.metadata.minSpeed.toFixed(1)} - {windData.field.metadata.maxSpeed.toFixed(1)} m/s
          </div>
        </div>
      )}
    </div>
  );
}

export default WindMap;
