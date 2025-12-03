/**
 * ICON Wind Data Provider
 * Fetches data from DWD (German Weather Service) Open Data
 * https://opendata.dwd.de/weather/nwp/icon/grib/
 *
 * ICON (ICOsahedral Nonhydrostatic) is a high-resolution global model
 * - Global: ~13km resolution
 * - EU-Nest: ~6.5km resolution over Europe
 * - D2: ~2km resolution over Germany
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

const ICON_BASE_URL = windConfig.providers.icon.baseUrl;

// ICON model run times (UTC)
const ICON_RUN_HOURS = [0, 6, 12, 18];

// Forecast hour steps available
const ICON_FORECAST_STEPS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 102, 108, 114, 120];

/**
 * ICON Provider implementation
 *
 * Note: This provider uses DWD Open Data which serves GRIB2 files.
 * For production use, you would need a GRIB2 parser like:
 * - ecCodes (via wasm or native binding)
 * - grib2json (npm package)
 *
 * For now, this implementation provides the structure and can be
 * extended with actual GRIB parsing when needed.
 */
class ICONProvider implements WindDataProvider {
  name: 'icon' = 'icon';

  /**
   * Check if provider can serve the request
   */
  async canServe(request: WindDataRequest): Promise<boolean> {
    if (!windConfig.providers.icon.enabled) {
      return false;
    }

    // ICON global covers the entire globe
    const [minLon, minLat, maxLon, maxLat] = request.bbox;

    if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) {
      return false;
    }

