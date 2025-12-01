// Production API URL - hardcoded for reliability
const PRODUCTION_API = 'https://api.hackandbuild.dev';

// Use production API in production, localhost in development
const BACKEND_BASE = process.env.NODE_ENV === 'production'
  ? PRODUCTION_API
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

export interface District {
  name: string;
  latitude: number;
  longitude: number;
  current_alert_level: string;
  rainfall_24h_mm: number | null;
}

export interface DangerFactor {
  factor: string;
  value: string;
  severity: 'low' | 'medium' | 'high';
}

export interface WeatherSummary {
  district: string;
  latitude: number;
  longitude: number;
  rainfall_mm: number;
  rainfall_24h_mm: number;
  rainfall_48h_mm: number;
  rainfall_72h_mm: number;
  forecast_precip_24h_mm: number;
  forecast_precip_48h_mm: number;
  precipitation_probability: number;
  temperature_c: number | null;
  humidity_percent: number | null;
  pressure_hpa: number | null;
  pressure_trend: number;
  cloud_cover_percent: number | null;
  wind_speed_kmh: number | null;
  wind_gusts_kmh: number | null;
  wind_direction: number | null;
  hours: number;
  alert_level: string;
  danger_level: 'low' | 'medium' | 'high';
  danger_score: number;
  danger_factors: DangerFactor[];
}

export interface WeatherDetail {
  district: string;
  latitude: number;
  longitude: number;
  current_rainfall_mm: number;
  rainfall_24h_mm: number;
  temperature_c: number | null;
  humidity_percent: number | null;
  forecast_24h: Array<{
    time: string;
    precipitation_mm: number;
    temperature_c: number | null;
    humidity_percent: number | null;
  }>;
  alert_level: string;
  last_updated: string;
}

export interface Alert {
  id: number;
  district: string;
  alert_level: string;
  rainfall_mm: number | null;
  source: string | null;
  message: string | null;
  sent_at: string;
}

export interface DailyForecast {
  date: string;
  day_name: string;
  total_rainfall_mm: number;
  max_precipitation_probability: number;
  avg_precipitation_probability: number;
  temp_min_c: number | null;
  temp_max_c: number | null;
  avg_humidity_percent: number | null;
  avg_cloud_cover_percent: number | null;
  max_wind_speed_kmh: number | null;
  forecast_alert_level: string;
}

export interface DistrictForecast {
  district: string;
  latitude: number;
  longitude: number;
  forecast_daily: DailyForecast[];
  forecast_precip_24h_mm: number;
  forecast_precip_48h_mm: number;
}

export interface ForecastAlert {
  district: string;
  date: string;
  day_name: string;
  alert_level: string;
  predicted_rainfall_mm: number;
  precipitation_probability: number;
  message: string;
  source: string;
}

export interface SubscribeRequest {
  phone_number: string;
  districts: string[];
  language: string;
}

export interface SubscribeResponse {
  id: number;
  phone_number: string;
  districts: string[];
  language: string;
  active: boolean;
  created_at: string;
}

class ApiClient {
  private getUrl(endpoint: string): string {
    // Always use BACKEND_BASE directly (works for both production and development)
    return `${BACKEND_BASE}${endpoint}`;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(this.getUrl(endpoint), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getDistricts(): Promise<District[]> {
    return this.fetch<District[]>('/api/districts');
  }

  async getAllWeather(hours: number = 24): Promise<WeatherSummary[]> {
    return this.fetch<WeatherSummary[]>(`/api/weather/all?hours=${hours}`);
  }

  async getDistrictWeather(name: string): Promise<WeatherDetail> {
    return this.fetch<WeatherDetail>(`/api/weather/${encodeURIComponent(name)}`);
  }

  async getActiveAlerts(district?: string, level?: string): Promise<Alert[]> {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    if (level) params.set('level', level);
    const query = params.toString();
    return this.fetch<Alert[]>(`/api/alerts${query ? `?${query}` : ''}`);
  }

  async getAlertHistory(options?: {
    district?: string;
    level?: string;
    limit?: number;
  }): Promise<Alert[]> {
    const params = new URLSearchParams();
    if (options?.district) params.set('district', options.district);
    if (options?.level) params.set('level', options.level);
    if (options?.limit) params.set('limit', options.limit.toString());
    const query = params.toString();
    return this.fetch<Alert[]>(`/api/alerts/history${query ? `?${query}` : ''}`);
  }

  async subscribe(data: SubscribeRequest): Promise<SubscribeResponse> {
    return this.fetch<SubscribeResponse>('/api/subscribe', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async unsubscribe(phone_number: string): Promise<{ message: string }> {
    return this.fetch('/api/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ phone_number }),
    });
  }

  async healthCheck(): Promise<{ status: string; version: string }> {
    return this.fetch('/api/health');
  }

  async getAllForecast(): Promise<DistrictForecast[]> {
    return this.fetch<DistrictForecast[]>('/api/weather/forecast/all');
  }

  async getForecastAlerts(): Promise<ForecastAlert[]> {
    return this.fetch<ForecastAlert[]>('/api/alerts/forecast');
  }

  // Intelligence endpoints
  async getIntelPriorities(limit: number = 50, district?: string, urgency?: string): Promise<IntelPrioritiesResponse> {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    if (district) params.set('district', district);
    if (urgency) params.set('urgency', urgency);
    return this.fetch<IntelPrioritiesResponse>(`/api/intel/priorities?${params.toString()}`);
  }

  async getIntelClusters(district?: string): Promise<IntelClustersResponse> {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    const query = params.toString();
    return this.fetch<IntelClustersResponse>(`/api/intel/clusters${query ? `?${query}` : ''}`);
  }

  async getIntelSummary(): Promise<IntelSummary> {
    return this.fetch<IntelSummary>('/api/intel/summary');
  }

  async getIntelActions(): Promise<IntelActionsResponse> {
    return this.fetch<IntelActionsResponse>('/api/intel/actions');
  }

  async refreshIntel(): Promise<{ status: string; summary: IntelSummary }> {
    return this.fetch('/api/intel/refresh', { method: 'POST' });
  }

  // Emergency Facilities endpoints (OpenStreetMap)
  async getFacilities(): Promise<FacilitiesResponse> {
    return this.fetch<FacilitiesResponse>('/api/intel/facilities');
  }

  async getNearbyFacilities(
    lat: number,
    lon: number,
    radiusKm: number = 10,
    limitPerType: number = 3
  ): Promise<NearbyFacilitiesResponse> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      radius_km: radiusKm.toString(),
      limit_per_type: limitPerType.toString(),
    });
    return this.fetch<NearbyFacilitiesResponse>(`/api/intel/facilities/nearby?${params.toString()}`);
  }

