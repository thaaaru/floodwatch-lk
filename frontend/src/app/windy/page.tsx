'use client';

import { useState, useEffect } from 'react';

type OverlayType =
  // Weather
  | 'rain' | 'wind' | 'temp' | 'clouds' | 'rh'
  // Precipitation & Radar
  | 'thunder' | 'radar' | 'satellite'
  // Clouds & Atmosphere
  | 'cBase' | 'lclouds' | 'mclouds' | 'hclouds' | 'cape'
  // Marine/Ocean
  | 'waves' | 'swell1' | 'swell2' | 'swell3' | 'wwaves' | 'currents'
  // Air Quality
  | 'pm2p5' | 'no2' | 'co' | 'aod550';

interface OverlayConfig {
  id: OverlayType;
  label: string;
  icon: string;
  category: string;
  description: string;
}

const overlays: OverlayConfig[] = [
  // Weather Essentials
  { id: 'rain', label: 'Rain & Thunder', icon: '🌧️', category: 'Weather', description: 'Precipitation forecast' },
  { id: 'wind', label: 'Wind Speed', icon: '💨', category: 'Weather', description: 'Wind speed & direction' },
  { id: 'temp', label: 'Temperature', icon: '🌡️', category: 'Weather', description: 'Air temperature' },
  { id: 'clouds', label: 'Cloud Cover', icon: '☁️', category: 'Weather', description: 'Total cloud coverage' },
  { id: 'rh', label: 'Humidity', icon: '💧', category: 'Weather', description: 'Relative humidity' },

  // Storms & Severe Weather
  { id: 'thunder', label: 'Lightning', icon: '⚡', category: 'Storms', description: 'Thunderstorm probability' },
  { id: 'radar', label: 'Radar', icon: '📡', category: 'Storms', description: 'Weather radar imagery' },
  { id: 'satellite', label: 'Satellite', icon: '🛰️', category: 'Storms', description: 'Satellite imagery' },
  { id: 'cape', label: 'CAPE', icon: '🌪️', category: 'Storms', description: 'Storm energy potential' },

  // Cloud Layers
  { id: 'cBase', label: 'Cloud Base', icon: '☁️', category: 'Clouds', description: 'Cloud base height' },
  { id: 'lclouds', label: 'Low Clouds', icon: '☁️', category: 'Clouds', description: 'Low-level clouds' },
  { id: 'mclouds', label: 'Mid Clouds', icon: '☁️', category: 'Clouds', description: 'Mid-level clouds' },
  { id: 'hclouds', label: 'High Clouds', icon: '☁️', category: 'Clouds', description: 'High-level clouds' },

  // Marine & Ocean
  { id: 'waves', label: 'Wave Height', icon: '🌊', category: 'Marine', description: 'Significant wave height' },
  { id: 'swell1', label: 'Primary Swell', icon: '🌊', category: 'Marine', description: 'Primary swell waves' },
  { id: 'swell2', label: 'Secondary Swell', icon: '🌊', category: 'Marine', description: 'Secondary swell waves' },
  { id: 'swell3', label: 'Tertiary Swell', icon: '🌊', category: 'Marine', description: 'Tertiary swell waves' },
  { id: 'wwaves', label: 'Wind Waves', icon: '🌊', category: 'Marine', description: 'Wind-generated waves' },
  { id: 'currents', label: 'Ocean Currents', icon: '🌊', category: 'Marine', description: 'Sea surface currents' },

  // Air Quality
  { id: 'pm2p5', label: 'PM2.5', icon: '😷', category: 'Air Quality', description: 'Fine particulate matter' },
  { id: 'no2', label: 'NO₂', icon: '🏭', category: 'Air Quality', description: 'Nitrogen dioxide' },
  { id: 'co', label: 'CO', icon: '🏭', category: 'Air Quality', description: 'Carbon monoxide' },
  { id: 'aod550', label: 'Aerosols', icon: '🌫️', category: 'Air Quality', description: 'Aerosol optical depth' },
];

export default function WindyPage() {
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>('rain');
  const [showPanel, setShowPanel] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('Weather');

  // Get categories
  const categories = Array.from(new Set(overlays.map(o => o.category)));

  // Prevent body scrolling and mobile bounce
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Center of Sri Lanka for full island view
  const lat = 7.8731; // Central Sri Lanka latitude
  const lon = 80.7718; // Central Sri Lanka longitude
  const zoom = 7; // Zoom level to show entire island

  const embedUrl = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&zoom=${zoom}&level=surface&overlay=${activeOverlay}&product=ecmwf&menu=&message=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;

  return (
    <div className="h-screen bg-slate-900 relative overflow-hidden" style={{ touchAction: 'none' }}>
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex-shrink-0" style={{ touchAction: 'auto' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-white">Sri Lanka Weather Map</h1>
              <span className="text-slate-400">•</span>
              <span className="text-sm text-blue-400 flex items-center gap-1">
                {overlays.find(o => o.id === activeOverlay)?.icon}
                <span>{overlays.find(o => o.id === activeOverlay)?.label}</span>
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Layers</span>
            <span className="text-xs text-slate-500">({overlays.length})</span>
          </button>
        </div>
      </div>

      {/* Floating Layer Panel */}
      {showPanel && (
        <div className="absolute top-16 right-4 bottom-4 z-10 bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-xl max-w-xs w-80 flex flex-col overflow-hidden" style={{ touchAction: 'auto' }}>
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-700 flex-shrink-0" style={{ touchAction: 'auto' }}>
            <div className="text-xs font-semibold text-white mb-2">Weather Layers</div>
            {/* Category Tabs */}
            <div className="flex gap-1 flex-wrap">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-2 py-1 text-xs rounded whitespace-nowrap transition-all ${
                    activeCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Layer List */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex flex-col gap-1">
              {overlays
                .filter(o => o.category === activeCategory)
                .map((overlay) => (
                  <button
                    key={overlay.id}
                    onClick={() => setActiveOverlay(overlay.id)}
                    className={`flex items-start gap-2 px-3 py-2 rounded-md text-sm transition-all ${
                      activeOverlay === overlay.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">{overlay.icon}</span>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{overlay.label}</div>
                      <div className={`text-xs mt-0.5 ${
                        activeOverlay === overlay.id ? 'text-blue-100' : 'text-slate-400'
                      }`}>
                        {overlay.description}
                      </div>
                    </div>
                    {activeOverlay === overlay.id && (
                      <svg className="w-4 h-4 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
            </div>
          </div>

          {/* Footer Info */}
          <div className="px-3 py-2 border-t border-slate-700 text-xs text-slate-400 flex-shrink-0">
            {overlays.filter(o => o.category === activeCategory).length} layers in {activeCategory}
          </div>
        </div>
      )}

      {/* Windy Embed - Full Height */}
      <div className="w-full overflow-hidden" style={{ height: 'calc(100vh - 56px)', touchAction: 'auto' }}>
        <iframe
          key={activeOverlay}
          src={embedUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          title="Sri Lanka Weather Map - Full Island View"
          style={{ touchAction: 'auto' }}
        />
      </div>
    </div>
  );
}
