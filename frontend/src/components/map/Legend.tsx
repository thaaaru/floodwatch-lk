'use client';

import React from 'react';
import { generateGradientStops } from '@/utils/scaleColor';

interface LegendProps {
  minSpeed: number;
  maxSpeed: number;
  unit?: string;
  title?: string;
}

export default function Legend({ minSpeed, maxSpeed, unit = 'm/s', title = 'Wind Speed' }: LegendProps) {
  const gradientStops = generateGradientStops(minSpeed, maxSpeed, 20);
  const gradientCSS = `linear-gradient(to right, ${gradientStops.map(s => s.color).join(', ')})`;

  // Generate tick marks
  const numTicks = 6;
  const ticks: number[] = [];
  for (let i = 0; i <= numTicks; i++) {
    ticks.push(minSpeed + (maxSpeed - minSpeed) * (i / numTicks));
  }

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 border border-slate-700/50 min-w-[200px]">
      <div className="text-xs text-slate-400 font-medium mb-2">{title} ({unit})</div>

      {/* Gradient bar */}
      <div
        className="h-3 rounded-sm mb-1"
        style={{ background: gradientCSS }}
      />

      {/* Tick marks */}
      <div className="flex justify-between text-[10px] text-slate-400">
        {ticks.map((tick, i) => (
          <span key={i} className="text-center" style={{ minWidth: '20px' }}>
            {tick.toFixed(0)}
          </span>
        ))}
      </div>

      {/* Speed range labels */}
      <div className="mt-2 pt-2 border-t border-slate-700/50 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm" style={{ background: '#6495ED' }} />
          <span className="text-slate-400">0-2: Calm</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm" style={{ background: '#48D1CC' }} />
          <span className="text-slate-400">2-6: Light</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm" style={{ background: '#7CCD52' }} />
          <span className="text-slate-400">6-10: Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm" style={{ background: '#FFC107' }} />
          <span className="text-slate-400">10-15: Fresh</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm" style={{ background: '#FF5722' }} />
          <span className="text-slate-400">15-21: Strong</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm" style={{ background: '#B71C1C' }} />
          <span className="text-slate-400">21+: Gale</span>
        </div>
      </div>
    </div>
  );
}
