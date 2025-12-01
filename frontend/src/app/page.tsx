'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { api, Alert } from '@/lib/api';
import AlertList from '@/components/AlertList';
import { MapLayer } from '@/components/Map';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
});

const layerOptions: { id: MapLayer; label: string; icon: string; description: string; group?: string }[] = [
  { id: 'danger', label: 'Flood Risk', icon: '⚠️', description: 'Danger level based on multiple factors', group: 'current' },
  { id: 'rainfall', label: 'Rainfall', icon: '🌧️', description: 'Accumulated rainfall', group: 'current' },
  { id: 'temperature', label: 'Temperature', icon: '🌡️', description: 'Current temperature', group: 'current' },
  { id: 'humidity', label: 'Humidity', icon: '💧', description: 'Relative humidity', group: 'current' },
  { id: 'wind', label: 'Wind', icon: '💨', description: 'Wind speed', group: 'current' },
  { id: 'pressure', label: 'Pressure', icon: '📊', description: 'Atmospheric pressure', group: 'current' },
  { id: 'clouds', label: 'Clouds', icon: '☁️', description: 'Cloud cover', group: 'current' },
  { id: 'gtraffic', label: 'Traffic', icon: '🚗', description: 'Live traffic conditions from Google Maps', group: 'current' },
  { id: 'forecast1', label: 'Day 1', icon: '📅', description: 'Forecast for tomorrow', group: 'forecast' },
  { id: 'forecast2', label: 'Day 2', icon: '📅', description: 'Forecast for day 2', group: 'forecast' },
  { id: 'forecast3', label: 'Day 3', icon: '📅', description: 'Forecast for day 3', group: 'forecast' },
  { id: 'forecast4', label: 'Day 4', icon: '📅', description: 'Forecast for day 4', group: 'forecast' },
  { id: 'forecast5', label: 'Day 5', icon: '📅', description: 'Forecast for day 5', group: 'forecast' },
];

const layerLegends: Record<MapLayer, { colors: { color: string; label: string }[] }> = {
  danger: {
    colors: [
      { color: '#22c55e', label: 'Low (0-30)' },
      { color: '#eab308', label: 'Medium (31-60)' },
      { color: '#dc2626', label: 'High (61-100)' },
    ]
  },
  rainfall: {
    colors: [
      { color: '#f8fafc', label: '0mm' },
      { color: '#bfdbfe', label: '5mm' },
      { color: '#60a5fa', label: '10mm' },
      { color: '#2563eb', label: '15mm' },
      { color: '#1e3a8a', label: '20mm+' },
    ]
  },
  temperature: {
    colors: [
      { color: '#6366f1', label: '<20°C' },
      { color: '#3b82f6', label: '20-24°C' },
      { color: '#22c55e', label: '24-28°C' },
      { color: '#eab308', label: '28-32°C' },
      { color: '#f97316', label: '32-35°C' },
      { color: '#dc2626', label: '>35°C' },
    ]
  },
  humidity: {
    colors: [
      { color: '#dbeafe', label: '<50%' },
      { color: '#93c5fd', label: '50-60%' },
      { color: '#60a5fa', label: '60-70%' },
      { color: '#3b82f6', label: '70-80%' },
      { color: '#2563eb', label: '80-90%' },
      { color: '#1e40af', label: '>90%' },
    ]
  },
  wind: {
    colors: [
      { color: '#86efac', label: '<10 km/h' },
      { color: '#22c55e', label: '10-20 km/h' },
      { color: '#eab308', label: '20-30 km/h' },
      { color: '#f97316', label: '30-40 km/h' },
      { color: '#dc2626', label: '40-60 km/h' },
      { color: '#7c2d12', label: '>60 km/h' },
    ]
  },
  pressure: {
    colors: [
      { color: '#dc2626', label: '<1000 hPa' },
      { color: '#f97316', label: '1000-1005 hPa' },
      { color: '#eab308', label: '1005-1010 hPa' },
      { color: '#22c55e', label: '1010-1015 hPa' },
      { color: '#3b82f6', label: '1015-1020 hPa' },
      { color: '#1e40af', label: '>1020 hPa' },
    ]
  },
  clouds: {
    colors: [
      { color: '#f9fafb', label: 'Clear (<10%)' },
      { color: '#e5e7eb', label: 'Few (10-30%)' },
      { color: '#d1d5db', label: 'Scattered (30-50%)' },
      { color: '#9ca3af', label: 'Broken (50-70%)' },
      { color: '#6b7280', label: 'Mostly Cloudy (70-90%)' },
      { color: '#374151', label: 'Overcast (>90%)' },
    ]
  },
  gtraffic: {
    colors: [
      { color: '#30ac3e', label: 'Fast / Normal' },
      { color: '#f5a623', label: 'Slow moving' },
      { color: '#e34133', label: 'Heavy traffic' },
      { color: '#8b0000', label: 'Very slow / Blocked' },
    ]
  },
  forecast1: {
    colors: [
      { color: '#22c55e', label: 'Normal (<50mm)' },
      { color: '#eab308', label: 'Watch (50-100mm)' },
      { color: '#f97316', label: 'Warning (100-150mm)' },
      { color: '#dc2626', label: 'Emergency (>150mm)' },
    ]
  },
  forecast2: {
    colors: [
      { color: '#22c55e', label: 'Normal (<50mm)' },
      { color: '#eab308', label: 'Watch (50-100mm)' },
      { color: '#f97316', label: 'Warning (100-150mm)' },
      { color: '#dc2626', label: 'Emergency (>150mm)' },
    ]
  },
  forecast3: {
    colors: [
      { color: '#22c55e', label: 'Normal (<50mm)' },
      { color: '#eab308', label: 'Watch (50-100mm)' },
      { color: '#f97316', label: 'Warning (100-150mm)' },
      { color: '#dc2626', label: 'Emergency (>150mm)' },
    ]
  },
  forecast4: {
    colors: [
      { color: '#22c55e', label: 'Normal (<50mm)' },
      { color: '#eab308', label: 'Watch (50-100mm)' },
      { color: '#f97316', label: 'Warning (100-150mm)' },
      { color: '#dc2626', label: 'Emergency (>150mm)' },
    ]
  },
  forecast5: {
    colors: [
      { color: '#22c55e', label: 'Normal (<50mm)' },
      { color: '#eab308', label: 'Watch (50-100mm)' },
      { color: '#f97316', label: 'Warning (100-150mm)' },
      { color: '#dc2626', label: 'Emergency (>150mm)' },
    ]
  },
};

