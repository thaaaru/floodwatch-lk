'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import { WeatherSummary, DistrictForecast, RiverStation, MarineCondition, api } from '@/lib/api';
import { getAlertColor } from '@/lib/districts';
import { riverPaths } from '@/lib/rivers';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RadarFrame {
  time: number;
  path: string;
}

interface RadarData {
  past: RadarFrame[];
  nowcast: RadarFrame[];
}

interface SatelliteData {
  infrared: RadarFrame[];
}

type OverlayType = 'radar' | 'satellite' | 'none';

export type MapLayer = 'rainfall' | 'danger' | 'temperature' | 'humidity' | 'wind' | 'pressure' | 'clouds' | 'forecast1' | 'forecast2' | 'forecast3' | 'forecast4' | 'forecast5';

interface MapControllerProps {
  weatherData: WeatherSummary[];
}

function MapController({ weatherData }: MapControllerProps) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map, weatherData]);
  return null;
}

// Color scale functions for different data types
function getTemperatureColor(temp: number | null): string {
  if (temp === null) return '#9ca3af';
  if (temp >= 35) return '#dc2626';
  if (temp >= 32) return '#f97316';
  if (temp >= 28) return '#eab308';
  if (temp >= 24) return '#22c55e';
  if (temp >= 20) return '#3b82f6';
  return '#6366f1';
}

function getHumidityColor(humidity: number | null): string {
  if (humidity === null) return '#9ca3af';
  if (humidity >= 90) return '#1e40af';
  if (humidity >= 80) return '#2563eb';
  if (humidity >= 70) return '#3b82f6';
  if (humidity >= 60) return '#60a5fa';
  if (humidity >= 50) return '#93c5fd';
  return '#dbeafe';
}

function getWindColor(speed: number | null): string {
  if (speed === null) return '#9ca3af';
  if (speed >= 60) return '#7c2d12';
  if (speed >= 40) return '#dc2626';
  if (speed >= 30) return '#f97316';
  if (speed >= 20) return '#eab308';
  if (speed >= 10) return '#22c55e';
  return '#86efac';
}

function getPressureColor(pressure: number | null): string {
  if (pressure === null) return '#9ca3af';
  if (pressure >= 1020) return '#1e40af';
  if (pressure >= 1015) return '#3b82f6';
  if (pressure >= 1010) return '#22c55e';
  if (pressure >= 1005) return '#eab308';
  if (pressure >= 1000) return '#f97316';
  return '#dc2626';
}

function getCloudColor(cover: number | null): string {
  if (cover === null) return '#9ca3af';
  if (cover >= 90) return '#374151';
  if (cover >= 70) return '#6b7280';
  if (cover >= 50) return '#9ca3af';
  if (cover >= 30) return '#d1d5db';
  if (cover >= 10) return '#e5e7eb';
  return '#f9fafb';
}

function getDangerColor(level: string): string {
  if (level === 'high') return '#dc2626';
  if (level === 'medium') return '#eab308';
  return '#22c55e';
}

function getRiverStatusColor(status: string): string {
  switch (status) {
    case 'alert': return '#dc2626';   // Red - alert level
    case 'rising': return '#f97316';  // Orange - water rising
    case 'falling': return '#22c55e'; // Green - water falling
    case 'normal': return '#3b82f6';  // Blue - normal
    default: return '#9ca3af';        // Gray - unknown
  }
}

function getMarineRiskColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'high': return '#dc2626';    // Red - dangerous waves
    case 'medium': return '#f97316';  // Orange - moderate waves
    case 'low': return '#22c55e';     // Green - calm seas
    default: return '#9ca3af';        // Gray - unknown
  }
}

function getForecastAlertColor(level: string): string {
  if (level === 'red') return '#dc2626';
  if (level === 'orange') return '#f97316';
  if (level === 'yellow') return '#eab308';
  return '#22c55e';
}

// Get alert symbol based on level
function getAlertSymbol(level: string): string {
  switch (level) {
    case 'red': return '⚠';     // Warning triangle
    case 'orange': return '!';   // Exclamation
    case 'yellow': return '◆';   // Diamond
    default: return '●';         // Circle for green/normal
  }
}

