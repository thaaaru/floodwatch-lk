'use client';

/**
 * WindVectorsLayer Component
 * Renders wind data as arrow vectors on the map
 */

import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { WindField, WindPoint } from '@/lib/wind/types';
import { speedToColor } from '@/lib/wind/utils';

interface WindVectorsLayerProps {
  field: WindField;
  sparse?: boolean; // For low-bandwidth mode
  arrowScale?: number;
  opacity?: number;
}

export function WindVectorsLayer({
  field,
  sparse = false,
  arrowScale = 0.5,
  opacity = 0.8,
}: WindVectorsLayerProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!field || field.points.length === 0) return;

    // Remove previous layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    // Create canvas overlay
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;

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

        this._draw();
      },

      _draw: function () {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = opacity;

        const bounds = this._map.getBounds();
        const zoom = this._map.getZoom();

        // Filter points to visible area
        let visiblePoints = field.points.filter(
          (p) =>
            p.lat >= bounds.getSouth() &&
            p.lat <= bounds.getNorth() &&
            p.lon >= bounds.getWest() &&
            p.lon <= bounds.getEast()
        );

        // Sparse mode: reduce point density
        if (sparse) {
          const step = Math.max(1, Math.floor(visiblePoints.length / 100));
          visiblePoints = visiblePoints.filter((_, i) => i % step === 0);
        }

        // Calculate arrow size based on zoom
        const baseSize = Math.max(8, Math.min(20, zoom * 2));

        visiblePoints.forEach((point) => {
          const pixelPoint = this._map.latLngToContainerPoint([point.lat, point.lon]);

          // Get color based on speed
          const color = speedToColor(point.speed);

          // Draw arrow
          drawArrow(
            ctx,
            pixelPoint.x,
            pixelPoint.y,
            point.directionDeg,
            point.speed,
            baseSize * arrowScale,
            color
          );
        });
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
  }, [map, field, sparse, arrowScale, opacity]);

  return null;
}

/**
 * Draw a wind arrow at given position
 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  directionDeg: number,
  speed: number,
  size: number,
  color: string
) {
  // Convert meteorological direction (where wind comes FROM) to drawing direction
  // Add 180° to show where wind is going TO
  const drawDirection = (directionDeg + 180) % 360;
  const angleRad = (drawDirection * Math.PI) / 180;

  // Scale arrow length by speed (min 0.5, max 2.0 multiplier)
  const speedFactor = 0.5 + Math.min(speed / 15, 1.5);
  const length = size * speedFactor;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);

  // Draw arrow shaft
  ctx.beginPath();
  ctx.moveTo(0, -length / 2);
  ctx.lineTo(0, length / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size / 8);
  ctx.stroke();

  // Draw arrow head
  const headSize = length * 0.3;
  ctx.beginPath();
  ctx.moveTo(0, length / 2);
  ctx.lineTo(-headSize / 2, length / 2 - headSize);
  ctx.lineTo(headSize / 2, length / 2 - headSize);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // Add speed-based tail barbs for stronger winds
  if (speed > 5) {
    const numBarbs = Math.min(3, Math.floor(speed / 5));
    for (let i = 0; i < numBarbs; i++) {
      const barbY = -length / 2 + (i + 1) * (length / 4);
      ctx.beginPath();
      ctx.moveTo(0, barbY);
      ctx.lineTo(-headSize * 0.6, barbY - headSize * 0.3);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, size / 10);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export default WindVectorsLayer;
