/**
 * Wind Data Engine - Utility Functions
 * Core calculations and helper functions for wind data processing
 */

import type { BBox, WindPoint, ColorStop, VectorArrow, WindFieldSummary, WindField } from './types';
import { WIND_SPEED_COLOR_STOPS, CARDINAL_DIRECTIONS, BEAUFORT_SCALE } from './config';

/**
 * Convert U/V components to wind speed (magnitude)
 * @param u - Eastward component (m/s)
 * @param v - Northward component (m/s)
 * @returns Wind speed in m/s
 */
export function uvToSpeed(u: number, v: number): number {
  return Math.sqrt(u * u + v * v);
}

/**
 * Convert U/V components to meteorological wind direction
 * Direction wind is coming FROM (0° = N, 90° = E, 180° = S, 270° = W)
 * @param u - Eastward component (m/s)
 * @param v - Northward component (m/s)
 * @returns Direction in degrees (0-360)
 */
export function uvToDirection(u: number, v: number): number {
  // atan2(-u, -v) gives direction wind is coming FROM
  const radians = Math.atan2(-u, -v);
  let degrees = (radians * 180 / Math.PI + 360) % 360;
  return Math.round(degrees * 10) / 10; // Round to 1 decimal
}

/**
 * Convert direction to the angle wind is blowing TO (for particle movement)
 * @param directionDeg - Meteorological direction (where wind is FROM)
 * @returns Angle in radians for canvas rendering
 */
export function directionToAngle(directionDeg: number): number {
  // Convert from "coming from" to "going to" and to canvas coordinates
  // Canvas: 0 = right, PI/2 = down
  const goingTo = (directionDeg + 180) % 360;
  return (goingTo - 90) * Math.PI / 180;
}

/**
 * Convert direction to canvas rotation angle for arrow rendering
 * Arrow points in the direction wind is blowing TO
 * @param directionDeg - Meteorological direction (where wind is FROM)
 * @returns Angle in radians
 */
export function directionToArrowAngle(directionDeg: number): number {
  // Arrow should point in direction wind is going TO
  const goingTo = (directionDeg + 180) % 360;
  // Convert to radians, adjust for canvas (0 = right, increases clockwise)
  return (goingTo - 90) * Math.PI / 180;
}

/**
 * Convert degrees to cardinal direction string
 * @param degrees - Direction in degrees (0-360)
 * @returns Cardinal direction (N, NE, E, etc.)
 */
export function degreesToCardinal(degrees: number): string {
  const index = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
  return CARDINAL_DIRECTIONS[index];
}

/**
 * Get Beaufort scale info for a wind speed
 * @param speed - Wind speed in m/s
 * @returns Beaufort scale entry
 */
export function getBeaufortScale(speed: number): typeof BEAUFORT_SCALE[0] {
  for (const scale of BEAUFORT_SCALE) {
    if (speed >= scale.min && speed < scale.max) {
      return scale;
    }
  }
  return BEAUFORT_SCALE[BEAUFORT_SCALE.length - 1];
}

/**
 * Interpolate color from speed using color stops
 * @param speed - Wind speed in m/s
 * @param colorStops - Array of color stops (optional, uses default)
 * @returns CSS color string
 */
export function speedToColor(speed: number, colorStops: ColorStop[] = WIND_SPEED_COLOR_STOPS): string {
  // Clamp speed to valid range
  const minSpeed = colorStops[0].value;
  const maxSpeed = colorStops[colorStops.length - 1].value;
  const clampedSpeed = Math.max(minSpeed, Math.min(speed, maxSpeed));

  // Find surrounding color stops
  let lowerStop = colorStops[0];
  let upperStop = colorStops[colorStops.length - 1];

  for (let i = 0; i < colorStops.length - 1; i++) {
    if (clampedSpeed >= colorStops[i].value && clampedSpeed < colorStops[i + 1].value) {
      lowerStop = colorStops[i];
      upperStop = colorStops[i + 1];
      break;
    }
  }

  // Edge case: exact match with last stop
  if (clampedSpeed >= maxSpeed) {
    return colorStops[colorStops.length - 1].color;
  }

  // Interpolate
  const range = upperStop.value - lowerStop.value;
  const t = range > 0 ? (clampedSpeed - lowerStop.value) / range : 0;

  return interpolateColor(lowerStop.color, upperStop.color, t);
}

/**
 * Interpolate between two hex colors
 * @param color1 - Start color (hex)
 * @param color2 - End color (hex)
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated hex color
 */
export function interpolateColor(color1: string, color2: string, t: number): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);

  return rgbToHex(r, g, b);
}