// Create small custom marker icon
function createAlertIcon(color: string, alertLevel: string): L.DivIcon {
  const size = 20;

  return L.divIcon({
    className: 'custom-alert-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: transform 0.15s ease;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface MapProps {
  onDistrictSelect?: (district: string) => void;
  hours: number;
  layer: MapLayer;
}

export default function Map({ onDistrictSelect, hours, layer }: MapProps) {
  const [weatherData, setWeatherData] = useState<WeatherSummary[]>([]);
  const [forecastData, setForecastData] = useState<DistrictForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overlayType, setOverlayType] = useState<OverlayType>('none');
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [satelliteData, setSatelliteData] = useState<SatelliteData | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const [showRivers, setShowRivers] = useState(false);
  const [riverStations, setRiverStations] = useState<RiverStation[]>([]);
  const [showMarine, setShowMarine] = useState(false);
  const [marineConditions, setMarineConditions] = useState<MarineCondition[]>([]);

  const isForecastLayer = layer.startsWith('forecast');
  const forecastDayIndex = isForecastLayer ? parseInt(layer.replace('forecast', '')) - 1 : 0;

  // Fetch weather overlay data from RainViewer
  useEffect(() => {
    if (overlayType === 'none') return;

    const fetchOverlayData = async () => {
      try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await res.json();
        setRadarData(data.radar);
        setSatelliteData(data.satellite);
        // Start at most recent frame
        if (overlayType === 'radar' && data.radar?.past) {
          setFrameIndex(data.radar.past.length - 1);
        } else if (overlayType === 'satellite' && data.satellite?.infrared) {
          setFrameIndex(data.satellite.infrared.length - 1);
        }
      } catch (err) {
        console.error('Failed to fetch overlay data:', err);
      }
    };

    fetchOverlayData();
    const interval = setInterval(fetchOverlayData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [overlayType]);

  // Get current frames based on overlay type
  const currentFrames = useMemo(() => {
    if (overlayType === 'radar' && radarData) {
      return [...radarData.past, ...radarData.nowcast];
    } else if (overlayType === 'satellite' && satelliteData) {
      return satelliteData.infrared;
    }
    return [];
  }, [overlayType, radarData, satelliteData]);

  // Fetch river data when enabled
  useEffect(() => {
    if (!showRivers) return;

    const fetchRiverData = async () => {
      try {
        const data = await api.getRiverLevels();
        setRiverStations(data.stations);
      } catch (err) {
        console.error('Failed to fetch river data:', err);
      }
    };

    fetchRiverData();
    const interval = setInterval(fetchRiverData, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [showRivers]);

  // Fetch marine data when enabled
  useEffect(() => {
    if (!showMarine) return;

    const fetchMarineData = async () => {
      try {
        const data = await api.getMarineConditions();
        setMarineConditions(data.conditions);
      } catch (err) {
        console.error('Failed to fetch marine data:', err);
      }
    };

    fetchMarineData();
    const interval = setInterval(fetchMarineData, 30 * 60 * 1000); // Refresh every 30 minutes
    return () => clearInterval(interval);
  }, [showMarine]);

  // Animate overlay frames with different speeds
  useEffect(() => {
    if (overlayType === 'none' || currentFrames.length === 0 || !isAnimating) return;

    // Radar: 600ms, Satellite: 1200ms (slower for cloud movement)
    const animationSpeed = overlayType === 'radar' ? 600 : 1200;

    const timer = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % currentFrames.length);
    }, animationSpeed);

    return () => clearInterval(timer);
  }, [overlayType, currentFrames.length, isAnimating]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [weather, forecast] = await Promise.all([
          api.getAllWeather(hours),
          api.getAllForecast()
        ]);
        if (isMounted) {
          setWeatherData(weather);
          setForecastData(forecast);
          setError('');
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load weather data');
          console.error(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [hours]);

  // Create a map of forecast data by district
  const forecastByDistrict = useMemo(() => {
    const map: Record<string, DistrictForecast> = {};
    forecastData.forEach(f => {
      map[f.district] = f;
    });
    return map;
  }, [forecastData]);

  // Get current overlay tile URL (must be before any early returns)
  const overlayTileUrl = useMemo(() => {
    if (overlayType === 'none' || currentFrames.length === 0) return null;
    const frame = currentFrames[frameIndex % currentFrames.length];
    if (!frame) return null;

    if (overlayType === 'radar') {
      return `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
    } else {
      // Satellite infrared - color scheme 0 (original)
      return `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/0/0_0.png`;
    }
  }, [overlayType, currentFrames, frameIndex]);

  // Get overlay timestamp (must be before any early returns)
  const overlayTimestamp = useMemo(() => {
    if (overlayType === 'none' || currentFrames.length === 0) return '';
    const frame = currentFrames[frameIndex % currentFrames.length];
    if (!frame) return '';
    const date = new Date(frame.time * 1000);
    const isForecast = overlayType === 'radar' && radarData && frameIndex >= radarData.past.length;
    return `${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}${isForecast ? ' (forecast)' : ''}`;
  }, [overlayType, currentFrames, frameIndex, radarData]);

  // Get marker color based on selected layer
  const getMarkerColor = (district: WeatherSummary): string => {
    if (isForecastLayer) {
      const forecast = forecastByDistrict[district.district];
      if (forecast && forecast.forecast_daily[forecastDayIndex]) {
        return getForecastAlertColor(forecast.forecast_daily[forecastDayIndex].forecast_alert_level);
      }
      return '#9ca3af';
    }

    switch (layer) {
      case 'rainfall':
        return getAlertColor(district.alert_level);
      case 'danger':
        return getDangerColor(district.danger_level);
      case 'temperature':
        return getTemperatureColor(district.temperature_c);
      case 'humidity':
        return getHumidityColor(district.humidity_percent);
      case 'wind':
        return getWindColor(district.wind_speed_kmh);
      case 'pressure':
        return getPressureColor(district.pressure_hpa);
      case 'clouds':
        return getCloudColor(district.cloud_cover_percent);
      default:
        return getAlertColor(district.alert_level);
    }
  };

  // Get value to display on marker based on layer
  const getMarkerValue = (district: WeatherSummary): string => {
    if (isForecastLayer) {
      const forecast = forecastByDistrict[district.district];
      if (forecast && forecast.forecast_daily[forecastDayIndex]) {
        return `${forecast.forecast_daily[forecastDayIndex].total_rainfall_mm.toFixed(0)}`;
      }
      return '-';
    }

    switch (layer) {
      case 'rainfall':
        const rainfall = hours === 24 ? district.rainfall_24h_mm : hours === 48 ? district.rainfall_48h_mm : district.rainfall_72h_mm;
        return `${rainfall?.toFixed(0) || 0}`;
      case 'danger':
        return `${district.danger_score}`;
      case 'temperature':
        return `${district.temperature_c?.toFixed(0) || '-'}`;
      case 'humidity':
        return `${district.humidity_percent?.toFixed(0) || '-'}`;
      case 'wind':
        return `${district.wind_speed_kmh?.toFixed(0) || '-'}`;
      case 'pressure':
        return `${district.pressure_hpa?.toFixed(0) || '-'}`;
      case 'clouds':
        return `${district.cloud_cover_percent?.toFixed(0) || '-'}`;
      default:
        return '';
    }
  };

  const markers = useMemo(() => {
    return weatherData.map((district) => {
      const forecast = forecastByDistrict[district.district];
      const rainfallValue = hours === 24
        ? district.rainfall_24h_mm
        : hours === 48
          ? district.rainfall_48h_mm
          : district.rainfall_72h_mm;

      const markerColor = getMarkerColor(district);
      const icon = createAlertIcon(markerColor, district.alert_level);

      return (
        <Marker
          key={`${district.district}-${hours}-${layer}-${rainfallValue}`}
          position={[district.latitude, district.longitude]}
          icon={icon}
          eventHandlers={{
            click: () => onDistrictSelect?.(district.district),
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -10]}
            opacity={0.95}
            className="district-tooltip"
          >
            <div className="p-2" style={{ width: '340px', maxWidth: '340px' }}>
              {/* Header with district name and alert badge */}
              <div className="flex justify-between items-center border-b pb-1.5 mb-2">
                <h3 className="font-bold text-sm">{district.district}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  district.alert_level === 'green' ? 'bg-green-500 text-white' :
                  district.alert_level === 'yellow' ? 'bg-yellow-500 text-white' :
                  district.alert_level === 'orange' ? 'bg-orange-500 text-white' :
                  'bg-red-500 text-white'
                }`}>
                  {district.alert_level.toUpperCase()}
                </span>
              </div>

              {/* Two column layout */}
              <div className="flex gap-2">
                {/* Left column - Current conditions */}
                <div className="flex-1 space-y-1">
                  {/* Danger Level */}
                  <div className={`p-1.5 rounded text-center text-xs ${
                    district.danger_level === 'high' ? 'bg-red-100 border border-red-400' :
                    district.danger_level === 'medium' ? 'bg-yellow-100 border border-yellow-400' :
                    'bg-green-100 border border-green-400'
                  }`}>
                    <span className="text-gray-600">Risk: </span>
                    <span className={`font-bold ${
                      district.danger_level === 'high' ? 'text-red-700' :
                      district.danger_level === 'medium' ? 'text-yellow-700' :
                      'text-green-700'
                    }`}>{district.danger_level.toUpperCase()}</span>
                    <span className="text-gray-500 ml-1">({district.danger_score})</span>
                  </div>

                  {/* Current conditions grid */}
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="bg-orange-50 p-1 rounded text-center">
                      <div className="text-gray-500">Temp</div>
                      <div className="font-bold">{district.temperature_c?.toFixed(1) || '-'}°C</div>
                    </div>
                    <div className="bg-blue-50 p-1 rounded text-center">
                      <div className="text-gray-500">Humidity</div>
                      <div className="font-bold">{district.humidity_percent?.toFixed(0) || '-'}%</div>
                    </div>
                    <div className="bg-cyan-50 p-1 rounded text-center">
                      <div className="text-gray-500">Wind</div>
                      <div className="font-bold">{district.wind_speed_kmh?.toFixed(0) || '-'} km/h</div>
                    </div>
                    <div className="bg-gray-100 p-1 rounded text-center">
                      <div className="text-gray-500">Clouds</div>
                      <div className="font-bold">{district.cloud_cover_percent?.toFixed(0) || '-'}%</div>
                    </div>
                  </div>

                  {/* Rainfall */}
                  <div className="bg-blue-50 p-1.5 rounded text-xs">
                    <div className="text-gray-600 mb-1">Rainfall (mm)</div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className={hours === 24 ? 'font-bold text-blue-700' : ''}>
                        <div className="text-gray-500">24h</div>
                        <div>{district.rainfall_24h_mm?.toFixed(1) || 0}</div>
                      </div>
                      <div className={hours === 48 ? 'font-bold text-blue-700' : ''}>
                        <div className="text-gray-500">48h</div>
                        <div>{district.rainfall_48h_mm?.toFixed(1) || 0}</div>
                      </div>
                      <div className={hours === 72 ? 'font-bold text-blue-700' : ''}>
                        <div className="text-gray-500">72h</div>
                        <div>{district.rainfall_72h_mm?.toFixed(1) || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right column - Forecast */}
                <div className="flex-1 space-y-1">
                  <div className="text-xs font-semibold text-gray-600 text-center">5-Day Forecast</div>
                  {forecast && forecast.forecast_daily.length > 0 ? (
                    <div className="space-y-0.5">
                      {forecast.forecast_daily.slice(0, 5).map((day, idx) => (
                        <div
                          key={day.date}
                          className={`flex items-center justify-between p-1 rounded text-xs ${
                            layer === `forecast${idx + 1}` ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: getForecastAlertColor(day.forecast_alert_level) }}
                            />
                            <span className="font-medium w-12 truncate">{day.day_name.slice(0, 3)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-blue-600 font-semibold">{day.total_rainfall_mm.toFixed(0)}mm</span>
                            <span className="text-gray-500">{day.max_precipitation_probability}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 text-center py-4">No forecast data</div>
                  )}

                  {/* Next 24h forecast summary */}
                  <div className="bg-purple-50 p-1.5 rounded text-xs text-center">
                    <div className="text-gray-600">Next 24h</div>
                    <div className="font-bold text-purple-700">{district.forecast_precip_24h_mm?.toFixed(1) || 0}mm</div>
                    <div className="text-gray-500">{district.precipitation_probability?.toFixed(0) || 0}% prob</div>
                  </div>
                </div>
              </div>

              {/* Risk Factors - compact */}
              {district.danger_factors && district.danger_factors.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t">
                  <div className="flex flex-wrap gap-1">
                    {district.danger_factors.slice(0, 3).map((factor, idx) => (
                      <span
                        key={idx}
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          factor.severity === 'high' ? 'bg-red-100 text-red-700' :
                          factor.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}
                      >
                        {factor.factor}: {factor.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Tooltip>
        </Marker>
      );
    });
  }, [weatherData, forecastByDistrict, hours, layer, onDistrictSelect, isForecastLayer, forecastDayIndex]);

  // River station markers
  const riverMarkers = useMemo(() => {
    if (!showRivers || riverStations.length === 0) return null;

    return riverStations.map((station) => (
      <CircleMarker
        key={`river-${station.river_code}-${station.station}`}
        center={[station.lat, station.lon]}
        radius={8}
        pathOptions={{
          fillColor: getRiverStatusColor(station.status),
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }}
      >
        <Popup maxWidth={300} minWidth={250}>
          <div className="p-1">
            <h3 className="font-bold text-sm border-b pb-1 mb-2">
              {station.river} ({station.river_code})
            </h3>
            <div className="text-xs text-gray-600 mb-2">{station.station}</div>

            {/* Status badge */}
            <div className={`inline-block px-2 py-1 rounded text-xs font-bold mb-2 ${
              station.status === 'alert' ? 'bg-red-100 text-red-700' :
              station.status === 'rising' ? 'bg-orange-100 text-orange-700' :
              station.status === 'falling' ? 'bg-green-100 text-green-700' :
              station.status === 'normal' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {station.status.toUpperCase()}
            </div>

            {/* Water levels */}
            <div className="grid grid-cols-3 gap-1 text-xs mb-2">
              <div className="bg-blue-50 p-1.5 rounded text-center">
                <div className="text-gray-500">Current</div>
                <div className="font-bold text-blue-700">{station.water_level_m.toFixed(2)}m</div>
              </div>
              <div className="bg-gray-50 p-1.5 rounded text-center">
                <div className="text-gray-500">1hr ago</div>
                <div className="font-medium">{station.water_level_1hr_ago_m.toFixed(2)}m</div>
              </div>
              <div className="bg-gray-50 p-1.5 rounded text-center">
                <div className="text-gray-500">9am</div>
                <div className="font-medium">{station.water_level_9am_m.toFixed(2)}m</div>
              </div>
            </div>

            {/* Additional info */}
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="bg-cyan-50 p-1.5 rounded">
                <span className="text-gray-500">24h Rain: </span>
                <span className="font-bold">{station.rainfall_24h_mm.toFixed(1)}mm</span>
              </div>
              <div className="bg-gray-50 p-1.5 rounded">
                <span className="text-gray-500">Catchment: </span>
                <span className="font-medium">{station.catchment_area_km2}km²</span>
              </div>
            </div>

            {station.last_updated && (
              <div className="mt-2 pt-1 border-t text-xs text-gray-500">
                Updated: {station.last_updated}
              </div>
            )}
          </div>
        </Popup>
      </CircleMarker>
    ));
  }, [showRivers, riverStations]);

  // River path lines
  const riverLines = useMemo(() => {
    if (!showRivers) return null;

    return riverPaths.map((river) => (
      <Polyline
        key={`river-line-${river.code}`}
        positions={river.coordinates}
        pathOptions={{
          color: river.color,
          weight: 3,
          opacity: 0.7,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      >
        <Tooltip sticky>
          <span className="font-medium">{river.name}</span>
        </Tooltip>
      </Polyline>
    ));
  }, [showRivers]);

  // Marine condition markers
  const marineMarkers = useMemo(() => {
    if (!showMarine || marineConditions.length === 0) return null;

    return marineConditions.map((condition) => (
      <CircleMarker
        key={`marine-${condition.location}`}
        center={[condition.lat, condition.lon]}
        radius={10}
        pathOptions={{
          fillColor: getMarineRiskColor(condition.risk_level),
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }}
      >
        <Popup maxWidth={300} minWidth={250}>
          <div className="p-1">
            <h3 className="font-bold text-sm border-b pb-1 mb-2">
              {condition.location}
            </h3>
            <div className="text-xs text-gray-600 mb-2">{condition.district}</div>

            {/* Risk badge */}
            <div className={`inline-block px-2 py-1 rounded text-xs font-bold mb-2 ${
              condition.risk_level === 'high' ? 'bg-red-100 text-red-700' :
              condition.risk_level === 'medium' ? 'bg-orange-100 text-orange-700' :
              'bg-green-100 text-green-700'
            }`}>
              {condition.risk_level.toUpperCase()} RISK
            </div>

            {/* Wave conditions */}
            <div className="grid grid-cols-2 gap-1 text-xs mb-2">
              <div className="bg-blue-50 p-1.5 rounded text-center">
                <div className="text-gray-500">Wave Height</div>
                <div className="font-bold text-blue-700">{condition.wave_height_m.toFixed(1)}m</div>
              </div>
              <div className="bg-cyan-50 p-1.5 rounded text-center">
                <div className="text-gray-500">Swell</div>
                <div className="font-bold text-cyan-700">{condition.swell_wave_height_m.toFixed(1)}m</div>
              </div>
              <div className="bg-gray-50 p-1.5 rounded text-center">
                <div className="text-gray-500">Wave Period</div>
                <div className="font-medium">{condition.wave_period_s.toFixed(1)}s</div>
              </div>
              <div className="bg-gray-50 p-1.5 rounded text-center">
                <div className="text-gray-500">Direction</div>
                <div className="font-medium">{condition.wave_direction}°</div>
              </div>
            </div>

            {/* Risk factors */}
            {condition.risk_factors && condition.risk_factors.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <div className="text-xs text-gray-500 mb-1">Risk Factors:</div>
                <div className="flex flex-wrap gap-1">
                  {condition.risk_factors.map((factor, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700"
                    >
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Popup>
      </CircleMarker>
    ));
  }, [showMarine, marineConditions]);

  if (loading && weatherData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error && weatherData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const sriLankaCenter: [number, number] = [7.8731, 80.7718];

  return (
    <div className="relative h-full w-full">
      {/* Weather overlay toggles - positioned bottom-left to avoid zoom controls */}
      <div className="absolute bottom-6 left-2 z-[1000] flex flex-col gap-2">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => {
              if (overlayType !== 'radar') {
                setShowRivers(false); // Turn off Rivers when showing Rain
              }
              setOverlayType(overlayType === 'radar' ? 'none' : 'radar');
            }}
            className={`px-3 py-2 rounded-lg shadow-md flex items-center gap-2 text-sm font-medium transition-colors ${
              overlayType === 'radar'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.5 13.5C4.5 15.433 6.067 17 8 17h8c2.21 0 4-1.79 4-4 0-1.86-1.28-3.41-3-3.86V9c0-2.76-2.24-5-5-5-2.42 0-4.44 1.72-4.9 4-.46-.06-.94-.1-1.1-.1C4.07 7.9 2.5 9.6 2.5 11.5c0 1.1.5 2 1.3 2.6-.2.4-.3.9-.3 1.4z"/>
              <path d="M8 19l-1 3M12 19l-1 3M16 19l-1 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Rain
          </button>
          <button
            onClick={() => {
              if (overlayType !== 'satellite') {
                setShowRivers(false); // Turn off Rivers when showing Cloud
              }
              setOverlayType(overlayType === 'satellite' ? 'none' : 'satellite');
            }}
            className={`px-3 py-2 rounded-lg shadow-md flex items-center gap-2 text-sm font-medium transition-colors ${
              overlayType === 'satellite'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Cloud
          </button>
          <button
            onClick={() => {
              if (!showRivers) {
                setOverlayType('none'); // Turn off Rain/Cloud when showing Rivers
              }
              setShowRivers(!showRivers);
            }}
            className={`px-3 py-2 rounded-lg shadow-md flex items-center gap-2 text-sm font-medium transition-colors ${
              showRivers
                ? 'bg-cyan-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            title="River water levels"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
            Rivers
          </button>
          <button
            onClick={() => setShowMarine(!showMarine)}
            className={`px-3 py-2 rounded-lg shadow-md flex items-center gap-2 text-sm font-medium transition-colors ${
              showMarine
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            title="Coastal marine conditions"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            Marine
          </button>
          <a
            href="https://www.lightningmaps.org/?lang=en#m=oss;t=3;s=0;o=0;b=;ts=0;y=7.8731;x=80.7718;z=8;d=2;dl=2;dc=0;"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-lg shadow-md flex items-center gap-2 text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
            title="Live lightning strikes"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Lightning
          </a>
        </div>

        {overlayType !== 'none' && currentFrames.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-2 text-xs">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-gray-600 font-medium">{overlayTimestamp}</span>
              <button
                onClick={() => setIsAnimating(!isAnimating)}
                className={`px-2 py-1 rounded ${isAnimating ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
              >
                {isAnimating ? '⏸' : '▶'}
              </button>
            </div>
            {overlayType === 'radar' ? (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#00ff00' }} />
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ffff00' }} />
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ff8800' }} />
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ff0000' }} />
                <span className="text-gray-500 ml-1">Rain intensity</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ffffff' }} />
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#888888' }} />
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#333333' }} />
                <span className="text-gray-500 ml-1">Cloud cover (IR)</span>
              </div>
            )}
          </div>
        )}

        {showRivers && (
          <div className="bg-white rounded-lg shadow-md p-2 text-xs">
            <div className="text-gray-600 font-medium mb-1">River Gauges</div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#dc2626' }} />
                <span className="text-gray-600">Alert</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }} />
                <span className="text-gray-600">Rising</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                <span className="text-gray-600">Falling</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                <span className="text-gray-600">Normal</span>
              </div>
            </div>
            <div className="text-gray-400 mt-1">{riverStations.length} stations</div>
          </div>
        )}

        {showMarine && (
          <div className="bg-white rounded-lg shadow-md p-2 text-xs">
            <div className="text-gray-600 font-medium mb-1">Coastal Conditions</div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#dc2626' }} />
                <span className="text-gray-600">High Risk</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }} />
                <span className="text-gray-600">Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                <span className="text-gray-600">Low</span>
              </div>
            </div>
            <div className="text-gray-400 mt-1">{marineConditions.length} coastal points</div>
          </div>
        )}
      </div>

      {loading && (
        <div className="absolute top-2 right-2 z-[1000] bg-white px-3 py-1 rounded-full shadow-md flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Updating...</span>
        </div>
      )}
      <MapContainer
        center={sriLankaCenter}
        zoom={8}
        className="h-full w-full rounded-lg"
        scrollWheelZoom={true}
      >
        <MapController weatherData={weatherData} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {overlayType !== 'none' && overlayTileUrl && (
          <TileLayer
            key={`${overlayType}-${frameIndex}`}
            url={overlayTileUrl}
            opacity={overlayType === 'radar' ? 0.7 : 0.6}
            attribution='<a href="https://rainviewer.com">RainViewer</a>'
          />
        )}
        {markers}
        {riverLines}
        {riverMarkers}
        {marineMarkers}
      </MapContainer>
    </div>
  );
}
