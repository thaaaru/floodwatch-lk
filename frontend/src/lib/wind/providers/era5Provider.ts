/**
 * ERA5 Wind Data Provider
 * Uses ECMWF Climate Data Store (CDS) API
 * https://cds.climate.copernicus.eu/api/v2
 *
 * ERA5 is a reanalysis dataset providing:
 * - Hourly data from 1979 to present (~5 days lag)
 * - 0.25° resolution (~31km)
 * - Excellent for historical analysis
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

const CDS_API_URL = windConfig.providers.era5.apiUrl;
const CDS_API_KEY = windConfig.providers.era5.apiKey;

/**
 * CDS API response types
 */
interface CDSJobResponse {
  state: 'queued' | 'running' | 'completed' | 'failed';
  request_id: string;
  location?: string;  // Download URL when completed
  error?: {
    message: string;
  };
}

/**
 * ERA5 Provider implementation
 *
 * Note: ERA5 data access requires:
 * 1. CDS account and API key
 * 2. Acceptance of terms for ERA5 dataset
 *
 * The CDS API is job-based:
 * 1. Submit data request
 * 2. Poll for completion
 * 3. Download NetCDF file
 * 4. Parse and extract data
 *
 * For production, consider pre-processing and caching ERA5 data
 * to tiles/GeoJSON format for faster access.
 */
class ERA5Provider implements WindDataProvider {
  name: 'era5' = 'era5';

  /**
   * Check if provider can serve the request
   */
  async canServe(request: WindDataRequest): Promise<boolean> {
    if (!windConfig.providers.era5.enabled) {
      return false;
    }

    if (!CDS_API_KEY) {
      console.warn('ERA5 provider: CDS_API_KEY not configured');
      return false;
    }

    // ERA5 covers the globe
    const [minLon, minLat, maxLon, maxLat] = request.bbox;
    if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) {
      return false;
    }

    // ERA5 is historical only (~5 days lag)
    if (request.time) {
      const requestTime = new Date(request.time);
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      // ERA5 available from 1979 to ~5 days ago
      if (requestTime > fiveDaysAgo || requestTime < new Date('1979-01-01')) {
        return false;
      }
    } else {
      // If no time specified, ERA5 can't serve "current" data
      return false;
    }

    return true;
  }

  /**
   * Get available time range
   */
  async getAvailableTimeRange(): Promise<{ start: string; end: string }> {
    const now = new Date();
    const end = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

    return {
      start: '1979-01-01T00:00:00Z',
      end: end.toISOString(),
    };
  }

  /**
   * Fetch wind field data from ERA5
   */
  async fetchWindField(request: WindDataRequest): Promise<WindField> {
    const { bbox, time, resolutionKm = 25 } = request;

    if (!time) {
      throw new Error('ERA5 requires a specific time parameter');
    }

    const requestTime = new Date(time);

    // Generate grid points
    const gridPoints = generateGrid(bbox, resolutionKm);
    const { width, height } = getGridDimensions(bbox, resolutionKm);

    let windPoints: WindPoint[];

    try {
      windPoints = await this.fetchERA5Data(bbox, requestTime, resolutionKm);
    } catch (error) {
      console.warn('ERA5 fetch failed:', error);
      windPoints = [];
    }

    const stats = calculateWindStats(windPoints);

    return {
      metadata: {
        source: 'era5',
        time: requestTime.toISOString(),
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
   * Fetch ERA5 data from CDS API
   *
   * This is a placeholder for the actual CDS API implementation.
   * The CDS API workflow:
   * 1. POST request to submit a data retrieval job
   * 2. Poll the job status until completed
   * 3. Download the NetCDF file
   * 4. Parse and extract data
   */
  private async fetchERA5Data(
    bbox: BBox,
    time: Date,
    resolutionKm: number
  ): Promise<WindPoint[]> {
    if (!CDS_API_KEY) {
      throw new Error('CDS API key not configured');
    }

    // Build CDS API request
    const [minLon, minLat, maxLon, maxLat] = bbox;

    const cdsRequest = {
      product_type: 'reanalysis',
      format: 'netcdf',
      variable: [
        '10m_u_component_of_wind',
        '10m_v_component_of_wind',
      ],
      year: time.getUTCFullYear().toString(),
      month: (time.getUTCMonth() + 1).toString().padStart(2, '0'),
      day: time.getUTCDate().toString().padStart(2, '0'),
      time: time.getUTCHours().toString().padStart(2, '0') + ':00',
      area: [maxLat, minLon, minLat, maxLon], // North, West, South, East
    };

    console.log('ERA5 CDS request (not implemented):', cdsRequest);

    // TODO: Implement actual CDS API calls
    // This would require:
    // 1. Submit job to CDS API
    // 2. Poll for completion
    // 3. Download NetCDF
    // 4. Parse with netcdfjs or similar
    // 5. Extract U/V values at grid points
    // 6. Convert to WindPoint array

    /*
    // Example implementation outline:

    // 1. Submit request
    const submitResponse = await fetch(`${CDS_API_URL}/resources/reanalysis-era5-single-levels`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${CDS_API_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cdsRequest),
    });

    const jobInfo: CDSJobResponse = await submitResponse.json();

    // 2. Poll for completion
    let status = jobInfo;
    while (status.state === 'queued' || status.state === 'running') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const statusResponse = await fetch(
        `${CDS_API_URL}/tasks/${jobInfo.request_id}`,
        { headers: { 'Authorization': `Basic ${Buffer.from(`${CDS_API_KEY}:`).toString('base64')}` } }
      );
      status = await statusResponse.json();
    }

    if (status.state === 'failed') {
      throw new Error(`ERA5 job failed: ${status.error?.message}`);
    }

    // 3. Download NetCDF
    const dataResponse = await fetch(status.location!);
    const netcdfBuffer = await dataResponse.arrayBuffer();

    // 4. Parse NetCDF (would need netcdfjs or similar)
    // const reader = new NetCDFReader(netcdfBuffer);
    // const uVar = reader.getDataVariable('u10');
    // const vVar = reader.getDataVariable('v10');

    // 5. Build WindPoint array
    */

    // For now, throw to trigger fallback
    throw new Error('ERA5 CDS integration not yet implemented');
  }
}

/**
 * Helper to check CDS API key validity
 */
export async function verifyCDSApiKey(): Promise<boolean> {
  if (!CDS_API_KEY) {
    return false;
  }

  try {
    // The CDS API has a status endpoint
    const response = await fetch(`${CDS_API_URL}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${CDS_API_KEY}:`).toString('base64')}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get ERA5 data availability info
 */
export function getERA5Availability(): {
  startDate: string;
  endDate: string;
  resolution: string;
  updateFrequency: string;
} {
  const now = new Date();
  const latestAvailable = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  return {
    startDate: '1979-01-01',
    endDate: latestAvailable.toISOString().split('T')[0],
    resolution: '0.25° (~31km)',
    updateFrequency: 'Daily, ~5 day delay',
  };
}

// Export singleton instance
export const era5Provider = new ERA5Provider();
export default era5Provider;
