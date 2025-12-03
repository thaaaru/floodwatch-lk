/**
 * Wind Data Engine - Type Definitions
 * Core types for multi-source wind visualization system
 */

// Wind data sources
export type WindSource = 'icon' | 'gfs' | 'era5' | 'openweather' | 'mock' | 'auto';

// Visualization modes
export type WindVisualizationMode = 'vectors' | 'particles' | 'heatmap' | 'low-bandwidth';

// Bounding box: [minLon, minLat, maxLon, maxLat]
export type BBox = [number, number, number, number];

/**
 * Single wind data point with all computed properties
 */
export interface WindPoint {
  lat: number;
  lon: number;
  u: number;              // Eastward component (m/s)
  v: number;              // Northward component (m/s)
  speed: number;          // Wind speed magnitude (m/s)
  directionDeg: number;   // Meteorological direction (degrees, 0=N, 90=E)
  time: string;           // ISO 8601 timestamp
  source: WindSource;     // Data source identifier
}

/**
 * Wind field metadata
 */
export interface WindFieldMetadata {
  source: WindSource;
  time: string;           // ISO 8601 timestamp
  bbox: BBox;
  resolutionKm: number;
  gridWidth: number;      // Number of columns
  gridHeight: number;     // Number of rows
  minSpeed: number;
  maxSpeed: number;
  meanSpeed: number;
  fetchedAt: string;      // When data was retrieved
}

/**
 * Complete wind field with metadata and data points
 */
export interface WindField {
  metadata: WindFieldMetadata;
  points: WindPoint[];
}

/**
 * Wind field summary for low-bandwidth mode
 */
export interface WindFieldSummary {
  metadata: WindFieldMetadata;
  maxSpeed: number;
  meanSpeed: number;
  minSpeed: number;
  predominantDirection: number;        // Degrees
  predominantDirectionCardinal: string; // e.g., "NW"
  regionStats?: RegionStat[];
}

/**
 * Regional statistics for summary endpoint
 */
export interface RegionStat {
  name: string;
  bbox: BBox;
  meanSpeed: number;
  maxSpeed: number;
  predominantDirection: number;
}

/**
 * Request options for wind data
 */
export interface WindDataRequest {
  bbox: BBox;
  time?: string;          // ISO 8601, defaults to now
  source: WindSource;
  resolutionKm?: number;  // Default 25km
}

/**
 * Provider interface - all providers must implement this
 */
export interface WindDataProvider {
  name: WindSource;

  /**
   * Check if provider can serve data for given request
   */
  canServe(request: WindDataRequest): Promise<boolean>;

  /**
   * Fetch wind data for the given request
   */
  fetchWindField(request: WindDataRequest): Promise<WindField>;

  /**
   * Get available time range for this provider
   */
  getAvailableTimeRange(): Promise<{ start: string; end: string }>;
}

/**
 * Cache entry for wind data
 */
export interface WindCacheEntry {
  field: WindField;
  cachedAt: string;
  expiresAt: string;
}

/**
 * Provider status for health checks
 */
export interface ProviderStatus {
  source: WindSource;
  available: boolean;
  lastChecked: string;
  latency?: number;
  error?: string;
}

/**
 * Configuration for wind data engine
 */
export interface WindEngineConfig {
  defaultSource: WindSource;
  defaultResolutionKm: number;
  cacheTTLMinutes: number;
  maxPointsPerRequest: number;
  providers: {
    icon: {
      enabled: boolean;
      baseUrl: string;
    };
    gfs: {
      enabled: boolean;
      baseUrl: string;
    };
    era5: {
      enabled: boolean;
      apiUrl: string;
      apiKey?: string;
    };
  };
}

/**
 * Color stop for gradient scales
 */
export interface ColorStop {
  value: number;
  color: string;
}

/**
 * Particle for animation
 */
export interface WindParticle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  speed: number;
}

/**
 * Vector arrow properties
 */
export interface VectorArrow {
  lat: number;
  lon: number;
  angle: number;       // Radians, for canvas rotation
  length: number;      // Scaled by speed
  color: string;
  speed: number;
}

/**
 * API response types
 */
export interface WindAPIResponse {
  success: boolean;
  data?: WindField;
  error?: string;
}

export interface WindSummaryAPIResponse {
  success: boolean;
  data?: WindFieldSummary;
  error?: string;
}

/**
 * Event types for wind visualization
 */
export interface WindHoverEvent {
  point: WindPoint | null;
  screenX: number;
  screenY: number;
}

export interface WindClickEvent {
  point: WindPoint;
  screenX: number;
  screenY: number;
}