export type DangerFilter = 'all' | 'low' | 'medium' | 'high';

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedHours, setSelectedHours] = useState<number>(24);
  const [selectedLayer, setSelectedLayer] = useState<MapLayer>('danger');
  const [loading, setLoading] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [dangerFilter, setDangerFilter] = useState<DangerFilter>('all');

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
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  const currentLegend = layerLegends[selectedLayer];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Flood Monitoring Dashboard</h1>
          <p className="text-sm text-gray-600">Real-time weather and flood risk for all 25 districts of Sri Lanka</p>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-2 bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto">
          {/* Single Row: Current + Rainfall Period + Forecast */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Current Weather Layers */}
            <span className="text-xs font-medium text-gray-500 shrink-0">Current:</span>
            <div className="flex flex-wrap gap-1">
              {layerOptions.filter(l => l.group === 'current').map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setSelectedLayer(layer.id)}
                  title={layer.description}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                    selectedLayer === layer.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  <span>{layer.icon}</span>
                  <span className="hidden sm:inline">{layer.label}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>

            {/* Rainfall Period */}
            <span className="text-xs font-medium text-gray-500 shrink-0">Period:</span>
            <div className="flex rounded overflow-hidden border border-gray-300 shadow-sm">
              {[24, 48, 72].map((hours) => (
                <button
                  key={hours}
                  onClick={() => setSelectedHours(hours)}
                  className={`px-2 py-1 text-xs font-semibold transition-all ${
                    selectedHours === hours
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {hours}h
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>

            {/* Forecast Layers */}
            <span className="text-xs font-medium text-gray-500 shrink-0">Forecast:</span>
            <div className="flex flex-wrap gap-1">
              {layerOptions.filter(l => l.group === 'forecast').map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setSelectedLayer(layer.id)}
                  title={layer.description}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                    selectedLayer === layer.id
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">{layer.label}</span>
                  <span className="sm:hidden">{layer.id.replace('forecast', 'D')}</span>
                </button>
              ))}
            </div>

            {/* Legend Toggle */}
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 ml-auto"
            >
              {showLegend ? '▼' : '▶'} Legend
            </button>
          </div>

          {/* Legend */}
          {showLegend && (
            <div className="flex flex-wrap gap-2 text-xs bg-white p-2 rounded-lg border mt-2">
              <span className="font-medium text-gray-700 mr-2">
                {layerOptions.find(l => l.id === selectedLayer)?.label}:
              </span>
              {selectedLayer === 'danger' ? (
                <>
                  <button
                    onClick={() => setDangerFilter(dangerFilter === 'all' ? 'all' : 'all')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
                      dangerFilter === 'all' ? 'bg-gray-200 ring-2 ring-gray-400' : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className="w-4 h-4 rounded border border-gray-300 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"></span>
                    <span className="text-gray-600">All</span>
                  </button>
                  {currentLegend.colors.map((item, idx) => {
                    const filterValue = idx === 0 ? 'low' : idx === 1 ? 'medium' : 'high';
                    return (
                      <button
                        key={idx}
                        onClick={() => setDangerFilter(dangerFilter === filterValue ? 'all' : filterValue as DangerFilter)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
                          dangerFilter === filterValue ? 'bg-gray-200 ring-2 ring-blue-500' : 'hover:bg-gray-100'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded border border-gray-300"
                          style={{ backgroundColor: item.color }}
                        ></span>
                        <span className="text-gray-600">{item.label}</span>
                      </button>
                    );
                  })}
                </>
              ) : (
                currentLegend.colors.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: item.color }}
                    ></span>
                    <span className="text-gray-600">{item.label}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Map takes full remaining height */}
      <div className="flex-1 flex">
        {/* Map - Full width on mobile, 3/4 on desktop */}
        <div className="flex-1 p-4">
          <div className="h-full bg-white rounded-lg shadow-lg overflow-hidden">
            <Map
              onDistrictSelect={setSelectedDistrict}
              hours={selectedHours}
              layer={selectedLayer}
              dangerFilter={dangerFilter}
            />
          </div>
        </div>

        {/* Alerts Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:block w-80 p-4 pl-0">
          <div className="h-full">
            <AlertList
              alerts={selectedDistrict ? alerts.filter(a => a.district === selectedDistrict) : alerts}
              title={selectedDistrict ? `Alerts: ${selectedDistrict}` : 'Active Alerts'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
