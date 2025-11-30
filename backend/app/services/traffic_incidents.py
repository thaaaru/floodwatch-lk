"""
HERE Traffic Incidents API integration.
Provides real-time road incidents, closures, and traffic data for Sri Lanka.
"""
import httpx
import logging
from typing import Optional
from datetime import datetime

from ..config import get_settings

logger = logging.getLogger(__name__)

# Sri Lanka split into 1° x 1° grid cells (HERE limits bbox to 1 degree)
SRI_LANKA_REGIONS = [
    # Row 1 (Southern)
    {"min_lat": 5.9, "min_lon": 79.5, "max_lat": 6.9, "max_lon": 80.5, "name": "Southwest"},
    {"min_lat": 5.9, "min_lon": 80.5, "max_lat": 6.9, "max_lon": 81.5, "name": "Southeast"},
    # Row 2
    {"min_lat": 6.9, "min_lon": 79.5, "max_lat": 7.9, "max_lon": 80.5, "name": "West-Central"},
    {"min_lat": 6.9, "min_lon": 80.5, "max_lat": 7.9, "max_lon": 81.5, "name": "East-Central"},
    # Row 3
    {"min_lat": 7.9, "min_lon": 79.5, "max_lat": 8.9, "max_lon": 80.5, "name": "Northwest"},
    {"min_lat": 7.9, "min_lon": 80.5, "max_lat": 8.9, "max_lon": 81.5, "name": "Northeast"},
    # Row 4 (Northern)
    {"min_lat": 8.9, "min_lon": 79.5, "max_lat": 9.9, "max_lon": 80.5, "name": "North"},
]

# HERE incident categories mapping
INCIDENT_CATEGORIES = {
    "accident": "Accident",
    "congestion": "Jam",
    "roadClosed": "Road Closed",
    "construction": "Road Works",
    "disabledVehicle": "Broken Down Vehicle",
    "plannedEvent": "Event",
    "massTransit": "Mass Transit",
    "weather": "Weather",
    "miscellaneous": "Other",
    "roadHazard": "Road Hazard",
    "laneRestriction": "Lane Closed",
}

# Map HERE criticality to our severity levels
def get_severity(criticality: str) -> str:
    """Convert HERE criticality to severity level"""
    criticality_map = {
        "critical": "critical",
        "major": "major",
        "minor": "moderate",
        "lowImpact": "minor",
    }
    return criticality_map.get(criticality, "unknown")


# Map category to icon_category (for frontend compatibility)
def get_icon_category(category: str) -> int:
    """Map HERE category to icon category number"""
    category_map = {
        "accident": 1,
        "congestion": 6,
        "roadClosed": 8,
        "construction": 9,
        "weather": 11,
        "disabledVehicle": 14,
        "laneRestriction": 7,
        "roadHazard": 3,
    }
    return category_map.get(category, 0)


class TrafficIncident:
    """Represents a traffic incident"""
    def __init__(
        self,
        id: str,
        icon_category: int,
        category: str,
        severity: str,
        lat: float,
        lon: float,
        description: str,
        from_location: str,
        to_location: str,
        road_name: str,
        delay_seconds: int,
        length_meters: int,
        start_time: Optional[str],
        end_time: Optional[str],
    ):
        self.id = id
        self.icon_category = icon_category
        self.category = category
        self.severity = severity
        self.lat = lat
        self.lon = lon
        self.description = description
        self.from_location = from_location
        self.to_location = to_location
        self.road_name = road_name
        self.delay_seconds = delay_seconds
        self.length_meters = length_meters
        self.start_time = start_time
        self.end_time = end_time

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "icon_category": self.icon_category,
            "category": self.category,
            "severity": self.severity,
            "lat": self.lat,
            "lon": self.lon,
            "description": self.description,
            "from_location": self.from_location,
            "to_location": self.to_location,
            "road_name": self.road_name,
            "delay_seconds": self.delay_seconds,
            "delay_minutes": round(self.delay_seconds / 60) if self.delay_seconds else 0,
            "length_meters": self.length_meters,
            "length_km": round(self.length_meters / 1000, 1) if self.length_meters else 0,
            "start_time": self.start_time,
            "end_time": self.end_time,
        }