/**
 * Convert hex color to RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB values to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Create a color lookup table for performance
 * @param maxSpeed - Maximum speed for the table
 * @param resolution - Number of entries
 * @returns Uint8Array with RGB values
 */
export function createColorLUT(maxSpeed: number = 50, resolution: number = 256): Uint8Array {
  const lut = new Uint8Array(resolution * 3);

  for (let i = 0; i < resolution; i++) {
    const speed = (i / resolution) * maxSpeed;
    const color = speedToColor(speed);
    const rgb = hexToRgb(color);
    lut[i * 3] = rgb.r;
    lut[i * 3 + 1] = rgb.g;
    lut[i * 3 + 2] = rgb.b;
  }

  return lut;
}

/**
 * Get color from pre-computed LUT
 */
export function getColorFromLUT(lut: Uint8Array, speed: number, maxSpeed: number = 50): [number, number, number] {
  const resolution = lut.length / 3;
  const index = Math.min(Math.floor((speed / maxSpeed) * resolution), resolution - 1);
  return [lut[index * 3], lut[index * 3 + 1], lut[index * 3 + 2]];
}

/**
 * Generate a grid of lat/lon points within a bounding box
 * @param bbox - Bounding box [minLon, minLat, maxLon, maxLat]
 * @param resolutionKm - Grid spacing in kilometers
 * @returns Array of {lat, lon} points
 */
export function generateGrid(bbox: BBox, resolutionKm: number): Array<{ lat: number; lon: number }> {
  const [minLon, minLat, maxLon, maxLat] = bbox;

  // Approximate degrees per km at this latitude
  const avgLat = (minLat + maxLat) / 2;
  const latDegPerKm = 1 / 111.0;
  const lonDegPerKm = 1 / (111.0 * Math.cos(avgLat * Math.PI / 180));

  const latStep = resolutionKm * latDegPerKm;
  const lonStep = resolutionKm * lonDegPerKm;

  const points: Array<{ lat: number; lon: number }> = [];

  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    for (let lon = minLon; lon <= maxLon; lon += lonStep) {
      points.push({ lat, lon });
    }
  }

  return points;
}

/**
 * Calculate grid dimensions for a bbox at given resolution
 */
export function getGridDimensions(bbox: BBox, resolutionKm: number): { width: number; height: number } {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const avgLat = (minLat + maxLat) / 2;

  const latDegPerKm = 1 / 111.0;
  const lonDegPerKm = 1 / (111.0 * Math.cos(avgLat * Math.PI / 180));

  const latStep = resolutionKm * latDegPerKm;
  const lonStep = resolutionKm * lonDegPerKm;

  const width = Math.ceil((maxLon - minLon) / lonStep);
  const height = Math.ceil((maxLat - minLat) / latStep);

  return { width, height };
}

/**
 * Bilinear interpolation of wind at a point from a grid
 * @param lon - Longitude
 * @param lat - Latitude
 * @param grid - 2D array of wind points (indexed by [row][col])
 * @param bbox - Bounding box of the grid
 * @returns Interpolated u, v values or null if outside grid
 */
export function bilinearInterpolate(
  lon: number,
  lat: number,
  grid: WindPoint[][],
  bbox: BBox
): { u: number; v: number } | null {
  const [minLon, minLat, maxLon, maxLat] = bbox;

  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
    return null;
  }

  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  if (rows < 2 || cols < 2) return null;

  // Calculate grid position
  const xFrac = (lon - minLon) / (maxLon - minLon) * (cols - 1);
  const yFrac = (lat - minLat) / (maxLat - minLat) * (rows - 1);

  const x0 = Math.floor(xFrac);
  const y0 = Math.floor(yFrac);
  const x1 = Math.min(x0 + 1, cols - 1);
  const y1 = Math.min(y0 + 1, rows - 1);

  const tx = xFrac - x0;
  const ty = yFrac - y0;

  // Get four corner values
  const p00 = grid[y0][x0];
  const p10 = grid[y0][x1];
  const p01 = grid[y1][x0];
  const p11 = grid[y1][x1];

  if (!p00 || !p10 || !p01 || !p11) return null;

  // Bilinear interpolation
  const u = (1 - tx) * (1 - ty) * p00.u + tx * (1 - ty) * p10.u +
            (1 - tx) * ty * p01.u + tx * ty * p11.u;
  const v = (1 - tx) * (1 - ty) * p00.v + tx * (1 - ty) * p10.v +
            (1 - tx) * ty * p01.v + tx * ty * p11.v;

  return { u, v };
}

/**
 * Calculate statistics from a wind field
 */
