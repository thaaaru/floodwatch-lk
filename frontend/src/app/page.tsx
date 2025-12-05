'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { api, Alert } from '@/lib/api';
import AlertList from '@/components/AlertList';
import NewsFeed from '@/components/NewsFeed';
import RiverNetworkStatus from '@/components/RiverNetworkStatus';
import { MapLayer } from '@/components/Map';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-slate-100 rounded-2xl flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        <span className="text-sm text-slate-500">Loading map...</span>
      </div>
    </div>
  )
});

const layerOptions: { id: MapLayer; label: string; icon: string; description: string; group: string }[] = [
  { id: 'danger', label: 'Flood Risk', icon: '⚠️', description: 'Danger level based on multiple factors', group: 'current' },
  { id: 'rainfall', label: 'Rainfall', icon: '🌧️', description: 'Accumulated rainfall', group: 'current' },
  { id: 'temperature', label: 'Temp', icon: '🌡️', description: 'Current temperature', group: 'current' },
  { id: 'humidity', label: 'Humidity', icon: '💧', description: 'Relative humidity', group: 'current' },
  { id: 'wind', label: 'Wind', icon: '💨', description: 'Wind speed', group: 'current' },
  { id: 'pressure', label: 'Pressure', icon: '📊', description: 'Atmospheric pressure', group: 'current' },
  { id: 'forecast1', label: '+1 Day', icon: '📅', description: 'Tomorrow forecast', group: 'forecast' },
  { id: 'forecast2', label: '+2 Days', icon: '📅', description: 'Day 2 forecast', group: 'forecast' },
  { id: 'forecast3', label: '+3 Days', icon: '📅', description: 'Day 3 forecast', group: 'forecast' },
  { id: 'forecast4', label: '+4 Days', icon: '📅', description: 'Day 4 forecast', group: 'forecast' },
  { id: 'forecast5', label: '+5 Days', icon: '📅', description: 'Day 5 forecast', group: 'forecast' },
];

const layerLegends: Record<MapLayer, { colors: { color: string; label: string }[] }> = {
  danger: {
    colors: [
      { color: '#10b981', label: 'Low' },
      { color: '#f59e0b', label: 'Medium' },
      { color: '#ef4444', label: 'High' },
    ]
  },
  rainfall: {
    colors: [
      { color: '#ffffff', label: '0' },
      { color: '#bae6fd', label: '1-5' },
      { color: '#38bdf8', label: '10-25' },
      { color: '#0284c7', label: '50-100' },
      { color: '#0c4a6e', label: '>150mm' },
    ]
  },
  temperature: {
    colors: [
      { color: '#6366f1', label: '<20°' },
      { color: '#22c55e', label: '24-28°' },
      { color: '#f97316', label: '32-35°' },
      { color: '#dc2626', label: '>35°' },
    ]
  },
  humidity: {
    colors: [
      { color: '#dbeafe', label: '<50%' },
      { color: '#60a5fa', label: '60-70%' },
      { color: '#2563eb', label: '80-90%' },
      { color: '#1e40af', label: '>90%' },
    ]
  },
  wind: {
    colors: [
      { color: '#86efac', label: '<10km/h' },
      { color: '#eab308', label: '20-30km/h' },
      { color: '#dc2626', label: '>40km/h' },
    ]
  },
  pressure: {
    colors: [
      { color: '#dc2626', label: '<1000hPa' },
      { color: '#22c55e', label: '1010-1015' },
      { color: '#1e40af', label: '>1020hPa' },
    ]
  },
  forecast1: { colors: [{ color: '#22c55e', label: 'Normal' }, { color: '#eab308', label: 'Watch' }, { color: '#dc2626', label: 'Warning' }] },
  forecast2: { colors: [{ color: '#22c55e', label: 'Normal' }, { color: '#eab308', label: 'Watch' }, { color: '#dc2626', label: 'Warning' }] },
  forecast3: { colors: [{ color: '#22c55e', label: 'Normal' }, { color: '#eab308', label: 'Watch' }, { color: '#dc2626', label: 'Warning' }] },
  forecast4: { colors: [{ color: '#22c55e', label: 'Normal' }, { color: '#eab308', label: 'Watch' }, { color: '#dc2626', label: 'Warning' }] },
  forecast5: { colors: [{ color: '#22c55e', label: 'Normal' }, { color: '#eab308', label: 'Watch' }, { color: '#dc2626', label: 'Warning' }] },
};

