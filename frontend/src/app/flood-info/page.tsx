'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, FloodThreatResponse, IrrigationResponse } from '@/lib/api';

// Safe number formatting helper
const fmt = (v: any, d: number = 0): string => {
  if (v === null || v === undefined || isNaN(Number(v))) return '0';
  return Number(v).toFixed(d);
};

export default function FloodInformationPage() {
  const [floodThreat, setFloodThreat] = useState<FloodThreatResponse | null>(null);
  const [riverData, setRiverData] = useState<IrrigationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [threatData, irrigationData] = await Promise.all([
        api.getFloodThreat(),
        api.getIrrigationData(),
      ]);
      setFloodThreat(threatData);
      setRiverData(irrigationData);
    } catch (err) {
      console.error('Failed to fetch flood data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 minutes
    const interval = setInterval(fetchData, 1800000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getThreatLevelColor = (level: string): string => {
    switch (level.toLowerCase()) {
      case 'critical':
        return 'bg-red-600';
      case 'high':
        return 'bg-orange-600';
      case 'moderate':
        return 'bg-yellow-600';
      case 'low':
        return 'bg-green-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getRiverStatusColor = (status: string, pctToFlood?: number) => {
    switch (status) {
      case 'major_flood': return 'bg-red-600 text-white';
      case 'minor_flood': return 'bg-orange-500 text-white';
      case 'alert': return 'bg-yellow-500 text-black';
      default:
        if (pctToFlood !== undefined && pctToFlood >= 40) return 'bg-blue-500 text-white';
        return 'bg-green-600 text-white';
    }
  };

  const getRiverStatusLabel = (status: string, pctToFlood?: number) => {
    switch (status) {
      case 'major_flood': return 'MAJOR FLOOD';
      case 'minor_flood': return 'MINOR FLOOD';
      case 'alert': return 'ALERT';
      default:
        if (pctToFlood !== undefined && pctToFlood >= 40) return 'LOW RISK';
        return 'NORMAL';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/" className="text-slate-400 hover:text-white transition-colors flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate">Flood Information</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5 hidden sm:block">River monitoring and district risk assessment</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {loading ? (
          <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* River Network Status */}
            {riverData && (
              <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">🌊</span>
                    <span>River Network Status</span>
                  </div>
                  <span className="text-xs sm:text-sm font-normal text-gray-400">({riverData.count} stations monitored)</span>
                </h2>

                {/* River Summary by River Name */}
                <div className="mb-3 sm:mb-4">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-400 mb-1 sm:mb-2">Status by River</h3>
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-2">Data source: Sri Lanka Irrigation Department (updated every 5 mins)</p>
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <div className="inline-block min-w-full px-3 sm:px-0">
                    <table className="w-full text-xs sm:text-sm min-w-[640px]">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700 text-[10px] sm:text-xs">
                          <th className="text-left py-2 px-1 sm:px-2">River</th>
                          <th className="text-center py-2 px-1 cursor-help" title="Number of gauging stations monitored on this river">Stations</th>
                          <th className="text-center py-2 px-1 text-red-400 cursor-help" title="Stations at/above major flood level (100%+ of threshold)">Major</th>
                          <th className="text-center py-2 px-1 text-orange-400 cursor-help" title="Stations at minor flood level (between minor & major thresholds)">Minor</th>
                          <th className="text-center py-2 px-1 text-yellow-400 cursor-help" title="Stations at alert level (water rising, below flood threshold)">Alert</th>
                          <th className="text-center py-2 px-1 text-green-400 cursor-help" title="Stations at normal water levels (below alert threshold)">Normal</th>
                          <th className="text-center py-2 px-1 cursor-help" title="Highest percentage to major flood threshold among all stations on this river. 100% = major flood level reached.">Highest %</th>
                          <th className="text-center py-2 px-1 cursor-help" title="Overall status based on worst station condition on this river">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Group stations by river
                          const riverGroups = riverData.stations.reduce((acc, station) => {
                            if (!acc[station.river]) {
                              acc[station.river] = [];
                            }
                            acc[station.river].push(station);
                            return acc;
                          }, {} as Record<string, typeof riverData.stations>);

                          // Convert to array and sort by highest risk
                          return Object.entries(riverGroups)
                            .map(([river, stations]) => {
                              const major = stations.filter(s => s.status === 'major_flood').length;
                              const minor = stations.filter(s => s.status === 'minor_flood').length;
                              const alert = stations.filter(s => s.status === 'alert').length;
                              const normal = stations.filter(s => s.status === 'normal').length;
                              const highestPct = Math.max(...stations.map(s => s.pct_to_major_flood));
                              const worstStatus = major > 0 ? 'major_flood' : minor > 0 ? 'minor_flood' : alert > 0 ? 'alert' : 'normal';
                              return { river, stations, major, minor, alert, normal, highestPct, worstStatus };
                            })
                            .sort((a, b) => b.highestPct - a.highestPct)
                            .map((row, idx) => (
                              <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700 group/row relative">
                                <td className="py-2 px-1 sm:px-2 font-medium cursor-help relative">
                                  {row.river}
                                  {/* Hover tooltip with station details */}
                                  <div className="absolute left-0 top-full mt-1 px-3 py-2 bg-gray-900 text-xs text-gray-200 rounded-lg opacity-0 group-hover/row:opacity-100 transition-opacity pointer-events-none w-72 z-20 shadow-lg border border-gray-700">
                                    <div className="font-semibold text-white mb-2">{row.river} - Gauging Stations</div>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                      {row.stations
                                        .sort((a, b) => b.pct_to_major_flood - a.pct_to_major_flood)
                                        .map((s, i) => (
                                        <div key={i} className={`flex justify-between items-center py-1 border-b border-gray-800 ${
                                          s.status === 'major_flood' ? 'text-red-400' :
                                          s.status === 'minor_flood' ? 'text-orange-400' :
                                          s.status === 'alert' ? 'text-yellow-400' : 'text-gray-400'
                                        }`}>
                                          <span className="font-medium">{s.station}</span>
                                          <span className="font-mono text-right">
                                            {fmt(s.water_level_m, 2)}m / {fmt(s.major_flood_level_m, 2)}m
                                            <span className="text-gray-500 ml-1">({fmt(s.pct_to_major_flood)}%)</span>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-gray-700 text-gray-500 text-[10px]">
                                      Format: Current Level / Major Flood Threshold (% to flood)
                                    </div>
                                  </div>
                                </td>
                                <td className="text-center py-2 px-1 text-gray-400">{row.stations.length}</td>
                                <td className="text-center py-2 px-1">
                                  {row.major > 0 ? <span className="text-red-500 font-bold">{row.major}</span> : <span className="text-gray-600">0</span>}
                                </td>
                                <td className="text-center py-2 px-1">
                                  {row.minor > 0 ? <span className="text-orange-500 font-bold">{row.minor}</span> : <span className="text-gray-600">0</span>}
                                </td>
                                <td className="text-center py-2 px-1">
                                  {row.alert > 0 ? <span className="text-yellow-500 font-bold">{row.alert}</span> : <span className="text-gray-600">0</span>}
                                </td>
                                <td className="text-center py-2 px-1">
                                  <span className="text-green-500">{row.normal}</span>
                                </td>
                                <td className="text-center py-2 px-1">
                                  <div className="flex items-center justify-center gap-1 sm:gap-2">
                                    <div className="w-12 sm:w-16 bg-gray-700 rounded-full h-1.5 sm:h-2">
                                      <div
                                        className={`h-1.5 sm:h-2 rounded-full ${
                                          row.highestPct >= 100 ? 'bg-red-500' :
                                          row.highestPct >= 80 ? 'bg-orange-500' :
                                          row.highestPct >= 60 ? 'bg-yellow-500' :
                                          row.highestPct >= 40 ? 'bg-blue-500' : 'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(row.highestPct, 100)}%` }}
                                      ></div>
                                    </div>
                                    <span className="font-mono text-[10px] sm:text-xs">{fmt(row.highestPct)}%</span>
                                  </div>
                                </td>
                                <td className="text-center py-2 px-1">
                                  <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${getRiverStatusColor(row.worstStatus, row.highestPct)}`}>
                                    {getRiverStatusLabel(row.worstStatus, row.highestPct)}
                                  </span>
                                </td>
                              </tr>
                            ));
                        })()}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Risk Districts */}
            {floodThreat && floodThreat.top_risk_districts.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Top Risk Districts</h2>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <div className="inline-block min-w-full px-3 sm:px-0">
                  <table className="w-full text-xs sm:text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700 text-[10px] sm:text-xs">
                        <th className="text-left py-2 px-1 sm:px-2">District</th>
                        <th className="text-center py-2 px-1">Threat Score</th>
                        <th className="text-center py-2 px-1">Level</th>
                        <th className="text-center py-2 px-1">Rain</th>
                        <th className="text-center py-2 px-1">River</th>
                        <th className="text-center py-2 px-1">Forecast</th>
                        <th className="text-left py-2 px-1 sm:px-2">Key Factors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {floodThreat.top_risk_districts.slice(0, 10).map((d, idx) => (
                        <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700">
                          <td className="py-2 px-1 sm:px-2 font-medium">{d.district}</td>
                          <td className="text-center py-2 px-1">
                            <div className="flex items-center justify-center gap-1 sm:gap-2">
                              <div className="w-12 sm:w-16 bg-gray-700 rounded-full h-1.5 sm:h-2">
                                <div
                                  className={`h-1.5 sm:h-2 rounded-full ${getThreatLevelColor(d.threat_level)}`}
                                  style={{ width: `${d.threat_score}%` }}
                                ></div>
                              </div>
                              <span className="font-mono font-bold text-[10px] sm:text-xs">{fmt(d.threat_score)}</span>
                            </div>
                          </td>
                          <td className="text-center py-2 px-1">
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${getThreatLevelColor(d.threat_level)} text-white`}>
                              {d.threat_level}
                            </span>
                          </td>
                          <td className="text-center py-2 px-1 font-mono text-blue-400 text-[10px] sm:text-xs">{fmt(d.rainfall_score)}</td>
                          <td className="text-center py-2 px-1 font-mono text-cyan-400 text-[10px] sm:text-xs">{fmt(d.river_score)}</td>
                          <td className="text-center py-2 px-1 font-mono text-purple-400 text-[10px] sm:text-xs">{fmt(d.forecast_score)}</td>
                          <td className="py-2 px-1 sm:px-2 text-[10px] sm:text-xs text-gray-400">
                            {d.factors.slice(0, 2).map((f, i) => (
                              <div key={i} className="truncate max-w-[120px] sm:max-w-none">{f.value}</div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
