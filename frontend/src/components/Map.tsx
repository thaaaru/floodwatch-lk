'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import { WeatherSummary, DistrictForecast, RiverStation, MarineCondition, IrrigationStation, api } from '@/lib/api';
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

export type MapLayer = 'rainfall' | 'danger' | 'temperature' | 'humidity' | 'wind' | 'pressure' | 'forecast1' | 'forecast2' | 'forecast3' | 'forecast4' | 'forecast5';

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

// Rainfall color: gradient from white (dry) to dark blue (heavy rain)
function getRainfallColor(rainfall: number | null): string {
  if (rainfall === null || rainfall === 0) return '#ffffff'; // white - dry
  if (rainfall < 1) return '#e0f2fe';    // sky-100 - trace rainfall
  if (rainfall < 5) return '#bae6fd';    // sky-200 - very light
  if (rainfall < 10) return '#7dd3fc';   // sky-300 - light
  if (rainfall < 25) return '#38bdf8';   // sky-400 - light-moderate
  if (rainfall < 50) return '#0ea5e9';   // sky-500 - moderate
  if (rainfall < 100) return '#0284c7';  // sky-600 - moderate-heavy
  if (rainfall < 150) return '#0369a1';  // sky-700 - heavy
  return '#0c4a6e';                       // sky-900 - extreme (dark blue)
}

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

// Irrigation/Flood gauge station colors based on flood threshold status
function getFloodGaugeColor(status: string): string {
  switch (status) {
    case 'major_flood': return '#7c2d12'; // Dark brown - major flood
    case 'minor_flood': return '#c2410c'; // Orange-red - minor flood
    case 'alert': return '#ea580c';       // Orange - alert level
    case 'normal': return '#65a30d';      // Lime green - normal
    default: return '#9ca3af';            // Gray - unknown
  }
}

