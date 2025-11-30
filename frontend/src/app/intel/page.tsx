'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, IntelSummary, SOSReport, IntelCluster, IntelAction, NearbyFacilitiesResponse, EmergencyFacility } from '@/lib/api';

export default function IntelDashboard() {
  const [summary, setSummary] = useState<IntelSummary | null>(null);
  const [priorities, setPriorities] = useState<SOSReport[]>([]);
  const [clusters, setClusters] = useState<IntelCluster[]>([]);
  const [actions, setActions] = useState<IntelAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [filterUrgency, setFilterUrgency] = useState<string>('');
  const [expandedReport, setExpandedReport] = useState<number | null>(null);
  const [nearbyFacilities, setNearbyFacilities] = useState<NearbyFacilitiesResponse | null>(null);
  const [loadingFacilities, setLoadingFacilities] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [summaryData, prioritiesData, clustersData, actionsData] = await Promise.all([
        api.getIntelSummary(),
        api.getIntelPriorities(100, undefined, filterUrgency || undefined),
        api.getIntelClusters(),
        api.getIntelActions(),
      ]);

      setSummary(summaryData);
      setPriorities(prioritiesData.reports);
      setClusters(clustersData.clusters);
      setActions(actionsData.actions);
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
      </main>
    </div>
  );
}
