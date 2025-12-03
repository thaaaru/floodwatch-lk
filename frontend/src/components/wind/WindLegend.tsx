'use client';

/**
 * WindLegend Component
 * Displays wind speed color legend with Beaufort scale
 */

import React from 'react';
import { WIND_SPEED_COLOR_STOPS, BEAUFORT_SCALE } from '@/lib/wind/config';

interface WindLegendProps {
  minSpeed?: number;
  maxSpeed?: number;
  onClose?: () => void;
}

export function WindLegend({
  minSpeed = 0,
  maxSpeed = 30,
  onClose,
}: WindLegendProps) {
  // Create gradient background
  const gradientStops = WIND_SPEED_COLOR_STOPS
    .map((stop) => `${stop.color} ${(stop.value / maxSpeed) * 100}%`)
    .join(', ');

  return (
    <div className="absolute bottom-4 right-4 bg-gray-900/90 rounded-lg shadow-lg p-3 z-40 min-w-[200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-white">Wind Speed</h4>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close legend"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Gradient bar */}
      <div
        className="h-4 rounded mb-1"
        style={{
          background: `linear-gradient(to right, ${gradientStops})`,
        }}
      />

      {/* Scale labels */}
      <div className="flex justify-between text-xs text-gray-300 mb-3">
        <span>{minSpeed} m/s</span>
        <span>{Math.round(maxSpeed / 2)} m/s</span>
        <span>{maxSpeed} m/s</span>
      </div>

      {/* Beaufort scale reference */}
      <div className="border-t border-gray-700 pt-2 mt-2">
        <div className="text-xs text-gray-400 mb-1">Beaufort Scale</div>
        <div className="space-y-0.5">
          {BEAUFORT_SCALE.slice(0, 8).map((b, index) => (
            <div
              key={index}
              className="flex items-center text-xs"
            >
              <div
                className="w-3 h-3 rounded-sm mr-2 flex-shrink-0"
                style={{ backgroundColor: WIND_SPEED_COLOR_STOPS[Math.min(index * 2, WIND_SPEED_COLOR_STOPS.length - 1)]?.color || '#888' }}
              />
              <span className="text-gray-300 truncate">
                {index}: {b.name}
              </span>
              <span className="text-gray-500 ml-auto text-[10px]">
                {b.min}-{b.max === Infinity ? '40+' : b.max}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Units toggle could go here */}
      <div className="text-[10px] text-gray-500 mt-2 text-center">
        1 m/s = 1.94 knots = 3.6 km/h
      </div>
    </div>
  );
}

export default WindLegend;
