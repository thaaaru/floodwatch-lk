'use client';

/**
 * WindControls Component
 * UI controls for wind visualization settings
 */

import React, { useState } from 'react';
import type { WindSource, WindVisualizationMode } from '@/lib/wind/types';

interface WindControlsProps {
  source: WindSource;
  visualizationMode: WindVisualizationMode;
  loading: boolean;
  onSourceChange: (source: WindSource) => void;
  onModeChange: (mode: WindVisualizationMode) => void;
  onRefresh: () => void;
}

const SOURCES: { value: WindSource; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Best available source' },
  { value: 'gfs', label: 'GFS', description: 'NOAA Global Forecast System' },
  { value: 'icon', label: 'ICON', description: 'DWD German Weather Service' },
  { value: 'era5', label: 'ERA5', description: 'ECMWF Reanalysis' },
];

const MODES: { value: WindVisualizationMode; label: string; icon: JSX.Element }[] = [
  {
    value: 'particles',
    label: 'Particles',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="4" cy="12" r="2" />
        <circle cx="12" cy="8" r="2" />
        <circle cx="20" cy="12" r="2" />
        <circle cx="8" cy="16" r="1.5" />
        <circle cx="16" cy="16" r="1.5" />
      </svg>
    ),
  },
  {
    value: 'vectors',
    label: 'Vectors',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="15 8 19 12 15 16" />
      </svg>
    ),
  },
  {
    value: 'heatmap',
    label: 'Heatmap',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="3" width="6" height="6" opacity="0.3" />
        <rect x="9" y="3" width="6" height="6" opacity="0.5" />
        <rect x="15" y="3" width="6" height="6" opacity="0.7" />
        <rect x="3" y="9" width="6" height="6" opacity="0.5" />
        <rect x="9" y="9" width="6" height="6" opacity="0.8" />
        <rect x="15" y="9" width="6" height="6" opacity="0.6" />
        <rect x="3" y="15" width="6" height="6" opacity="0.4" />
        <rect x="9" y="15" width="6" height="6" opacity="0.6" />
        <rect x="15" y="15" width="6" height="6" opacity="0.9" />
      </svg>
    ),
  },
  {
    value: 'low-bandwidth',
    label: 'Low BW',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12h4l3-9 4 18 3-9h4" />
      </svg>
    ),
  },
];

export function WindControls({
  source,
  visualizationMode,
  loading,
  onSourceChange,
  onModeChange,
  onRefresh,
}: WindControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-50">
      {/* Main control panel */}
      <div className="bg-gray-900/95 rounded-lg shadow-lg overflow-hidden">
        {/* Header with toggle */}
        <div
          className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.121 14.121A3 3 0 1 0 9.88 9.88m4.242 4.242L9.88 9.88m4.242 4.242L6.343 17.657a2 2 0 1 1-2.828-2.828l3.535-3.535m7.07-7.071 3.536 3.536a2 2 0 0 1-2.829 2.828l-3.535-3.535m0 0L9.88 9.88"
              />
            </svg>
            <span className="text-white font-medium text-sm">Wind</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Visualization mode buttons (always visible) */}
        <div className="px-2 py-1.5 border-t border-gray-700">
          <div className="flex gap-1">
            {MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => onModeChange(mode.value)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${
                  visualizationMode === mode.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                title={mode.label}
              >
                {mode.icon}
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Expanded controls */}
        {isExpanded && (
          <div className="px-3 py-2 border-t border-gray-700 space-y-3">
            {/* Data source selector */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Data Source</label>
              <div className="grid grid-cols-2 gap-1">
                {SOURCES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => onSourceChange(s.value)}
                    className={`px-2 py-1.5 rounded text-xs transition-colors ${
                      source === s.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                    title={s.description}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                loading
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {loading ? 'Loading...' : 'Refresh'}
            </button>

            {/* Source info */}
            <div className="text-[10px] text-gray-500 text-center">
              {SOURCES.find((s) => s.value === source)?.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WindControls;
