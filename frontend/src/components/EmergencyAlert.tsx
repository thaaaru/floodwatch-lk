'use client';

import { useState } from 'react';

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  details?: string[];
  source?: string;
  sourceUrl?: string;
  updatedAt: string;
}

export default function EmergencyAlert() {
  const [dismissed, setDismissed] = useState(false);

  // Critical alerts - in a real app, this would come from an API
  const alerts: Alert[] = [
    {
      id: 'nbro-landslide-warning-dec5',
      severity: 'critical',
      title: 'NBRO Red Alert: Critical Landslide Warning - Immediate Evacuation Required',
      message: 'Level 3 (Red) evacuation alerts issued for Kandy, Nuwara Eliya, Ratnapura and Kegalle districts. 40 District Secretariat Divisions affected.',
      details: [
        'Valid: 4:00 PM Dec 5 to 4:00 PM Dec 6, 2025',
        'Highland areas recorded over 500mm rainfall - soil saturation beyond critical limits',
        'Residents on slopes, near cut slopes, and steep roads must evacuate immediately',
        'Red alert extended to 40 District Secretariat Divisions in 4 districts',
      ],
      source: 'NBRO',
      sourceUrl: 'https://www.nbro.gov.lk/index.php?lang=en',
      updatedAt: 'Dec 5, 4:00 PM',
    },
  ];

  if (dismissed || alerts.length === 0) {
    return null;
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');

  if (criticalAlerts.length === 0) {
    return null;
  }

  const alert = criticalAlerts[0]; // Show first critical alert

  return (
    <div className="relative bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white shadow-2xl border-b-4 border-red-900">
      {/* Animated background pulse */}
      <div className="absolute inset-0 bg-red-600 opacity-20 animate-pulse" />

      <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center animate-pulse">
              <span className="text-2xl sm:text-3xl">🚨</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block px-2 py-0.5 bg-white/30 backdrop-blur-sm rounded text-xs font-bold uppercase tracking-wide">
                    Critical Emergency
                  </span>
                  <span className="text-xs opacity-90">{alert.updatedAt}</span>
                </div>
                <h2 className="text-base sm:text-lg md:text-xl font-bold leading-tight">
                  {alert.title}
                </h2>
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => setDismissed(true)}
                className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
                aria-label="Dismiss alert"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Message */}
            <p className="text-sm sm:text-base leading-relaxed mb-3 opacity-95">
              {alert.message}
            </p>

            {/* Details */}
            {alert.details && alert.details.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 mb-3">
                <div className="text-xs sm:text-sm font-semibold mb-2">Current Situation:</div>
                <ul className="space-y-1.5">
                  {alert.details.map((detail, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                      <span className="text-yellow-300 flex-shrink-0 mt-0.5">▸</span>
                      <span className="opacity-95">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/flood-info"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-red-700 rounded-lg text-xs sm:text-sm font-bold hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Flood Status
              </a>
              <a
                href="https://floodsupport.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg text-xs sm:text-sm font-bold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Report Emergency
              </a>
              {alert.sourceUrl && (
                <a
                  href={alert.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100 underline transition-opacity"
                >
                  <span>Source: {alert.source}</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
