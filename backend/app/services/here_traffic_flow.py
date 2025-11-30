"""
HERE Traffic Flow API integration.
Provides real-time traffic speeds and congestion levels for Sri Lanka roads.
"""
import httpx
import logging
from typing import Optional
from datetime import datetime

from ..config import get_settings

logger = logging.getLogger(__name__)

# Major roads/highways in Sri Lanka to monitor
# Format: name, start coords, end coords
SRI_LANKA_ROADS = [
    # Expressways
    {"name": "Southern Expressway (Colombo-Galle)", "lat": 6.8211, "lon": 79.9373},
    {"name": "Southern Expressway (Galle)", "lat": 6.0535, "lon": 80.2210},
    {"name": "Outer Circular Highway", "lat": 6.9344, "lon": 79.9756},
    {"name": "Colombo-Katunayake Expressway", "lat": 7.1686, "lon": 79.8841},
    {"name": "Central Expressway (Kadawatha)", "lat": 7.0012, "lon": 79.9500},
    # Major city roads
    {"name": "Colombo - Galle Road", "lat": 6.9271, "lon": 79.8612},
    {"name": "Colombo - Kandy Road", "lat": 7.2906, "lon": 80.6337},
    {"name": "Colombo - Negombo Road", "lat": 7.2094, "lon": 79.8358},
    {"name": "Kandy City", "lat": 7.2906, "lon": 80.6337},
    {"name": "Jaffna City", "lat": 9.6615, "lon": 80.0255},
    {"name": "Galle City", "lat": 6.0535, "lon": 80.2210},
    {"name": "Batticaloa", "lat": 7.7310, "lon": 81.6747},
    {"name": "Trincomalee", "lat": 8.5874, "lon": 81.2152},
    {"name": "Anuradhapura", "lat": 8.3114, "lon": 80.4037},
    {"name": "Kurunegala", "lat": 7.4863, "lon": 80.3647},
]


class HereTrafficFlowService:
    """Service for fetching real-time traffic flow data from HERE"""

    BASE_URL = "https://data.traffic.hereapi.com/v7/flow"

    def __init__(self):
        self.settings = get_settings()
        self._cache: list[dict] = []
        self._last_fetch: Optional[datetime] = None
        self._cache_duration_seconds = 300  # 5 minutes

    async def fetch_flow_for_location(self, lat: float, lon: float, name: str) -> Optional[dict]:
        """Fetch traffic flow for a specific location"""
        api_key = self.settings.here_api_key

        if not api_key:
            return None

        try:
            # Create a small bounding box around the point (roughly 2km)
            delta = 0.02  # ~2km
            bbox = f"{lon - delta},{lat - delta},{lon + delta},{lat + delta}"

            params = {
                "apiKey": api_key,
                "in": f"bbox:{bbox}",
                "locationReferencing": "shape",
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()

            results = data.get("results", [])
            if not results:
                return None

            # Aggregate flow data from all road segments
            total_speed = 0
            total_free_flow = 0
            jam_factor_sum = 0
            segment_count = 0
            road_names = set()

            for result in results:
                current_flow = result.get("currentFlow", {})
                speed = current_flow.get("speed", 0)
                free_flow = current_flow.get("freeFlow", 0)
                jam_factor = current_flow.get("jamFactor", 0)

                if speed > 0:
                    total_speed += speed
                    total_free_flow += free_flow
                    jam_factor_sum += jam_factor
                    segment_count += 1

                # Get road name
                location = result.get("location", {})
                road_name = location.get("description", "")
                if road_name:
                    road_names.add(road_name)

            if segment_count == 0:
                return None

            avg_speed = total_speed / segment_count
            avg_free_flow = total_free_flow / segment_count
            avg_jam_factor = jam_factor_sum / segment_count

            # Calculate congestion level
            if avg_jam_factor < 2:
                congestion = "free"
                congestion_color = "#30ac3e"
            elif avg_jam_factor < 4:
                congestion = "light"
                congestion_color = "#90EE90"
            elif avg_jam_factor < 6:
                congestion = "moderate"
                congestion_color = "#f5a623"
            elif avg_jam_factor < 8:
                congestion = "heavy"
                congestion_color = "#e34133"
            else:
                congestion = "severe"
                congestion_color = "#811f1f"

            return {
                "name": name,
                "lat": lat,
                "lon": lon,
                "current_speed_kmh": round(avg_speed * 3.6, 1),  # m/s to km/h
                "free_flow_speed_kmh": round(avg_free_flow * 3.6, 1),
                "jam_factor": round(avg_jam_factor, 1),
                "congestion": congestion,
                "congestion_color": congestion_color,
                "speed_ratio": round(avg_speed / avg_free_flow * 100, 1) if avg_free_flow > 0 else 100,
                "road_names": list(road_names)[:3],
                "segment_count": segment_count,
            }

        except Exception as e:
            logger.error(f"Failed to fetch flow for {name}: {e}")
            return None

    async def fetch_all_flow_data(self) -> list[dict]:
        """Fetch traffic flow for all monitored locations"""
        api_key = self.settings.here_api_key

        if not api_key:
            logger.warning("HERE API key not configured")
            return []

        flow_data = []

        for road in SRI_LANKA_ROADS:
            result = await self.fetch_flow_for_location(
                road["lat"], road["lon"], road["name"]
            )
            if result:
                flow_data.append(result)

        self._cache = flow_data
        self._last_fetch = datetime.utcnow()

        logger.info(f"Fetched traffic flow for {len(flow_data)} locations")
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
                "avg_speed_kmh": 0,
                "avg_jam_factor": 0,
            }

        congestion_counts = {
            "free": 0,
            "light": 0,
            "moderate": 0,
            "heavy": 0,
            "severe": 0,
        }

        total_speed = 0
        total_jam = 0

        for loc in self._cache:
            congestion = loc.get("congestion", "free")
            congestion_counts[congestion] = congestion_counts.get(congestion, 0) + 1
            total_speed += loc.get("current_speed_kmh", 0)
            total_jam += loc.get("jam_factor", 0)

        count = len(self._cache)

        return {
            "total_locations": count,
            "free_flow": congestion_counts["free"],
            "light": congestion_counts["light"],
            "moderate": congestion_counts["moderate"],
            "heavy": congestion_counts["heavy"],
            "severe": congestion_counts["severe"],
            "avg_speed_kmh": round(total_speed / count, 1) if count > 0 else 0,
            "avg_jam_factor": round(total_jam / count, 1) if count > 0 else 0,
        }


# Singleton instance
here_flow_service = HereTrafficFlowService()