export type DangerFilter = 'all' | 'low' | 'medium' | 'high';

interface RainSummary {
  districtsWithRain: number;
  totalDistricts: number;
  maxRainfall: number;
  maxRainfallDistrict: string;
  totalRainfall: number;
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedHours, setSelectedHours] = useState<number>(24);
  const [selectedLayer, setSelectedLayer] = useState<MapLayer>('danger');
  const [loading, setLoading] = useState(true);
  const [dangerFilter, setDangerFilter] = useState<DangerFilter>('all');
  const [rainSummary, setRainSummary] = useState<RainSummary | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [showMobilePanel, setShowMobilePanel] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await api.getActiveAlerts();
        setAlerts(data);
      } catch (err) {
        console.error('Failed to fetch alerts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
    // No auto-refresh - data is cached on backend, manual refresh only
  }, []);

  // Get user location for Windy map focus
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        () => {
          // User denied or error - use default Sri Lanka center
          setUserLocation(null);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
      );
    }
  }, []);

  // Fetch rain summary
  useEffect(() => {
    const fetchRainSummary = async () => {
      try {
        const weatherData = await api.getAllWeather(selectedHours);
        if (!weatherData || weatherData.length === 0) return;

        const rainfallKey = selectedHours === 24 ? 'rainfall_24h_mm' :
                          selectedHours === 48 ? 'rainfall_48h_mm' : 'rainfall_72h_mm';

        const districtsWithRain = weatherData.filter((d: any) => (d[rainfallKey] || 0) > 0);
        const maxDistrict = weatherData.reduce((max: any, d: any) =>
          (d[rainfallKey] || 0) > (max[rainfallKey] || 0) ? d : max, weatherData[0]);
        const totalRainfall = weatherData.reduce((sum: number, d: any) =>
          sum + (d[rainfallKey] || 0), 0);

        setRainSummary({
          districtsWithRain: districtsWithRain.length,
          totalDistricts: weatherData.length,
          maxRainfall: Number(maxDistrict?.[rainfallKey]) || 0,
          maxRainfallDistrict: maxDistrict?.district || 'Unknown',
          totalRainfall: totalRainfall,
        });
      } catch (err) {
        console.error('Failed to fetch rain summary:', err);
      }
    };
    fetchRainSummary();
    // No auto-refresh - data is cached on backend for 60 minutes
  }, [selectedHours]);

  const currentLegend = layerLegends[selectedLayer];
  const currentLayers = layerOptions.filter(l => l.group === 'current');
  const forecastLayers = layerOptions.filter(l => l.group === 'forecast');

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50">
      {/* Map Controls - Floating on top of map */}
      <div className="flex-1 relative">
        {/* Map - Full Screen */}
        <div className="absolute inset-0 p-4">
          <div className="h-full card overflow-hidden">
            <Map
              onDistrictSelect={setSelectedDistrict}
              hours={selectedHours}
              layer={selectedLayer}
              dangerFilter={dangerFilter}
              userLocation={userLocation}
            />
          </div>
        </div>

        {/* Top Controls Overlay */}
        <div className="absolute top-6 left-6 right-6 z-[1000] flex flex-col gap-3">
          {/* Layer Selection */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/30 p-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Current Layers */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 hidden sm:inline">Current</span>
                <div className="flex flex-wrap gap-1">
                  {currentLayers.map((layer) => (
                    <button
                      key={layer.id}
                      onClick={() => setSelectedLayer(layer.id)}
                      title={layer.description}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                        selectedLayer === layer.id
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{layer.icon}</span>
                      <span className="hidden sm:inline">{layer.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />

              {/* Time Period */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 hidden sm:inline">Period</span>
                <div className="flex rounded-lg overflow-hidden border border-slate-200">
                  {[24, 48, 72].map((hours) => (
                    <button
                      key={hours}
                      onClick={() => setSelectedHours(hours)}
                      className={`px-2.5 py-1.5 text-xs font-semibold transition-all ${
                        selectedHours === hours
                          ? 'bg-brand-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {hours}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-slate-200 hidden md:block" />

              {/* Forecast Layers */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 hidden md:inline">Forecast</span>
                <div className="flex flex-wrap gap-1">
                  {forecastLayers.map((layer) => (
                    <button
                      key={layer.id}
                      onClick={() => setSelectedLayer(layer.id)}
                      title={layer.description}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        selectedLayer === layer.id
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {layer.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/30 p-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-slate-600">
              {layerOptions.find(l => l.id === selectedLayer)?.label}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedLayer === 'danger' && (
                <button
                  onClick={() => setDangerFilter('all')}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
                    dangerFilter === 'all' ? 'bg-slate-200 ring-1 ring-slate-400' : 'hover:bg-slate-100'
                  }`}
                >
                  <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" />
                  <span className="text-slate-600">All</span>
                </button>
              )}
              {currentLegend.colors.map((item, idx) => {
                const filterValue = selectedLayer === 'danger'
                  ? (idx === 0 ? 'low' : idx === 1 ? 'medium' : 'high')
                  : null;
                return (
                  <button
                    key={idx}
                    onClick={() => filterValue && setDangerFilter(dangerFilter === filterValue ? 'all' : filterValue as DangerFilter)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
                      selectedLayer === 'danger' && dangerFilter === filterValue
                        ? 'bg-slate-200 ring-1 ring-brand-500'
                        : selectedLayer === 'danger' ? 'hover:bg-slate-100 cursor-pointer' : ''
                    }`}
                    disabled={selectedLayer !== 'danger'}
                  >
                    <span
                      className="w-3 h-3 rounded-sm border border-slate-200"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-600">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Floating Info Panel - Both Desktop & Mobile */}
        <div>
          {/* Floating Action Button */}
          <button
            onClick={() => setShowMobilePanel(!showMobilePanel)}
            className="fixed bottom-6 right-6 z-[2000] w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
          >
            {showMobilePanel ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          {/* Floating Panel */}
          {showMobilePanel && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/50 z-[1500] animate-in fade-in duration-200"
                onClick={() => setShowMobilePanel(false)}
              />

              {/* Panel Content - Right side on desktop, bottom on mobile */}
              <div className="fixed lg:top-20 lg:right-6 lg:bottom-6 lg:w-96 inset-x-0 bottom-0 lg:inset-x-auto z-[1600] bg-white/10 backdrop-blur-md lg:rounded-2xl rounded-t-3xl shadow-2xl lg:max-h-none max-h-[85vh] flex flex-col border border-white/20 animate-in lg:slide-in-from-right slide-in-from-bottom duration-300">
                {/* Handle */}
                <div className="flex items-center justify-center pt-3 pb-2">
                  <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
                </div>

                {/* Panel Header */}
                <div className="px-4 pb-3 border-b border-white/20">
                  <h2 className="text-lg font-semibold text-slate-900">Dashboard Info</h2>
                  <p className="text-xs text-slate-700 mt-1">Real-time flood monitoring data</p>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* River Network Status - Mobile */}
                  <RiverNetworkStatus />

                  {/* Alerts */}
                  {alerts.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between bg-red-500/10">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <h2 className="text-sm font-semibold text-slate-800">Active Alerts</h2>
                        </div>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600 font-semibold">
                          {alerts.length}
                        </span>
                      </div>
                      <div className="p-3 max-h-[250px] overflow-y-auto">
                        <AlertList
                          alerts={selectedDistrict ? alerts.filter(a => a.district === selectedDistrict) : alerts}
                          compact
                        />
                      </div>
                    </div>
                  )}

                  {/* No Alerts */}
                  {alerts.length === 0 && !loading && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 px-4 py-3 flex items-center gap-2 text-sm text-emerald-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>No active alerts</span>
                    </div>
                  )}

                  {/* News Feed */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-white/20 flex items-center gap-2">
                      <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                      <h2 className="text-sm font-semibold text-slate-800">News & Updates</h2>
                    </div>
                    <div className="p-3 max-h-[300px] overflow-y-auto">
                      <NewsFeed maxItems={5} compact />
                    </div>
                  </div>

                  {/* Windy Link */}
                  <a
                    href="/windy"
                    className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 flex items-center justify-between group hover:bg-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🌀</span>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Windy Weather Map</div>
                        <div className="text-xs text-slate-500">Real-time wind & rain visualization</div>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
