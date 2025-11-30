"""
TomTom Traffic Flow API integration.
Provides real-time traffic speeds and travel times for Sri Lanka roads.
"""
import httpx
import logging
from typing import Optional
from datetime import datetime

from ..config import get_settings

logger = logging.getLogger(__name__)

# Key road segments to monitor in Sri Lanka
ROAD_SEGMENTS = [
    # Expressways
    {"name": "Southern Expressway - Kottawa", "lat": 6.8411, "lon": 79.9633},
    {"name": "Southern Expressway - Pinnaduwa", "lat": 6.0867, "lon": 80.1978},
    {"name": "Colombo-Katunayake Expressway", "lat": 7.0833, "lon": 79.8833},
    {"name": "Outer Circular Highway - Kaduwela", "lat": 6.9356, "lon": 79.9844},
    # Colombo roads
    {"name": "Galle Road - Colombo", "lat": 6.9147, "lon": 79.8536},
    {"name": "Duplication Road - Colombo", "lat": 6.8989, "lon": 79.8589},
    {"name": "Marine Drive - Colombo", "lat": 6.9344, "lon": 79.8428},
    {"name": "Baseline Road - Colombo", "lat": 6.9078, "lon": 79.8783},
    {"name": "High Level Road - Colombo", "lat": 6.8847, "lon": 79.8894},
    # Inter-city roads
    {"name": "A1 - Colombo-Kandy Road", "lat": 7.0500, "lon": 80.1000},
    {"name": "A2 - Colombo-Galle Road", "lat": 6.5000, "lon": 80.0500},
    {"name": "A3 - Colombo-Negombo Road", "lat": 7.1000, "lon": 79.8600},
    {"name": "A4 - Colombo-Ratnapura Road", "lat": 6.7000, "lon": 80.2000},
    {"name": "A6 - Ambepussa-Trincomalee Road", "lat": 7.8000, "lon": 80.8000},
    {"name": "A9 - Kandy-Jaffna Road", "lat": 8.5000, "lon": 80.5000},
    # Major cities
    {"name": "Kandy City Center", "lat": 7.2906, "lon": 80.6337},
    {"name": "Galle Fort Area", "lat": 6.0300, "lon": 80.2167},
    {"name": "Jaffna City", "lat": 9.6615, "lon": 80.0255},
    {"name": "Negombo Town", "lat": 7.2094, "lon": 79.8358},
    {"name": "Matara Town", "lat": 5.9485, "lon": 80.5353},
]


