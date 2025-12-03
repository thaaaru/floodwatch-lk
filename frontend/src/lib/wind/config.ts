/**
 * Wind Data Engine - Configuration
 * Centralized configuration for all wind data providers and settings
 */

import type { WindEngineConfig, ColorStop } from './types';

/**
 * Environment-based configuration
 */
export const windConfig: WindEngineConfig = {
  defaultSource: 'auto',
  defaultResolutionKm: 25,
  cacheTTLMinutes: 30,
  maxPointsPerRequest: 10000,

  providers: {
    icon: {
      enabled: true,
      baseUrl: process.env.DWD_ICON_BASE || 'https://opendata.dwd.de/weather/nwp/icon/grib',
    },
    gfs: {
      enabled: true,
      baseUrl: process.env.OPEN_METEO_BASE || 'https://api.open-meteo.com/v1',
    },
    era5: {
      enabled: true,
      apiUrl: process.env.CDS_API_URL || 'https://cds.climate.copernicus.eu/api/v2',
      apiKey: process.env.CDS_API_KEY,
    },
  },
};

/**
 * Default bounding box for Sri Lanka region
 */
export const SRI_LANKA_BBOX: [number, number, number, number] = [79.5, 5.9, 82.0, 10.0];

/**
 * Extended bounding box including surrounding ocean
 */
export const SRI_LANKA_EXTENDED_BBOX: [number, number, number, number] = [68.0, -5.0, 95.0, 20.0];

/**
 * Regional bounding box for South Asia
 */
export const SOUTH_ASIA_BBOX: [number, number, number, number] = [60.0, -10.0, 100.0, 30.0];

/**
 * Wind speed color scale (blue → cyan → green → yellow → orange → red → purple)
 * Based on Beaufort scale ranges
 */
export const WIND_SPEED_COLOR_STOPS: ColorStop[] = [
  { value: 0, color: '#6495ED' },    // Cornflower blue - calm
  { value: 2, color: '#41B6E6' },    // Light blue
  { value: 4, color: '#48D1CC' },    // Medium turquoise
  { value: 6, color: '#3CB371' },    // Medium sea green
  { value: 8, color: '#7CCD52' },    // Yellow-green
  { value: 10, color: '#C0E541' },   // Lime
  { value: 12, color: '#FFEB3B' },   // Yellow
  { value: 15, color: '#FFC107' },   // Amber
  { value: 18, color: '#FF9800' },   // Orange
  { value: 21, color: '#FF5722' },   // Deep orange
  { value: 25, color: '#F44336' },   // Red
  { value: 30, color: '#B71C1C' },   // Dark red
  { value: 40, color: '#9C27B0' },   // Purple - storm
];

/**
 * Beaufort scale descriptions
 */
export const BEAUFORT_SCALE = [
  { min: 0, max: 0.5, name: 'Calm', description: 'Smoke rises vertically' },
  { min: 0.5, max: 1.5, name: 'Light air', description: 'Direction shown by smoke drift' },
  { min: 1.5, max: 3.3, name: 'Light breeze', description: 'Wind felt on face, leaves rustle' },
  { min: 3.3, max: 5.5, name: 'Gentle breeze', description: 'Leaves and small twigs in constant motion' },
  { min: 5.5, max: 7.9, name: 'Moderate breeze', description: 'Raises dust and loose paper' },
  { min: 7.9, max: 10.7, name: 'Fresh breeze', description: 'Small trees sway' },
  { min: 10.7, max: 13.8, name: 'Strong breeze', description: 'Large branches in motion' },
  { min: 13.8, max: 17.1, name: 'Near gale', description: 'Whole trees in motion' },
  { min: 17.1, max: 20.7, name: 'Gale', description: 'Twigs break off trees' },
  { min: 20.7, max: 24.4, name: 'Strong gale', description: 'Slight structural damage' },
  { min: 24.4, max: 28.4, name: 'Storm', description: 'Trees uprooted, considerable damage' },
  { min: 28.4, max: 32.6, name: 'Violent storm', description: 'Widespread damage' },
  { min: 32.6, max: Infinity, name: 'Hurricane', description: 'Devastating damage' },
];

/**
 * Cardinal directions mapping
 */
export const CARDINAL_DIRECTIONS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW'
];

/**
 * Provider priority order for 'auto' mode
 */
export const PROVIDER_PRIORITY: ('icon' | 'gfs' | 'era5')[] = ['icon', 'gfs', 'era5'];

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  wind: '/api/wind',
  windSummary: '/api/wind/summary',
  providerStatus: '/api/wind/status',
};

/**
 * Visualization defaults
 */
export const VISUALIZATION_DEFAULTS = {
  particleCount: 3000,
  particleMaxAge: 80,
  particleSpeed: 0.5,
  vectorSpacing: 50,       // Pixels between vectors
  vectorMinLength: 10,
  vectorMaxLength: 40,
  heatmapOpacity: 0.6,
  trailFadeRate: 0.15,
};

/**
 * Map defaults
 */
export const MAP_DEFAULTS = {
  center: [7.8, 80.7] as [number, number],  // Sri Lanka center
  zoom: 7,
  minZoom: 4,
  maxZoom: 12,
};

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  ttlMinutes: 30,
  maxEntries: 100,
  staleWhileRevalidate: true,
};

/**
 * Request timeout configuration (ms)
 */
export const TIMEOUTS = {
  icon: 30000,
  gfs: 15000,
  era5: 60000,  // ERA5 can be slow due to job queue
};
