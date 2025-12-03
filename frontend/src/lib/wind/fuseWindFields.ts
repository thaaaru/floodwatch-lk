/**
 * Wind Field Fusion Logic
 * Merges wind data from multiple providers with priority-based selection
 * Includes robust fallback to mock data to avoid excessive API calls
 */

import type {
  WindField,
  WindPoint,
  WindSource,
  WindDataRequest,
  ProviderStatus,
  BBox,
} from './types';
import { PROVIDER_PRIORITY } from './config';
import { gfsProvider, iconProvider, era5Provider } from './providers';
import { calculateWindStats, bilinearInterpolate } from './utils';

/**
 * Provider instances mapped by source name
 * Only includes providers that are actually implemented
 */
const providers = {
  icon: iconProvider,
  gfs: gfsProvider,
  era5: era5Provider,
};

/**
 * Track API failures to avoid hammering rate-limited APIs
 */
const providerCooldowns: Map<string, { until: number; reason: string }> = new Map();

/**
 * Check if a provider is in cooldown (rate limited)
 */
function isProviderInCooldown(source: string): boolean {
  const cooldown = providerCooldowns.get(source);
  if (!cooldown) return false;

  if (Date.now() > cooldown.until) {
    providerCooldowns.delete(source);
    return false;
  }

  console.log(`Provider ${source} in cooldown until ${new Date(cooldown.until).toISOString()}: ${cooldown.reason}`);
  return true;
}

/**
 * Set a provider into cooldown
 */
function setProviderCooldown(source: string, minutes: number, reason: string): void {
  const until = Date.now() + minutes * 60 * 1000;
  providerCooldowns.set(source, { until, reason });
  console.log(`Provider ${source} set to cooldown for ${minutes} min: ${reason}`);
}

/**
 * Get wind field with automatic source selection and fallback
 * This is the main entry point for the wind data engine
 *
 * Rate limit strategy:
 * 1. Check if provider is in cooldown before trying
 * 2. On 429 or rate limit error, put provider in 60-min cooldown
 * 3. Fall back to mock data immediately to avoid hammering APIs
 */
