'use client';

import { useEffect, useState } from 'react';
import { api, Alert, ForecastAlert } from '@/lib/api';
import { districts, getAlertBadgeClass } from '@/lib/districts';
import { format } from 'date-fns';

type TabType = 'active' | 'forecast' | 'history';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [forecastAlerts, setForecastAlerts] = useState<ForecastAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterLevel, setFilterLevel] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'forecast') {
          const data = await api.getForecastAlerts();
          setForecastAlerts(data);
        } else if (activeTab === 'active') {
          const data = await api.getActiveAlerts(
            filterDistrict || undefined,
            filterLevel || undefined
          );
          setAlerts(data);
        } else {
          const data = await api.getAlertHistory({
            district: filterDistrict || undefined,
            level: filterLevel || undefined,
            limit: 100,
          });
          setAlerts(data);
        }
      } catch (err) {
        console.error('Failed to fetch alerts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab, filterDistrict, filterLevel]);

  const filteredForecastAlerts = forecastAlerts.filter(alert => {
    if (filterDistrict && alert.district !== filterDistrict) return false;
    if (filterLevel && alert.alert_level !== filterLevel) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Flood Alerts</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Active Alerts
        </button>
        <button
          onClick={() => setActiveTab('forecast')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'forecast'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Forecast Alerts
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Alert History
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Location</label>
            <select
              value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Locations</option>
              {districts.map((d) => (<option key={d.name} value={d.name}>{d.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Level</label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Levels</option>
              <option value="yellow">Yellow (Watch)</option>
              <option value="orange">Orange (Warning)</option>
              <option value="red">Red (Emergency)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : activeTab === 'forecast' ? (
        /* Forecast Alerts */
        filteredForecastAlerts.length === 0 ? (
          <div className="bg-green-50 rounded-lg shadow p-8 text-center">
            <div className="text-green-600 text-lg font-medium mb-2">No Forecast Alerts</div>
            <p className="text-gray-600">No significant rainfall is predicted in the next 5 days for the selected filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Showing {filteredForecastAlerts.length} predicted alerts for the next 5 days
            </p>
            {filteredForecastAlerts.map((alert, idx) => (
              <div key={`${alert.district}-${alert.date}-${idx}`} className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getAlertBadgeClass(alert.alert_level)}`}>
                      {alert.alert_level.toUpperCase()}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{alert.district}</h3>
                      <p className="text-sm text-gray-500">{alert.day_name}, {new Date(alert.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">{alert.predicted_rainfall_mm.toFixed(0)}mm</p>
                    <p className="text-sm text-gray-500">{alert.precipitation_probability}% probability</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-700 bg-gray-50 rounded p-2">{alert.message}</p>
              </div>
            ))}
          </div>
        )
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {activeTab === 'active' ? 'No active alerts' : 'No alerts found'}
        </div>
      ) : (
        /* Active/History Alerts Table */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rainfall</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(alert.sent_at), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{alert.district}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAlertBadgeClass(alert.alert_level)}`}>
                      {alert.alert_level.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {alert.rainfall_mm !== null ? `${alert.rainfall_mm.toFixed(1)}mm` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{alert.source || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
