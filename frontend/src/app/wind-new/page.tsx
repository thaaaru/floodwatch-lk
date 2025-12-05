'use client';

/**
 * Wind Visualization Page (New)
 * Interactive wind map with multiple visualization modes
 * Uses the new multi-source wind data engine
 */

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamic import to avoid SSR issues with Leaflet
const WindMap = dynamic(
  () => import('@/components/wind/WindMap').then((mod) => mod.WindMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-white flex items-center gap-2">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
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
          <span>Loading wind map...</span>
        </div>
      </div>
    ),
  }
);

export default function WindNewPage() {
  return (
    <div className="h-screen w-full flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-900/95 border-b border-gray-700 px-4 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="h-6 w-px bg-gray-700" />
          <h1 className="text-white font-semibold flex items-center gap-2">
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
            Wind Map v2
          </h1>
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">New</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/wind"
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Old Version
          </Link>
          <span className="text-xs text-gray-400 hidden md:inline">
            FloodWatch.lk
          </span>
        </div>
      </header>

      {/* Map container */}
      <main className="flex-1 relative">
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <div className="text-white">Loading...</div>
            </div>
          }
        >
          <WindMap
            initialCenter={[7.8731, 80.7718]}
            initialZoom={7}
            className="w-full h-full"
          />
        </Suspense>
      </main>

      {/* Footer info */}
      <footer className="bg-gray-900/95 border-t border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-400 z-50">
        <div className="flex items-center gap-4">
          <span>Data: GFS (NOAA), ICON (DWD), ERA5 (ECMWF)</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">Updated hourly</span>
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Powered by Open-Meteo
          </a>
        </div>
      </footer>
    </div>
  );
}
