'use client';

/**
 * WindHeatmapLayer Component
 * Renders wind speed as a color-coded heatmap overlay
 */

import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { WindField } from '@/lib/wind/types';
import { speedToColor, bilinearInterpolateScalar } from '@/lib/wind/utils';

interface WindHeatmapLayerProps {
  field: WindField;
  opacity?: number;
  blur?: number;
}

export function WindHeatmapLayer({
  field,
  opacity = 0.6,
  blur = 0,
}: WindHeatmapLayerProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!field || field.points.length === 0) return;

    // Remove previous layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;

    // Build speed grid for interpolation
    const buildSpeedGrid = () => {
      const { bbox, gridWidth, gridHeight } = field.metadata;
      const [minLon, minLat, maxLon, maxLat] = bbox;

      // Create 2D array for speed
      const speedGrid: number[][] = [];
      for (let y = 0; y < gridHeight; y++) {
        speedGrid[y] = new Array(gridWidth).fill(0);
      }

      // Fill grid from points
      const lonStep = (maxLon - minLon) / (gridWidth - 1);
      const latStep = (maxLat - minLat) / (gridHeight - 1);

      for (const point of field.points) {
        const gridX = Math.round((point.lon - minLon) / lonStep);
        const gridY = Math.round((point.lat - minLat) / latStep);

        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
          speedGrid[gridY][gridX] = point.speed;
        }
      }

      return speedGrid;
    };

    const speedGrid = buildSpeedGrid();
    const { bbox, gridWidth, gridHeight } = field.metadata;
    const [minLon, minLat, maxLon, maxLat] = bbox;

    // Custom canvas layer
    const CanvasLayer = L.Layer.extend({
      onAdd: function (map: L.Map) {
        this._map = map;
        const pane = map.getPane('overlayPane');
        if (pane) {
          pane.appendChild(canvas);
        }
        map.on('moveend', this._reset, this);
        this._reset();
      },

      onRemove: function (map: L.Map) {
        const pane = map.getPane('overlayPane');
        if (pane && canvas.parentNode === pane) {
          pane.removeChild(canvas);
        }
        map.off('moveend', this._reset, this);
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

        // Scale context for DPR
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        if (blur > 0) {
          canvas.style.filter = `blur(${blur}px)`;
        }

        this._draw();
      },

      _draw: function () {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = opacity;

        const mapBounds = this._map.getBounds();
        const size = this._map.getSize();

        // Calculate pixel resolution
        const pixelWidth = size.x;
        const pixelHeight = size.y;

        // Sample resolution (lower = more detail but slower)
        const sampleStep = 4;

        // Create image data
        const imageData = ctx.createImageData(
          Math.ceil(pixelWidth / sampleStep),
          Math.ceil(pixelHeight / sampleStep)
        );

        for (let py = 0; py < imageData.height; py++) {
          for (let px = 0; px < imageData.width; px++) {
            // Convert pixel to lat/lon
            const containerPoint = L.point(
              px * sampleStep + sampleStep / 2,
              py * sampleStep + sampleStep / 2
            );
            const latLng = this._map.containerPointToLatLng(containerPoint);

            // Check if within data bounds
            if (
              latLng.lat < minLat ||
              latLng.lat > maxLat ||
              latLng.lng < minLon ||
              latLng.lng > maxLon
            ) {
              continue;
            }

            // Calculate grid position
            const gridX = ((latLng.lng - minLon) / (maxLon - minLon)) * (gridWidth - 1);
            const gridY = ((latLng.lat - minLat) / (maxLat - minLat)) * (gridHeight - 1);

            // Bilinear interpolation
            const x0 = Math.floor(gridX);
            const x1 = Math.min(x0 + 1, gridWidth - 1);
            const y0 = Math.floor(gridY);
            const y1 = Math.min(y0 + 1, gridHeight - 1);

            const xFrac = gridX - x0;
            const yFrac = gridY - y0;

            const speed = bilinearInterpolateScalar(
              speedGrid[y0][x0],
              speedGrid[y0][x1],
              speedGrid[y1][x0],
              speedGrid[y1][x1],
              xFrac,
              yFrac
            );

            // Get color for speed
            const colorStr = speedToColor(speed);
            const color = parseColor(colorStr);

            // Set pixel
            const idx = (py * imageData.width + px) * 4;
            imageData.data[idx] = color.r;
            imageData.data[idx + 1] = color.g;
            imageData.data[idx + 2] = color.b;
            imageData.data[idx + 3] = Math.round(opacity * 255);
          }
        }

        // Create temporary canvas for scaling
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        const tempCtx = tempCanvas.getContext('2d');

        if (tempCtx) {
          tempCtx.putImageData(imageData, 0, 0);

          // Draw scaled to main canvas
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(tempCanvas, 0, 0, pixelWidth, pixelHeight);
        }
      },
    });

    const layer = new CanvasLayer();
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, field, opacity, blur]);

  return null;
}

/**
 * Parse CSS color string to RGB values
 */
function parseColor(colorStr: string): { r: number; g: number; b: number } {
  // Handle rgb(r, g, b) format
  const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  // Handle hex format
  if (colorStr.startsWith('#')) {
    const hex = colorStr.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  // Default fallback
  return { r: 128, g: 128, b: 128 };
}

export default WindHeatmapLayer;
