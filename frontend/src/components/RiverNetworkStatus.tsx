'use client';

import { useEffect, useState } from 'react';
import { Card, DonutChart, BarList } from '@tremor/react';
import { api, IrrigationData } from '@/lib/api';

interface RiverStatusSummary {
  total: number;
  major_flood: number;
  minor_flood: number;
  alert: number;
  normal: number;
}

export default function RiverNetworkStatus() {
  const [data, setData] = useState<IrrigationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRiverData = async () => {
      try {
        const riverData = await api.getIrrigationData();
        setData(riverData);
      } catch (err) {
        console.error('Failed to fetch river data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRiverData();
  }, []);

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden flex flex-col" style={{ height: '320px' }}>
        <div className="px-4 py-3 border-b border-white/20 flex items-center gap-2 bg-blue-500/10">
          <span className="text-lg">🌊</span>
          <h2 className="text-sm font-semibold text-slate-800">River Network Status</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const summary = data.summary;

  // Data for donut chart
  const chartData = [
    {
      name: 'Major Flood',
      value: summary.rivers_at_major_flood,
      color: 'rose',
    },
    {
      name: 'Minor Flood',
      value: summary.rivers_at_minor_flood,
      color: 'orange',
    },
    {
      name: 'Alert',
      value: summary.rivers_at_alert,
      color: 'amber',
    },
    {
      name: 'Normal',
      value: summary.rivers_at_normal,
      color: 'emerald',
    },
  ].filter(item => item.value > 0);

  // Data for bar list (top risk rivers)
  const topRiskRivers = data.stations
    .sort((a, b) => {
      const statusPriority: Record<string, number> = {
        'major_flood': 4,
        'minor_flood': 3,
        'alert': 2,
        'normal': 1,
      };
      return (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0);
    })
    .slice(0, 5)
    .map(station => ({
      name: station.station,
      value: station.pct_to_alert,
      color: station.status === 'major_flood' ? 'rose' :
             station.status === 'minor_flood' ? 'orange' :
             station.status === 'alert' ? 'amber' : 'emerald',
    }));

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'major_flood': return 'bg-rose-100 text-rose-700 border-rose-300';
      case 'minor_flood': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'alert': return 'bg-amber-100 text-amber-700 border-amber-300';
      default: return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    }
  };

  const criticalCount = summary.rivers_at_major_flood + summary.rivers_at_minor_flood;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden flex flex-col" style={{ height: '380px' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between bg-blue-500/10">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌊</span>
          <h2 className="text-sm font-semibold text-slate-800">River Network Status</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-800 bg-blue-100/50 px-2 py-0.5 rounded-full">
            {summary.total_stations} stations
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Critical Alert Banner */}
        {criticalCount > 0 && (
          <div className="bg-rose-500/20 border border-rose-300/50 rounded-lg p-3 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="text-sm font-bold text-rose-900">
                {criticalCount} {criticalCount === 1 ? 'River' : 'Rivers'} in Flood
              </div>
              <div className="text-xs text-rose-700">Immediate attention required</div>
            </div>
          </div>
        )}

        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`border rounded-lg p-2.5 ${getStatusBgColor('major_flood')}`}>
            <div className="text-xs opacity-75">Major Flood</div>
            <div className="text-xl font-bold">{summary.rivers_at_major_flood}</div>
          </div>
          <div className={`border rounded-lg p-2.5 ${getStatusBgColor('minor_flood')}`}>
            <div className="text-xs opacity-75">Minor Flood</div>
            <div className="text-xl font-bold">{summary.rivers_at_minor_flood}</div>
          </div>
          <div className={`border rounded-lg p-2.5 ${getStatusBgColor('alert')}`}>
            <div className="text-xs opacity-75">Alert</div>
            <div className="text-xl font-bold">{summary.rivers_at_alert}</div>
          </div>
          <div className={`border rounded-lg p-2.5 ${getStatusBgColor('normal')}`}>
            <div className="text-xs opacity-75">Normal</div>
            <div className="text-xl font-bold">{summary.rivers_at_normal}</div>
          </div>
        </div>

        {/* Top Risk Stations */}
        {topRiskRivers.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2">Top Risk Stations</div>
            <div className="space-y-1">
              {topRiskRivers.map((river, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 bg-white/20 rounded">
                  <span className="text-slate-800 truncate flex-1">{river.name}</span>
                  <span className={`font-bold ml-2 ${
                    river.value >= 100 ? 'text-rose-600' :
                    river.value >= 80 ? 'text-orange-600' :
                    river.value >= 60 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {river.value.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View All Link */}
        <a
          href="/rivers"
          className="block text-center text-xs text-blue-700 hover:text-blue-800 font-medium py-2 hover:bg-white/20 rounded-lg transition-colors"
        >
          View all stations →
        </a>
      </div>
    </div>
  );
}
