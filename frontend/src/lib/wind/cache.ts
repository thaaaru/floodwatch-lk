/**
 * Wind Data Cache
 * In-memory caching layer for wind data with TTL support
 */

import type { WindField, WindCacheEntry, BBox } from './types';
import { CACHE_CONFIG } from './config';
import { generateCacheKey, snapBboxToGrid, roundToHour } from './utils';

/**
 * Simple in-memory cache for wind data
 * In production, consider Redis or similar for distributed caching
 */
class WindCache {
  private cache = new Map<string, WindCacheEntry>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number = 100, ttlMinutes: number = 30) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Generate cache key from request parameters
   */
  private makeKey(source: string, bbox: BBox, time: string, resolutionKm: number): string {
    return generateCacheKey(source, bbox, time, resolutionKm);
  }

  /**
   * Get cached wind field if available and not expired
   */
  get(source: string, bbox: BBox, time: string, resolutionKm: number): WindField | null {
    const key = this.makeKey(source, bbox, time, resolutionKm);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (new Date(entry.expiresAt) < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return entry.field;
  }

  /**
   * Store wind field in cache
   */
  set(source: string, bbox: BBox, time: string, resolutionKm: number, field: WindField): void {
    const key = this.makeKey(source, bbox, time, resolutionKm);

    // Evict old entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const now = new Date();
    const entry: WindCacheEntry = {
      field,
      cachedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if cache has a valid entry
   */
  has(source: string, bbox: BBox, time: string, resolutionKm: number): boolean {
    return this.get(source, bbox, time, resolutionKm) !== null;
  }

  /**
   * Remove specific entry from cache
   */
  delete(source: string, bbox: BBox, time: string, resolutionKm: number): boolean {
    const key = this.makeKey(source, bbox, time, resolutionKm);
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{
      key: string;
      cachedAt: string;
      expiresAt: string;
      source: string;
    }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      cachedAt: entry.cachedAt,
      expiresAt: entry.expiresAt,
      source: entry.field.metadata.source,
    }));

    return {
      size: this.cache.size,
      maxSize: this.maxEntries,
      hitRate: 0, // Would need to track hits/misses for this
      entries,
    };
  }

  /**
   * Evict expired entries
   */
  evictExpired(): number {
    const now = new Date();
    let evicted = 0;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (new Date(entry.expiresAt) < now) {
        this.cache.delete(key);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Evict oldest entry (LRU-ish)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      const cachedTime = new Date(entry.cachedAt).getTime();
      if (cachedTime < oldestTime) {
        oldestTime = cachedTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// Singleton cache instance
export const windCache = new WindCache(
  CACHE_CONFIG.maxEntries,
  CACHE_CONFIG.ttlMinutes
);

/**
 * Cached wrapper for getWindField
 */
export async function getCachedWindField(
  source: string,
  bbox: BBox,
  time: string,
  resolutionKm: number,
  fetcher: () => Promise<WindField>
): Promise<WindField> {
  // Normalize parameters for cache lookup
  const normalizedBbox = snapBboxToGrid(bbox);
  const normalizedTime = roundToHour(time);

  // Check cache first
  const cached = windCache.get(source, normalizedBbox, normalizedTime, resolutionKm);
  if (cached) {
    console.log(`Wind cache hit: ${source} at ${normalizedTime}`);
    return cached;
  }

  // Fetch fresh data
  console.log(`Wind cache miss: ${source} at ${normalizedTime}`);
  const field = await fetcher();

  // Store in cache
  windCache.set(source, normalizedBbox, normalizedTime, resolutionKm, field);

  return field;
}

/**
 * Periodic cache cleanup (call from a scheduler)
 */
export function cleanupCache(): { evicted: number } {
  const evicted = windCache.evictExpired();
  return { evicted };
}

export default windCache;