// Create custom flood gauge marker icon
function createFloodGaugeIcon(status: string, pctToAlert: number): L.DivIcon {
  const color = getFloodGaugeColor(status);
  const size = 26;
  const isFlooding = status === 'major_flood' || status === 'minor_flood';

  return L.divIcon({
    className: 'custom-flood-gauge-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 4px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      ${isFlooding ? 'animation: pulse 1s infinite;' : ''}
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1">
        <path d="M12 2L5 12h14L12 2z" fill="${isFlooding ? 'white' : 'rgba(255,255,255,0.8)'}"/>
        <rect x="6" y="14" width="12" height="8" rx="1" fill="rgba(255,255,255,0.6)"/>
        <rect x="6" y="${22 - Math.min(pctToAlert, 100) * 0.08}" width="12" height="${Math.min(pctToAlert, 100) * 0.08}" fill="white"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function getMarineRiskColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'high': return '#0369a1';    // Dark cyan/blue - dangerous waves
    case 'medium': return '#0891b2';  // Cyan - moderate waves
    case 'low': return '#06b6d4';     // Light cyan - calm seas
    default: return '#9ca3af';        // Gray - unknown
  }
}

// Create custom wave icon for marine/coastal markers
function createMarineIcon(riskLevel: string): L.DivIcon {
  const color = getMarineRiskColor(riskLevel);
  const size = 28;

  return L.divIcon({
    className: 'custom-marine-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M2 12c1.5-2 3.5-3 6-3s4.5 1 6 3c1.5 2 3.5 3 6 3"/>
        <path d="M2 18c1.5-2 3.5-3 6-3s4.5 1 6 3c1.5 2 3.5 3 6 3" opacity="0.5"/>
        <path d="M2 6c1.5-2 3.5-3 6-3s4.5 1 6 3c1.5 2 3.5 3 6 3" opacity="0.5"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
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
function createAlertIcon(color: string, alertLevel: string, borderColor: string = 'white'): L.DivIcon {
  const size = 14;

  return L.divIcon({
    className: 'custom-alert-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 1.5px solid ${borderColor};
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: transform 0.15s ease;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Create marker icon with rainfall text
function createRainfallMarker(color: string, rainfallMm: number, borderColor: string = 'white'): L.DivIcon {
  const circleSize = 18;
  const rainfallText = Math.round(rainfallMm);

  return L.divIcon({
    className: 'custom-rainfall-marker',
    html: `<div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
    ">
      <div style="
        width: ${circleSize}px;
        height: ${circleSize}px;
        background-color: ${color};
        border: 2px solid ${borderColor};
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
      <div style="
        margin-top: 3px;
        background: rgba(255, 255, 255, 0.95);
        padding: 2px 5px;
        border-radius: 4px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: 600;
        color: ${rainfallMm > 50 ? '#dc2626' : rainfallMm > 25 ? '#f97316' : rainfallMm > 10 ? '#3b82f6' : '#64748b'};
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        white-space: nowrap;
        letter-spacing: 0.3px;
      ">${rainfallText}mm</div>
    </div>`,
    iconSize: [50, 40],
    iconAnchor: [25, 20],
  });
}

export type DangerFilter = 'all' | 'low' | 'medium' | 'high';

interface MapProps {
  onDistrictSelect?: (district: string) => void;
  hours: number;
  layer: MapLayer;
  dangerFilter?: DangerFilter;
  userLocation?: { lat: number; lon: number } | null;
}

export default function Map({ onDistrictSelect, hours, layer, dangerFilter = 'all', userLocation }: MapProps) {
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
  const [showMarine, setShowMarine] = useState(true); // Show marine by default
  const [marineConditions, setMarineConditions] = useState<MarineCondition[]>([]);
  const [showFloodGauges, setShowFloodGauges] = useState(true); // Show flood gauges by default
  const [floodGaugeStations, setFloodGaugeStations] = useState<IrrigationStation[]>([]);

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
    // No auto-refresh - data is cached on backend
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
    // No auto-refresh - data is cached on backend
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
    // No auto-refresh - data is cached on backend
  }, [showMarine]);

  // Fetch flood gauge (irrigation) data when enabled
  useEffect(() => {
    if (!showFloodGauges) return;

    const fetchFloodGaugeData = async () => {
      try {
        const data = await api.getIrrigationData();
        setFloodGaugeStations(data.stations);
      } catch (err) {
        console.error('Failed to fetch flood gauge data:', err);
      }
    };

    fetchFloodGaugeData();
    // No auto-refresh - data is cached on backend
  }, [showFloodGauges]);

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
        // Use Promise.allSettled to handle partial failures gracefully
        // Weather data is essential, forecast is optional
        const [weatherResult, forecastResult] = await Promise.allSettled([
          api.getAllWeather(hours),
          api.getAllForecast()
        ]);

        if (isMounted) {
          // Weather is required - fail if it doesn't load
          if (weatherResult.status === 'fulfilled') {
            setWeatherData(weatherResult.value);
            setError('');
          } else {
            setError('Failed to load weather data');
            console.error('Weather fetch failed:', weatherResult.reason);
          }

          // Forecast is optional - use empty array if it fails
          if (forecastResult.status === 'fulfilled') {
            setForecastData(forecastResult.value);
          } else {
            console.warn('Forecast fetch failed (non-critical):', forecastResult.reason);
            // Keep existing forecast data or use empty array
            setForecastData(prev => prev.length > 0 ? prev : []);
          }
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
        const rainfallMm = hours === 24 ? district.rainfall_24h_mm : hours === 48 ? district.rainfall_48h_mm : district.rainfall_72h_mm;
        return getRainfallColor(rainfallMm);
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
      default:
        return getAlertColor(district.alert_level);
    }
  };

  // Get value to display on marker based on layer
  const getMarkerValue = (district: WeatherSummary): string => {
    if (isForecastLayer) {
      const forecast = forecastByDistrict[district.district];
      if (forecast && forecast.forecast_daily[forecastDayIndex]) {
        return `${Math.round(Number(forecast.forecast_daily[forecastDayIndex].total_rainfall_mm) || 0)}`;
      }
      return '-';
    }

    switch (layer) {
      case 'rainfall':
        const rainfall = hours === 24 ? district.rainfall_24h_mm : hours === 48 ? district.rainfall_48h_mm : district.rainfall_72h_mm;
        return `${Math.round(Number(rainfall || 0))}`;
      case 'danger':
        return `${district.danger_score}`;
      case 'temperature':
        return district.temperature_c != null ? `${Math.round(Number(district.temperature_c))}` : '-';
      case 'humidity':
        return district.humidity_percent != null ? `${Math.round(Number(district.humidity_percent))}` : '-';
      case 'wind':
        return district.wind_speed_kmh != null ? `${Math.round(Number(district.wind_speed_kmh))}` : '-';
      case 'pressure':
        return district.pressure_hpa != null ? `${Math.round(Number(district.pressure_hpa))}` : '-';
      default:
        return '';
    }
  };

  // Filter weather data based on danger filter
  const filteredWeatherData = useMemo(() => {
    if (dangerFilter === 'all') return weatherData;
    return weatherData.filter(district => district.danger_level === dangerFilter);
  }, [weatherData, dangerFilter]);

  const markers = useMemo(() => {
    // Sort by priority: green < yellow < orange < red (so red renders on top)
    const alertPriority: Record<string, number> = {
      'green': 0,
      'yellow': 1,
      'orange': 2,
      'red': 3
    };

    const dangerPriority: Record<string, number> = {
      'low': 0,
      'moderate': 1,
      'medium': 1,
      'high': 2,
      'critical': 3
    };

    const sortedData = [...filteredWeatherData].sort((a, b) => {
      // Primary sort by alert level
      const alertDiff = (alertPriority[a.alert_level] || 0) - (alertPriority[b.alert_level] || 0);
      if (alertDiff !== 0) return alertDiff;

      // Secondary sort by danger level
      return (dangerPriority[a.danger_level] || 0) - (dangerPriority[b.danger_level] || 0);
    });

    return sortedData.map((district, index) => {
      const forecast = forecastByDistrict[district.district];
      const rainfallValue = hours === 24
        ? district.rainfall_24h_mm
        : hours === 48
          ? district.rainfall_48h_mm
          : district.rainfall_72h_mm;

      const markerColor = getMarkerColor(district);
      // Use dark blue border for rainfall layer to match the blue gradient
      const borderColor = layer === 'rainfall' ? '#0c4a6e' : 'white'; // sky-900
      // Use rainfall marker for rainfall and danger layers, otherwise use alert icon
      const icon = (layer === 'rainfall' || layer === 'danger')
        ? createRainfallMarker(markerColor, rainfallValue || 0, borderColor)
        : createAlertIcon(markerColor, district.alert_level, borderColor);

      // Calculate z-index for weather markers (1000-1999 range, below flood gauges)
      const baseZIndex = 1000;
      const alertValue = alertPriority[district.alert_level] || 0;
      const dangerValue = dangerPriority[district.danger_level] || 0;
      const zIndex = baseZIndex + (alertValue * 100) + (dangerValue * 10) + index;

      return (
        <Marker
          key={`${district.district}-${hours}-${layer}-${rainfallValue}`}
          position={[district.latitude, district.longitude]}
          icon={icon}
          zIndexOffset={zIndex}
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
                      <div className="font-bold">{district.temperature_c != null ? Number(district.temperature_c).toFixed(1) : '-'}°C</div>
                    </div>
                    <div className="bg-blue-50 p-1 rounded text-center">
                      <div className="text-gray-500">Humidity</div>
                      <div className="font-bold">{district.humidity_percent != null ? Math.round(Number(district.humidity_percent)) : '-'}%</div>
                    </div>
                    <div className="bg-cyan-50 p-1 rounded text-center">
                      <div className="text-gray-500">Wind</div>
                      <div className="font-bold">{district.wind_speed_kmh != null ? Math.round(Number(district.wind_speed_kmh)) : '-'} km/h</div>
                    </div>
                  </div>

                  {/* Rainfall */}
                  <div className="bg-blue-50 p-1.5 rounded text-xs">
                    <div className="text-gray-600 mb-1">Rainfall (mm)</div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className={hours === 24 ? 'font-bold text-blue-700' : ''}>
                        <div className="text-gray-500">24h</div>
                        <div>{Number(district.rainfall_24h_mm || 0).toFixed(1)}</div>
                      </div>
                      <div className={hours === 48 ? 'font-bold text-blue-700' : ''}>
                        <div className="text-gray-500">48h</div>
                        <div>{Number(district.rainfall_48h_mm || 0).toFixed(1)}</div>
                      </div>
                      <div className={hours === 72 ? 'font-bold text-blue-700' : ''}>
                        <div className="text-gray-500">72h</div>
                        <div>{Number(district.rainfall_72h_mm || 0).toFixed(1)}</div>
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
                            <span className="text-blue-600 font-semibold">{Math.round(Number(day.total_rainfall_mm) || 0)}mm</span>
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
                    <div className="font-bold text-purple-700">{Number(district.forecast_precip_24h_mm || 0).toFixed(1)}mm</div>
                    <div className="text-gray-500">{Math.round(Number(district.precipitation_probability || 0))}% prob</div>
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
  }, [filteredWeatherData, forecastByDistrict, hours, layer, onDistrictSelect, isForecastLayer, forecastDayIndex]);

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

    // Sort by risk level: low < medium < high (so high risk renders on top)
    const riskPriority: Record<string, number> = {
      'low': 0,
      'medium': 1,
      'high': 2
    };

    const sortedConditions = [...marineConditions].sort((a, b) => {
      return (riskPriority[a.risk_level] || 0) - (riskPriority[b.risk_level] || 0);
    });

    return sortedConditions.map((condition, index) => {
      // Calculate z-index for marine markers
      const baseZIndex = 500;
      const riskValue = riskPriority[condition.risk_level] || 0;
      const zIndex = baseZIndex + (riskValue * 100) + index;

      return (
        <Marker
          key={`marine-${condition.location}`}
          position={[condition.lat, condition.lon]}
          icon={createMarineIcon(condition.risk_level)}
          zIndexOffset={zIndex}
        />
    );
  });
}, [showMarine, marineConditions]);

  // Flood gauge (irrigation station) markers
  const floodGaugeMarkers = useMemo(() => {
    if (!showFloodGauges || floodGaugeStations.length === 0) return null;

    // Sort by flood severity: normal < alert < minor_flood < major_flood (so major renders on top)
    const statusPriority: Record<string, number> = {
      'normal': 0,
      'alert': 1,
      'minor_flood': 2,
      'major_flood': 3
    };

    const sortedStations = [...floodGaugeStations].sort((a, b) => {
      return (statusPriority[a.status] || 0) - (statusPriority[b.status] || 0);
    });

    return sortedStations.map((station, index) => {
      // Calculate z-index: higher priority status gets higher z-index
      const baseZIndex = 2000; // Start high to be above weather markers
      const statusPriorityValue = statusPriority[station.status] || 0;
      const zIndex = baseZIndex + (statusPriorityValue * 100) + index;

      return (
        <Marker
          key={`flood-gauge-${station.station}`}
          position={[station.lat, station.lon]}
          icon={createFloodGaugeIcon(station.status, station.pct_to_alert)}
          zIndexOffset={zIndex}
        />
    );
  });
}, [showFloodGauges, floodGaugeStations]);

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
  const mapCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lon]
    : sriLankaCenter;
  const mapZoom = userLocation ? 10 : 7;

  return (
    <div className="relative h-full w-full">
      {loading && (
        <div className="absolute top-2 right-2 z-[1000] bg-white px-3 py-1 rounded-full shadow-md flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Updating...</span>
        </div>
      )}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
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
        {riverLines}
        {riverMarkers}
        {marineMarkers}
        {markers}
        {floodGaugeMarkers}
        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lon]}
            radius={8}
            pathOptions={{
              fillColor: '#3b82f6',
              fillOpacity: 1,
              color: '#ffffff',
              weight: 3,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              <span className="font-medium">Your Location</span>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