export function calculateWindStats(points: WindPoint[]): {
  minSpeed: number;
  maxSpeed: number;
  meanSpeed: number;
  predominantDirection: number;
} {
  if (points.length === 0) {
    return { minSpeed: 0, maxSpeed: 0, meanSpeed: 0, predominantDirection: 0 };
  }

  let minSpeed = Infinity;
  let maxSpeed = -Infinity;
  let sumSpeed = 0;
  let sumU = 0;
  let sumV = 0;

  for (const point of points) {
    minSpeed = Math.min(minSpeed, point.speed);
    maxSpeed = Math.max(maxSpeed, point.speed);
    sumSpeed += point.speed;
    sumU += point.u;
    sumV += point.v;
  }

  const meanSpeed = sumSpeed / points.length;
  const avgU = sumU / points.length;
  const avgV = sumV / points.length;
  const predominantDirection = uvToDirection(avgU, avgV);

  return {
    minSpeed: Math.round(minSpeed * 10) / 10,
    maxSpeed: Math.round(maxSpeed * 10) / 10,
    meanSpeed: Math.round(meanSpeed * 10) / 10,
    predominantDirection: Math.round(predominantDirection),
  };
}

/**
 * Create wind field summary from full field
 */
export function createWindFieldSummary(field: WindField): WindFieldSummary {
  const stats = calculateWindStats(field.points);

  return {
    metadata: field.metadata,
    ...stats,
    predominantDirectionCardinal: degreesToCardinal(stats.predominantDirection),
  };
}

/**
 * Convert wind points array to vector arrows for rendering
 */
export function pointsToVectorArrows(
  points: WindPoint[],
  minLength: number = 10,
  maxLength: number = 40,
  maxSpeed: number = 25
): VectorArrow[] {
  return points.map(point => ({
    lat: point.lat,
    lon: point.lon,
    angle: directionToArrowAngle(point.directionDeg),
    length: minLength + (point.speed / maxSpeed) * (maxLength - minLength),
    color: speedToColor(point.speed),
    speed: point.speed,
  }));
}

/**
 * Debounce function for event handlers
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Format wind speed for display
 */
export function formatWindSpeed(speed: number, decimals: number = 1): string {
  return speed.toFixed(decimals);
}

/**
 * Format wind direction for display
 */
export function formatWindDirection(degrees: number): string {
  return `${Math.round(degrees)}° (${degreesToCardinal(degrees)})`;
}

/**
 * Format timestamp for display
 */
export function formatWindTime(isoTime: string): string {
  const date = new Date(isoTime);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Round time to nearest hour for caching
 */
export function roundToHour(isoTime: string): string {
  const date = new Date(isoTime);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

/**
 * Snap bbox to grid for caching
 */
export function snapBboxToGrid(bbox: BBox, gridSize: number = 0.5): BBox {
  return [
    Math.floor(bbox[0] / gridSize) * gridSize,
    Math.floor(bbox[1] / gridSize) * gridSize,
    Math.ceil(bbox[2] / gridSize) * gridSize,
    Math.ceil(bbox[3] / gridSize) * gridSize,
  ];
}

/**
 * Generate cache key from request parameters
 */
export function generateCacheKey(
  source: string,
  bbox: BBox,
  time: string,
  resolutionKm: number
): string {
  const snappedBbox = snapBboxToGrid(bbox);
  const roundedTime = roundToHour(time);
  return `wind:${source}:${snappedBbox.join(',')}:${roundedTime}:${resolutionKm}`;
}

/**
 * Simple scalar bilinear interpolation
 * @param v00 - Value at (0,0)
 * @param v10 - Value at (1,0)
 * @param v01 - Value at (0,1)
 * @param v11 - Value at (1,1)
 * @param tx - X interpolation factor (0-1)
 * @param ty - Y interpolation factor (0-1)
 */
export function bilinearInterpolateScalar(
  v00: number,
  v10: number,
  v01: number,
  v11: number,
  tx: number,
  ty: number
): number {
  return (1 - tx) * (1 - ty) * v00 +
         tx * (1 - ty) * v10 +
         (1 - tx) * ty * v01 +
         tx * ty * v11;
}

/**
 * Check if a point is within a bounding box
 */
export function isPointInBbox(lat: number, lon: number, bbox: BBox): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

/**
 * Calculate distance between two points in km (Haversine formula)
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find nearest wind point to a given location
 */
export function findNearestPoint(
  lat: number,
  lon: number,
  points: WindPoint[]
): WindPoint | null {
  if (points.length === 0) return null;

  let nearest = points[0];
  let minDist = haversineDistance(lat, lon, nearest.lat, nearest.lon);

  for (const point of points) {
    const dist = haversineDistance(lat, lon, point.lat, point.lon);
    if (dist < minDist) {
      minDist = dist;
      nearest = point;
    }
  }

  return nearest;
}
