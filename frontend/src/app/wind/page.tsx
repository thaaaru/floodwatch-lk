'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Legend from '@/components/map/Legend';
import { createColorLUT, getColorFromLUT } from '@/utils/scaleColor';
import {
  interpolateWind,
  getLODConfig,
  formatWindSpeed,
  type WindVector,
} from '@/utils/windToVector';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hackandbuild.dev';

// Types
interface WindData {
  lon: number[];
  lat: number[];
  u: number[][];
  v: number[][];
  speed: number[][];
  meta: {
    min_speed: number;
    max_speed: number;
    mean_speed: number;
    data_source?: string;
  };
  run_date: string;
  run_hour: string;
  forecast_hour: number;
  valid_time: string;
  generated_at?: string;
}

interface WindMeta {
  available_runs: Array<{
    run_date: string;
    run_hour: string;
    forecast_hours: number[];
  }>;
  latest_run: {
    run_date: string;
    run_hour: string;
    forecast_hours: number[];
  } | null;
}

interface Particle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
}

interface HoverInfo {
  x: number;
  y: number;
  speed: number;
  direction: number;
  cardinal: string;
}


// Pre-computed color LUT for performance
const COLOR_LUT = createColorLUT(50, 200);

export default function WindPage() {
  const mapRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const windDataRef = useRef<WindData | null>(null);

  const [windData, setWindData] = useState<WindData | null>(null);
  const [windMeta, setWindMeta] = useState<WindMeta | null>(null);
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [currentZoom, setCurrentZoom] = useState(7);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate the forecast hour closest to current time
  const getClosestForecastHour = (runDate: string, runHour: string, forecastHours: number[]): number => {
    try {
      // Parse run time: runDate is "YYYYMMDD", runHour is "00" or "06" or "12" or "18"
      const year = parseInt(runDate.slice(0, 4));
      const month = parseInt(runDate.slice(4, 6)) - 1; // JS months are 0-indexed
      const day = parseInt(runDate.slice(6, 8));
      const hour = parseInt(runHour);

      const runTime = new Date(Date.UTC(year, month, day, hour, 0, 0));
      const now = new Date();

      // Calculate hours since model run
      const hoursSinceRun = (now.getTime() - runTime.getTime()) / (1000 * 60 * 60);

      // Find the closest forecast hour that's >= current time offset
      // This ensures we show current or future conditions, not past
      let closestHour = forecastHours[0];
      let minDiff = Math.abs(forecastHours[0] - hoursSinceRun);

      for (const fh of forecastHours) {
        const diff = Math.abs(fh - hoursSinceRun);
        if (diff < minDiff) {
          minDiff = diff;
          closestHour = fh;
        }
      }

      return closestHour;
    } catch (e) {
      console.error('Error calculating closest forecast hour:', e);
      return forecastHours[0];
    }
  };

  // Fetch metadata
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await fetch(`${API_URL}/api/wind/meta`);
        const data = await res.json();
        setWindMeta(data);
        if (data.latest_run?.forecast_hours?.length > 0) {
          // Auto-select the forecast hour closest to current time
          const closestHour = getClosestForecastHour(
            data.latest_run.run_date,
            data.latest_run.run_hour,
            data.latest_run.forecast_hours
          );
          setSelectedHour(closestHour);
        }
      } catch (err) {
        console.error('Failed to fetch wind metadata:', err);
      }
    };
    fetchMeta();
  }, []);

  // Fetch wind data when hour changes
  useEffect(() => {
    const fetchWind = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/wind/latest?forecast_hour=${selectedHour}`);
        const data = await res.json();
        setWindData(data);
        windDataRef.current = data;
      } catch (err) {
        console.error('Failed to fetch wind data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWind();
  }, [selectedHour]);

  // Auto-play forecast
  useEffect(() => {
    if (isPlaying && windMeta?.latest_run?.forecast_hours) {
      const hours = windMeta.latest_run.forecast_hours;
      playIntervalRef.current = setInterval(() => {
        setSelectedHour(prev => {
          const idx = hours.indexOf(prev);
          return hours[(idx + 1) % hours.length];
        });
      }, 2000);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, windMeta]);

  // Interpolate wind at a point
  const getWindAt = useCallback((lon: number, lat: number): WindVector | null => {
    const data = windDataRef.current;
    if (!data) return null;
    return interpolateWind(lon, lat, data.lon, data.lat, data.u, data.v, data.speed);
  }, []);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || mapRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      const dataBounds = L.latLngBounds(L.latLng(-5.0, 68.0), L.latLng(20.0, 95.0));
      const sriLankaBounds = L.latLngBounds(L.latLng(5.9, 79.4), L.latLng(9.9, 82.0));

      const map = L.map(mapContainerRef.current!, {
        center: [7.8, 80.7],
        zoom: 7,
        minZoom: 4,
        maxZoom: 10,
        zoomControl: false,
        attributionControl: true,
        maxBounds: dataBounds.pad(0.1),
        maxBoundsViscosity: 0.8,
      });

      map.fitBounds(sriLankaBounds, { padding: [20, 20] });

      // Light basemap for better visibility
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 10
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      mapRef.current = map;

      // Create canvases on top of map
      const trailCanvas = document.createElement('canvas');
      trailCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:400;';
      mapContainerRef.current!.appendChild(trailCanvas);
      trailCanvasRef.current = trailCanvas;

      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:401;';
      mapContainerRef.current!.appendChild(canvas);
      canvasRef.current = canvas;

      const resizeCanvas = () => {
        if (canvas && trailCanvas && mapContainerRef.current) {
          const rect = mapContainerRef.current.getBoundingClientRect();
          canvas.width = rect.width;
          canvas.height = rect.height;
          trailCanvas.width = rect.width;
          trailCanvas.height = rect.height;
        }
      };
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      // Track zoom changes
      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });

      // Mouse move for hover info
      map.on('mousemove', (e: any) => {
        const wind = interpolateWind(
          e.latlng.lng,
          e.latlng.lat,
          windDataRef.current?.lon || [],
          windDataRef.current?.lat || [],
          windDataRef.current?.u || [],
          windDataRef.current?.v || [],
          windDataRef.current?.speed || []
        );
        if (wind && wind.speed > 0) {
          setHoverInfo({
            x: e.containerPoint.x,
            y: e.containerPoint.y,
            speed: wind.speed,
            direction: wind.direction,
            cardinal: wind.cardinalDir,
          });
        } else {
          setHoverInfo(null);
        }
      });

      map.on('mouseout', () => setHoverInfo(null));

      setMapLoaded(true);
    };

    initMap();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Main rendering loop
  useEffect(() => {
    if (!mapRef.current || !canvasRef.current || !trailCanvasRef.current || !windData || !mapLoaded) return;

    const map = mapRef.current;
    const canvas = canvasRef.current;
    const trailCanvas = trailCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const trailCtx = trailCanvas.getContext('2d');
    if (!ctx || !trailCtx) return;

    let isAnimating = true;
    const lodConfig = getLODConfig(currentZoom);

    // Build wind field cache
    const buildWindField = () => {
      const { width, height } = canvas;
      const cellSize = lodConfig.gridCellSize;
      const cols = Math.ceil(width / cellSize);
      const rows = Math.ceil(height / cellSize);
      const field: Array<WindVector | null> = new Array(cols * rows);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * cellSize + cellSize / 2;
          const y = row * cellSize + cellSize / 2;
          const latlng = map.containerPointToLatLng([x, y]);
          field[row * cols + col] = getWindAt(latlng.lng, latlng.lat);
        }
      }

      return { field, cols, rows, cellSize };
    };

    const getWindAtPoint = (x: number, y: number, wf: ReturnType<typeof buildWindField>) => {
      const { field, cols, rows, cellSize } = wf;
      const col = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);
      if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
      return field[row * cols + col];
    };

    // Initialize particles
    const initParticles = () => {
      const { width, height } = canvas;
      const particles: Particle[] = [];
      const count = lodConfig.particleCount;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          age: Math.floor(Math.random() * 60),
          maxAge: 50 + Math.floor(Math.random() * 30),
        });
      }
      return particles;
    };

    let windField = buildWindField();
    let particles = initParticles();

    // Rebuild on map move
    const handleMoveEnd = () => {
      windField = buildWindField();
    };
    map.on('moveend', handleMoveEnd);

    const render = () => {
      if (!isAnimating) return;

      const { width, height } = canvas;
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const lod = getLODConfig(zoom);

      // Clear main canvas
      ctx.clearRect(0, 0, width, height);

      // Particle layer - transparent flowing wind lines
      // Fade existing trails for animation effect (transparent fade)
      trailCtx.globalCompositeOperation = 'destination-out';
      trailCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      trailCtx.fillRect(0, 0, width, height);
      trailCtx.globalCompositeOperation = 'source-over';

      const speedMult = lod.particleSpeed * 0.4 * Math.pow(1.3, zoom - 7);

      for (const particle of particles) {
        const wind = getWindAtPoint(particle.x, particle.y, windField);

        if (wind && wind.speed > 0.5) {
          const oldX = particle.x;
          const oldY = particle.y;

          // Wind direction: particles flow in the direction the wind is blowing TO
          // U positive = eastward = +X on screen
          // V positive = northward = -Y on screen (screen Y is inverted)
          particle.x += wind.u * speedMult;
          particle.y -= wind.v * speedMult;

          const rgb = getColorFromLUT(COLOR_LUT, wind.speed, 50);
          const ageRatio = particle.age / particle.maxAge;
          let alpha = 0.6;
          if (ageRatio < 0.2) alpha = (ageRatio / 0.2) * 0.6;
          else if (ageRatio > 0.6) alpha = ((1 - ageRatio) / 0.4) * 0.6;

          trailCtx.beginPath();
          trailCtx.moveTo(oldX, oldY);
          trailCtx.lineTo(particle.x, particle.y);
          trailCtx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
          trailCtx.lineWidth = 1.5;
          trailCtx.stroke();

          particle.age++;
        } else {
          particle.age += 5;
        }

        if (particle.age > particle.maxAge ||
            particle.x < -20 || particle.x > width + 20 ||
            particle.y < -20 || particle.y > height + 20) {
          particle.x = Math.random() * width;
          particle.y = Math.random() * height;
          particle.age = 0;
          particle.maxAge = 50 + Math.floor(Math.random() * 30);
        }
      }

      // Draw particles on main canvas
      ctx.drawImage(trailCanvas, 0, 0);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isAnimating = false;
      map.off('moveend', handleMoveEnd);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [windData, mapLoaded, currentZoom, getWindAt]);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });
    } catch { return iso; }
  };

  const formatRunTime = (date: string, hour: string) => {
    try {
      const d = new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${hour}:00:00Z`);
      return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });
    } catch { return `${date} ${hour}Z`; }
  };

  return (
    <div className="h-[calc(100vh-64px)] relative bg-slate-900">
      {/* Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0" style={{ zIndex: 1 }} />

      {/* Hover tooltip */}
      {hoverInfo && (
        <div
          className="absolute z-[1002] bg-slate-800/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-600 pointer-events-none shadow-lg"
          style={{ left: hoverInfo.x + 15, top: hoverInfo.y - 40 }}
        >
          <div className="text-sm font-semibold text-white">
            {formatWindSpeed(hoverInfo.speed)} m/s
          </div>
          <div className="text-xs text-slate-400">
            From {hoverInfo.cardinal} ({Math.round(hoverInfo.direction)}°)
          </div>
        </div>
      )}

      {/* Controls Panel */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-lg p-4 border border-slate-700/50 w-80">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">Wind Map</h1>
              <p className="text-slate-400 text-xs">GFS 10m Surface Wind</p>
            </div>
          </div>


          {/* Forecast Time Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Forecast Hour</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (windMeta?.latest_run) {
                      const nowHour = getClosestForecastHour(
                        windMeta.latest_run.run_date,
                        windMeta.latest_run.run_hour,
                        windMeta.latest_run.forecast_hours
                      );
                      setSelectedHour(nowHour);
                      setIsPlaying(false);
                    }
                  }}
                  className="px-2 py-1 rounded-lg text-xs font-medium transition-all bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                  title="Jump to current time"
                >
                  Now
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                    isPlaying ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                      Pause
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Play
                    </>
                  )}
                </button>
              </div>
            </div>

            <select
              value={selectedHour}
              onChange={(e) => setSelectedHour(Number(e.target.value))}
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {windMeta?.latest_run?.forecast_hours?.map((h) => {
                const nowHour = windMeta.latest_run ? getClosestForecastHour(
                  windMeta.latest_run.run_date,
                  windMeta.latest_run.run_hour,
                  windMeta.latest_run.forecast_hours
                ) : 0;
                const isNow = h === nowHour;
                return (
                  <option key={h} value={h}>
                    +{h}h {h === 0 ? '(Analysis)' : 'Forecast'}{isNow ? ' ← Now' : ''}
                  </option>
                );
              })}
            </select>

            {windMeta?.latest_run?.forecast_hours && (
              <input
                type="range"
                min={0}
                max={windMeta.latest_run.forecast_hours.length - 1}
                value={windMeta.latest_run.forecast_hours.indexOf(selectedHour)}
                onChange={(e) => setSelectedHour(windMeta.latest_run!.forecast_hours[Number(e.target.value)])}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            )}
          </div>

          {/* Valid Time Display */}
          {windData?.valid_time && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-1">Valid Time</div>
                <div className="text-sm text-cyan-400 font-medium">
                  {formatTime(windData.valid_time)}
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {windData?.meta && (
            <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-cyan-400 font-bold text-sm">{windData.meta.min_speed.toFixed(1)}</div>
                <div className="text-[10px] text-slate-500">Min m/s</div>
              </div>
              <div>
                <div className="text-yellow-400 font-bold text-sm">{windData.meta.mean_speed.toFixed(1)}</div>
                <div className="text-[10px] text-slate-500">Avg m/s</div>
              </div>
              <div>
                <div className="text-red-400 font-bold text-sm">{windData.meta.max_speed.toFixed(1)}</div>
                <div className="text-[10px] text-slate-500">Max m/s</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 left-4 z-[1000]">
        <Legend
          minSpeed={windData?.meta?.min_speed ?? 0}
          maxSpeed={Math.min(windData?.meta?.max_speed ?? 25, 30)}
        />
      </div>

      {/* Metadata Bar */}
      <div className="absolute bottom-8 right-4 z-[1000]">
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-3 border border-slate-700/50 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 w-20">Model:</span>
            <span className="text-xs text-slate-300">{windData?.meta?.data_source === 'gfs' ? 'GFS 0.25°' : 'GFS Synthetic'}</span>
          </div>
          {windMeta?.latest_run && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-20">Run:</span>
              <span className="text-xs text-slate-300">
                {formatRunTime(windMeta.latest_run.run_date, windMeta.latest_run.run_hour)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 w-20">Forecast:</span>
            <span className="text-xs text-slate-300">+{selectedHour}h</span>
          </div>
          {windData?.generated_at && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-20">Updated:</span>
              <span className="text-xs text-slate-300">
                {new Date(windData.generated_at).toLocaleTimeString()}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-700/50">
            <span className="text-[10px] text-slate-500 w-20">Zoom:</span>
            <span className="text-xs text-slate-300">{currentZoom.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center z-[2000]">
          <div className="bg-slate-800 rounded-xl p-6 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-cyan-200 border-t-cyan-500 rounded-full animate-spin" />
            <span className="text-sm text-slate-300">Loading wind data...</span>
          </div>
        </div>
      )}
    </div>
  );
}