  async getNearestHospital(lat: number, lon: number): Promise<NearestHospitalResponse> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
    });
    return this.fetch<NearestHospitalResponse>(`/api/intel/facilities/nearest-hospital?${params.toString()}`);
  }

  async refreshFacilities(): Promise<{ status: string; summary: Record<string, number>; last_updated: string | null }> {
    return this.fetch('/api/intel/facilities/refresh', { method: 'POST' });
  }

  // River water levels endpoints
  async getRiverLevels(): Promise<RiverLevelsResponse> {
    return this.fetch<RiverLevelsResponse>('/api/intel/rivers');
  }

  async refreshRiverLevels(): Promise<{ status: string; count: number; summary: Record<string, number> }> {
    return this.fetch('/api/intel/rivers/refresh', { method: 'POST' });
  }

  // Weather Alerts endpoints (WeatherAPI.com)
  async getWeatherAlerts(): Promise<WeatherAlertsResponse> {
    return this.fetch<WeatherAlertsResponse>('/api/intel/weather-alerts');
  }

  async refreshWeatherAlerts(): Promise<{ status: string; count: number; summary: Record<string, number> }> {
    return this.fetch('/api/intel/weather-alerts/refresh', { method: 'POST' });
  }

  // Marine Weather endpoints (Open-Meteo Marine)
  async getMarineConditions(): Promise<MarineResponse> {
    return this.fetch<MarineResponse>('/api/intel/marine');
  }

  async refreshMarineConditions(): Promise<{ status: string; count: number; summary: Record<string, number> }> {
    return this.fetch('/api/intel/marine/refresh', { method: 'POST' });
  }

  // Traffic Incidents endpoints (TomTom)
  async getTrafficIncidents(category?: string): Promise<TrafficResponse> {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    const query = params.toString();
    return this.fetch<TrafficResponse>(`/api/intel/traffic${query ? `?${query}` : ''}`);
  }

  async refreshTrafficIncidents(): Promise<{ status: string; count: number; summary: Record<string, number> }> {
    return this.fetch('/api/intel/traffic/refresh', { method: 'POST' });
  }
}

// Intelligence types
export interface SOSReport {
  id: number;
  reference: string;
  name: string;
  phone: string;
  alternate_phone: string | null;
  address: string;
  landmark: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  emergency_type: string;
  number_of_people: number;
  water_level: string;
  building_type: string | null;
  floor_level: string | null;
  safe_for_hours: number | null;
  description: string;
  title: string;
  has_children: boolean;
  has_elderly: boolean;
  has_disabled: boolean;
  has_medical_emergency: boolean;
  has_food: boolean;
  has_water: boolean;
  has_power: boolean;
  battery_percent: number | null;
  status: string;
  priority: string;
  source: string;
  rescue_team: string | null;
  verified_by: string | null;
  acknowledged_at: string | null;
  rescued_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  urgency_score: number;
  urgency_tier: string;
  score_factors: string[];
  weather_risk: number;
  elevation_m: number | null;
  elevation_risk: number;
  elevation_risk_level: string;
}

export interface IntelPrioritiesResponse {
  count: number;
  reports: SOSReport[];
}

