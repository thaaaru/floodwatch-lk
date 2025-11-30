"""
River Water Level Fetcher Service
Fetches real-time river water level data from Sri Lanka Navy flood monitoring system
"""
import httpx
import re
from typing import Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

NAVY_FLOOD_URL = "https://floodms.navy.lk/wlrs/api/"


class RiverStation:
    """Represents a river gauging station"""
    def __init__(
        self,
        river: str,
        river_code: str,
        station: str,
        lat: float,
        lon: float,
        catchment_area: float,
        water_level: float,
        water_level_1hr_ago: float,
        water_level_9am: float,
        rainfall_24h: float,
        status: str,
        last_updated: str
    ):
        self.river = river
        self.river_code = river_code
        self.station = station
        self.lat = lat
        self.lon = lon
        self.catchment_area = catchment_area
        self.water_level = water_level
        self.water_level_1hr_ago = water_level_1hr_ago
        self.water_level_9am = water_level_9am
        self.rainfall_24h = rainfall_24h
        self.status = status  # normal, alert, rising, falling
        self.last_updated = last_updated

    def to_dict(self) -> dict:
        return {
            "river": self.river,
            "river_code": self.river_code,
            "station": self.station,
            "lat": self.lat,
            "lon": self.lon,
            "catchment_area_km2": self.catchment_area,
            "water_level_m": self.water_level,
            "water_level_1hr_ago_m": self.water_level_1hr_ago,
            "water_level_9am_m": self.water_level_9am,
            "rainfall_24h_mm": self.rainfall_24h,
            "status": self.status,
            "last_updated": self.last_updated,
        }


class RiverFetcher:
    """Fetches and parses river water level data"""

    def __init__(self):
        self._cache: list[dict] = []
        self._last_fetch: Optional[datetime] = None
        self._cache_duration_seconds = 300  # 5 minute cache

    async def fetch_river_levels(self) -> list[dict]:
        """Fetch river water levels from Navy flood monitoring system"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(NAVY_FLOOD_URL)
                response.raise_for_status()
                html = response.text

                stations = self._parse_stations(html)
                self._cache = [s.to_dict() for s in stations]
                self._last_fetch = datetime.utcnow()

                logger.info(f"Fetched {len(stations)} river gauging stations")
                return self._cache

        except Exception as e:
            logger.error(f"Failed to fetch river data: {e}")
            return self._cache  # Return cached data on error

    def _parse_stations(self, html: str) -> list[RiverStation]:
        """Parse river station data from HTML"""
        stations = []

        # Pattern to match L.marker calls with popup data
        pattern = r'L\.marker\(\[([0-9.]+),\s*([0-9.]+)\],\s*\{\s*icon:\s*(\w+)\s*\}\)\.bindPopup\("([^"]+)"\)'

        matches = re.findall(pattern, html)

        for lat, lon, icon, popup in matches:
            try:
                station = self._parse_popup(float(lat), float(lon), icon, popup)
                if station:
                    stations.append(station)
            except Exception as e:
                logger.warning(f"Failed to parse station: {e}")
                continue

        return stations

    def _parse_popup(self, lat: float, lon: float, icon: str, popup: str) -> Optional[RiverStation]:
        """Parse popup content to extract station data"""
        try:
            # Extract river name and code
            river_match = re.search(r'<b>([^<]+)\s*\(([^)]+)\)', popup)
            if not river_match:
                return None
            river = river_match.group(1).strip()
            river_code = river_match.group(2).strip()

            # Extract station name
            station_match = re.search(r'Gauging Station\s*:\s*([^<]+)', popup)
            station = station_match.group(1).strip() if station_match else "Unknown"

            # Extract catchment area
            catchment_match = re.search(r'Catchment Area.*?:\s*([0-9.]+)', popup)
            catchment_area = float(catchment_match.group(1)) if catchment_match else 0

            # Extract water level before 1hr
            level_1hr_match = re.search(r'Water Level before 1hr\s*:\s*([0-9.]+)', popup)
            water_level_1hr = float(level_1hr_match.group(1)) if level_1hr_match else 0

            # Extract water level at 9am
            level_9am_match = re.search(r'Water Level at 9:00 am\s*:\s*([0-9.]+)', popup)
            water_level_9am = float(level_9am_match.group(1)) if level_9am_match else 0

            # Extract 24hr rainfall
            rainfall_match = re.search(r'24 Hr RF\s*:\s*([0-9.]+)', popup)
            rainfall_24h = float(rainfall_match.group(1)) if rainfall_match else 0

            # Extract last updated
            updated_match = re.search(r'Last update on\s*:\s*([^<"]+)', popup)
            last_updated = updated_match.group(1).strip() if updated_match else ""

            # Map icon to status
            status_map = {
                'normIcon': 'normal',
                'alertIcon': 'alert',
                'rupIcon': 'rising',
                'fallIcon': 'falling',
            }
            status = status_map.get(icon, 'unknown')

            # Use 1hr ago level as current (most recent)
            water_level = water_level_1hr if water_level_1hr > 0 else water_level_9am

            return RiverStation(
                river=river,
                river_code=river_code,
                station=station,
                lat=lat,
                lon=lon,
                catchment_area=catchment_area,
                water_level=water_level,
                water_level_1hr_ago=water_level_1hr,
                water_level_9am=water_level_9am,
                rainfall_24h=rainfall_24h,
                status=status,
                last_updated=last_updated
            )

        except Exception as e:
            logger.warning(f"Error parsing popup: {e}")
            return None

    def get_cached_data(self) -> list[dict]:
        """Get cached river data without fetching"""
        return self._cache

    def is_cache_valid(self) -> bool:
        """Check if cache is still valid"""
        if not self._last_fetch:
            return False
        elapsed = (datetime.utcnow() - self._last_fetch).total_seconds()
        return elapsed < self._cache_duration_seconds


# Singleton instance
river_fetcher = RiverFetcher()