export async function getWindField(request: WindDataRequest): Promise<WindField> {
  const { source, bbox, time, resolutionKm = 25 } = request;

  // If specific source requested
  if (source !== 'auto') {
    // Check cooldown for specific source
    if (isProviderInCooldown(source)) {
      console.warn(`Provider ${source} is rate-limited, falling back to mock data`);
      return generateMockWindField(request);
    }

    const provider = providers[source as keyof typeof providers];
    if (!provider) {
      console.warn(`Unknown wind source: ${source}, using mock data`);
      return generateMockWindField(request);
    }

    try {
      const canServe = await provider.canServe(request);
      if (!canServe) {
        console.warn(`Provider ${source} cannot serve, using mock data`);
        return generateMockWindField(request);
      }

      const field = await provider.fetchWindField(request);
      if (field.points.length > 0) {
        return field;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Check for rate limiting
      if (message.includes('429') || message.includes('rate') || message.includes('limit')) {
        setProviderCooldown(source, 60, message);
      }

      console.warn(`Provider ${source} failed: ${message}, using mock data`);
    }

    return generateMockWindField(request);
  }

  // Auto mode: try providers in priority order, respecting cooldowns
  const errors: Array<{ source: WindSource; error: Error }> = [];

  for (const sourceName of PROVIDER_PRIORITY) {
    // Skip if in cooldown
    if (isProviderInCooldown(sourceName)) {
      continue;
    }

    const provider = providers[sourceName];

    try {
      const canServe = await provider.canServe(request);
      if (!canServe) {
        continue;
      }

      const field = await provider.fetchWindField(request);

      // Validate field has data
      if (field.points.length > 0) {
        return field;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push({ source: sourceName, error: err });

      // Check for rate limiting and set cooldown
      const message = err.message;
      if (message.includes('429') || message.includes('rate') || message.includes('limit') || message.includes('exceeded')) {
        setProviderCooldown(sourceName, 60, message);
      }
    }
  }

  // All providers failed or in cooldown - use mock data
  console.warn('All providers failed or rate-limited, using mock wind data');
  return generateMockWindField(request);
}

/**
 * Generate mock wind data for demonstration/fallback
 * Creates realistic-looking wind patterns
 */
function generateMockWindField(request: WindDataRequest): WindField {
  const { bbox, resolutionKm = 25 } = request;
  const [minLon, minLat, maxLon, maxLat] = bbox;

  // Calculate grid dimensions
  const latRange = maxLat - minLat;
  const lonRange = maxLon - minLon;
  const avgLat = (minLat + maxLat) / 2;
  const kmPerDegreeLat = 111;
  const kmPerDegreeLon = 111 * Math.cos((avgLat * Math.PI) / 180);

  const gridWidth = Math.max(5, Math.ceil((lonRange * kmPerDegreeLon) / resolutionKm));
  const gridHeight = Math.max(5, Math.ceil((latRange * kmPerDegreeLat) / resolutionKm));

  const latStep = latRange / (gridHeight - 1);
  const lonStep = lonRange / (gridWidth - 1);

  const points: WindPoint[] = [];
  const now = new Date();

  // Create wind pattern - simulate monsoon-like pattern for South Asia
  // Base direction: southwest monsoon (coming from southwest)
  const baseDirection = 225; // degrees (from SW)
  const baseSpeed = 5; // m/s

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const lat = minLat + y * latStep;
      const lon = minLon + x * lonStep;

      // Add variation based on position
      const latFactor = (lat - minLat) / latRange;
      const lonFactor = (lon - minLon) / lonRange;

      // Simulate some turbulence/variation
      const noise1 = Math.sin(lat * 2 + lon * 3) * 0.5;
      const noise2 = Math.cos(lat * 3 - lon * 2) * 0.3;

      // Speed varies with latitude (stronger near equator)
      const speed = baseSpeed +
        Math.abs(Math.sin(latFactor * Math.PI)) * 4 + // Stronger in middle
        noise1 * 2 +
        Math.random() * 1.5; // Some randomness

      // Direction varies slightly
      const direction = baseDirection +
        (lonFactor - 0.5) * 30 + // Curve with longitude
        noise2 * 20 +
        (Math.random() - 0.5) * 10;

      // Convert direction to U/V components
      const dirRad = (direction * Math.PI) / 180;
      const u = -speed * Math.sin(dirRad);
      const v = -speed * Math.cos(dirRad);

      points.push({
        lat,
        lon,
        u,
        v,
        speed,
        directionDeg: direction,
        time: now.toISOString(),
        source: 'mock',
      });
    }
  }

  // Calculate stats
  const speeds = points.map(p => p.speed);
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);
  const meanSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

  return {
    metadata: {
      source: 'mock',
      time: now.toISOString(),
      bbox,
      resolutionKm,
      gridWidth,
      gridHeight,
      minSpeed,
      maxSpeed,
      meanSpeed,
      fetchedAt: now.toISOString(),
    },
    points,
  };
}

/**
 * Fuse multiple wind fields into one
 * Uses priority-based selection with optional blending
 */
export function fuseWindFields(
  fields: WindField[],
  priorityOrder: WindSource[] = PROVIDER_PRIORITY
): WindField {
  if (fields.length === 0) {
    throw new Error('No wind fields to fuse');
  }

  if (fields.length === 1) {
    return fields[0];
  }

  // Sort fields by priority
  const sortedFields = [...fields].sort((a, b) => {
    const priorityA = priorityOrder.indexOf(a.metadata.source as WindSource);
    const priorityB = priorityOrder.indexOf(b.metadata.source as WindSource);
    return priorityA - priorityB;
  });

  // Use highest priority field as base
  const baseField = sortedFields[0];

  // For simple fusion, just return the highest priority field
  // Advanced fusion could blend overlapping areas

  return {
    ...baseField,
    metadata: {
      ...baseField.metadata,
      source: 'auto', // Mark as auto-fused
    },
  };
}

/**
 * Blend two wind fields at overlapping points
 * Uses weighted average based on resolution (higher resolution = more weight)
 */