    // ICON provides ~5 days of forecast
    if (request.time) {
      const requestTime = new Date(request.time);
      const now = new Date();
      const hoursDiff = (requestTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // ICON doesn't provide historical data via open data
      // Forecast up to ~120 hours ahead
      if (hoursDiff < -6 || hoursDiff > 120) {
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
    const latestRun = this.getLatestModelRun(now);

    return {
      start: latestRun.toISOString(),
      end: new Date(latestRun.getTime() + 120 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Get the latest available model run time
   */
  private getLatestModelRun(now: Date): Date {
    const currentHour = now.getUTCHours();

    // Find the latest run that would be available (typically ~4 hours delay)
    const availableHour = ICON_RUN_HOURS
      .filter(h => h <= currentHour - 4)
      .pop() || ICON_RUN_HOURS[ICON_RUN_HOURS.length - 1];

    const runDate = new Date(now);

    // If we need to go back to previous day
    if (availableHour > currentHour - 4) {
      runDate.setUTCDate(runDate.getUTCDate() - 1);
    }

    runDate.setUTCHours(availableHour, 0, 0, 0);
    return runDate;
  }

  /**
   * Fetch wind field data
   *
   * In a full implementation, this would:
   * 1. Download GRIB2 files for U and V components
   * 2. Parse GRIB2 data
   * 3. Extract values for the requested bbox
   * 4. Interpolate to requested resolution
   */
  async fetchWindField(request: WindDataRequest): Promise<WindField> {
    const { bbox, time, resolutionKm = 25 } = request;
    const requestTime = time ? new Date(time) : new Date();

    // Get model run and forecast hour
    const latestRun = this.getLatestModelRun(new Date());
    const forecastHour = this.getForecastHour(latestRun, requestTime);

    // Generate grid points
    const gridPoints = generateGrid(bbox, resolutionKm);
    const { width, height } = getGridDimensions(bbox, resolutionKm);

    // TODO: Implement actual GRIB2 fetching and parsing
    // For now, return a placeholder that indicates ICON is not yet implemented
    // but maintains the correct structure

    // Attempt to fetch ICON data
    let windPoints: WindPoint[];

    try {
      windPoints = await this.fetchICONData(bbox, latestRun, forecastHour, resolutionKm);
    } catch (error) {
      console.warn('ICON fetch failed, using fallback:', error);
      // Return empty field - fusion logic will fall back to other providers
      windPoints = [];
    }

    const stats = calculateWindStats(windPoints);

    return {
      metadata: {
        source: 'icon',
        time: this.calculateValidTime(latestRun, forecastHour).toISOString(),
        bbox,
        resolutionKm,
        gridWidth: width,
        gridHeight: height,
        minSpeed: stats.minSpeed,
        maxSpeed: stats.maxSpeed,
        meanSpeed: stats.meanSpeed,
        fetchedAt: new Date().toISOString(),
      },
      points: windPoints,
    };
  }

  /**
   * Get the closest forecast hour step
   */
  private getForecastHour(modelRun: Date, targetTime: Date): number {
    const hoursDiff = (targetTime.getTime() - modelRun.getTime()) / (1000 * 60 * 60);

    // Find closest available forecast step
    let closest = ICON_FORECAST_STEPS[0];
    let closestDiff = Math.abs(hoursDiff - closest);

    for (const step of ICON_FORECAST_STEPS) {
      const diff = Math.abs(hoursDiff - step);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = step;
      }
    }

    return closest;
  }

  /**
   * Calculate valid time from model run and forecast hour
   */
  private calculateValidTime(modelRun: Date, forecastHour: number): Date {
    return new Date(modelRun.getTime() + forecastHour * 60 * 60 * 1000);
  }

  /**
   * Fetch ICON data from DWD Open Data
   *
   * This is a placeholder implementation. In production:
   * 1. Construct URLs for U_10M and V_10M GRIB2 files
   * 2. Download the files
   * 3. Parse GRIB2 data
   * 4. Extract and interpolate values
   */
  private async fetchICONData(
    bbox: BBox,
    modelRun: Date,
    forecastHour: number,
    resolutionKm: number
  ): Promise<WindPoint[]> {
    // Build file URLs
    const runStr = this.formatModelRun(modelRun);
    const forecastStr = forecastHour.toString().padStart(3, '0');

    // Example URLs (these would need to be constructed based on actual DWD naming conventions)
    const uUrl = `${ICON_BASE_URL}/${runStr}/icon_global_icosahedral_single-level_${runStr}_${forecastStr}_U_10M.grib2.bz2`;
    const vUrl = `${ICON_BASE_URL}/${runStr}/icon_global_icosahedral_single-level_${runStr}_${forecastStr}_V_10M.grib2.bz2`;

    console.log('ICON URLs (not implemented):', { uUrl, vUrl });

    // TODO: Implement actual GRIB2 fetching and parsing
    // This would require:
    // 1. fetch() the .grib2.bz2 files
    // 2. Decompress with bz2 library
    // 3. Parse GRIB2 with appropriate library
    // 4. Extract U/V values at grid points
    // 5. Convert to WindPoint array

    // For now, throw to trigger fallback
    throw new Error('ICON GRIB2 parsing not yet implemented');
  }

  /**
   * Format model run time for URL construction
   */
  private formatModelRun(modelRun: Date): string {
    const year = modelRun.getUTCFullYear();
    const month = (modelRun.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = modelRun.getUTCDate().toString().padStart(2, '0');
    const hour = modelRun.getUTCHours().toString().padStart(2, '0');

    return `${year}${month}${day}${hour}`;
  }
}

/**
 * Helper function to get ICON data URL patterns
 * Useful for documentation and testing
 */
export function getICONDataUrls(modelRun: Date, forecastHour: number): {
  u: string;
  v: string;
  baseUrl: string;
} {
  const runStr = [
    modelRun.getUTCFullYear(),
    (modelRun.getUTCMonth() + 1).toString().padStart(2, '0'),
    modelRun.getUTCDate().toString().padStart(2, '0'),
    modelRun.getUTCHours().toString().padStart(2, '0'),
  ].join('');

  const forecastStr = forecastHour.toString().padStart(3, '0');

  return {
    baseUrl: ICON_BASE_URL,
    u: `${ICON_BASE_URL}/${runStr}/icon_global_icosahedral_single-level_${runStr}_${forecastStr}_U_10M.grib2.bz2`,
    v: `${ICON_BASE_URL}/${runStr}/icon_global_icosahedral_single-level_${runStr}_${forecastStr}_V_10M.grib2.bz2`,
  };
}

// Export singleton instance
export const iconProvider = new ICONProvider();
export default iconProvider;
