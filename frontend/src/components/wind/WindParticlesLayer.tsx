'use client';

/**
 * WindParticlesLayer Component
 * Animated particle flow visualization similar to zoom.earth/earth.nullschool.net
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { WindField, WindPoint } from '@/lib/wind/types';
import { speedToColor, bilinearInterpolateScalar } from '@/lib/wind/utils';

interface WindParticlesLayerProps {
  field: WindField;
  particleCount?: number;
  particleAge?: number;
  lineWidth?: number;
  speedFactor?: number;
  fadeOpacity?: number;
  colorMode?: 'speed' | 'direction' | 'uniform';
}

interface Particle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  speed: number;
}

export function WindParticlesLayer({
  field,
  particleCount = 5000,
  particleAge = 100,
  lineWidth = 1.5,
  speedFactor = 0.15,
  fadeOpacity = 0.96,
  colorMode = 'speed',
}: WindParticlesLayerProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const layerRef = useRef<L.Layer | null>(null);
  const isAnimatingRef = useRef(false);

  // Build wind lookup grid for fast interpolation
  const buildWindGrid = useCallback(() => {
    if (!field || field.points.length === 0) return null;

    const { bbox, gridWidth, gridHeight } = field.metadata;
    const [minLon, minLat, maxLon, maxLat] = bbox;

    // Create 2D arrays for U and V components
    const uGrid: number[][] = [];
    const vGrid: number[][] = [];

    // Initialize grids
    for (let y = 0; y < gridHeight; y++) {
      uGrid[y] = new Array(gridWidth).fill(0);
      vGrid[y] = new Array(gridWidth).fill(0);
    }

    // Fill grid from points
    const lonStep = (maxLon - minLon) / (gridWidth - 1);
    const latStep = (maxLat - minLat) / (gridHeight - 1);

    for (const point of field.points) {
      const gridX = Math.round((point.lon - minLon) / lonStep);
      const gridY = Math.round((point.lat - minLat) / latStep);

      if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
        uGrid[gridY][gridX] = point.u;
        vGrid[gridY][gridX] = point.v;
      }
    }

    return { uGrid, vGrid, bbox, gridWidth, gridHeight };
  }, [field]);

  // Get interpolated wind at a given lat/lon
  const getWindAt = useCallback(
    (
      lat: number,
      lon: number,
      grid: ReturnType<typeof buildWindGrid>
    ): { u: number; v: number } | null => {
      if (!grid) return null;

      const { uGrid, vGrid, bbox, gridWidth, gridHeight } = grid;
      const [minLon, minLat, maxLon, maxLat] = bbox;

      // Check bounds
      if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) {
        return null;
      }

      // Calculate grid coordinates
      const x = ((lon - minLon) / (maxLon - minLon)) * (gridWidth - 1);
      const y = ((lat - minLat) / (maxLat - minLat)) * (gridHeight - 1);

      // Bilinear interpolation
      const x0 = Math.floor(x);
      const x1 = Math.min(x0 + 1, gridWidth - 1);
      const y0 = Math.floor(y);
      const y1 = Math.min(y0 + 1, gridHeight - 1);

      const xFrac = x - x0;
      const yFrac = y - y0;

      const u = bilinearInterpolateScalar(
        uGrid[y0][x0],
        uGrid[y0][x1],
        uGrid[y1][x0],
        uGrid[y1][x1],
        xFrac,
        yFrac
      );

      const v = bilinearInterpolateScalar(
        vGrid[y0][x0],
        vGrid[y0][x1],
        vGrid[y1][x0],
        vGrid[y1][x1],
        xFrac,
        yFrac
      );

      return { u, v };
    },
    []
  );

  // Create a particle at random position within the wind data bounds
  // (intersected with visible map bounds for efficiency)
  const createParticle = useCallback(
    (mapBounds: L.LatLngBounds, windBbox?: [number, number, number, number]): Particle => {
      // Use wind data bounds if available, otherwise map bounds
      let minLon = mapBounds.getWest();
      let minLat = mapBounds.getSouth();
      let maxLon = mapBounds.getEast();
      let maxLat = mapBounds.getNorth();

      if (windBbox) {
        // Intersect with wind data bounds - particles only where we have data
        const [wMinLon, wMinLat, wMaxLon, wMaxLat] = windBbox;
        minLon = Math.max(minLon, wMinLon);
        minLat = Math.max(minLat, wMinLat);
        maxLon = Math.min(maxLon, wMaxLon);
        maxLat = Math.min(maxLat, wMaxLat);
      }

      // Ensure valid bounds
      if (minLon >= maxLon || minLat >= maxLat) {
        // Fall back to wind bbox center if no intersection
        if (windBbox) {
          const [wMinLon, wMinLat, wMaxLon, wMaxLat] = windBbox;
          minLon = wMinLon;
          minLat = wMinLat;
          maxLon = wMaxLon;
          maxLat = wMaxLat;
        }
      }

      const lat = minLat + Math.random() * (maxLat - minLat);
      const lon = minLon + Math.random() * (maxLon - minLon);

      return {
        x: lon,
        y: lat,
        age: Math.floor(Math.random() * particleAge),
        maxAge: particleAge + Math.floor(Math.random() * 20),
        speed: 0,
      };
    },
    [particleAge]
  );

  useEffect(() => {
    if (!field || field.points.length === 0) return;

    // Remove previous layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    // Stop previous animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;

    // Build wind grid for interpolation
    const windGrid = buildWindGrid();
    if (!windGrid) return;

    // Initialize particles within the wind data bounds
    const bounds = map.getBounds();
    const windBbox = field.metadata.bbox;
    particlesRef.current = [];
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(createParticle(bounds, windBbox));
    }

    // Custom canvas layer
    const CanvasLayer = L.Layer.extend({
      onAdd: function (map: L.Map) {
        this._map = map;
        const pane = map.getPane('overlayPane');
        if (pane) {
          pane.appendChild(canvas);
        }
        map.on('movestart', this._stopAnimation, this);
        map.on('moveend', this._resetAndStart, this);
        this._reset();
        this._startAnimation();
      },

      onRemove: function (map: L.Map) {
        this._stopAnimation();
        const pane = map.getPane('overlayPane');
        if (pane && canvas.parentNode === pane) {
          pane.removeChild(canvas);
        }
        map.off('movestart', this._stopAnimation, this);
        map.off('moveend', this._resetAndStart, this);
      },

      _reset: function () {
        const bounds = this._map.getBounds();
        const topLeft = this._map.latLngToLayerPoint(bounds.getNorthWest());
        const size = this._map.getSize();

        // Account for device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;

        canvas.style.position = 'absolute';
        canvas.style.left = `${topLeft.x}px`;
        canvas.style.top = `${topLeft.y}px`;
        canvas.style.pointerEvents = 'none';
        canvas.style.width = `${size.x}px`;
        canvas.style.height = `${size.y}px`;
        canvas.width = size.x * dpr;
        canvas.height = size.y * dpr;

        // Clear canvas and scale context for DPR
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, size.x, size.y);
        }
      },

      _resetAndStart: function () {
        this._reset();
        // Reinitialize particles for new bounds (within wind data area)
        const bounds = this._map.getBounds();
        particlesRef.current = [];
        for (let i = 0; i < particleCount; i++) {
          particlesRef.current.push(createParticle(bounds, windBbox));
        }
        this._startAnimation();
      },

      _stopAnimation: function () {
        isAnimatingRef.current = false;
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      },

      _startAnimation: function () {
        isAnimatingRef.current = true;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Apply DPR scaling to context
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const animate = () => {
          if (!isAnimatingRef.current) return;

          const mapInstance = this._map;
          if (!mapInstance) return;

          const bounds = mapInstance.getBounds();
          const size = mapInstance.getSize();

          // Fade previous frame (using destination-out for transparency)
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = `rgba(0, 0, 0, ${1 - fadeOpacity})`;
          ctx.fillRect(0, 0, size.x, size.y);
          ctx.globalCompositeOperation = 'source-over';

          // Update and draw particles
          for (let i = 0; i < particlesRef.current.length; i++) {
            const p = particlesRef.current[i];

            // Get wind at particle position
            const wind = getWindAt(p.y, p.x, windGrid);

            if (wind) {
              const speed = Math.sqrt(wind.u * wind.u + wind.v * wind.v);
              p.speed = speed;

              // Get current pixel position
              const currentPixel = mapInstance.latLngToContainerPoint([p.y, p.x]);

              // Move particle based on wind
              // U is east-west (positive = east), V is north-south (positive = north)
              const zoom = mapInstance.getZoom();
              const scaleFactor = speedFactor * Math.pow(2, zoom - 7);

              p.x += wind.u * scaleFactor * 0.01;
              p.y += wind.v * scaleFactor * 0.01;

              // Get new pixel position
              const newPixel = mapInstance.latLngToContainerPoint([p.y, p.x]);

              // Draw line
              if (
                currentPixel.x >= 0 &&
                currentPixel.x < size.x &&
                currentPixel.y >= 0 &&
                currentPixel.y < size.y
              ) {
                ctx.beginPath();
                ctx.moveTo(currentPixel.x, currentPixel.y);
                ctx.lineTo(newPixel.x, newPixel.y);

                // Color based on speed
                const color = speedToColor(speed);
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.stroke();
              }
            }

            // Age particle
            p.age++;

            // Reset particle if too old or out of wind data bounds
            const [wMinLon, wMinLat, wMaxLon, wMaxLat] = windBbox;
            if (
              p.age > p.maxAge ||
              p.x < wMinLon ||
              p.x > wMaxLon ||
              p.y < wMinLat ||
              p.y > wMaxLat
            ) {
              const newP = createParticle(bounds, windBbox);
              particlesRef.current[i] = newP;
            }
          }

          animationRef.current = requestAnimationFrame(animate);
        };

        animate();
      },
    });

    const layer = new CanvasLayer();
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      isAnimatingRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [
    map,
    field,
    particleCount,
    particleAge,
    lineWidth,
    speedFactor,
    fadeOpacity,
    colorMode,
    buildWindGrid,
    getWindAt,
    createParticle,
  ]);

  return null;
}

export default WindParticlesLayer;
