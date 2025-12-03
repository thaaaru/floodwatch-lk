/**
 * GFS Wind Data Provider
 * Uses Open-Meteo API as a JSON interface to GFS data
 * https://api.open-meteo.com/v1/gfs
 */

import type {
  WindDataProvider,
  WindDataRequest,
  WindField,
  WindPoint,
  BBox,
} from '../types';
import { windConfig, TIMEOUTS } from '../config';
import {
  uvToSpeed,
  uvToDirection,
  generateGrid,
  getGridDimensions,
  calculateWindStats,
} from '../utils';

const GFS_BASE_URL = windConfig.providers.gfs.baseUrl;

/**
 * Open-Meteo API response types
 */
interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units?: {
    time: string;
    wind_speed_10m: string;
    wind_direction_10m: string;
  };
  hourly?: {
    time: string[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_u_component_10m?: number[];
    wind_v_component_10m?: number[];
  };
  current?: {
    time: string;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
}

/**
 * GFS Provider implementation using Open-Meteo
 */
class GFSProvider implements WindDataProvider {
  name: 'gfs' = 'gfs';

  /**
   * Check if provider can serve the request
   */
  async canServe(request: WindDataRequest): Promise<boolean> {
    if (!windConfig.providers.gfs.enabled) {
      return false;
    }

    // GFS via Open-Meteo has good global coverage
    // Check if bbox is within reasonable bounds
    const [minLon, minLat, maxLon, maxLat] = request.bbox;

    // Open-Meteo supports global coverage
    if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) {
      return false;
    }

    // Check time range (GFS provides ~16 days forecast, ~5 days historical)
    if (request.time) {
      const requestTime = new Date(request.time);
      const now = new Date();
      const daysDiff = (requestTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff < -5 || daysDiff > 16) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get available time range
   */
  async getAvailableTimeRange(): Promise<{ start: string; end: string }> {
    const now = new Date();
    const start = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const end = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000);  // 16 days ahead

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  /**
   * Fetch wind field data using bulk API to avoid rate limits
   */
  async fetchWindField(request: WindDataRequest): Promise<WindField> {
    const { bbox, resolutionKm = 25 } = request;
    const now = new Date().toISOString();

    // Generate grid points
    const gridPoints = generateGrid(bbox, resolutionKm);
    const { width, height } = getGridDimensions(bbox, resolutionKm);

    // Use bulk API - comma-separated coordinates in single requests
    // Max ~100 points per request to avoid URL length limits
    const maxPointsPerRequest = 100;
    const points: WindPoint[] = [];

    for (let i = 0; i < gridPoints.length; i += maxPointsPerRequest) {
      const chunk = gridPoints.slice(i, i + maxPointsPerRequest);

      const latitudes = chunk.map(p => p.lat.toFixed(2)).join(',');
      const longitudes = chunk.map(p => p.lon.toFixed(2)).join(',');

      try {
        const params = new URLSearchParams({
          latitude: latitudes,
          longitude: longitudes,
          current: 'wind_speed_10m,wind_direction_10m',
          wind_speed_unit: 'ms',
          timezone: 'UTC',
        });

        const response = await fetch(`${GFS_BASE_URL}/forecast?${params}`, {
          signal: AbortSignal.timeout(15000),
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          console.warn(`GFS bulk fetch failed: ${response.status}`);
          continue;
        }

        const data = await response.json();

        // Response is an array when multiple locations requested
        const results = Array.isArray(data) ? data : [data];

        for (const result of results) {
          if (!result.current) continue;

          const speed = result.current.wind_speed_10m;
          const direction = result.current.wind_direction_10m;

          if (speed == null || direction == null) continue;

          const directionRad = (direction * Math.PI) / 180;
          const u = -speed * Math.sin(directionRad);
          const v = -speed * Math.cos(directionRad);

          points.push({
            lat: result.latitude,
            lon: result.longitude,
            u,
            v,
            speed,
            directionDeg: direction,
            time: result.current.time,
            source: 'gfs',
          });
        }
      } catch (error) {
        console.warn('GFS bulk fetch error:', error);
      }

      // Small delay between chunks
      if (i + maxPointsPerRequest < gridPoints.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Calculate statistics
    const stats = calculateWindStats(points);

    return {
      metadata: {
        source: 'gfs',
        time: now,
        bbox,
        resolutionKm,
        gridWidth: width,
        gridHeight: height,
        minSpeed: stats.minSpeed,
        maxSpeed: stats.maxSpeed,
        meanSpeed: stats.meanSpeed,
        fetchedAt: now,
      },
      points,
    };
  }

  /**
   * Fetch wind data for multiple grid points
   * Uses batching to minimize API calls
   */
  private async fetchGridPoints(
    points: Array<{ lat: number; lon: number }>,
    time: string
  ): Promise<WindPoint[]> {
    // Open-Meteo allows up to 1000 locations per request with their commercial API
    // For the free API, we need to make individual requests but can batch them
    // We'll use a grid-based approach with concurrent requests

    const batchSize = 50; // Concurrent requests limit
    const results: WindPoint[] = [];

    // Split into batches
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);

      // Fetch batch concurrently
      const batchResults = await Promise.all(
        batch.map(point => this.fetchSinglePoint(point.lat, point.lon, time))
      );

      results.push(...batchResults.filter((p): p is WindPoint => p !== null));

      // Small delay between batches to be respectful to the API
      if (i + batchSize < points.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Fetch wind data for a single point
   */
  private async fetchSinglePoint(
    lat: number,
    lon: number,
    time: string
  ): Promise<WindPoint | null> {
    try {
      const targetTime = new Date(time);
      const targetHour = targetTime.toISOString().slice(0, 13) + ':00';

      const params = new URLSearchParams({
        latitude: lat.toFixed(4),
        longitude: lon.toFixed(4),
        hourly: 'wind_speed_10m,wind_direction_10m',
        wind_speed_unit: 'ms',
        timezone: 'UTC',
        forecast_days: '1',
      });

      // Add date parameters for historical data
      const now = new Date();
      if (targetTime < now) {
        params.set('past_days', '5');
      }

      const url = `${GFS_BASE_URL}/gfs?${params.toString()}`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUTS.gfs),
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`GFS fetch failed for ${lat},${lon}: ${response.status}`);
        return null;
      }

      const data: OpenMeteoResponse = await response.json();

      if (!data.hourly?.time || !data.hourly?.wind_speed_10m || !data.hourly?.wind_direction_10m) {
        return null;
      }

      // Find closest time index
      const timeIndex = this.findClosestTimeIndex(data.hourly.time, targetHour);

      if (timeIndex === -1) {
        return null;
      }

      const speed = data.hourly.wind_speed_10m[timeIndex];
      const direction = data.hourly.wind_direction_10m[timeIndex];

      // Convert direction to U/V components
      // Direction is where wind is coming FROM
      const directionRad = direction * Math.PI / 180;
      const u = -speed * Math.sin(directionRad);
      const v = -speed * Math.cos(directionRad);

      return {
        lat: data.latitude,
        lon: data.longitude,
        u,
        v,
        speed,
        directionDeg: direction,
        time: data.hourly.time[timeIndex],
        source: 'gfs',
      };
    } catch (error) {
      console.warn(`GFS fetch error for ${lat},${lon}:`, error);
      return null;
    }
  }

  /**
   * Find the closest time index in the hourly array
   */
  private findClosestTimeIndex(times: string[], targetTime: string): number {
    const target = new Date(targetTime).getTime();

    let closestIndex = -1;
    let closestDiff = Infinity;

    for (let i = 0; i < times.length; i++) {
      const diff = Math.abs(new Date(times[i]).getTime() - target);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    return closestIndex;
  }
}

/**
 * Fetch wind data using Open-Meteo's multi-location API
 * This makes ONE request for ALL grid points - no rate limiting!
 */
export async function fetchGFSBulk(bbox: BBox, resolutionKm: number = 50): Promise<WindField> {
  const gridPoints = generateGrid(bbox, resolutionKm);
  const { width, height } = getGridDimensions(bbox, resolutionKm);
  const now = new Date().toISOString();

  // Open-Meteo supports comma-separated lat/lon lists
  // But has a limit, so we chunk if needed (max ~100 points per request recommended)
  const maxPointsPerRequest = 100;
  const points: WindPoint[] = [];

  for (let i = 0; i < gridPoints.length; i += maxPointsPerRequest) {
    const chunk = gridPoints.slice(i, i + maxPointsPerRequest);

    const latitudes = chunk.map(p => p.lat.toFixed(2)).join(',');
    const longitudes = chunk.map(p => p.lon.toFixed(2)).join(',');

    try {
      const params = new URLSearchParams({
        latitude: latitudes,
        longitude: longitudes,
        current: 'wind_speed_10m,wind_direction_10m',
        wind_speed_unit: 'ms',
        timezone: 'UTC',
      });

      const response = await fetch(`${GFS_BASE_URL}/forecast?${params}`, {
        signal: AbortSignal.timeout(15000),
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.warn(`GFS bulk fetch failed: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Response is an array when multiple locations requested
      const results = Array.isArray(data) ? data : [data];

      for (const result of results) {
        if (!result.current) continue;

        const speed = result.current.wind_speed_10m;
        const direction = result.current.wind_direction_10m;

        if (speed == null || direction == null) continue;

        const directionRad = (direction * Math.PI) / 180;
        const u = -speed * Math.sin(directionRad);
        const v = -speed * Math.cos(directionRad);

        points.push({
          lat: result.latitude,
          lon: result.longitude,
          u,
          v,
          speed,
          directionDeg: direction,
          time: result.current.time,
          source: 'gfs',
        });
      }
    } catch (error) {
      console.warn('GFS bulk fetch error:', error);
    }

    // Small delay between chunks to be respectful
    if (i + maxPointsPerRequest < gridPoints.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const stats = calculateWindStats(points);

  return {
    metadata: {
      source: 'gfs',
      time: now,
      bbox,
      resolutionKm,
      gridWidth: width,
      gridHeight: height,
      minSpeed: stats.minSpeed,
      maxSpeed: stats.maxSpeed,
      meanSpeed: stats.meanSpeed,
      fetchedAt: now,
    },
    points,
  };
}

// Export singleton instance
export const gfsProvider = new GFSProvider();
export default gfsProvider;
