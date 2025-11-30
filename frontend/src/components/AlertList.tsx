'use client';

import { Alert } from '@/lib/api';
import { getAlertBadgeClass } from '@/lib/districts';
import { format } from 'date-fns';

interface AlertListProps {
  alerts: Alert[];
  title?: string;
  showDistrict?: boolean;
}

const AlertLegend = () => (
  <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
    <h3 className="text-sm font-medium text-gray-700 mb-2">Alert Levels (based on 24h rainfall)</h3>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-green-500"></span>
        <span className="text-gray-600">Normal: &lt; 50mm</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
        <span className="text-gray-600">Watch: 50-100mm</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-orange-500"></span>
        <span className="text-gray-600">Warning: 100-150mm</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500"></span>
        <span className="text-gray-600">Emergency: &ge; 150mm</span>
      </div>
    </div>
  </div>
);

export default function AlertList({ alerts, title = 'Active Alerts', showDistrict = true }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <AlertLegend />
        <p className="text-gray-500 text-center py-8">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <AlertLegend />
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {alerts.map((alert) => (
          <div key={alert.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-start">
              {showDistrict && <h3 className="font-medium text-gray-900">{alert.district}</h3>}
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAlertBadgeClass(alert.alert_level)}`}>
                {alert.alert_level.toUpperCase()}
              </span>
            </div>
            {alert.rainfall_mm !== null && (
              <p className="text-sm text-gray-600 mt-1">Rainfall: {alert.rainfall_mm.toFixed(1)}mm/24h</p>
            )}
            {alert.message && <p className="text-sm text-gray-700 mt-2">{alert.message}</p>}
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">{format(new Date(alert.sent_at), 'MMM d, yyyy HH:mm')}</span>
              {alert.source && <span className="text-xs text-gray-400">Source: {alert.source}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
