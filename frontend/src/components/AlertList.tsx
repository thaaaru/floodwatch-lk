'use client';

import { Alert } from '@/lib/api';
import { format } from 'date-fns';

interface AlertListProps {
  alerts: Alert[];
  title?: string;
  showDistrict?: boolean;
  compact?: boolean;
}

const getAlertStyles = (level: string) => {
  switch (level.toLowerCase()) {
    case 'emergency':
      return {
        badge: 'bg-red-100 text-red-700 border-red-200',
        dot: 'bg-red-500',
        border: 'border-l-red-500',
      };
    case 'warning':
      return {
        badge: 'bg-amber-100 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
        border: 'border-l-amber-500',
      };
    case 'watch':
      return {
        badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        dot: 'bg-yellow-500',
        border: 'border-l-yellow-500',
      };
    default:
      return {
        badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        border: 'border-l-emerald-500',
      };
  }
};

const QuickLinks = ({ compact = false }: { compact?: boolean }) => (
  <div className={`space-y-2 ${compact ? 'mt-3' : 'mt-4'}`}>
    <a
      href="https://zoom.earth/places/sri-lanka/#map=wind-speed/model=icon"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 transition-all group"
    >
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-700 group-hover:text-brand-600 transition-colors">Zoom Earth</span>
        <p className="text-xs text-slate-500">Live satellite & wind</p>
      </div>
      <svg className="w-4 h-4 text-slate-400 group-hover:text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
    <a
      href="https://meteo.gov.lk/"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 transition-all group"
    >
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-700 group-hover:text-amber-600 transition-colors">Meteorology Dept</span>
        <p className="text-xs text-slate-500">Official forecasts</p>
      </div>
      <svg className="w-4 h-4 text-slate-400 group-hover:text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  </div>
);

export default function AlertList({ alerts, title = 'Active Alerts', showDistrict = true, compact = false }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {!compact && <h2 className="section-title mb-4">{title}</h2>}
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">All Clear</p>
          <p className="text-xs text-slate-500 mt-1">No active alerts</p>
        </div>
        <QuickLinks compact={compact} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {!compact && <h2 className="section-title mb-4">{title}</h2>}
      <div className="space-y-2 flex-1 overflow-y-auto">
        {alerts.map((alert) => {
          const styles = getAlertStyles(alert.alert_level);
          return (
            <div
              key={alert.id}
              className={`p-3 rounded-xl bg-white border border-slate-200/60 border-l-4 ${styles.border} hover:shadow-soft transition-all`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {showDistrict && (
                    <h3 className="font-medium text-slate-900 text-sm">{alert.district}</h3>
                  )}
                  {alert.rainfall_mm != null && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {Number(alert.rainfall_mm).toFixed(1)}mm rainfall
                    </p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles.badge}`}>
                  {alert.alert_level}
                </span>
              </div>
              {alert.message && (
                <p className="text-xs text-slate-600 mt-2 line-clamp-2">{alert.message}</p>
              )}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  {format(new Date(alert.sent_at), 'MMM d, HH:mm')}
                </span>
                {alert.source && (
                  <span className="text-xs text-slate-400">{alert.source}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <QuickLinks compact={compact} />
    </div>
  );
}
