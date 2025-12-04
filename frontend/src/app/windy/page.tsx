'use client';

export default function WindyPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>
            <h1 className="text-xl font-semibold text-white">Windy Weather Map</h1>
          </div>
          <div className="text-sm text-slate-400">
            Real-time wind, rain, and weather visualization
          </div>
        </div>
      </div>

      {/* Windy Embed - Full Height */}
      <div className="w-full" style={{ height: 'calc(100vh - 56px)' }}>
        <iframe
          src="https://embed.windy.com/embed2.html?lat=7.8731&lon=80.7718&detailLat=6.889&detailLon=79.956&width=650&height=450&zoom=6&level=surface&overlay=rain&product=ecmwf&menu=&message=true&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1"
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          title="Windy Weather Map - Sri Lanka"
        />
      </div>
    </div>
  );
}