export function blendWindFields(
  field1: WindField,
  field2: WindField,
  weight1: number = 0.6 // Weight for field1
): WindField {
  const weight2 = 1 - weight1;

  // Find common bbox
  const bbox: BBox = [
    Math.max(field1.metadata.bbox[0], field2.metadata.bbox[0]),
    Math.max(field1.metadata.bbox[1], field2.metadata.bbox[1]),
    Math.min(field1.metadata.bbox[2], field2.metadata.bbox[2]),
    Math.min(field1.metadata.bbox[3], field2.metadata.bbox[3]),
  ];

  // Filter points within common bbox
  const points1 = field1.points.filter(p =>
    p.lon >= bbox[0] && p.lon <= bbox[2] &&
    p.lat >= bbox[1] && p.lat <= bbox[3]
  );

  const points2 = field2.points.filter(p =>
    p.lon >= bbox[0] && p.lon <= bbox[2] &&
    p.lat >= bbox[1] && p.lat <= bbox[3]
  );

  // Create point map for field2 by approximate location
  const point2Map = new Map<string, WindPoint>();
  for (const p of points2) {
    const key = `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
    point2Map.set(key, p);
  }

  // Blend points
  const blendedPoints: WindPoint[] = [];

  for (const p1 of points1) {
    const key = `${p1.lat.toFixed(2)},${p1.lon.toFixed(2)}`;
    const p2 = point2Map.get(key);

    if (p2) {
      // Blend the two points
      const u = p1.u * weight1 + p2.u * weight2;
      const v = p1.v * weight1 + p2.v * weight2;
      const speed = Math.sqrt(u * u + v * v);
      const directionDeg = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;

      blendedPoints.push({
        lat: p1.lat,
        lon: p1.lon,
        u,
        v,
        speed,
        directionDeg,
        time: p1.time,
        source: 'auto',
      });
    } else {
      // No matching point in field2, use field1 as-is
      blendedPoints.push({ ...p1, source: 'auto' });
    }
  }

  const stats = calculateWindStats(blendedPoints);

  return {
    metadata: {
      source: 'auto',
      time: field1.metadata.time,
      bbox,
      resolutionKm: Math.min(field1.metadata.resolutionKm, field2.metadata.resolutionKm),
      gridWidth: Math.max(field1.metadata.gridWidth, field2.metadata.gridWidth),
      gridHeight: Math.max(field1.metadata.gridHeight, field2.metadata.gridHeight),
      minSpeed: stats.minSpeed,
      maxSpeed: stats.maxSpeed,
      meanSpeed: stats.meanSpeed,
      fetchedAt: new Date().toISOString(),
    },
    points: blendedPoints,
  };
}

/**
 * Check status of all providers
 */
export async function checkProviderStatus(): Promise<ProviderStatus[]> {
  const statuses: ProviderStatus[] = [];

  for (const [name, provider] of Object.entries(providers)) {
    const startTime = Date.now();

    try {
      // Simple availability check
      const canServe = await provider.canServe({
        bbox: [79, 6, 82, 10], // Small test bbox
        source: name as WindSource,
        resolutionKm: 50,
      });

      statuses.push({
        source: name as WindSource,
        available: canServe,
        lastChecked: new Date().toISOString(),
        latency: Date.now() - startTime,
      });
    } catch (error) {
      statuses.push({
        source: name as WindSource,
        available: false,
        lastChecked: new Date().toISOString(),
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return statuses;
}

/**
 * Get recommended source for a request
 */
export async function getRecommendedSource(request: WindDataRequest): Promise<WindSource> {
  for (const source of PROVIDER_PRIORITY) {
    const provider = providers[source];
    try {
      if (await provider.canServe({ ...request, source })) {
        return source;
      }
    } catch {
      continue;
    }
  }

  return 'gfs'; // Default fallback
}

/**
 * Validate that a wind field has sufficient data
 */
export function validateWindField(field: WindField): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (field.points.length === 0) {
    issues.push('No data points');
  }

  if (field.points.length < 10) {
    issues.push('Very few data points (less than 10)');
  }

  if (field.metadata.maxSpeed <= 0) {
    issues.push('Invalid max speed');
  }

  // Check for NaN values
  const hasNaN = field.points.some(
    p => isNaN(p.u) || isNaN(p.v) || isNaN(p.speed)
  );
  if (hasNaN) {
    issues.push('Contains NaN values');
  }

  // Check bbox consistency
  const outOfBounds = field.points.filter(
    p =>
      p.lon < field.metadata.bbox[0] ||
      p.lon > field.metadata.bbox[2] ||
      p.lat < field.metadata.bbox[1] ||
      p.lat > field.metadata.bbox[3]
  );
  if (outOfBounds.length > 0) {
    issues.push(`${outOfBounds.length} points outside declared bbox`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
