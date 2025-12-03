/**
 * Wind Data API Endpoint
 * GET /api/wind
 *
 * Query Parameters:
 * - bbox: minLon,minLat,maxLon,maxLat (default: Sri Lanka region)
 * - time: ISO8601 timestamp (default: now)
 * - source: icon|gfs|era5|auto (default: auto)
 * - resolutionKm: number (default: 25)
 * - format: full|compact (default: full)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getWindField,
  getCachedWindField,
  windCache,
  validateWindField,
} from '@/lib/wind';
import type { WindSource, BBox, WindDataRequest } from '@/lib/wind/types';
import { windConfig, SRI_LANKA_BBOX } from '@/lib/wind/config';

// Valid sources
const VALID_SOURCES: WindSource[] = ['auto', 'icon', 'gfs', 'era5'];

// Parse bbox from string
function parseBBox(bboxStr: string): BBox | null {
  const parts = bboxStr.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return null;
  }
  const [minLon, minLat, maxLon, maxLat] = parts;

  // Validate ranges
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) {
    return null;
  }
  if (minLon >= maxLon || minLat >= maxLat) {
    return null;
  }

  return [minLon, minLat, maxLon, maxLat];
}

// Convert wind field to compact format (for bandwidth optimization)
function toCompactFormat(field: ReturnType<typeof import('@/lib/wind').getWindField> extends Promise<infer T> ? T : never) {
  return {
    meta: {
      src: field.metadata.source,
      t: field.metadata.time,
      bbox: field.metadata.bbox,
      res: field.metadata.resolutionKm,
      w: field.metadata.gridWidth,
      h: field.metadata.gridHeight,
      min: field.metadata.minSpeed,
      max: field.metadata.maxSpeed,
      avg: field.metadata.meanSpeed,
    },
    // Flatten points to arrays for smaller payload
    pts: field.points.map(p => [
      Math.round(p.lat * 1000) / 1000,
      Math.round(p.lon * 1000) / 1000,
      Math.round(p.u * 100) / 100,
      Math.round(p.v * 100) / 100,
      Math.round(p.speed * 100) / 100,
      Math.round(p.directionDeg),
    ]),
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Parse parameters
    const bboxParam = searchParams.get('bbox');
    const timeParam = searchParams.get('time');
    const sourceParam = searchParams.get('source') || 'auto';
    const resolutionParam = searchParams.get('resolutionKm');
    const formatParam = searchParams.get('format') || 'full';

    // Validate source
    if (!VALID_SOURCES.includes(sourceParam as WindSource)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      );
    }

    // Parse bbox (default to Sri Lanka region)
    let bbox: BBox = SRI_LANKA_BBOX;
    if (bboxParam) {
      const parsedBbox = parseBBox(bboxParam);
      if (!parsedBbox) {
        return NextResponse.json(
          { error: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat' },
          { status: 400 }
        );
      }
      bbox = parsedBbox;
    }

    // Parse time (default to now)
    let time: string | undefined;
    if (timeParam) {
      const parsedTime = new Date(timeParam);
      if (isNaN(parsedTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid time format. Expected ISO8601 timestamp.' },
          { status: 400 }
        );
      }
      time = parsedTime.toISOString();
    }

    // Parse resolution
    let resolutionKm = windConfig.defaultResolutionKm;
    if (resolutionParam) {
      const parsed = parseFloat(resolutionParam);
      if (isNaN(parsed) || parsed < 5 || parsed > 100) {
        return NextResponse.json(
          { error: 'Invalid resolutionKm. Must be between 5 and 100.' },
          { status: 400 }
        );
      }
      resolutionKm = parsed;
    }

    // Build request
    const windRequest: WindDataRequest = {
      bbox,
      source: sourceParam as WindSource,
      resolutionKm,
      time,
    };

    // Fetch wind data (with caching)
    const field = await getCachedWindField(
      sourceParam,
      bbox,
      time || new Date().toISOString(),
      resolutionKm,
      () => getWindField(windRequest)
    );

    // Validate the field
    const validation = validateWindField(field);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Format response
    const response = formatParam === 'compact'
      ? {
          ...toCompactFormat(field),
          _meta: {
            responseTime,
            cached: responseTime < 100, // Rough heuristic
            valid: validation.valid,
            issues: validation.issues,
          },
        }
      : {
          metadata: field.metadata,
          points: field.points,
          _meta: {
            responseTime,
            cached: responseTime < 100,
            valid: validation.valid,
            issues: validation.issues,
          },
        };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 min browser cache
        'X-Response-Time': `${responseTime}ms`,
        'X-Wind-Source': field.metadata.source,
      },
    });

  } catch (error) {
    console.error('Wind API error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to fetch wind data',
        message,
        _meta: { responseTime },
      },
      {
        status: 500,
        headers: {
          'X-Response-Time': `${responseTime}ms`,
        },
      }
    );
  }
}

// Cache management endpoint
export async function DELETE(request: NextRequest) {
  try {
    windCache.clear();
    return NextResponse.json({ success: true, message: 'Wind cache cleared' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