class TomTomTrafficFlowService:
    """Service for fetching real-time traffic flow data from TomTom"""

    BASE_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"

    def __init__(self):
        self.settings = get_settings()
        self._cache: list[dict] = []
        self._last_fetch: Optional[datetime] = None
        self._cache_duration_seconds = 300  # 5 minutes

    async def fetch_flow_for_point(self, lat: float, lon: float, name: str) -> Optional[dict]:
        """Fetch traffic flow for a specific point"""
        api_key = self.settings.tomtom_api_key

        if not api_key:
            return None

        try:
            params = {
                "key": api_key,
                "point": f"{lat},{lon}",
                "unit": "KMPH",
                "openLr": "false",
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()

            flow_data = data.get("flowSegmentData", {})

            if not flow_data:
                return None

            current_speed = flow_data.get("currentSpeed", 0)
            free_flow_speed = flow_data.get("freeFlowSpeed", 0)
            current_travel_time = flow_data.get("currentTravelTime", 0)
            free_flow_travel_time = flow_data.get("freeFlowTravelTime", 0)
            confidence = flow_data.get("confidence", 0)
            road_closure = flow_data.get("roadClosure", False)

            # Calculate congestion level based on speed ratio
            if road_closure:
                congestion = "closed"
                congestion_color = "#000000"
            elif free_flow_speed > 0:
                speed_ratio = current_speed / free_flow_speed
                if speed_ratio >= 0.9:
                    congestion = "free"
                    congestion_color = "#30ac3e"
                elif speed_ratio >= 0.7:
                    congestion = "light"
                    congestion_color = "#90EE90"
                elif speed_ratio >= 0.5:
                    congestion = "moderate"
                    congestion_color = "#f5a623"
                elif speed_ratio >= 0.3:
                    congestion = "heavy"
                    congestion_color = "#e34133"
                else:
                    congestion = "severe"
                    congestion_color = "#811f1f"
            else:
                congestion = "unknown"
                congestion_color = "#808080"

            # Calculate delay
            delay_seconds = current_travel_time - free_flow_travel_time if current_travel_time > free_flow_travel_time else 0

            return {
                "name": name,
                "lat": lat,
                "lon": lon,
                "current_speed_kmh": round(current_speed, 1),
                "free_flow_speed_kmh": round(free_flow_speed, 1),
                "speed_ratio": round(current_speed / free_flow_speed * 100, 1) if free_flow_speed > 0 else 100,
                "current_travel_time_sec": current_travel_time,
                "free_flow_travel_time_sec": free_flow_travel_time,
                "delay_seconds": delay_seconds,
                "delay_minutes": round(delay_seconds / 60, 1),
                "confidence": round(confidence * 100, 1),
                "road_closure": road_closure,
                "congestion": congestion,
                "congestion_color": congestion_color,
                "source": "tomtom",
            }

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                # No traffic data for this location
                return None
            logger.error(f"TomTom API error for {name}: {e.response.status_code}")
            return None
        except Exception as e:
            logger.error(f"Failed to fetch TomTom flow for {name}: {e}")
            return None

    async def fetch_all_flow_data(self) -> list[dict]:
        """Fetch traffic flow for all monitored road segments"""
        api_key = self.settings.tomtom_api_key

        if not api_key:
            logger.warning("TomTom API key not configured")
            return []

        flow_data = []

        for segment in ROAD_SEGMENTS:
            result = await self.fetch_flow_for_point(
                segment["lat"], segment["lon"], segment["name"]
            )
            if result:
                flow_data.append(result)

        self._cache = flow_data
        self._last_fetch = datetime.utcnow()

        logger.info(f"Fetched TomTom traffic flow for {len(flow_data)} locations")
        return flow_data

    def get_cached_data(self) -> list[dict]:
        """Get cached traffic flow data"""
        return self._cache

    def is_cache_valid(self) -> bool:
        """Check if cache is still valid"""
        if not self._last_fetch:
            return False
        elapsed = (datetime.utcnow() - self._last_fetch).total_seconds()
        return elapsed < self._cache_duration_seconds

    def get_summary(self) -> dict:
        """Get summary of current traffic conditions"""
        if not self._cache:
            return {
                "total_locations": 0,
                "free_flow": 0,
                "light": 0,
                "moderate": 0,
                "heavy": 0,
                "severe": 0,
                "closed": 0,
                "avg_speed_kmh": 0,
                "total_delay_minutes": 0,
            }

        congestion_counts = {
            "free": 0,
            "light": 0,
            "moderate": 0,
            "heavy": 0,
            "severe": 0,
            "closed": 0,
            "unknown": 0,
        }

        total_speed = 0
        total_delay = 0

        for loc in self._cache:
            congestion = loc.get("congestion", "unknown")
            congestion_counts[congestion] = congestion_counts.get(congestion, 0) + 1
            total_speed += loc.get("current_speed_kmh", 0)
            total_delay += loc.get("delay_minutes", 0)

        count = len(self._cache)

        return {
            "total_locations": count,
            "free_flow": congestion_counts["free"],
            "light": congestion_counts["light"],
            "moderate": congestion_counts["moderate"],
            "heavy": congestion_counts["heavy"],
            "severe": congestion_counts["severe"],
            "closed": congestion_counts["closed"],
            "avg_speed_kmh": round(total_speed / count, 1) if count > 0 else 0,
            "total_delay_minutes": round(total_delay, 1),
        }

    def get_congested_roads(self) -> list[dict]:
        """Get roads with heavy or severe congestion"""
        return [
            loc for loc in self._cache
            if loc.get("congestion") in ["heavy", "severe", "closed"]
        ]


# Singleton instance
tomtom_flow_service = TomTomTrafficFlowService()
