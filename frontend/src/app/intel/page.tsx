'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, IntelSummary, SOSReport, IntelCluster, IntelAction, NearbyFacilitiesResponse, FloodThreatResponse, IrrigationResponse, TrafficFlowResponse, TrafficIncident, AllFacilitiesResponse, FloodPatternsResponse } from '@/lib/api';

export default function IntelDashboard() {
  const [summary, setSummary] = useState<IntelSummary | null>(null);
  const [priorities, setPriorities] = useState<SOSReport[]>([]);
  const [clusters, setClusters] = useState<IntelCluster[]>([]);
  const [actions, setActions] = useState<IntelAction[]>([]);
  const [floodThreat, setFloodThreat] = useState<FloodThreatResponse | null>(null);
  const [riverData, setRiverData] = useState<IrrigationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [filterUrgency, setFilterUrgency] = useState<string>('');
  const [expandedReport, setExpandedReport] = useState<number | null>(null);
  const [nearbyFacilities, setNearbyFacilities] = useState<NearbyFacilitiesResponse | null>(null);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [activeTab, setActiveTab] = useState<'threat' | 'rescue' | 'infrastructure'>('threat');
  const [trafficFlow, setTrafficFlow] = useState<TrafficFlowResponse | null>(null);
  const [trafficIncidents, setTrafficIncidents] = useState<TrafficIncident[]>([]);
  const [allFacilities, setAllFacilities] = useState<AllFacilitiesResponse | null>(null);
  const [floodPatterns, setFloodPatterns] = useState<FloodPatternsResponse | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [summaryData, prioritiesData, clustersData, actionsData, threatData, irrigationData, trafficFlowData, trafficIncidentsData, facilitiesData] = await Promise.all([
        api.getIntelSummary(),
        api.getIntelPriorities(100, undefined, filterUrgency || undefined),
        api.getIntelClusters(),
        api.getIntelActions(),
        api.getFloodThreat(),
        api.getIrrigationData(),
        api.getTrafficFlow().catch(() => null),
        api.getTrafficIncidents().catch(() => ({ incidents: [] })),
        api.getAllFacilities().catch(() => null),
      ]);

      setSummary(summaryData);
      setPriorities(prioritiesData.reports);
      setClusters(clustersData.clusters);
      setActions(actionsData.actions);
      setFloodThreat(threatData);
      setRiverData(irrigationData);
      setTrafficFlow(trafficFlowData);
      setTrafficIncidents(trafficIncidentsData.incidents);
      setAllFacilities(facilitiesData);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch intel data:', err);
    } finally {
      setLoading(false);
    }
  }, [filterUrgency]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch flood patterns (on-demand since it takes time)
  const fetchFloodPatterns = useCallback(async () => {
    if (floodPatterns || loadingPatterns) return; // Already loaded or loading
    setLoadingPatterns(true);
    try {
      const patterns = await api.getFloodPatterns('Colombo', 30);
      setFloodPatterns(patterns);
    } catch (err) {
      console.error('Failed to fetch flood patterns:', err);
    } finally {
      setLoadingPatterns(false);
    }
  }, [floodPatterns, loadingPatterns]);

  // Load flood patterns when threat tab is active
  useEffect(() => {
    if (activeTab === 'threat' && !floodPatterns && !loadingPatterns) {
      fetchFloodPatterns();
    }
  }, [activeTab, floodPatterns, loadingPatterns, fetchFloodPatterns]);

  const handleExpandReport = async (report: SOSReport) => {
    if (expandedReport === report.id) {
      setExpandedReport(null);
      setNearbyFacilities(null);
      return;
    }

    setExpandedReport(report.id);
    setNearbyFacilities(null);

    if (report.latitude && report.longitude) {
      setLoadingFacilities(true);
      try {
        const facilities = await api.getNearbyFacilities(report.latitude, report.longitude, 15, 3);
        setNearbyFacilities(facilities);
      } catch (err) {
        console.error('Failed to fetch nearby facilities:', err);
      } finally {
        setLoadingFacilities(false);
      }
    }
  };

  const getFacilityIcon = (type: string) => {
    switch (type) {
      case 'hospitals': return '🏥';
      case 'police': return '🚔';
      case 'fire_stations': return '🚒';
      case 'shelters': return '🏠';
      default: return '📍';
    }
  };

  const getUrgencyColor = (tier: string) => {
    switch (tier) {
      case 'CRITICAL': return 'bg-red-600 text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-black';
      default: return 'bg-green-500 text-white';
    }
  };

  const getWaterLevelIcon = (level: string) => {
    switch (level) {
      case 'ROOF': return '🏠🌊';
      case 'NECK': return '😰🌊';
      case 'CHEST': return '🧍🌊';
      case 'WAIST': return '🚶🌊';
      case 'ANKLE': return '🦶💧';
      default: return '❓';
    }
  };

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-600';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getThreatLevelBorder = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'border-red-500';
      case 'HIGH': return 'border-orange-500';
      case 'MEDIUM': return 'border-yellow-500';
      default: return 'border-green-500';
    }
  };

  const getRiverStatusColor = (status: string) => {
    switch (status) {
      case 'major_flood': return 'bg-red-600 text-white';
      case 'minor_flood': return 'bg-orange-500 text-white';
      case 'alert': return 'bg-yellow-500 text-black';
      default: return 'bg-green-600 text-white';
    }
  };

  const getRiverStatusLabel = (status: string) => {
    switch (status) {
      case 'major_flood': return 'MAJOR FLOOD';
      case 'minor_flood': return 'MINOR FLOOD';
      case 'alert': return 'ALERT';
      default: return 'NORMAL';
    }
  };

  const getCongestionColor = (congestion: string) => {
    switch (congestion) {
      case 'free': return 'bg-green-600 text-white';
      case 'light': return 'bg-green-400 text-black';
      case 'moderate': return 'bg-yellow-500 text-black';
      case 'heavy': return 'bg-orange-500 text-white';
      case 'severe': return 'bg-red-600 text-white';
      case 'closed': return 'bg-black text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getIncidentIcon = (category: string) => {
    const lower = category.toLowerCase();
    if (lower.includes('closed') || lower.includes('closure')) return '🚫';
    if (lower.includes('accident')) return '⚠️';
    if (lower.includes('flood')) return '🌊';
    if (lower.includes('road') && lower.includes('work')) return '🚧';
    if (lower.includes('jam')) return '🚗';
    return '⚡';
  };

  const getIncidentSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'major': return 'bg-orange-500 text-white';
      case 'moderate': return 'bg-yellow-500 text-black';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mx-auto"></div>
          <p className="text-white mt-4">Loading Intelligence Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-red-500">Emergency Intel Dashboard</h1>
            <p className="text-sm text-gray-400">
              Automated Damage Control Intelligence | Data from{' '}
              <a
                href="https://floodsupport.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                FloodSupport.org
              </a>
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Auto-refreshes every 30s</div>
            <div className="text-xs text-gray-500">Last updated: {lastUpdated}</div>
            <a
              href="https://floodsupport.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Report Emergency at FloodSupport.org
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-700 pb-2">
          <button
            onClick={() => setActiveTab('threat')}
            className={`px-4 py-2 rounded-t-lg font-semibold transition-colors ${
              activeTab === 'threat'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Flood Threat Intel
          </button>
          <button
            onClick={() => setActiveTab('rescue')}
            className={`px-4 py-2 rounded-t-lg font-semibold transition-colors ${
              activeTab === 'rescue'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Rescue Operations
          </button>
          {/* Infrastructure Intel tab - hidden for now
          <button
            onClick={() => setActiveTab('infrastructure')}
            className={`px-4 py-2 rounded-t-lg font-semibold transition-colors ${
              activeTab === 'infrastructure'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Infrastructure Intel
          </button>
          */}
        </div>

        {/* FLOOD THREAT INTEL TAB */}
        {activeTab === 'threat' && (
          <>
            {/* National Threat Level Banner */}
            {floodThreat && (
              <div className={`rounded-lg p-6 border-2 ${getThreatLevelBorder(floodThreat.national_threat_level)}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`${getThreatLevelColor(floodThreat.national_threat_level)} text-white px-6 py-3 rounded-lg`}>
                      <div className="text-sm font-medium opacity-90">NATIONAL THREAT</div>
                      <div className="text-3xl font-bold">{floodThreat.national_threat_level}</div>
                    </div>
                    <div>
                      <div className="text-5xl font-bold text-white">{floodThreat.national_threat_score.toFixed(0)}<span className="text-2xl text-gray-400">/100</span></div>
                      <div className="text-sm text-gray-400">Composite Threat Score</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-2xl font-bold text-red-500">{floodThreat.summary.critical_districts}</div>
                      <div className="text-xs text-gray-400">Critical Districts</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-2xl font-bold text-orange-500">{floodThreat.summary.high_risk_districts}</div>
                      <div className="text-xs text-gray-400">High Risk</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-2xl font-bold text-yellow-500">{floodThreat.summary.medium_risk_districts}</div>
                      <div className="text-xs text-gray-400">Medium Risk</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* River Status Summary */}
            {riverData && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>🌊</span> River Network Status
                  <span className="text-sm font-normal text-gray-400">({riverData.count} stations monitored)</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-center">
                    <div className="text-3xl font-bold text-red-500">{riverData.summary.major_flood}</div>
                    <div className="text-sm text-red-300">Major Flood</div>
                  </div>
                  <div className="bg-orange-900/50 border border-orange-700 rounded-lg p-3 text-center">
                    <div className="text-3xl font-bold text-orange-500">{riverData.summary.minor_flood}</div>
                    <div className="text-sm text-orange-300">Minor Flood</div>
                  </div>
                  <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-3 text-center">
                    <div className="text-3xl font-bold text-yellow-500">{riverData.summary.alert}</div>
                    <div className="text-sm text-yellow-300">Alert Level</div>
                  </div>
                  <div className="bg-green-900/50 border border-green-700 rounded-lg p-3 text-center">
                    <div className="text-3xl font-bold text-green-500">{riverData.summary.normal}</div>
                    <div className="text-sm text-green-300">Normal</div>
                  </div>
                </div>

                {/* River Stations at Risk */}
                {riverData.stations.filter(s => s.status !== 'normal').length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="text-left py-2">Station</th>
                          <th className="text-left py-2">River</th>
                          <th className="text-center py-2">Level</th>
                          <th className="text-center py-2">Flood Threshold</th>
                          <th className="text-center py-2">% to Flood</th>
                          <th className="text-center py-2">Status</th>
                          <th className="text-left py-2">Districts Affected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riverData.stations
                          .filter(s => s.status !== 'normal')
                          .sort((a, b) => b.pct_to_major_flood - a.pct_to_major_flood)
                          .map((station, idx) => (
                            <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700">
                              <td className="py-2 font-medium">{station.station}</td>
                              <td className="py-2 text-gray-400">{station.river}</td>
                              <td className="text-center py-2 font-mono">{station.water_level_m.toFixed(2)}m</td>
                              <td className="text-center py-2 font-mono text-gray-500">{station.major_flood_level_m.toFixed(2)}m</td>
                              <td className="text-center py-2">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-20 bg-gray-700 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        station.pct_to_major_flood >= 100 ? 'bg-red-500' :
                                        station.pct_to_major_flood >= 80 ? 'bg-orange-500' :
                                        station.pct_to_major_flood >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                                      }`}
                                      style={{ width: `${Math.min(station.pct_to_major_flood, 100)}%` }}
                                    ></div>
                                  </div>
                                  <span className="font-mono text-xs">{station.pct_to_major_flood.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="text-center py-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${getRiverStatusColor(station.status)}`}>
                                  {getRiverStatusLabel(station.status)}
                                </span>
                              </td>
                              <td className="py-2 text-sm text-gray-400">{station.districts.join(', ')}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {riverData.stations.filter(s => s.status !== 'normal').length === 0 && (
                  <div className="text-center text-green-400 py-4">
                    All river stations are at normal levels
                  </div>
                )}
              </div>
            )}

            {/* Top Risk Districts */}
            {floodThreat && floodThreat.top_risk_districts.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4">Top Risk Districts</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        <th className="text-left py-2">District</th>
                        <th className="text-center py-2">Threat Score</th>
                        <th className="text-center py-2">Level</th>
                        <th className="text-center py-2">Rain</th>
                        <th className="text-center py-2">River</th>
                        <th className="text-center py-2">Forecast</th>
                        <th className="text-left py-2">Key Factors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {floodThreat.top_risk_districts.slice(0, 10).map((d, idx) => (
                        <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700">
                          <td className="py-2 font-medium">{d.district}</td>
                          <td className="text-center py-2">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-gray-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${getThreatLevelColor(d.threat_level)}`}
                                  style={{ width: `${d.threat_score}%` }}
                                ></div>
                              </div>
                              <span className="font-mono font-bold">{d.threat_score.toFixed(0)}</span>
                            </div>
                          </td>
                          <td className="text-center py-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getThreatLevelColor(d.threat_level)} text-white`}>
                              {d.threat_level}
                            </span>
                          </td>
                          <td className="text-center py-2 font-mono text-blue-400">{d.rainfall_score.toFixed(0)}</td>
                          <td className="text-center py-2 font-mono text-cyan-400">{d.river_score.toFixed(0)}</td>
                          <td className="text-center py-2 font-mono text-purple-400">{d.forecast_score.toFixed(0)}</td>
                          <td className="py-2 text-xs text-gray-400">
                            {d.factors.slice(0, 2).map((f, i) => (
                              <div key={i}>{f.value}</div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Historical Flood Patterns Analysis */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>📊</span> Historical Flood Pattern Analysis (30-Year Data)
                {loadingPatterns && <span className="text-sm text-gray-400 font-normal">(Loading...)</span>}
              </h2>

              {floodPatterns ? (
                <div className="space-y-6">
                  {/* Summary Stats with Gauge Charts */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-400">{floodPatterns.summary.avg_annual_rainfall_mm.toFixed(0)}</div>
                      <div className="text-xs text-blue-300">Avg Annual Rainfall (mm)</div>
                    </div>
                    <div className="bg-orange-900/50 border border-orange-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-orange-400">{floodPatterns.summary.max_daily_rainfall_mm.toFixed(0)}</div>
                      <div className="text-xs text-orange-300">Max Daily Rainfall (mm)</div>
                    </div>
                    <div className="bg-cyan-900/50 border border-cyan-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-cyan-400">{floodPatterns.summary.heavy_rain_days}</div>
                      <div className="text-xs text-cyan-300">Heavy Rain Days (&gt;50mm)</div>
                    </div>
                    <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-red-400">{floodPatterns.summary.extreme_rain_days}</div>
                      <div className="text-xs text-red-300">Extreme Days (&gt;100mm)</div>
                    </div>
                  </div>

                  {/* NEW: Radial/Polar Chart - Monthly Rainfall */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Radial Monthly Rainfall Pattern</h3>
                    <div className="flex justify-center">
                      <div className="relative w-72 h-72">
                        {/* Concentric circles for scale */}
                        {[25, 50, 75, 100].map((pct) => (
                          <div
                            key={pct}
                            className="absolute border border-gray-600 rounded-full opacity-30"
                            style={{
                              width: `${pct}%`,
                              height: `${pct}%`,
                              top: `${(100 - pct) / 2}%`,
                              left: `${(100 - pct) / 2}%`,
                            }}
                          />
                        ))}
                        {/* Month segments */}
                        {floodPatterns.flood_risk_months.sort((a, b) => a.month - b.month).map((m, idx) => {
                          const maxRain = Math.max(...floodPatterns.flood_risk_months.map(x => x.avg_rainfall_mm));
                          const radius = (m.avg_rainfall_mm / maxRain) * 45;
                          const angle = (idx * 30 - 90) * (Math.PI / 180);
                          const x = 50 + radius * Math.cos(angle);
                          const y = 50 + radius * Math.sin(angle);
                          const riskColor = m.flood_risk === 'HIGH' ? '#ef4444' : m.flood_risk === 'MEDIUM' ? '#eab308' : '#22c55e';
                          return (
                            <div key={m.month}>
                              {/* Line from center to point */}
                              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                                <line
                                  x1="50" y1="50"
                                  x2={x} y2={y}
                                  stroke={riskColor}
                                  strokeWidth="2"
                                  opacity="0.6"
                                />
                                <circle cx={x} cy={y} r="3" fill={riskColor} />
                              </svg>
                              {/* Month label */}
                              <div
                                className="absolute text-xs text-gray-400 font-medium"
                                style={{
                                  left: `${50 + 48 * Math.cos(angle)}%`,
                                  top: `${50 + 48 * Math.sin(angle)}%`,
                                  transform: 'translate(-50%, -50%)',
                                }}
                              >
                                {m.month_name.substring(0, 3)}
                              </div>
                            </div>
                          );
                        })}
                        {/* Connect points to form polygon */}
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                          <polygon
                            points={floodPatterns.flood_risk_months.sort((a, b) => a.month - b.month).map((m, idx) => {
                              const maxRain = Math.max(...floodPatterns.flood_risk_months.map(x => x.avg_rainfall_mm));
                              const radius = (m.avg_rainfall_mm / maxRain) * 45;
                              const angle = (idx * 30 - 90) * (Math.PI / 180);
                              return `${50 + radius * Math.cos(angle)},${50 + radius * Math.sin(angle)}`;
                            }).join(' ')}
                            fill="rgba(59, 130, 246, 0.3)"
                            stroke="#3b82f6"
                            strokeWidth="1.5"
                          />
                        </svg>
                        {/* Center label */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-lg font-bold text-white">{floodPatterns.district}</div>
                            <div className="text-xs text-gray-400">30yr avg</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-center gap-6 mt-4 text-xs">
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-full" /> HIGH Risk</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded-full" /> MEDIUM Risk</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-full" /> LOW Risk</div>
                    </div>
                  </div>

                  {/* Monthly Flood Risk Chart - Original Bar */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Monthly Flood Risk Profile</h3>
                    <div className="flex items-end gap-1 h-48">
                      {floodPatterns.flood_risk_months.sort((a, b) => a.month - b.month).map((m) => {
                        const maxRain = Math.max(...floodPatterns.flood_risk_months.map(x => x.avg_rainfall_mm));
                        const heightPct = (m.avg_rainfall_mm / maxRain) * 100;
                        const riskColor = m.flood_risk === 'HIGH' ? 'bg-red-500' : m.flood_risk === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500';
                        return (
                          <div key={m.month} className="flex-1 flex flex-col items-center">
                            <div className="text-xs text-gray-400 mb-1">{m.avg_rainfall_mm.toFixed(0)}</div>
                            <div
                              className={`w-full ${riskColor} rounded-t transition-all hover:opacity-80`}
                              style={{ height: `${heightPct}%`, minHeight: '4px' }}
                              title={`${m.month_name}: ${m.avg_rainfall_mm.toFixed(0)}mm avg, ${m.max_daily_mm.toFixed(0)}mm max`}
                            />
                            <div className="text-xs text-gray-400 mt-1">{m.month_name.substring(0, 3)}</div>
                            <div className={`text-xs font-bold mt-1 ${m.flood_risk === 'HIGH' ? 'text-red-400' : m.flood_risk === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'}`}>
                              {m.flood_risk === 'HIGH' ? '⚠️' : m.flood_risk === 'MEDIUM' ? '⚡' : '✓'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-center gap-6 mt-4 text-xs">
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded" /> HIGH Risk</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded" /> MEDIUM Risk</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded" /> LOW Risk</div>
                    </div>
                  </div>

                  {/* NEW: Treemap - Seasonal Rainfall Distribution */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Seasonal Rainfall Treemap</h3>
                    <div className="flex flex-wrap gap-1 h-48">
                      {(() => {
                        const seasons = Object.entries(floodPatterns.seasonal_patterns);
                        const totalRainDays = seasons.reduce((sum, [, s]) => sum + s.rainy_days, 0);
                        const colors = {
                          southwest: { bg: 'bg-blue-600', border: 'border-blue-400' },
                          northeast: { bg: 'bg-cyan-600', border: 'border-cyan-400' },
                          inter_monsoon: { bg: 'bg-purple-600', border: 'border-purple-400' },
                        };
                        return seasons.map(([key, season]) => {
                          const widthPct = Math.max((season.rainy_days / totalRainDays) * 100, 20);
                          const color = colors[key as keyof typeof colors] || { bg: 'bg-gray-600', border: 'border-gray-400' };
                          return (
                            <div
                              key={key}
                              className={`${color.bg} border-2 ${color.border} rounded-lg p-3 flex flex-col justify-between transition-all hover:opacity-90`}
                              style={{ flexBasis: `${widthPct}%`, flexGrow: 1, minWidth: '150px' }}
                            >
                              <div>
                                <div className="font-semibold text-sm text-white">{season.name}</div>
                                <div className="text-xs text-white/70 mt-1">{season.rainy_days} rainy days</div>
                              </div>
                              <div className="mt-auto pt-2">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <div className="text-white/60">Avg Daily</div>
                                    <div className="font-bold text-white">{season.avg_daily_mm.toFixed(1)}mm</div>
                                  </div>
                                  <div>
                                    <div className="text-white/60">Max Day</div>
                                    <div className="font-bold text-white">{season.max_daily_mm.toFixed(0)}mm</div>
                                  </div>
                                  <div>
                                    <div className="text-white/60">Heavy Days</div>
                                    <div className="font-bold text-yellow-300">{season.heavy_rain_days}</div>
                                  </div>
                                  <div>
                                    <div className="text-white/60">Extreme</div>
                                    <div className={`font-bold ${season.extreme_rain_days > 0 ? 'text-red-300' : 'text-green-300'}`}>
                                      {season.extreme_rain_days}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <div className="flex justify-center gap-4 mt-3 text-xs">
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded" /> Southwest Monsoon</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-cyan-600 rounded" /> Northeast Monsoon</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-600 rounded" /> Inter-Monsoon</div>
                    </div>
                  </div>

                  {/* NEW: Gauge Charts for Risk Indicators */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Risk Gauge Indicators</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Extreme Event Frequency Gauge */}
                      {(() => {
                        const extremePerYear = floodPatterns.summary.extreme_rain_days / 30;
                        const gaugeValue = Math.min((extremePerYear / 5) * 100, 100); // 5 events/year = 100%
                        const gaugeColor = gaugeValue > 66 ? '#ef4444' : gaugeValue > 33 ? '#eab308' : '#22c55e';
                        return (
                          <div className="text-center">
                            <div className="relative w-24 h-12 mx-auto overflow-hidden">
                              <div className="absolute inset-0 bg-gray-600 rounded-t-full"></div>
                              <div
                                className="absolute bottom-0 left-0 right-0 rounded-t-full transition-all"
                                style={{
                                  height: `${gaugeValue}%`,
                                  backgroundColor: gaugeColor,
                                }}
                              ></div>
                              <div className="absolute inset-0 flex items-end justify-center pb-1">
                                <span className="text-lg font-bold text-white">{extremePerYear.toFixed(1)}</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-2">Extreme Events/Year</div>
                          </div>
                        );
                      })()}
                      {/* Heavy Rain Frequency Gauge */}
                      {(() => {
                        const heavyPerYear = floodPatterns.summary.heavy_rain_days / 30;
                        const gaugeValue = Math.min((heavyPerYear / 30) * 100, 100); // 30 days/year = 100%
                        const gaugeColor = gaugeValue > 66 ? '#ef4444' : gaugeValue > 33 ? '#eab308' : '#22c55e';
                        return (
                          <div className="text-center">
                            <div className="relative w-24 h-12 mx-auto overflow-hidden">
                              <div className="absolute inset-0 bg-gray-600 rounded-t-full"></div>
                              <div
                                className="absolute bottom-0 left-0 right-0 rounded-t-full transition-all"
                                style={{
                                  height: `${gaugeValue}%`,
                                  backgroundColor: gaugeColor,
                                }}
                              ></div>
                              <div className="absolute inset-0 flex items-end justify-center pb-1">
                                <span className="text-lg font-bold text-white">{heavyPerYear.toFixed(1)}</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-2">Heavy Rain Days/Year</div>
                          </div>
                        );
                      })()}
                      {/* Max Daily Intensity Gauge */}
                      {(() => {
                        const maxDaily = floodPatterns.summary.max_daily_rainfall_mm;
                        const gaugeValue = Math.min((maxDaily / 300) * 100, 100); // 300mm = 100%
                        const gaugeColor = gaugeValue > 66 ? '#ef4444' : gaugeValue > 33 ? '#eab308' : '#22c55e';
                        return (
                          <div className="text-center">
                            <div className="relative w-24 h-12 mx-auto overflow-hidden">
                              <div className="absolute inset-0 bg-gray-600 rounded-t-full"></div>
                              <div
                                className="absolute bottom-0 left-0 right-0 rounded-t-full transition-all"
                                style={{
                                  height: `${gaugeValue}%`,
                                  backgroundColor: gaugeColor,
                                }}
                              ></div>
                              <div className="absolute inset-0 flex items-end justify-center pb-1">
                                <span className="text-lg font-bold text-white">{maxDaily.toFixed(0)}</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-2">Max Daily (mm)</div>
                          </div>
                        );
                      })()}
                      {/* High Risk Months Gauge */}
                      {(() => {
                        const highRiskMonths = floodPatterns.flood_risk_months.filter(m => m.flood_risk === 'HIGH').length;
                        const gaugeValue = (highRiskMonths / 12) * 100;
                        const gaugeColor = gaugeValue > 50 ? '#ef4444' : gaugeValue > 25 ? '#eab308' : '#22c55e';
                        return (
                          <div className="text-center">
                            <div className="relative w-24 h-12 mx-auto overflow-hidden">
                              <div className="absolute inset-0 bg-gray-600 rounded-t-full"></div>
                              <div
                                className="absolute bottom-0 left-0 right-0 rounded-t-full transition-all"
                                style={{
                                  height: `${gaugeValue}%`,
                                  backgroundColor: gaugeColor,
                                }}
                              ></div>
                              <div className="absolute inset-0 flex items-end justify-center pb-1">
                                <span className="text-lg font-bold text-white">{highRiskMonths}</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-2">High Risk Months</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* NEW: Box Plot Style - Monthly Rainfall Distribution */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Monthly Rainfall Range (Avg to Max)</h3>
                    <div className="space-y-2">
                      {floodPatterns.flood_risk_months.sort((a, b) => a.month - b.month).map((m) => {
                        const maxPossible = floodPatterns.summary.max_daily_rainfall_mm;
                        const avgPct = (m.avg_rainfall_mm / maxPossible) * 100;
                        const maxPct = (m.max_daily_mm / maxPossible) * 100;
                        const riskColor = m.flood_risk === 'HIGH' ? 'bg-red-500' : m.flood_risk === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500';
                        return (
                          <div key={m.month} className="flex items-center gap-2">
                            <div className="w-8 text-xs text-gray-400 text-right">{m.month_name.substring(0, 3)}</div>
                            <div className="flex-1 relative h-6 bg-gray-600 rounded overflow-hidden">
                              {/* Max range (lighter) */}
                              <div
                                className={`absolute left-0 top-0 bottom-0 ${riskColor} opacity-30`}
                                style={{ width: `${maxPct}%` }}
                              />
                              {/* Avg range (solid) */}
                              <div
                                className={`absolute left-0 top-0 bottom-0 ${riskColor}`}
                                style={{ width: `${avgPct}%` }}
                              />
                              {/* Max marker */}
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-white"
                                style={{ left: `${maxPct}%` }}
                              />
                            </div>
                            <div className="w-24 text-xs text-gray-400 text-right">
                              <span className="text-white">{m.avg_rainfall_mm.toFixed(0)}</span>
                              <span className="text-gray-500"> / </span>
                              <span className="text-orange-400">{m.max_daily_mm.toFixed(0)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-center gap-4 mt-3 text-xs">
                      <div className="flex items-center gap-1"><div className="w-6 h-3 bg-gray-500 rounded" /> Avg Rainfall</div>
                      <div className="flex items-center gap-1"><div className="w-6 h-3 bg-gray-500 opacity-30 rounded" /> Max Range</div>
                      <div className="flex items-center gap-1"><div className="w-0.5 h-3 bg-white" /> Max Daily</div>
                    </div>
                  </div>

                  {/* NEW: Sparklines - Yearly Trends Compact */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">30-Year Trend Sparklines</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Total Rainfall Sparkline */}
                      <div className="bg-gray-800 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-400">Annual Rainfall</span>
                          <span className="text-sm font-bold text-blue-400">
                            {floodPatterns.yearly_trends[floodPatterns.yearly_trends.length - 1]?.total_rainfall_mm.toFixed(0) || 0}mm
                          </span>
                        </div>
                        <div className="flex items-end gap-px h-12">
                          {floodPatterns.yearly_trends.map((y) => {
                            const max = Math.max(...floodPatterns.yearly_trends.map(t => t.total_rainfall_mm));
                            const heightPct = (y.total_rainfall_mm / max) * 100;
                            return (
                              <div
                                key={y.year}
                                className="flex-1 bg-blue-500 rounded-t min-w-[2px]"
                                style={{ height: `${heightPct}%` }}
                                title={`${y.year}: ${y.total_rainfall_mm.toFixed(0)}mm`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{floodPatterns.yearly_trends[0]?.year}</span>
                          <span>{floodPatterns.yearly_trends[floodPatterns.yearly_trends.length - 1]?.year}</span>
                        </div>
                      </div>
                      {/* Extreme Days Sparkline */}
                      <div className="bg-gray-800 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-400">Extreme Days/Year</span>
                          <span className="text-sm font-bold text-red-400">
                            {floodPatterns.yearly_trends[floodPatterns.yearly_trends.length - 1]?.extreme_days || 0}
                          </span>
                        </div>
                        <div className="flex items-end gap-px h-12">
                          {floodPatterns.yearly_trends.map((y) => {
                            const max = Math.max(...floodPatterns.yearly_trends.map(t => t.extreme_days), 1);
                            const heightPct = (y.extreme_days / max) * 100;
                            return (
                              <div
                                key={y.year}
                                className="flex-1 bg-red-500 rounded-t min-w-[2px]"
                                style={{ height: `${Math.max(heightPct, 2)}%` }}
                                title={`${y.year}: ${y.extreme_days} extreme days`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{floodPatterns.yearly_trends[0]?.year}</span>
                          <span>{floodPatterns.yearly_trends[floodPatterns.yearly_trends.length - 1]?.year}</span>
                        </div>
                      </div>
                      {/* Max Daily Sparkline */}
                      <div className="bg-gray-800 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-400">Max Daily/Year</span>
                          <span className="text-sm font-bold text-orange-400">
                            {floodPatterns.yearly_trends[floodPatterns.yearly_trends.length - 1]?.max_daily_mm.toFixed(0) || 0}mm
                          </span>
                        </div>
                        <div className="flex items-end gap-px h-12">
                          {floodPatterns.yearly_trends.map((y) => {
                            const max = Math.max(...floodPatterns.yearly_trends.map(t => t.max_daily_mm));
                            const heightPct = (y.max_daily_mm / max) * 100;
                            return (
                              <div
                                key={y.year}
                                className="flex-1 bg-orange-500 rounded-t min-w-[2px]"
                                style={{ height: `${heightPct}%` }}
                                title={`${y.year}: ${y.max_daily_mm.toFixed(0)}mm max`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{floodPatterns.yearly_trends[0]?.year}</span>
                          <span>{floodPatterns.yearly_trends[floodPatterns.yearly_trends.length - 1]?.year}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* NEW: Heatmap Calendar - Extreme Events by Month/Year */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Extreme Event Heatmap (by Month)</h3>
                    <div className="overflow-x-auto">
                      <div className="min-w-[600px]">
                        {/* Month headers */}
                        <div className="flex gap-1 mb-1">
                          <div className="w-12 text-xs text-gray-500"></div>
                          {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => (
                            <div key={i} className="flex-1 text-center text-xs text-gray-400">{m}</div>
                          ))}
                        </div>
                        {/* Event distribution by month from extreme events */}
                        {(() => {
                          // Group events by month
                          const monthCounts = Array(12).fill(0);
                          floodPatterns.extreme_events.forEach(e => {
                            monthCounts[e.month - 1]++;
                          });
                          const maxCount = Math.max(...monthCounts, 1);
                          return (
                            <div className="flex gap-1">
                              <div className="w-12 text-xs text-gray-400 flex items-center">Events</div>
                              {monthCounts.map((count, i) => {
                                const intensity = count / maxCount;
                                const bgColor = count === 0 ? 'bg-gray-700' :
                                  intensity > 0.7 ? 'bg-red-600' :
                                  intensity > 0.4 ? 'bg-orange-500' :
                                  intensity > 0.2 ? 'bg-yellow-500' : 'bg-green-600';
                                return (
                                  <div
                                    key={i}
                                    className={`flex-1 h-8 ${bgColor} rounded flex items-center justify-center text-xs font-bold text-white`}
                                    title={`${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}: ${count} extreme events`}
                                  >
                                    {count > 0 ? count : ''}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex justify-center gap-3 mt-3 text-xs">
                      <div className="flex items-center gap-1"><div className="w-4 h-4 bg-gray-700 rounded" /> 0</div>
                      <div className="flex items-center gap-1"><div className="w-4 h-4 bg-green-600 rounded" /> Low</div>
                      <div className="flex items-center gap-1"><div className="w-4 h-4 bg-yellow-500 rounded" /> Med</div>
                      <div className="flex items-center gap-1"><div className="w-4 h-4 bg-orange-500 rounded" /> High</div>
                      <div className="flex items-center gap-1"><div className="w-4 h-4 bg-red-600 rounded" /> Critical</div>
                    </div>
                  </div>

                  {/* Seasonal Patterns - Original Cards */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Monsoon Season Analysis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Object.entries(floodPatterns.seasonal_patterns).map(([key, season]) => (
                        <div key={key} className="bg-gray-800 rounded-lg p-4">
                          <div className="font-semibold text-sm mb-2">{season.name}</div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Avg Daily Rain</span>
                              <span className="font-mono text-blue-400">{season.avg_daily_mm.toFixed(1)} mm</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Max Single Day</span>
                              <span className="font-mono text-orange-400">{season.max_daily_mm.toFixed(1)} mm</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Heavy Rain Days</span>
                              <span className="font-mono text-cyan-400">{season.heavy_rain_days}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Extreme Events</span>
                              <span className={`font-mono ${season.extreme_rain_days > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {season.extreme_rain_days}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Yearly Trend Chart - Original */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Annual Rainfall Trend ({floodPatterns.period})</h3>
                    <div className="flex items-end gap-2 h-40 overflow-x-auto">
                      {floodPatterns.yearly_trends.map((year) => {
                        const maxRain = Math.max(...floodPatterns.yearly_trends.map(y => y.total_rainfall_mm));
                        const heightPct = (year.total_rainfall_mm / maxRain) * 100;
                        const avgRain = floodPatterns.summary.avg_annual_rainfall_mm;
                        const isAboveAvg = year.total_rainfall_mm > avgRain;
                        return (
                          <div key={year.year} className="flex-1 min-w-[12px] flex flex-col items-center">
                            <div className="text-xs text-gray-500 mb-1 transform -rotate-45 origin-bottom-left whitespace-nowrap hidden md:block">
                              {(year.total_rainfall_mm / 1000).toFixed(1)}k
                            </div>
                            <div
                              className={`w-full ${isAboveAvg ? 'bg-blue-500' : 'bg-blue-700'} rounded-t transition-all hover:opacity-80`}
                              style={{ height: `${heightPct}%`, minHeight: '4px' }}
                              title={`${year.year}: ${year.total_rainfall_mm.toFixed(0)}mm total, ${year.extreme_days} extreme days`}
                            />
                            <div className="text-xs text-gray-400 mt-1">{year.year.toString().slice(-2)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-center items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>Avg: {(floodPatterns.summary.avg_annual_rainfall_mm / 1000).toFixed(1)}k mm/year</span>
                      <span className="text-gray-600">|</span>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded" /> Above avg</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-700 rounded" /> Below avg</div>
                    </div>
                  </div>

                  {/* Extreme Events Table */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Top 10 Extreme Rainfall Events (Potential Flood Triggers)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-600">
                            <th className="text-left py-2">#</th>
                            <th className="text-left py-2">Date</th>
                            <th className="text-center py-2">Rainfall (mm)</th>
                            <th className="text-center py-2">Month</th>
                            <th className="text-center py-2">Severity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {floodPatterns.extreme_events.slice(0, 10).map((event, idx) => (
                            <tr key={idx} className="border-b border-gray-700">
                              <td className="py-2 text-gray-500">{idx + 1}</td>
                              <td className="py-2">{event.date}</td>
                              <td className="text-center py-2">
                                <span className="font-mono font-bold text-red-400">{event.precipitation_mm.toFixed(1)}</span>
                              </td>
                              <td className="text-center py-2 text-gray-400">
                                {['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][event.month]}
                              </td>
                              <td className="text-center py-2">
                                {event.precipitation_mm >= 150 ? (
                                  <span className="px-2 py-1 rounded bg-red-900 text-red-300 text-xs">EXTREME</span>
                                ) : event.precipitation_mm >= 100 ? (
                                  <span className="px-2 py-1 rounded bg-orange-900 text-orange-300 text-xs">SEVERE</span>
                                ) : (
                                  <span className="px-2 py-1 rounded bg-yellow-900 text-yellow-300 text-xs">HEAVY</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Analysis Info */}
                  <div className="text-xs text-gray-500 text-center">
                    Analysis based on {floodPatterns.total_days_analyzed.toLocaleString()} days of data for {floodPatterns.district} district ({floodPatterns.period})
                    | Source: Open-Meteo Historical Weather API | Data cached for 24 hours
                  </div>
                </div>
              ) : loadingPatterns ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <div className="text-gray-400">Analyzing 30 years of historical rainfall data...</div>
                  <div className="text-gray-500 text-sm mt-2">This may take 1-2 minutes (results are cached for 24 hours)</div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Unable to load flood pattern analysis
                </div>
              )}
            </div>

            {/* Data Sources Info */}
            <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
              <div className="font-semibold text-gray-300 mb-2">Data Sources:</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div>🌧️ <span className="text-gray-300">Rainfall:</span> Open-Meteo API (30min cache)</div>
                <div>🌊 <span className="text-gray-300">River Levels:</span> Irrigation Dept ArcGIS (5min cache)</div>
                <div>📅 <span className="text-gray-300">Forecast:</span> Open-Meteo 5-day forecast</div>
                <div>📊 <span className="text-gray-300">Historical:</span> Open-Meteo Archive (30 years)</div>
              </div>
            </div>
          </>
        )}

        {/* RESCUE OPERATIONS TAB */}
        {activeTab === 'rescue' && (
          <>
            {/* Emergency Contacts Bar */}
            <div className="bg-red-900 rounded-lg p-4 border border-red-700">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-red-300 font-semibold">Emergency Hotlines:</span>
                  <a href="tel:117" className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded font-bold">117 Emergency</a>
                  <a href="tel:119" className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded font-bold">119 Police</a>
                  <a href="tel:110" className="bg-orange-700 hover:bg-orange-600 text-white px-3 py-1 rounded font-bold">110 Fire</a>
                  <a href="tel:108" className="bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded font-bold">108 Ambulance</a>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://floodsupport.org/emergency-contacts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                  >
                    District Contacts
                  </a>
                  <a
                    href="https://floodsupport.org/flood-map"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-800 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Live Flood Map
                  </a>
                  <a
                    href="https://floodsupport.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm font-semibold"
                  >
                    Report Emergency
                  </a>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-red-500">
              <div className="text-3xl font-bold">{summary.total_reports}</div>
              <div className="text-sm text-gray-400">Total Reports</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-orange-500">
              <div className="text-3xl font-bold">{summary.total_people_affected}</div>
              <div className="text-sm text-gray-400">People Affected</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-red-600">
              <div className="text-3xl font-bold text-red-500">{summary.urgency_breakdown.critical}</div>
              <div className="text-sm text-gray-400">CRITICAL</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-orange-600">
              <div className="text-3xl font-bold text-orange-500">{summary.urgency_breakdown.high}</div>
              <div className="text-sm text-gray-400">HIGH</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
              <div className="text-3xl font-bold">{summary.resource_needs.needs_water}</div>
              <div className="text-sm text-gray-400">Need Water</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-purple-500">
              <div className="text-3xl font-bold">{summary.resource_needs.medical_emergencies}</div>
              <div className="text-sm text-gray-400">Medical Emergency</div>
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        {actions.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-red-400">Recommended Actions</h2>
            <div className="space-y-3">
              {actions.map((action, idx) => (
                <div key={idx} className="bg-gray-700 rounded-lg p-4 border-l-4 border-red-500">
                  <div className="flex items-start gap-3">
                    <div className="bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                      {action.priority}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{action.action.replace(/_/g, ' ')}</div>
                      <div className="text-sm text-gray-300 mt-1">{action.description}</div>
                      {action.targets.length > 0 && (
                        <div className="mt-2 text-xs text-gray-400">
                          {action.targets.slice(0, 3).map((t, i) => (
                            <span key={i} className="inline-block bg-gray-600 rounded px-2 py-1 mr-2 mb-1">
                              {String(t.location || t.district || t.name || `Target ${i + 1}`)}
                            </span>
                          ))}
                          {action.targets.length > 3 && (
                            <span className="text-gray-500">+{action.targets.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Most Affected Districts */}
        {summary && summary.most_affected_districts.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Most Affected Districts</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2">District</th>
                    <th className="text-center py-2">Reports</th>
                    <th className="text-center py-2">People</th>
                    <th className="text-center py-2">Critical</th>
                    <th className="text-center py-2">High</th>
                    <th className="text-center py-2">Need Water</th>
                    <th className="text-center py-2">Medical</th>
                    <th className="text-center py-2">Rain 24h</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.most_affected_districts.slice(0, 10).map((d, idx) => (
                    <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700">
                      <td className="py-2 font-medium">{d.district}</td>
                      <td className="text-center py-2">{d.count}</td>
                      <td className="text-center py-2">{d.total_people}</td>
                      <td className="text-center py-2">
                        <span className={d.critical > 0 ? 'text-red-500 font-bold' : ''}>{d.critical}</span>
                      </td>
                      <td className="text-center py-2">
                        <span className={d.high > 0 ? 'text-orange-500 font-bold' : ''}>{d.high}</span>
                      </td>
                      <td className="text-center py-2">{d.needs_water}</td>
                      <td className="text-center py-2">{d.has_medical}</td>
                      <td className="text-center py-2">
                        <span className={d.forecast_rain_24h > 50 ? 'text-blue-400' : ''}>
                          {d.forecast_rain_24h?.toFixed(0) || 0}mm
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Clusters */}
        {clusters.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Emergency Clusters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clusters.slice(0, 6).map((cluster, idx) => (
                <div key={idx} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold">{cluster.name}</div>
                    <div className="text-xs bg-gray-600 rounded px-2 py-1">
                      Avg: {cluster.avg_urgency.toFixed(0)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-400">Reports:</span> {cluster.report_count}</div>
                    <div><span className="text-gray-400">People:</span> {cluster.total_people}</div>
                    <div><span className="text-red-400">Critical:</span> {cluster.critical_count}</div>
                    <div><span className="text-orange-400">High:</span> {cluster.high_count}</div>
                  </div>
                  <div className="mt-2 flex gap-2 text-xs">
                    {cluster.vulnerabilities.medical_emergency && <span className="bg-red-600 px-2 py-1 rounded">Medical</span>}
                    {cluster.vulnerabilities.elderly && <span className="bg-purple-600 px-2 py-1 rounded">Elderly</span>}
                    {cluster.vulnerabilities.children && <span className="bg-blue-600 px-2 py-1 rounded">Children</span>}
                    {cluster.vulnerabilities.disabled && <span className="bg-yellow-600 text-black px-2 py-1 rounded">Disabled</span>}
                  </div>
                  {cluster.top_reports && cluster.top_reports.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-600">
                      <div className="text-xs text-gray-400 mb-1">Top reports:</div>
                      <div className="flex flex-wrap gap-1">
                        {cluster.top_reports.slice(0, 3).map((report) => (
                          <span
                            key={report.id}
                            className="text-xs bg-gray-600 px-2 py-1 rounded"
                            title={report.reference || `ID: ${report.id}`}
                          >
                            {report.address?.substring(0, 20) || `#${report.id}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Priority Filter */}
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-400">Filter by urgency:</span>
          {['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((tier) => (
            <button
              key={tier}
              onClick={() => setFilterUrgency(tier)}
              className={`px-3 py-1 rounded text-sm ${
                filterUrgency === tier
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tier || 'All'}
            </button>
          ))}
        </div>

        {/* Priority List */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Priority-Ranked Emergencies ({priorities.length})</h2>
          <p className="text-xs text-gray-500 mb-3">Click on a report to see nearby emergency facilities</p>
          <div className="space-y-3 max-h-[800px] overflow-y-auto">
            {priorities.map((report, idx) => (
              <div key={report.id}>
                <div
                  className={`bg-gray-700 rounded-lg p-4 border-l-4 cursor-pointer hover:bg-gray-650 transition-colors ${expandedReport === report.id ? 'ring-2 ring-blue-500' : ''}`}
                  style={{
                    borderLeftColor: report.urgency_tier === 'CRITICAL' ? '#dc2626' :
                                     report.urgency_tier === 'HIGH' ? '#f97316' :
                                     report.urgency_tier === 'MEDIUM' ? '#eab308' : '#22c55e'
                  }}
                  onClick={() => handleExpandReport(report)}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    {/* Rank */}
                    <div className="text-2xl font-bold text-gray-500 w-8">#{idx + 1}</div>

                    {/* Score Badge */}
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${getUrgencyColor(report.urgency_tier)}`}>
                      {report.urgency_score}
                    </div>

                    {/* Water Level */}
                    <div className="text-xl" title={`Water Level: ${report.water_level}`}>
                      {getWaterLevelIcon(report.water_level)}
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">
                        {report.address || report.landmark || 'No address'}
                      </div>
                      <div className="text-sm text-gray-400">
                        {report.district} | {report.number_of_people} people
                        {report.safe_for_hours !== null && ` | Safe: ${report.safe_for_hours}hrs`}
                      </div>
                      {report.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">{report.description}</div>
                      )}
                    </div>

                    {/* Vulnerability Tags */}
                    <div className="flex flex-wrap gap-1">
                      {report.has_medical_emergency && <span className="bg-red-600 text-xs px-2 py-1 rounded">Medical</span>}
                      {report.has_elderly && <span className="bg-purple-600 text-xs px-2 py-1 rounded">Elderly</span>}
                      {report.has_children && <span className="bg-blue-600 text-xs px-2 py-1 rounded">Children</span>}
                      {report.has_disabled && <span className="bg-yellow-600 text-black text-xs px-2 py-1 rounded">Disabled</span>}
                      {!report.has_water && <span className="bg-cyan-600 text-xs px-2 py-1 rounded">No Water</span>}
                      {!report.has_food && <span className="bg-orange-700 text-xs px-2 py-1 rounded">No Food</span>}
                      {report.elevation_m !== null && report.elevation_m !== undefined && (
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            report.elevation_risk_level === 'CRITICAL' ? 'bg-red-800' :
                            report.elevation_risk_level === 'HIGH' ? 'bg-orange-800' :
                            report.elevation_risk_level === 'MEDIUM' ? 'bg-yellow-800' :
                            'bg-gray-600'
                          }`}
                          title={`Elevation: ${report.elevation_m}m - ${report.elevation_risk_level} flood risk`}
                        >
                          {report.elevation_m}m
                        </span>
                      )}
                    </div>

                    {/* Contact & Links */}
                    <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                      {report.phone && (
                        <a href={`tel:${report.phone}`} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                          Call
                        </a>
                      )}
                      {report.reference && (
                        <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                          {report.reference}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Panel - Nearby Facilities */}
                {expandedReport === report.id && (
                  <div className="bg-gray-800 border border-gray-600 rounded-b-lg p-4 -mt-1 ml-4">
                    <h3 className="text-sm font-semibold mb-3 text-blue-400">Nearby Emergency Facilities (within 15km)</h3>

                    {!report.latitude || !report.longitude ? (
                      <p className="text-sm text-gray-500">No GPS coordinates available for this report</p>
                    ) : loadingFacilities ? (
                      <div className="flex items-center gap-2 text-gray-400">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        <span className="text-sm">Loading nearby facilities...</span>
                      </div>
                    ) : nearbyFacilities && nearbyFacilities.total_found > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Hospitals */}
                        {nearbyFacilities.hospitals.length > 0 && (
                          <div className="bg-gray-700 rounded p-3">
                            <div className="text-sm font-semibold mb-2 text-red-400">{getFacilityIcon('hospitals')} Hospitals</div>
                            <div className="space-y-2">
                              {nearbyFacilities.hospitals.map((h) => (
                                <div key={h.id} className="text-xs">
                                  <div className="font-medium">{h.name}</div>
                                  <div className="text-gray-400">{h.distance_km}km away</div>
                                  {h.phone && (
                                    <a href={`tel:${h.phone}`} className="text-green-400 hover:underline">{h.phone}</a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Police */}
                        {nearbyFacilities.police.length > 0 && (
                          <div className="bg-gray-700 rounded p-3">
                            <div className="text-sm font-semibold mb-2 text-blue-400">{getFacilityIcon('police')} Police</div>
                            <div className="space-y-2">
                              {nearbyFacilities.police.map((p) => (
                                <div key={p.id} className="text-xs">
                                  <div className="font-medium">{p.name}</div>
                                  <div className="text-gray-400">{p.distance_km}km away</div>
                                  {p.phone && (
                                    <a href={`tel:${p.phone}`} className="text-green-400 hover:underline">{p.phone}</a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Fire Stations */}
                        {nearbyFacilities.fire_stations.length > 0 && (
                          <div className="bg-gray-700 rounded p-3">
                            <div className="text-sm font-semibold mb-2 text-orange-400">{getFacilityIcon('fire_stations')} Fire Stations</div>
                            <div className="space-y-2">
                              {nearbyFacilities.fire_stations.map((f) => (
                                <div key={f.id} className="text-xs">
                                  <div className="font-medium">{f.name}</div>
                                  <div className="text-gray-400">{f.distance_km}km away</div>
                                  {f.phone && (
                                    <a href={`tel:${f.phone}`} className="text-green-400 hover:underline">{f.phone}</a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Shelters */}
                        {nearbyFacilities.shelters.length > 0 && (
                          <div className="bg-gray-700 rounded p-3">
                            <div className="text-sm font-semibold mb-2 text-green-400">{getFacilityIcon('shelters')} Shelters</div>
                            <div className="space-y-2">
                              {nearbyFacilities.shelters.map((s) => (
                                <div key={s.id} className="text-xs">
                                  <div className="font-medium">{s.name}</div>
                                  <div className="text-gray-400">{s.distance_km}km away</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : nearbyFacilities ? (
                      <p className="text-sm text-gray-500">No facilities found within 15km radius</p>
                    ) : null}

                    {/* Coordinates display */}
                    {report.latitude && report.longitude && (
                      <div className="mt-3 pt-2 border-t border-gray-600 text-xs text-gray-500">
                        GPS: {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                        <a
                          href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-3 text-blue-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open in Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
          </>
        )}

        {/* INFRASTRUCTURE INTEL TAB */}
        {activeTab === 'infrastructure' && (
          <>
            {/* Traffic Flow Overview */}
            {trafficFlow && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>🚗</span> Road Network Status
                  <span className="text-sm font-normal text-gray-400">({trafficFlow.total_locations} monitoring points)</span>
                </h2>

                {/* Congestion Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                  <div className="bg-green-900/50 border border-green-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-500">{trafficFlow.combined_summary?.free_flow ?? 0}</div>
                    <div className="text-xs text-green-300">Free Flow</div>
                  </div>
                  <div className="bg-green-800/50 border border-green-600 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{trafficFlow.combined_summary?.light ?? 0}</div>
                    <div className="text-xs text-green-300">Light</div>
                  </div>
                  <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-500">{trafficFlow.combined_summary?.moderate ?? 0}</div>
                    <div className="text-xs text-yellow-300">Moderate</div>
                  </div>
                  <div className="bg-orange-900/50 border border-orange-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-orange-500">{trafficFlow.combined_summary?.heavy ?? 0}</div>
                    <div className="text-xs text-orange-300">Heavy</div>
                  </div>
                  <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-500">{trafficFlow.combined_summary?.severe ?? 0}</div>
                    <div className="text-xs text-red-300">Severe</div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{(trafficFlow.combined_summary?.avg_speed_kmh ?? 0).toFixed(0)}</div>
                    <div className="text-xs text-gray-400">Avg km/h</div>
                  </div>
                </div>

                {/* Congested Roads */}
                {trafficFlow.congested_roads && trafficFlow.congested_roads.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-orange-400 mb-2">Congested Roads</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-700">
                            <th className="text-left py-2">Road</th>
                            <th className="text-center py-2">Status</th>
                            <th className="text-center py-2">Current Speed</th>
                            <th className="text-center py-2">Normal Speed</th>
                            <th className="text-center py-2">Delay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trafficFlow.congested_roads.map((road, idx) => (
                            <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700">
                              <td className="py-2 font-medium">{road.name}</td>
                              <td className="text-center py-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${getCongestionColor(road.congestion)}`}>
                                  {road.congestion.toUpperCase()}
                                </span>
                              </td>
                              <td className="text-center py-2 font-mono text-red-400">{road.current_speed_kmh.toFixed(0)} km/h</td>
                              <td className="text-center py-2 font-mono text-gray-500">{road.free_flow_speed_kmh.toFixed(0)} km/h</td>
                              <td className="text-center py-2 font-mono text-orange-400">
                                {road.delay_minutes ? `+${road.delay_minutes.toFixed(0)} min` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(!trafficFlow.congested_roads || trafficFlow.congested_roads.length === 0) && (
                  <div className="text-center text-green-400 py-4">
                    All monitored roads have normal traffic flow
                  </div>
                )}
              </div>
            )}

            {/* Road Incidents & Closures */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>⚠️</span> Road Incidents & Closures
                <span className="text-sm font-normal text-gray-400">({trafficIncidents?.length ?? 0} active)</span>
              </h2>

              {/* Incident Summary */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-500">
                    {trafficIncidents?.filter(i => i.category?.toLowerCase().includes('closed')).length ?? 0}
                  </div>
                  <div className="text-xs text-red-300">Road Closures</div>
                </div>
                <div className="bg-orange-900/50 border border-orange-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-500">
                    {trafficIncidents?.filter(i => i.category?.toLowerCase().includes('accident')).length ?? 0}
                  </div>
                  <div className="text-xs text-orange-300">Accidents</div>
                </div>
                <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-500">
                    {trafficIncidents?.filter(i => i.category?.toLowerCase().includes('flood')).length ?? 0}
                  </div>
                  <div className="text-xs text-blue-300">Flooding</div>
                </div>
                <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-500">
                    {trafficIncidents?.filter(i => i.category?.toLowerCase().includes('work')).length ?? 0}
                  </div>
                  <div className="text-xs text-yellow-300">Roadworks</div>
                </div>
                <div className="bg-purple-900/50 border border-purple-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-500">
                    {trafficIncidents?.filter(i => i.category?.toLowerCase().includes('jam')).length ?? 0}
                  </div>
                  <div className="text-xs text-purple-300">Traffic Jams</div>
                </div>
              </div>

              {/* Incident List */}
              {trafficIncidents && trafficIncidents.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {trafficIncidents.slice(0, 20).map((incident, idx) => (
                    <div key={idx} className="bg-gray-700 rounded-lg p-3 flex items-start gap-3">
                      <span className="text-2xl">{getIncidentIcon(incident.category)}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${getIncidentSeverityColor(incident.severity)}`}>
                            {incident.severity.toUpperCase()}
                          </span>
                          <span className="text-sm font-medium">{incident.category}</span>
                        </div>
                        <div className="text-sm text-gray-300">{incident.road_name}</div>
                        {incident.description && (
                          <div className="text-xs text-gray-500 mt-1">{incident.description}</div>
                        )}
                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                          {incident.delay_minutes > 0 && (
                            <span className="text-orange-400">Delay: {incident.delay_minutes} min</span>
                          )}
                          {incident.length_km > 0 && (
                            <span>Length: {incident.length_km.toFixed(1)} km</span>
                          )}
                        </div>
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${incident.lat},${incident.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs"
                      >
                        Map
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-green-400 py-4">
                  No active road incidents
                </div>
              )}
            </div>

            {/* Emergency Facilities */}
            {allFacilities && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>🏥</span> Emergency Facilities
                  <span className="text-sm font-normal text-gray-400">
                    ({allFacilities.summary.hospitals + allFacilities.summary.police + allFacilities.summary.fire_stations + allFacilities.summary.shelters} total)
                  </span>
                </h2>

                {/* Facility Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-center">
                    <div className="text-4xl mb-2">🏥</div>
                    <div className="text-3xl font-bold text-red-500">{allFacilities.summary.hospitals}</div>
                    <div className="text-sm text-red-300">Hospitals</div>
                  </div>
                  <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-4 text-center">
                    <div className="text-4xl mb-2">🚔</div>
                    <div className="text-3xl font-bold text-blue-500">{allFacilities.summary.police}</div>
                    <div className="text-sm text-blue-300">Police Stations</div>
                  </div>
                  <div className="bg-orange-900/50 border border-orange-700 rounded-lg p-4 text-center">
                    <div className="text-4xl mb-2">🚒</div>
                    <div className="text-3xl font-bold text-orange-500">{allFacilities.summary.fire_stations}</div>
                    <div className="text-sm text-orange-300">Fire Stations</div>
                  </div>
                  <div className="bg-green-900/50 border border-green-700 rounded-lg p-4 text-center">
                    <div className="text-4xl mb-2">🏠</div>
                    <div className="text-3xl font-bold text-green-500">{allFacilities.summary.shelters}</div>
                    <div className="text-sm text-green-300">Shelters</div>
                  </div>
                </div>

                {/* Facility Lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Hospitals */}
                  <div className="bg-gray-700 rounded-lg p-3">
                    <h3 className="text-sm font-semibold text-red-400 mb-2">Hospitals (showing 10)</h3>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {allFacilities.hospitals.slice(0, 10).map((h) => (
                        <div key={h.id} className="flex justify-between items-center text-xs py-1 border-b border-gray-600">
                          <span className="truncate flex-1">{h.name}</span>
                          <a
                            href={`https://www.google.com/maps?q=${h.lat},${h.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 ml-2"
                          >
                            Map
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Police Stations */}
                  <div className="bg-gray-700 rounded-lg p-3">
                    <h3 className="text-sm font-semibold text-blue-400 mb-2">Police Stations (showing 10)</h3>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {allFacilities.police.slice(0, 10).map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-xs py-1 border-b border-gray-600">
                          <span className="truncate flex-1">{p.name}</span>
                          <a
                            href={`https://www.google.com/maps?q=${p.lat},${p.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 ml-2"
                          >
                            Map
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Route Impact Assessment */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>🛣️</span> Evacuation Route Assessment
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Affected Routes */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-red-400 mb-3">Potentially Affected Routes</h3>
                  {(() => {
                    const floodIncidents = (trafficIncidents || []).filter(i =>
                      i.category?.toLowerCase().includes('flood') ||
                      i.category?.toLowerCase().includes('closed')
                    );
                    const congestedRoads = trafficFlow?.congested_roads?.filter(r =>
                      r.congestion === 'severe' || r.congestion === 'heavy'
                    ) || [];

                    if (floodIncidents.length === 0 && congestedRoads.length === 0) {
                      return <div className="text-green-400 text-sm">All major routes appear clear</div>;
                    }

                    return (
                      <div className="space-y-2">
                        {floodIncidents.slice(0, 5).map((incident, idx) => (
                          <div key={`flood-${idx}`} className="flex items-center gap-2 text-sm">
                            <span className="text-red-500">🚫</span>
                            <span>{incident.road_name || incident.category}</span>
                            <span className="text-xs text-gray-500">({incident.category})</span>
                          </div>
                        ))}
                        {congestedRoads.slice(0, 5).map((road, idx) => (
                          <div key={`road-${idx}`} className="flex items-center gap-2 text-sm">
                            <span className="text-orange-500">⚠️</span>
                            <span>{road.name}</span>
                            <span className="text-xs text-gray-500">(Heavy traffic)</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Quick Stats */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-400 mb-3">Network Health</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Road Closures</span>
                      <span className={`font-bold ${(trafficIncidents || []).filter(i => i.category?.toLowerCase().includes('closed')).length > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {(trafficIncidents || []).filter(i => i.category?.toLowerCase().includes('closed')).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Flood-Related Incidents</span>
                      <span className={`font-bold ${(trafficIncidents || []).filter(i => i.category?.toLowerCase().includes('flood')).length > 0 ? 'text-blue-500' : 'text-green-500'}`}>
                        {(trafficIncidents || []).filter(i => i.category?.toLowerCase().includes('flood')).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Severe Congestion Points</span>
                      <span className={`font-bold ${(trafficFlow?.combined_summary?.severe || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {trafficFlow?.combined_summary?.severe ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Average Network Speed</span>
                      <span className="font-bold text-white">
                        {trafficFlow?.combined_summary?.avg_speed_kmh?.toFixed(0) ?? '-'} km/h
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Delay (monitored roads)</span>
                      <span className={`font-bold ${(trafficFlow?.tomtom_summary?.total_delay_minutes || 0) > 30 ? 'text-orange-500' : 'text-green-500'}`}>
                        {trafficFlow?.tomtom_summary?.total_delay_minutes?.toFixed(0) ?? 0} min
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Data Sources Info */}
            <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
              <div className="font-semibold text-gray-300 mb-2">Data Sources:</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>🚗 <span className="text-gray-300">Traffic Flow:</span> HERE & TomTom APIs (5min cache)</div>
                <div>⚠️ <span className="text-gray-300">Incidents:</span> TomTom Traffic API (5min cache)</div>
                <div>🏥 <span className="text-gray-300">Facilities:</span> OpenStreetMap (24hr cache)</div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
