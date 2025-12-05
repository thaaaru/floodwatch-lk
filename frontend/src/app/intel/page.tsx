'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, IntelSummary, SOSReport, IntelCluster, IntelAction, NearbyFacilitiesResponse, FloodThreatResponse, IrrigationResponse, TrafficFlowResponse, TrafficIncident, AllFacilitiesResponse, FloodPatternsResponse, EnvironmentalDataResponse, YesterdayStats } from '@/lib/api';

// Safe number formatting helper to prevent toFixed errors on undefined/null values
const fmt = (v: any, d: number = 0): string => {
  if (v === null || v === undefined || isNaN(Number(v))) return '0';
  return Number(v).toFixed(d);
};

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
  const [activeTab, setActiveTab] = useState<'threat' | 'infrastructure'>('threat');
  const [trafficFlow, setTrafficFlow] = useState<TrafficFlowResponse | null>(null);
  const [trafficIncidents, setTrafficIncidents] = useState<TrafficIncident[]>([]);
  const [allFacilities, setAllFacilities] = useState<AllFacilitiesResponse | null>(null);
  const [floodPatterns, setFloodPatterns] = useState<FloodPatternsResponse | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalDataResponse | null>(null);
  const [loadingEnvironmental, setLoadingEnvironmental] = useState(false);
  const [yesterdayStats, setYesterdayStats] = useState<YesterdayStats | null>(null);
  const [loadingYesterdayStats, setLoadingYesterdayStats] = useState(false);

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
    // Auto-refresh every 30 minutes (matches backend cache duration)
    const interval = setInterval(fetchData, 1800000);
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

  // Fetch environmental data (on-demand since it takes time)
  const fetchEnvironmentalData = useCallback(async () => {
    if (environmentalData || loadingEnvironmental) return; // Already loaded or loading
    setLoadingEnvironmental(true);
    try {
      const data = await api.getEnvironmentalData(1994, 2024);
      setEnvironmentalData(data);
    } catch (err) {
      console.error('Failed to fetch environmental data:', err);
    } finally {
      setLoadingEnvironmental(false);
    }
  }, [environmentalData, loadingEnvironmental]);

  // Load environmental data when threat tab is active
  useEffect(() => {
    if (activeTab === 'threat' && !environmentalData && !loadingEnvironmental) {
      fetchEnvironmentalData();
    }
  }, [activeTab, environmentalData, loadingEnvironmental, fetchEnvironmentalData]);

  // Fetch yesterday's stats (on-demand)
  const fetchYesterdayStats = useCallback(async () => {
    if (yesterdayStats || loadingYesterdayStats) return;
    setLoadingYesterdayStats(true);
    try {
      const stats = await api.getYesterdayStats();
      setYesterdayStats(stats);
    } catch (err) {
      console.error('Failed to fetch yesterday stats:', err);
    } finally {
      setLoadingYesterdayStats(false);
    }
  }, [yesterdayStats, loadingYesterdayStats]);

  // Load yesterday's stats when threat tab is active
  useEffect(() => {
    if (activeTab === 'threat' && !yesterdayStats && !loadingYesterdayStats) {
      fetchYesterdayStats();
    }
  }, [activeTab, yesterdayStats, loadingYesterdayStats, fetchYesterdayStats]);

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

  const getRiverStatusColor = (status: string, pctToFlood?: number) => {
    switch (status) {
      case 'major_flood': return 'bg-red-600 text-white';
      case 'minor_flood': return 'bg-orange-500 text-white';
      case 'alert': return 'bg-yellow-500 text-black';
      default:
        // For normal status, differentiate between low and safe based on percentage
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
        // For normal status, show LOW if close to alert level
        if (pctToFlood !== undefined && pctToFlood >= 40) return 'LOW RISK';
        return 'NORMAL';
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-2 border-red-200 border-t-red-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-300 mt-4">Loading Intelligence Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/50 px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Emergency Intel Dashboard</h1>
              <p className="text-sm text-slate-400">
                Data from{' '}
                <a
                  href="https://floodsupport.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-400 hover:text-brand-300"
                >
                  FloodSupport.org
                </a>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-500">Auto-refresh: 30s</div>
              <div className="text-sm text-slate-400">Updated: {lastUpdated}</div>
            </div>
            <a
              href="https://floodsupport.org"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              Report Emergency
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-700/50 pb-3">
          <button
            onClick={() => setActiveTab('threat')}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'threat'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            Flood Threat Intel
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
                      <div className="text-5xl font-bold text-white">{fmt(floodThreat.national_threat_score)}<span className="text-2xl text-gray-400">/100</span></div>
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div
                    className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-center cursor-help relative group"
                    title="Stations where water level has exceeded the major flood threshold. Severe flooding expected."
                  >
                    <div className="text-2xl font-bold text-red-500">{riverData.summary.major_flood}</div>
                    <div className="text-xs text-red-300">Major Flood</div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-xs text-gray-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 z-10 shadow-lg border border-gray-700">
                      <div className="font-semibold text-red-400 mb-1">Major Flood (100%+)</div>
                      <div className="mb-2">Water level exceeds major flood threshold. Severe flooding in progress.</div>
                      {riverData.summary.major_flood > 0 && (
                        <div className="mt-1 pt-1 border-t border-gray-700 space-y-1">
                          {riverData.stations.filter(s => s.status === 'major_flood').map((s, i) => (
                            <div key={i} className="flex justify-between text-red-300">
                              <span>{s.station}</span>
                              <span className="font-mono">{fmt(s.water_level_m, 2)}m / {fmt(s.major_flood_level_m, 2)}m</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="bg-orange-900/50 border border-orange-700 rounded-lg p-3 text-center cursor-help relative group"
                    title="Stations where water level has exceeded minor flood threshold but below major flood level."
                  >
                    <div className="text-2xl font-bold text-orange-500">{riverData.summary.minor_flood}</div>
                    <div className="text-xs text-orange-300">Minor Flood</div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-xs text-gray-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 z-10 shadow-lg border border-gray-700">
                      <div className="font-semibold text-orange-400 mb-1">Minor Flood (80-99%)</div>
                      <div className="mb-2">Water level between minor and major flood thresholds. Localized flooding occurring.</div>
                      {riverData.summary.minor_flood > 0 && (
                        <div className="mt-1 pt-1 border-t border-gray-700 space-y-1">
                          {riverData.stations.filter(s => s.status === 'minor_flood').map((s, i) => (
                            <div key={i} className="flex justify-between text-orange-300">
                              <span>{s.station}</span>
                              <span className="font-mono">{fmt(s.water_level_m, 2)}m / {fmt(s.major_flood_level_m, 2)}m</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-3 text-center cursor-help relative group"
                    title="Stations where water level has reached alert threshold. Rising water, monitor closely."
                  >
                    <div className="text-2xl font-bold text-yellow-500">{riverData.summary.alert}</div>
                    <div className="text-xs text-yellow-300">Alert Level</div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-xs text-gray-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 z-10 shadow-lg border border-gray-700">
                      <div className="font-semibold text-yellow-400 mb-1">Alert Level (60-79%)</div>
                      <div className="mb-2">Water level reached alert threshold but below flood level. Close monitoring required.</div>
                      {riverData.summary.alert > 0 && (
                        <div className="mt-1 pt-1 border-t border-gray-700 space-y-1">
                          {riverData.stations.filter(s => s.status === 'alert').map((s, i) => (
                            <div key={i} className="flex justify-between text-yellow-300">
                              <span>{s.station}</span>
                              <span className="font-mono">{fmt(s.water_level_m, 2)}m / {fmt(s.major_flood_level_m, 2)}m</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="bg-blue-900/50 border border-blue-700 rounded-lg p-3 text-center cursor-help relative group"
                    title="Stations at 40-60% of major flood level. Normal but elevated water levels."
                  >
                    <div className="text-2xl font-bold text-blue-500">
                      {riverData.stations.filter(s => s.status === 'normal' && s.pct_to_major_flood >= 40).length}
                    </div>
                    <div className="text-xs text-blue-300">Low Risk</div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-xs text-gray-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 z-10 shadow-lg border border-gray-700">
                      <div className="font-semibold text-blue-400 mb-1">Low Risk (40-59%)</div>
                      <div className="mb-2">Water level at 40-60% of major flood threshold. Normal but slightly elevated.</div>
                      {riverData.stations.filter(s => s.status === 'normal' && s.pct_to_major_flood >= 40).length > 0 && (
                        <div className="mt-1 pt-1 border-t border-gray-700 space-y-1 max-h-32 overflow-y-auto">
                          {riverData.stations.filter(s => s.status === 'normal' && s.pct_to_major_flood >= 40).map((s, i) => (
                            <div key={i} className="flex justify-between text-blue-300">
                              <span>{s.station}</span>
                              <span className="font-mono">{fmt(s.water_level_m, 2)}m / {fmt(s.major_flood_level_m, 2)}m</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="bg-green-900/50 border border-green-700 rounded-lg p-3 text-center cursor-help relative group"
                    title="Stations below 40% of major flood level. Safe water levels."
                  >
                    <div className="text-2xl font-bold text-green-500">
                      {riverData.stations.filter(s => s.status === 'normal' && s.pct_to_major_flood < 40).length}
                    </div>
                    <div className="text-xs text-green-300">Normal</div>
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-xs text-gray-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 z-10 shadow-lg border border-gray-700">
                      <div className="font-semibold text-green-400 mb-1">Normal (&lt;40%)</div>
                      <div className="mb-2">Water level below 40% of major flood threshold. Safe conditions.</div>
                      {riverData.stations.filter(s => s.status === 'normal' && s.pct_to_major_flood < 40).length > 0 && (
                        <div className="mt-1 pt-1 border-t border-gray-700 space-y-1 max-h-32 overflow-y-auto">
                          {riverData.stations.filter(s => s.status === 'normal' && s.pct_to_major_flood < 40).map((s, i) => (
                            <div key={i} className="flex justify-between text-green-300">
                              <span>{s.station}</span>
                              <span className="font-mono">{fmt(s.water_level_m, 2)}m / {fmt(s.major_flood_level_m, 2)}m</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* River Summary by River Name */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Status by River</h3>
                  <p className="text-xs text-gray-500 mb-2">Data source: Sri Lanka Irrigation Department (updated every 5 mins)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="text-left py-2">River</th>
                          <th className="text-center py-2 cursor-help" title="Number of gauging stations monitored on this river">Stations</th>
                          <th className="text-center py-2 text-red-400 cursor-help" title="Stations at/above major flood level (100%+ of threshold)">Major</th>
                          <th className="text-center py-2 text-orange-400 cursor-help" title="Stations at minor flood level (between minor & major thresholds)">Minor</th>
                          <th className="text-center py-2 text-yellow-400 cursor-help" title="Stations at alert level (water rising, below flood threshold)">Alert</th>
                          <th className="text-center py-2 text-green-400 cursor-help" title="Stations at normal water levels (below alert threshold)">Normal</th>
                          <th className="text-center py-2 cursor-help" title="Highest percentage to major flood threshold among all stations on this river. 100% = major flood level reached.">Highest %</th>
                          <th className="text-center py-2 cursor-help" title="Overall status based on worst station condition on this river">Status</th>
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
                                <td className="py-2 font-medium cursor-help relative">
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
                                <td className="text-center py-2 text-gray-400">{row.stations.length}</td>
                                <td className="text-center py-2">
                                  {row.major > 0 ? <span className="text-red-500 font-bold">{row.major}</span> : <span className="text-gray-600">0</span>}
                                </td>
                                <td className="text-center py-2">
                                  {row.minor > 0 ? <span className="text-orange-500 font-bold">{row.minor}</span> : <span className="text-gray-600">0</span>}
                                </td>
                                <td className="text-center py-2">
                                  {row.alert > 0 ? <span className="text-yellow-500 font-bold">{row.alert}</span> : <span className="text-gray-600">0</span>}
                                </td>
                                <td className="text-center py-2">
                                  <span className="text-green-500">{row.normal}</span>
                                </td>
                                <td className="text-center py-2">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-16 bg-gray-700 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full ${
                                          row.highestPct >= 100 ? 'bg-red-500' :
                                          row.highestPct >= 80 ? 'bg-orange-500' :
                                          row.highestPct >= 60 ? 'bg-yellow-500' :
                                          row.highestPct >= 40 ? 'bg-blue-500' : 'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(row.highestPct, 100)}%` }}
                                      ></div>
                                    </div>
                                    <span className="font-mono text-xs">{fmt(row.highestPct)}%</span>
                                  </div>
                                </td>
                                <td className="text-center py-2">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${getRiverStatusColor(row.worstStatus, row.highestPct)}`}>
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
                              <span className="font-mono font-bold">{fmt(d.threat_score)}</span>
                            </div>
                          </td>
                          <td className="text-center py-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getThreatLevelColor(d.threat_level)} text-white`}>
                              {d.threat_level}
                            </span>
                          </td>
                          <td className="text-center py-2 font-mono text-blue-400">{fmt(d.rainfall_score)}</td>
                          <td className="text-center py-2 font-mono text-cyan-400">{fmt(d.river_score)}</td>
                          <td className="text-center py-2 font-mono text-purple-400">{fmt(d.forecast_score)}</td>
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
                      <div className="text-2xl font-bold text-blue-400">{fmt(floodPatterns.summary.avg_annual_rainfall_mm)}</div>
                      <div className="text-xs text-blue-300">Avg Annual Rainfall (mm)</div>
                    </div>
                    <div className="bg-orange-900/50 border border-orange-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-orange-400">{fmt(floodPatterns.summary.max_daily_rainfall_mm)}</div>
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

                  {/* 30-YEAR CLIMATE CHANGE ANALYSIS */}
                  {floodPatterns.climate_change && (
                    <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-purple-300 mb-4 flex items-center gap-2">
                        <span>📈</span> How Climate Has Changed (30-Year Analysis)
                      </h3>

                      {/* Key Findings Banner */}
                      {floodPatterns.climate_change.key_findings.length > 0 && (
                        <div className="bg-gray-800/80 rounded-lg p-3 mb-4">
                          <div className="text-sm font-semibold text-yellow-400 mb-2">Key Findings:</div>
                          <ul className="space-y-1">
                            {floodPatterns.climate_change.key_findings.map((finding, idx) => (
                              <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-yellow-500">•</span>
                                {finding}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Decade Comparison Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                        {floodPatterns.climate_change.decades.first && (
                          <div className="bg-gray-800 rounded-lg p-3 border-l-4 border-blue-500">
                            <div className="text-xs text-blue-400 font-semibold mb-1">First Decade</div>
                            <div className="text-lg font-bold text-white">{floodPatterns.climate_change.decades.first.years}</div>
                            <div className="mt-2 space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Avg Rainfall</span>
                                <span className="text-blue-300">{fmt(floodPatterns.climate_change.decades.first.avg_annual_rainfall_mm)} mm/yr</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Extreme Days</span>
                                <span className="text-red-300">{floodPatterns.climate_change.decades.first.total_extreme_days}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Max Daily</span>
                                <span className="text-orange-300">{fmt(floodPatterns.climate_change.decades.first.max_daily_mm)} mm</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {floodPatterns.climate_change.decades.second && (
                          <div className="bg-gray-800 rounded-lg p-3 border-l-4 border-purple-500">
                            <div className="text-xs text-purple-400 font-semibold mb-1">Second Decade</div>
                            <div className="text-lg font-bold text-white">{floodPatterns.climate_change.decades.second.years}</div>
                            <div className="mt-2 space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Avg Rainfall</span>
                                <span className="text-blue-300">{fmt(floodPatterns.climate_change.decades.second.avg_annual_rainfall_mm)} mm/yr</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Extreme Days</span>
                                <span className="text-red-300">{floodPatterns.climate_change.decades.second.total_extreme_days}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Max Daily</span>
                                <span className="text-orange-300">{fmt(floodPatterns.climate_change.decades.second.max_daily_mm)} mm</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {floodPatterns.climate_change.decades.third && (
                          <div className="bg-gray-800 rounded-lg p-3 border-l-4 border-green-500">
                            <div className="text-xs text-green-400 font-semibold mb-1">Last Decade</div>
                            <div className="text-lg font-bold text-white">{floodPatterns.climate_change.decades.third.years}</div>
                            <div className="mt-2 space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Avg Rainfall</span>
                                <span className="text-blue-300">{fmt(floodPatterns.climate_change.decades.third.avg_annual_rainfall_mm)} mm/yr</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Extreme Days</span>
                                <span className="text-red-300">{floodPatterns.climate_change.decades.third.total_extreme_days}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Max Daily</span>
                                <span className="text-orange-300">{fmt(floodPatterns.climate_change.decades.third.max_daily_mm)} mm</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Change Metrics Table */}
                      {floodPatterns.climate_change.changes.length > 0 && (
                        <div className="bg-gray-800/80 rounded-lg p-3 mb-4">
                          <div className="text-sm font-semibold text-gray-300 mb-3">Change Over 30 Years (First vs Last Decade)</div>
                          <div className="space-y-2">
                            {floodPatterns.climate_change.changes.map((change, idx) => (
                              <div key={idx} className="flex items-center gap-3 text-sm">
                                <div className="w-48 text-gray-400">{change.metric}</div>
                                <div className="w-24 text-gray-500 text-right">{change.first_decade}</div>
                                <div className="flex-1 px-2">
                                  <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
                                    {change.trend === 'increasing' && (
                                      <div
                                        className="absolute left-1/2 h-full bg-gradient-to-r from-transparent to-red-500"
                                        style={{ width: `${Math.min(Math.abs(change.change_pct) / 2, 50)}%` }}
                                      />
                                    )}
                                    {change.trend === 'decreasing' && (
                                      <div
                                        className="absolute right-1/2 h-full bg-gradient-to-l from-transparent to-green-500"
                                        style={{ width: `${Math.min(Math.abs(change.change_pct) / 2, 50)}%` }}
                                      />
                                    )}
                                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white" />
                                  </div>
                                </div>
                                <div className="w-24 text-gray-300">{change.last_decade}</div>
                                <div className={`w-20 text-right font-bold ${
                                  change.trend === 'increasing' ? 'text-red-400' :
                                  change.trend === 'decreasing' ? 'text-green-400' : 'text-gray-400'
                                }`}>
                                  {change.change_pct > 0 ? '+' : ''}{fmt(change.change_pct, 1)}%
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extreme Events by Decade Comparison */}
                      <div className="bg-gray-800/80 rounded-lg p-3 mb-4">
                        <div className="text-sm font-semibold text-gray-300 mb-3">Extreme Rainfall Events by Decade (&gt;100mm/day)</div>
                        <div className="flex items-end gap-4 h-32 justify-center">
                          {Object.entries(floodPatterns.climate_change.extreme_events_by_decade).map(([key, decade]) => {
                            const maxCount = Math.max(
                              floodPatterns.climate_change!.extreme_events_by_decade.decade1.count,
                              floodPatterns.climate_change!.extreme_events_by_decade.decade2.count,
                              floodPatterns.climate_change!.extreme_events_by_decade.decade3.count,
                              1
                            );
                            const heightPct = (decade.count / maxCount) * 100;
                            const color = key === 'decade1' ? 'bg-blue-500' : key === 'decade2' ? 'bg-purple-500' : 'bg-green-500';
                            return (
                              <div key={key} className="flex flex-col items-center w-24">
                                <div className="text-sm font-bold text-white mb-1">{decade.count}</div>
                                <div
                                  className={`w-16 ${color} rounded-t transition-all`}
                                  style={{ height: `${Math.max(heightPct, 5)}%` }}
                                />
                                <div className="text-xs text-gray-400 mt-2 text-center">{decade.years}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-xs text-gray-500 text-center mt-2">
                          {(() => {
                            const d1 = floodPatterns.climate_change!.extreme_events_by_decade.decade1.count;
                            const d3 = floodPatterns.climate_change!.extreme_events_by_decade.decade3.count;
                            if (d3 > d1) {
                              const increase = fmt((d3 - d1) / d1 * 100);
                              return `${increase}% increase in extreme events from first to last decade`;
                            } else if (d3 < d1) {
                              const decrease = fmt((d1 - d3) / d1 * 100);
                              return `${decrease}% decrease in extreme events from first to last decade`;
                            }
                            return 'Extreme events remained stable across decades';
                          })()}
                        </div>
                      </div>

                      {/* 5-Year Moving Average Trend */}
                      {floodPatterns.climate_change.moving_average_5yr.length > 0 && (
                        <div className="bg-gray-800/80 rounded-lg p-3">
                          <div className="text-sm font-semibold text-gray-300 mb-3">5-Year Moving Average Trend</div>
                          <div className="flex items-end gap-px h-24">
                            {floodPatterns.climate_change.moving_average_5yr.map((ma, idx) => {
                              const maxAvg = Math.max(...floodPatterns.climate_change!.moving_average_5yr.map(m => m.avg_rainfall_mm));
                              const minAvg = Math.min(...floodPatterns.climate_change!.moving_average_5yr.map(m => m.avg_rainfall_mm));
                              const range = maxAvg - minAvg || 1;
                              const heightPct = ((ma.avg_rainfall_mm - minAvg) / range) * 80 + 20;
                              const isRecent = idx >= floodPatterns.climate_change!.moving_average_5yr.length - 10;
                              return (
                                <div
                                  key={ma.year}
                                  className={`flex-1 ${isRecent ? 'bg-purple-500' : 'bg-blue-600'} rounded-t min-w-[3px] transition-all hover:opacity-80`}
                                  style={{ height: `${heightPct}%` }}
                                  title={`${ma.year}: ${fmt(ma.avg_rainfall_mm)}mm (5yr avg)`}
                                />
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>{floodPatterns.climate_change.moving_average_5yr[0]?.year}</span>
                            <span className="text-purple-400">Recent trend highlighted</span>
                            <span>{floodPatterns.climate_change.moving_average_5yr[floodPatterns.climate_change.moving_average_5yr.length - 1]?.year}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
                            <div className="text-xs text-gray-400 mb-1">{fmt(m.avg_rainfall_mm)}</div>
                            <div
                              className={`w-full ${riskColor} rounded-t transition-all hover:opacity-80`}
                              style={{ height: `${heightPct}%`, minHeight: '4px' }}
                              title={`${m.month_name}: ${fmt(m.avg_rainfall_mm)}mm avg, ${fmt(m.max_daily_mm)}mm max`}
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
                                    <div className="font-bold text-white">{fmt(season.avg_daily_mm, 1)}mm</div>
                                  </div>
                                  <div>
                                    <div className="text-white/60">Max Day</div>
                                    <div className="font-bold text-white">{fmt(season.max_daily_mm)}mm</div>
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
                                <span className="text-lg font-bold text-white">{fmt(extremePerYear, 1)}</span>
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
                                <span className="text-lg font-bold text-white">{fmt(heavyPerYear, 1)}</span>
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
                                <span className="text-lg font-bold text-white">{fmt(maxDaily)}</span>
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
                              <span className="text-white">{fmt(m.avg_rainfall_mm)}</span>
                              <span className="text-gray-500"> / </span>
                              <span className="text-orange-400">{fmt(m.max_daily_mm)}</span>
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
                            {fmt(floodPatterns.yearly_trends[floodPatterns.yearly_trends.length - 1]?.total_rainfall_mm)}mm
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
                                title={`${y.year}: ${fmt(y.total_rainfall_mm)}mm`}
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
                            {fmt(floodPatterns.yearly_trends[floodPatterns.yearly_trends.length - 1]?.max_daily_mm)}mm
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
                                title={`${y.year}: ${fmt(y.max_daily_mm)}mm max`}
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
                              <span className="font-mono text-blue-400">{fmt(season.avg_daily_mm, 1)} mm</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Max Single Day</span>
                              <span className="font-mono text-orange-400">{fmt(season.max_daily_mm, 1)} mm</span>
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
                              {fmt(year.total_rainfall_mm / 1000, 1)}k
                            </div>
                            <div
                              className={`w-full ${isAboveAvg ? 'bg-blue-500' : 'bg-blue-700'} rounded-t transition-all hover:opacity-80`}
                              style={{ height: `${heightPct}%`, minHeight: '4px' }}
                              title={`${year.year}: ${fmt(year.total_rainfall_mm)}mm total, ${year.extreme_days} extreme days`}
                            />
                            <div className="text-xs text-gray-400 mt-1">{year.year.toString().slice(-2)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-center items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>Avg: {fmt(floodPatterns.summary.avg_annual_rainfall_mm / 1000, 1)}k mm/year</span>
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
                                <span className="font-mono font-bold text-red-400">{fmt(event.precipitation_mm, 1)}</span>
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

            {/* Yesterday's Weather Stats */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>📅</span> Yesterday&apos;s Weather Summary
                {loadingYesterdayStats && <span className="text-sm text-gray-400 font-normal">(Loading...)</span>}
              </h2>

              {yesterdayStats ? (
                <div className="space-y-4">
                  {/* Date & Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-400">{fmt(yesterdayStats.total_rainfall_mm)}</div>
                      <div className="text-xs text-blue-300">Total Rainfall (mm)</div>
                    </div>
                    <div className="bg-cyan-900/50 border border-cyan-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-cyan-400">{fmt(yesterdayStats.avg_rainfall_mm, 1)}</div>
                      <div className="text-xs text-cyan-300">Avg per District (mm)</div>
                    </div>
                    <div className="bg-orange-900/50 border border-orange-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-orange-400">{fmt(yesterdayStats.max_rainfall_mm)}</div>
                      <div className="text-xs text-orange-300">Max Rainfall (mm)</div>
                    </div>
                    <div className="bg-green-900/50 border border-green-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-400">{yesterdayStats.districts_with_rain}</div>
                      <div className="text-xs text-green-300">Districts with Rain</div>
                    </div>
                  </div>

                  {/* Districts breakdown by rainfall category */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Heavy Rain Districts */}
                    {yesterdayStats.heavy_rain_districts.length > 0 && (
                      <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-red-400 font-bold">⚠️ Heavy Rain (&gt;50mm)</span>
                          <span className="bg-red-800 text-red-200 text-xs px-2 py-0.5 rounded-full">
                            {yesterdayStats.heavy_rain_districts.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {yesterdayStats.heavy_rain_districts.map((d) => (
                            <div key={d.district} className="flex justify-between text-sm">
                              <span className="text-gray-300">{d.district}</span>
                              <span className="font-mono text-red-400 font-bold">{d.rainfall_mm}mm</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Moderate Rain Districts */}
                    {yesterdayStats.moderate_rain_districts.length > 0 && (
                      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-yellow-400 font-bold">🌧️ Moderate Rain (25-50mm)</span>
                          <span className="bg-yellow-800 text-yellow-200 text-xs px-2 py-0.5 rounded-full">
                            {yesterdayStats.moderate_rain_districts.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {yesterdayStats.moderate_rain_districts.map((d) => (
                            <div key={d.district} className="flex justify-between text-sm">
                              <span className="text-gray-300">{d.district}</span>
                              <span className="font-mono text-yellow-400">{d.rainfall_mm}mm</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Light rain districts summary */}
                  {yesterdayStats.light_rain_districts.length > 0 && (
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-300 font-medium">💧 Light Rain (&lt;25mm)</span>
                        <span className="bg-gray-600 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                          {yesterdayStats.light_rain_districts.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {yesterdayStats.light_rain_districts.slice(0, 10).map((d) => (
                          <span key={d.district} className="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded">
                            {d.district}: {d.rainfall_mm}mm
                          </span>
                        ))}
                        {yesterdayStats.light_rain_districts.length > 10 && (
                          <span className="text-xs text-gray-500">
                            +{yesterdayStats.light_rain_districts.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dry districts summary */}
                  {yesterdayStats.dry_districts.length > 0 && (
                    <div className="bg-gray-700/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-400 font-medium">☀️ Dry Districts (No Rain)</span>
                        <span className="bg-gray-700 text-gray-400 text-xs px-2 py-0.5 rounded-full">
                          {yesterdayStats.dry_districts.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {yesterdayStats.dry_districts.slice(0, 12).map((district) => (
                          <span key={district} className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">
                            {district}
                          </span>
                        ))}
                        {yesterdayStats.dry_districts.length > 12 && (
                          <span className="text-xs text-gray-500">
                            +{yesterdayStats.dry_districts.length - 12} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Max rainfall district highlight */}
                  {yesterdayStats.max_rainfall_district && yesterdayStats.max_rainfall_mm > 0 && (
                    <div className="bg-gradient-to-r from-orange-900/50 to-red-900/50 border border-orange-600 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-400">Highest Rainfall</div>
                          <div className="text-lg font-bold text-white">{yesterdayStats.max_rainfall_district}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-orange-400">{fmt(yesterdayStats.max_rainfall_mm)}</div>
                          <div className="text-xs text-orange-300">mm</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer with date */}
                  <div className="text-xs text-gray-500 text-center">
                    Data for {new Date(yesterdayStats.date + 'T00:00:00').toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | Source: Open-Meteo Historical API
                  </div>
                </div>
              ) : loadingYesterdayStats ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <div className="text-gray-400">Loading yesterday&apos;s weather data...</div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Unable to load yesterday&apos;s weather data
                </div>
              )}
            </div>

            {/* Environmental Factors & Flood Risk Correlation */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>🌳</span> Environmental Factors & Flood Risk (30-Year Analysis)
                {loadingEnvironmental && <span className="text-sm text-gray-400 font-normal">(Loading...)</span>}
              </h2>

              {environmentalData ? (
                <div className="space-y-6">
                  {/* Risk Assessment Summary */}
                  <div className={`rounded-lg p-4 border-2 ${
                    environmentalData.flood_risk_factors.overall_risk_level === 'HIGH' ? 'bg-red-900/30 border-red-500' :
                    environmentalData.flood_risk_factors.overall_risk_level === 'MEDIUM' ? 'bg-yellow-900/30 border-yellow-500' :
                    'bg-green-900/30 border-green-500'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`text-3xl font-bold ${
                          environmentalData.flood_risk_factors.overall_risk_level === 'HIGH' ? 'text-red-400' :
                          environmentalData.flood_risk_factors.overall_risk_level === 'MEDIUM' ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {environmentalData.flood_risk_factors.overall_risk_level}
                        </div>
                        <div>
                          <div className="text-sm text-gray-300">Environmental Flood Risk</div>
                          <div className="text-xs text-gray-500">Based on land use changes since 1994</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {fmt(environmentalData.flood_risk_factors.risk_score)}/{environmentalData.flood_risk_factors.max_score}
                        </div>
                        <div className="text-xs text-gray-400">Risk Score</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-300">{environmentalData.flood_risk_factors.summary}</div>
                    {environmentalData.flood_risk_factors.recommendation && (
                      <div className="mt-2 text-xs text-cyan-400 bg-cyan-900/30 p-2 rounded">
                        💡 {environmentalData.flood_risk_factors.recommendation}
                      </div>
                    )}
                  </div>

                  {/* Environmental Indicators Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Forest Cover */}
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">🌲</span>
                        <div className="text-sm font-semibold text-gray-300">Forest Cover</div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold ${
                          environmentalData.forest_cover.analysis.trend === 'decreasing' ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {fmt(environmentalData.forest_cover.analysis.last_value, 1)}%
                        </span>
                        <span className={`text-sm ${
                          environmentalData.forest_cover.analysis.percent_change < 0 ? 'text-red-400' : 'text-green-400'
                        }`}>
                          ({environmentalData.forest_cover.analysis.percent_change > 0 ? '+' : ''}{fmt(environmentalData.forest_cover.analysis.percent_change, 1)}%)
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        From {fmt(environmentalData.forest_cover.analysis.first_value, 1)}% in {environmentalData.forest_cover.analysis.first_year}
                      </div>
                      {/* Mini sparkline */}
                      <div className="flex items-end gap-px h-8 mt-2">
                        {environmentalData.forest_cover.data.slice(-15).map((d, i) => {
                          const max = Math.max(...environmentalData.forest_cover.data.map(x => x.value));
                          const min = Math.min(...environmentalData.forest_cover.data.map(x => x.value));
                          const heightPct = ((d.value - min) / (max - min || 1)) * 100;
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-green-600 rounded-t min-w-[2px]"
                              style={{ height: `${Math.max(heightPct, 10)}%` }}
                              title={`${d.year}: ${fmt(d.value, 1)}%`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Population Density */}
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">👥</span>
                        <div className="text-sm font-semibold text-gray-300">Population Density</div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-orange-400">
                          {fmt(environmentalData.population_density.analysis.last_value)}
                        </span>
                        <span className="text-sm text-gray-400">per km²</span>
                      </div>
                      <div className={`text-sm ${
                        environmentalData.population_density.analysis.percent_change > 10 ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        +{fmt(environmentalData.population_density.analysis.percent_change, 1)}% since {environmentalData.population_density.analysis.first_year}
                      </div>
                      {/* Mini sparkline */}
                      <div className="flex items-end gap-px h-8 mt-2">
                        {environmentalData.population_density.data.slice(-15).map((d, i) => {
                          const max = Math.max(...environmentalData.population_density.data.map(x => x.value));
                          const min = Math.min(...environmentalData.population_density.data.map(x => x.value));
                          const heightPct = ((d.value - min) / (max - min || 1)) * 100;
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-orange-500 rounded-t min-w-[2px]"
                              style={{ height: `${Math.max(heightPct, 10)}%` }}
                              title={`${d.year}: ${fmt(d.value)} per km²`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Urban Population */}
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">🏙️</span>
                        <div className="text-sm font-semibold text-gray-300">Urban Population</div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-purple-400">
                          {fmt(environmentalData.urban_population.analysis.last_value, 1)}%
                        </span>
                      </div>
                      <div className="text-sm text-purple-300">
                        +{fmt(environmentalData.urban_population.analysis.last_value - environmentalData.urban_population.analysis.first_value, 1)}% since {environmentalData.urban_population.analysis.first_year}
                      </div>
                      {/* Mini sparkline */}
                      <div className="flex items-end gap-px h-8 mt-2">
                        {environmentalData.urban_population.data.slice(-15).map((d, i) => {
                          const max = Math.max(...environmentalData.urban_population.data.map(x => x.value));
                          const min = Math.min(...environmentalData.urban_population.data.map(x => x.value));
                          const heightPct = ((d.value - min) / (max - min || 1)) * 100;
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-purple-500 rounded-t min-w-[2px]"
                              style={{ height: `${Math.max(heightPct, 10)}%` }}
                              title={`${d.year}: ${fmt(d.value, 1)}%`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Agricultural Land */}
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">🌾</span>
                        <div className="text-sm font-semibold text-gray-300">Agricultural Land</div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-yellow-400">
                          {fmt(environmentalData.agricultural_land.analysis.last_value, 1)}%
                        </span>
                      </div>
                      <div className={`text-sm ${
                        environmentalData.agricultural_land.analysis.percent_change < 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {environmentalData.agricultural_land.analysis.percent_change > 0 ? '+' : ''}{fmt(environmentalData.agricultural_land.analysis.percent_change, 1)}% since {environmentalData.agricultural_land.analysis.first_year}
                      </div>
                      {/* Mini sparkline */}
                      <div className="flex items-end gap-px h-8 mt-2">
                        {environmentalData.agricultural_land.data.slice(-15).map((d, i) => {
                          const max = Math.max(...environmentalData.agricultural_land.data.map(x => x.value));
                          const min = Math.min(...environmentalData.agricultural_land.data.map(x => x.value));
                          const heightPct = ((d.value - min) / (max - min || 1)) * 100;
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-yellow-500 rounded-t min-w-[2px]"
                              style={{ height: `${Math.max(heightPct, 10)}%` }}
                              title={`${d.year}: ${fmt(d.value, 1)}%`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Risk Factors Detail */}
                  {environmentalData.flood_risk_factors.factors.length > 0 && (
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Environmental Risk Factors</h3>
                      <div className="space-y-3">
                        {environmentalData.flood_risk_factors.factors.map((factor, idx) => (
                          <div key={idx} className="bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-white">{factor.factor}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                factor.impact === 'High' ? 'bg-red-900 text-red-300' :
                                factor.impact === 'Medium' ? 'bg-yellow-900 text-yellow-300' :
                                'bg-green-900 text-green-300'
                              }`}>
                                {factor.impact} Impact
                              </span>
                            </div>
                            <div className="text-sm text-gray-400">{factor.description}</div>
                            <div className="text-xs text-cyan-400 mt-1">{factor.explanation}</div>
                            <div className="mt-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-600 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      factor.impact === 'High' ? 'bg-red-500' :
                                      factor.impact === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                                    }`}
                                    style={{ width: `${(factor.risk_contribution / 30) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-12 text-right">
                                  +{fmt(factor.risk_contribution)} pts
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Data Source Info */}
                  <div className="text-xs text-gray-500 text-center">
                    Source: {environmentalData.data_source} | Period: {environmentalData.period} | Data cached for 1 week
                  </div>
                </div>
              ) : loadingEnvironmental ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <div className="text-gray-400">Loading environmental data from World Bank API...</div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Unable to load environmental data
                </div>
              )}
            </div>

            {/* Zoom Earth External Link */}
            <a
              href="https://zoom.earth/places/sri-lanka/#map=wind-speed/model=icon"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border border-cyan-600 rounded-lg p-4 hover:border-cyan-400 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-cyan-300 group-hover:text-cyan-200">Zoom Earth - Live Satellite & Wind Map</h3>
                    <svg className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Real-time satellite imagery, wind speed patterns, cloud cover, and weather radar for Sri Lanka</p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span className="bg-gray-700 px-2 py-0.5 rounded">Live Satellite</span>
                    <span className="bg-gray-700 px-2 py-0.5 rounded">Wind Speed</span>
                    <span className="bg-gray-700 px-2 py-0.5 rounded">Cloud Cover</span>
                    <span className="bg-gray-700 px-2 py-0.5 rounded">Weather Radar</span>
                  </div>
                </div>
              </div>
            </a>

            {/* Data Sources Info */}
            <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
              <div className="font-semibold text-gray-300 mb-2">Data Sources:</div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <div>🌧️ <span className="text-gray-300">Rainfall:</span> Open-Meteo API</div>
                <div>🌊 <span className="text-gray-300">Rivers:</span> Irrigation Dept</div>
                <div>📊 <span className="text-gray-300">Historical:</span> Open-Meteo Archive</div>
                <div>🌳 <span className="text-gray-300">Deforestation:</span> World Bank</div>
                <div>👥 <span className="text-gray-300">Population:</span> World Bank</div>
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
                    <div className="text-2xl font-bold text-white">{fmt(trafficFlow.combined_summary?.avg_speed_kmh ?? 0)}</div>
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
                              <td className="text-center py-2 font-mono text-red-400">{fmt(road.current_speed_kmh)} km/h</td>
                              <td className="text-center py-2 font-mono text-gray-500">{fmt(road.free_flow_speed_kmh)} km/h</td>
                              <td className="text-center py-2 font-mono text-orange-400">
                                {road.delay_minutes ? `+${fmt(road.delay_minutes)} min` : '-'}
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
                            <span>Length: {fmt(incident.length_km, 1)} km</span>
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
                        {trafficFlow?.combined_summary?.avg_speed_kmh != null ? fmt(trafficFlow.combined_summary.avg_speed_kmh) : '-'} km/h
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Delay (monitored roads)</span>
                      <span className={`font-bold ${(trafficFlow?.tomtom_summary?.total_delay_minutes || 0) > 30 ? 'text-orange-500' : 'text-green-500'}`}>
                        {fmt(trafficFlow?.tomtom_summary?.total_delay_minutes ?? 0)} min
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
