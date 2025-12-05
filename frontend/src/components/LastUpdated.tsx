'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function LastUpdated() {
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await api.getCacheStatus();
        if (status.last_update) {
          setLastUpdate(status.last_update);
        }
      } catch {
        // Silently fail - don't block page load
      }
    };

    fetchStatus();
    // Refresh every 30 minutes to match backend cache duration
    const interval = setInterval(fetchStatus, 1800000);
    return () => clearInterval(interval);
  }, []);

  if (!lastUpdate) return null;

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString('en-LK', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-slate-200/60 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        Updated {formatTime(lastUpdate)}
      </span>
    </div>
  );
}