class TrafficIncidentsService:
    """Service for fetching traffic incidents from HERE"""

    BASE_URL = "https://data.traffic.hereapi.com/v7/incidents"

    def __init__(self):
        self.settings = get_settings()
        self._cache: list[dict] = []
        self._last_fetch: Optional[datetime] = None
        self._cache_duration_seconds = 300  # 5 minutes

    async def fetch_incidents_for_region(self, region: dict) -> list[dict]:
        """Fetch incidents for a single region"""
        api_key = self.settings.here_api_key

        try:
            bbox = f"{region['min_lon']},{region['min_lat']},{region['max_lon']},{region['max_lat']}"
            params = {
                "apiKey": api_key,
                "in": f"bbox:{bbox}",
                "locationReferencing": "shape",
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()

            return data.get("results", [])
        except Exception as e:
            logger.error(f"Failed to fetch incidents for region {region.get('name')}: {e}")
            return []

    async def fetch_incidents(self) -> list[dict]:
        """Fetch traffic incidents for Sri Lanka from HERE API"""
        api_key = self.settings.here_api_key

        if not api_key:
            logger.warning("HERE API key not configured")
            return []

        try:
            # Fetch from all regions and deduplicate
            all_raw_incidents = []
            seen_ids = set()

            for region in SRI_LANKA_REGIONS:
                raw_incidents = await self.fetch_incidents_for_region(region)
                for incident in raw_incidents:
                    incident_id = incident.get("incidentId")
                    if incident_id and incident_id not in seen_ids:
                        seen_ids.add(incident_id)
                        all_raw_incidents.append(incident)

            logger.info(f"HERE API returned {len(all_raw_incidents)} raw incidents from {len(SRI_LANKA_REGIONS)} regions")

            incidents = []
            for item in all_raw_incidents:
                try:
                    incident_details = item.get("incidentDetails", {})
                    location = item.get("location", {})

                    # Get coordinates from shape
                    shape = location.get("shape", {})
                    links = shape.get("links", [])

                    # Get midpoint of incident
                    lat, lon = 0, 0
                    if links:
                        points = links[0].get("points", [])
                        if points:
                            mid_idx = len(points) // 2
                            mid_point = points[mid_idx]
                            lat = mid_point.get("lat", 0)
                            lon = mid_point.get("lng", 0)

                    if lat == 0 and lon == 0:
                        continue

                    # Get incident type and category
                    incident_type = incident_details.get("type", "miscellaneous")
                    category = INCIDENT_CATEGORIES.get(incident_type, "Other")
                    icon_category = get_icon_category(incident_type)

                    # Get severity from criticality
                    criticality = incident_details.get("criticality", "minor")
                    severity = get_severity(criticality)

                    # Get description
                    description = incident_details.get("description", {}).get("value", "")
                    if not description:
                        description = f"{category} reported"

                    # Get road info
                    road_name = location.get("description", "Unknown Road")

                    # Get delay info
                    delay_seconds = incident_details.get("delay", 0) or 0
                    length_meters = location.get("length", 0) or 0

                    # Get times
                    start_time = incident_details.get("startTime")
                    end_time = incident_details.get("endTime")

                    incident = TrafficIncident(
                        id=item.get("incidentId", ""),
                        icon_category=icon_category,
                        category=category,
                        severity=severity,
                        lat=lat,
                        lon=lon,
                        description=description,
                        from_location=incident_details.get("from", ""),
                        to_location=incident_details.get("to", ""),
                        road_name=road_name,
                        delay_seconds=delay_seconds,
                        length_meters=length_meters,
                        start_time=start_time,
                        end_time=end_time,
                    )
                    incidents.append(incident.to_dict())

                except Exception as e:
                    logger.error(f"Error parsing incident: {e}")
                    continue

            self._cache = incidents
            self._last_fetch = datetime.utcnow()

            logger.info(f"Fetched {len(incidents)} traffic incidents for Sri Lanka from HERE")
            return incidents

        except httpx.HTTPStatusError as e:
            logger.error(f"HERE API error: {e.response.status_code} - {e.response.text}")
            return []
        except Exception as e:
            logger.error(f"Failed to fetch traffic incidents: {e}")
            return []

    def get_cached_data(self) -> list[dict]:
        """Get cached traffic incidents"""
        return self._cache

    def is_cache_valid(self) -> bool:
        """Check if cache is still valid"""
        if not self._last_fetch:
            return False
        elapsed = (datetime.utcnow() - self._last_fetch).total_seconds()
        return elapsed < self._cache_duration_seconds

    def get_summary(self) -> dict:
        """Get summary of current incidents"""
        if not self._cache:
            return {
                "total": 0,
                "road_closed": 0,
                "accidents": 0,
                "roadworks": 0,
                "flooding": 0,
                "jams": 0,
                "other": 0,
            }

        road_closed = sum(1 for i in self._cache if i["icon_category"] == 8)
        accidents = sum(1 for i in self._cache if i["icon_category"] == 1)
        roadworks = sum(1 for i in self._cache if i["icon_category"] == 9)
        flooding = sum(1 for i in self._cache if i["icon_category"] == 11)
        jams = sum(1 for i in self._cache if i["icon_category"] == 6)
        other = len(self._cache) - road_closed - accidents - roadworks - flooding - jams

        return {
            "total": len(self._cache),
            "road_closed": road_closed,
            "accidents": accidents,
            "roadworks": roadworks,
            "flooding": flooding,
            "jams": jams,
            "other": other,
        }

    def get_by_category(self, category: str) -> list[dict]:
        """Filter incidents by category"""
        category_map = {
            "road_closed": 8,
            "accident": 1,
            "roadworks": 9,
            "flooding": 11,
            "jam": 6,
        }

        icon_cat = category_map.get(category.lower())
        if icon_cat is None:
            return self._cache

        return [i for i in self._cache if i["icon_category"] == icon_cat]


# Singleton instance
traffic_service = TrafficIncidentsService()
