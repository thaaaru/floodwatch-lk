'use client';

import { useEffect, useState } from 'react';
import { api, DistrictForecast, DailyForecast } from '@/lib/api';
import { getAlertBadgeClass } from '@/lib/districts';

const getAlertColor = (level: string): string => {
  switch (level) {
    case 'red': return 'bg-red-100 border-red-400 text-red-800';
    case 'orange': return 'bg-orange-100 border-orange-400 text-orange-800';
    case 'yellow': return 'bg-yellow-100 border-yellow-400 text-yellow-800';
    default: return 'bg-green-100 border-green-400 text-green-800';
  }
};

const getRainfallBarWidth = (rainfall: number): string => {
  // Max width at 150mm
  const width = Math.min((rainfall / 150) * 100, 100);
  return `${width}%`;
};

const getRainfallBarColor = (level: string): string => {
  switch (level) {
    case 'red': return 'bg-red-500';
    case 'orange': return 'bg-orange-500';
    case 'yellow': return 'bg-yellow-500';
    default: return 'bg-green-500';
  }
};

function ForecastCard({ forecast, day }: { forecast: DailyForecast; day: number }) {
  const isToday = day === 0;

  return (
    <div className={`p-3 rounded-lg border ${getAlertColor(forecast.forecast_alert_level)} ${isToday ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex justify-between items-center mb-2">
        <div>
          <p className="font-semibold text-sm">{forecast.day_name}</p>
          <p className="text-xs opacity-75">{new Date(forecast.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getAlertBadgeClass(forecast.forecast_alert_level)}`}>
          {forecast.forecast_alert_level.toUpperCase()}
        </span>
      </div>

      {/* Rainfall bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span>Rain</span>
          <span className="font-semibold">{forecast.total_rainfall_mm}mm</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getRainfallBarColor(forecast.forecast_alert_level)} transition-all`}
            style={{ width: getRainfallBarWidth(forecast.total_rainfall_mm) }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className="flex items-center gap-1">
          <span>Prob:</span>
          <span className="font-medium">{forecast.max_precipitation_probability}%</span>
        </div>
        {forecast.temp_min_c !== null && forecast.temp_max_c !== null && (
          <div className="flex items-center gap-1">
            <span>Temp:</span>
            <span className="font-medium">{forecast.temp_min_c}-{forecast.temp_max_c}°C</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DistrictForecastRow({ district }: { district: DistrictForecast }) {
  const [expanded, setExpanded] = useState(false);

  // Get max alert level for quick overview
  const maxAlert = district.forecast_daily.reduce((max, day) => {
    const levels = ['green', 'yellow', 'orange', 'red'];
    return levels.indexOf(day.forecast_alert_level) > levels.indexOf(max) ? day.forecast_alert_level : max;
  }, 'green');

  return (
    <div className="bg-white rounded-lg shadow mb-3 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${getRainfallBarColor(maxAlert)}`} />
          <span className="font-medium text-gray-900">{district.district}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Next 24h: {district.forecast_precip_24h_mm.toFixed(1)}mm
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-3">
            {district.forecast_daily.map((day, idx) => (
              <ForecastCard key={day.date} forecast={day} day={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ForecastPage() {
  const [forecasts, setForecasts] = useState<DistrictForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rainfall'>('rainfall');

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const data = await api.getAllForecast();
        setForecasts(data);
      } catch (err) {
        setError('Failed to load forecast data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchForecast();
  }, []);

  const filteredForecasts = forecasts
    .filter(f => f.district.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'rainfall') {
        return b.forecast_precip_24h_mm - a.forecast_precip_24h_mm;
      }
      return a.district.localeCompare(b.district);
    });

  // Count locations with alerts
  const alertCounts = forecasts.reduce((counts, district) => {
    district.forecast_daily.forEach(day => {
      if (day.forecast_alert_level !== 'green') {
        counts[day.forecast_alert_level] = (counts[day.forecast_alert_level] || 0) + 1;
      }
    });
    return counts;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-red-50 text-red-700 px-6 py-4 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">5-Day Weather Forecast</h1>
          <p className="text-gray-600">Predicted rainfall and flood risk for all locations in Sri Lanka</p>
        </div>

        {/* Alert Summary */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Forecast Alert Summary (Next 5 Days)</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-red-500"></span>
              <span className="text-sm">Emergency: {alertCounts.red || 0} location-days</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-orange-500"></span>
              <span className="text-sm">Warning: {alertCounts.orange || 0} location-days</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-yellow-500"></span>
              <span className="text-sm">Watch: {alertCounts.yellow || 0} location-days</span>
            </div>
          </div>
          <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-600">
            <strong>Alert Levels:</strong> Green (&lt;50mm/day) | Yellow (50-100mm) | Orange (100-150mm) | Red (&gt;150mm)
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('rainfall')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'rainfall' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
              }`}
            >
              Sort by Rainfall
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'name' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
              }`}
            >
              Sort by Name
            </button>
          </div>
        </div>

        {/* Forecast List */}
        <div>
          {filteredForecasts.map((district) => (
            <DistrictForecastRow key={district.district} district={district} />
          ))}
        </div>

        {filteredForecasts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No locations found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}