export interface IntelCluster {
  cluster_id: string;
  name: string;
  districts: string[];
  report_count: number;
  total_people: number;
  total_urgency: number;
  avg_urgency: number;
  critical_count: number;
  high_count: number;
  centroid: {
    latitude: number | null;
    longitude: number | null;
  };
  vulnerabilities: {
    medical_emergency: boolean;
    elderly: boolean;
    children: boolean;
    disabled: boolean;
  };
  reports: number[];
  top_reports: SOSReport[];
}

export interface IntelClustersResponse {
  count: number;
  clusters: IntelCluster[];
}

export interface DistrictIntelStats {
  district: string;
  count: number;
  total_people: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avg_urgency: number;
  needs_food: number;
  needs_water: number;
  has_medical: number;
  forecast_rain_24h: number;
  current_alert_level: string;
}

export interface IntelSummary {
  total_reports: number;
  total_people_affected: number;
  total_clusters: number;
  urgency_breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  resource_needs: {
    needs_food: number;
    needs_water: number;
    medical_emergencies: number;
  };
  vulnerability_counts: {
    with_elderly: number;
    with_children: number;
    with_disabled: number;
  };
  most_affected_districts: DistrictIntelStats[];
  districts: Record<string, DistrictIntelStats>;
  analyzed_at: string;
}

export interface IntelAction {
  priority: number;
  action: string;
  description: string;
  targets: Array<Record<string, unknown>>;
}

export interface IntelActionsResponse {
  generated_at: string;
  total_actions: number;
  actions: IntelAction[];
}

// Emergency Facilities types (OpenStreetMap)
export interface EmergencyFacility {
  id: number;
  name: string;
  lat: number;
  lon: number;
  type: 'hospitals' | 'police' | 'fire_stations' | 'shelters';
  label: string;
  icon: string;
  emergency: string;
  phone: string | null;
  address: string | null;
  distance_km?: number;
}

export interface FacilitiesResponse {
  hospitals: EmergencyFacility[];
  police: EmergencyFacility[];
  fire_stations: EmergencyFacility[];
  shelters: EmergencyFacility[];
  summary: {
    hospitals: number;
    police: number;
    fire_stations: number;
    shelters: number;
  };
  last_updated: string | null;
}

export interface NearbyFacilitiesResponse {
  location: { latitude: number; longitude: number };
  radius_km: number;
  total_found: number;
  hospitals: EmergencyFacility[];
  police: EmergencyFacility[];
  fire_stations: EmergencyFacility[];
  shelters: EmergencyFacility[];
}

export interface NearestHospitalResponse {
  found: boolean;
  hospital?: EmergencyFacility;
  message?: string;
}

// River water levels types
export interface RiverStation {
  river: string;
  river_code: string;
  station: string;
  lat: number;
  lon: number;
  catchment_area_km2: number;
  water_level_m: number;
  water_level_1hr_ago_m: number;
  water_level_9am_m: number;
  rainfall_24h_mm: number;
  status: 'normal' | 'alert' | 'rising' | 'falling' | 'unknown';
  last_updated: string;
}

export interface RiverLevelsResponse {
  count: number;
  summary: {
    normal: number;
    alert: number;
    rising: number;
    falling: number;
  };
  stations: RiverStation[];
}

// Weather Alerts types (WeatherAPI.com)
export interface WeatherAlert {
  headline: string;
  severity: string;
  urgency: string;
  event: string;
  effective: string;
  expires: string;
  description: string;
  instruction: string;
  areas: string[];
  location: string;
  latitude: number;
  longitude: number;
}

export interface WeatherAlertsResponse {
  count: number;
  summary: {
    extreme: number;
    severe: number;
    moderate: number;
    minor: number;
  };
  alerts: WeatherAlert[];
}

// Marine Weather types (Open-Meteo Marine)
export interface MarineCondition {
  location: string;
  district: string;
  lat: number;
  lon: number;
  wave_height_m: number;
  wave_direction: number;
  wave_period_s: number;
  wind_wave_height_m: number;
  swell_wave_height_m: number;
  sea_surface_temp_c: number | null;
  risk_level: 'low' | 'medium' | 'high';
  risk_factors: string[];
}

export interface MarineResponse {
  count: number;
  summary: {
    total: number;
    high_risk: number;
    medium_risk: number;
    low_risk: number;
    max_wave_height: number;
  };
  conditions: MarineCondition[];
}

// Traffic Incidents types (TomTom)
export interface TrafficIncident {
  id: string;
  icon_category: number;
  category: string;
  severity: string;
  lat: number;
  lon: number;
  description: string;
  from_location: string;
  to_location: string;
  road_name: string;
  delay_seconds: number;
  delay_minutes: number;
  length_meters: number;
  length_km: number;
  start_time: string | null;
  end_time: string | null;
}

export interface TrafficResponse {
  count: number;
  summary: {
    total: number;
    road_closed: number;
    accidents: number;
    roadworks: number;
    flooding: number;
    jams: number;
    other: number;
  };
  incidents: TrafficIncident[];
}

export const api = new ApiClient();
export default api;
