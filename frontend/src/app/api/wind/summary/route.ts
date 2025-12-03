/**
 * Wind Summary API Endpoint
 * GET /api/wind/summary
 *
 * Returns lightweight metadata for UI controls:
 * - Available data sources
 * - Provider status
 * - Cache statistics
 * - Time ranges available
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkProviderStatus,
  windCache,
  getERA5Availability,
} from '@/lib/wind';
import { windConfig, PROVIDER_PRIORITY, SRI_LANKA_BBOX, BEAUFORT_SCALE, CACHE_CONFIG } from '@/lib/wind/config';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get provider statuses
    const providerStatus = await checkProviderStatus();

    // Get cache stats
    const cacheStats = windCache.getStats();

    // Get ERA5 availability info
    const era5Availability = getERA5Availability();

    // Calculate available time ranges
    const now = new Date();
    const forecastHours = 120; // ~5 days forecast
    const historicalDays = 5; // ERA5 lag

    const timeRanges = {
      forecast: {
        start: now.toISOString(),
        end: new Date(now.getTime() + forecastHours * 60 * 60 * 1000).toISOString(),
        sources: ['icon', 'gfs'],
      },
      reanalysis: {
        start: era5Availability.startDate,
        end: era5Availability.endDate,
        sources: ['era5'],
        note: 'ERA5 has ~5 day delay',
      },
    };

    // Build provider info
    const providers = PROVIDER_PRIORITY.map(source => {
      const status = providerStatus.find(p => p.source === source);
      const config = windConfig.providers[source];

      return {
        source,
        name: getProviderName(source),
        enabled: config.enabled,
        available: status?.available ?? false,
        latency: status?.latency,
        error: status?.error,
        resolution: getProviderResolution(source),
        coverage: getProviderCoverage(source),
        updateFrequency: getProviderUpdateFrequency(source),
      };
    });

    const response = {
      providers,
      priorityOrder: PROVIDER_PRIORITY,
      timeRanges,
      cache: {
        entries: cacheStats.size,
        maxEntries: cacheStats.maxSize,
        ttlMinutes: CACHE_CONFIG.ttlMinutes,
      },
      config: {
        defaultBbox: SRI_LANKA_BBOX,
        defaultResolutionKm: windConfig.defaultResolutionKm,
        sriLankaBbox: SRI_LANKA_BBOX,
      },
      beaufortScale: BEAUFORT_SCALE.map((b, index) => ({
        level: index,
        name: b.name,
        minSpeed: b.min,
        maxSpeed: b.max,
      })),
      _meta: {
        timestamp: now.toISOString(),
        responseTime: Date.now() - startTime,
      },
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60', // 1 min cache
        'X-Response-Time': `${Date.now() - startTime}ms`,
      },
    });

  } catch (error) {
    console.error('Wind summary API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch wind summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper functions for provider metadata
function getProviderName(source: string): string {
  switch (source) {
    case 'icon':
      return 'ICON (DWD)';
    case 'gfs':
      return 'GFS (NOAA via Open-Meteo)';
    case 'era5':
      return 'ERA5 (ECMWF)';
    default:
      return source.toUpperCase();
  }
}

function getProviderResolution(source: string): string {
  switch (source) {
    case 'icon':
      return '~7km (EU) / ~13km (global)';
    case 'gfs':
      return '~22km (0.25°)';
    case 'era5':
      return '~31km (0.25°)';
    default:
      return 'Unknown';
  }
}

function getProviderCoverage(source: string): string {
  switch (source) {
    case 'icon':
      return 'Global';
    case 'gfs':
      return 'Global';
    case 'era5':
      return 'Global (1979-present)';
    default:
      return 'Unknown';
  }
}

function getProviderUpdateFrequency(source: string): string {
  switch (source) {
    case 'icon':
      return 'Every 6 hours';
    case 'gfs':
      return 'Every 6 hours';
    case 'era5':
      return 'Daily (~5 day lag)';
    default:
      return 'Unknown';
  }
}
