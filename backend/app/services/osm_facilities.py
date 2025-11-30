"""
OpenStreetMap Facilities Service
Fetches nearby hospitals, police stations, shelters from Overpass API
for emergency response routing.
"""
import httpx
import math
import logging
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

OVERPASS_API_URL = "https://overpass-api.de/api/interpreter"

# Cache for facilities data (refreshed daily)
_facilities_cache: Dict[str, Any] = {
    "hospitals": [],
    "police": [],
    "fire_stations": [],
    "shelters": [],
    "last_updated": None
}

# Facility types to query
FACILITY_TYPES = {
    "hospitals": {
        "query": 'node["amenity"="hospital"](area.a);way["amenity"="hospital"](area.a);',
        "icon": "hospital",
        "label": "Hospital"
    },
    "police": {
        "query": 'node["amenity"="police"](area.a);way["amenity"="police"](area.a);',
        "icon": "shield",
        "label": "Police Station"
    },
    "fire_stations": {
        "query": 'node["amenity"="fire_station"](area.a);way["amenity"="fire_station"](area.a);',
        "icon": "fire",
        "label": "Fire Station"
    },
    "shelters": {
        "query": 'node["amenity"="shelter"](area.a);node["emergency"="assembly_point"](area.a);node["social_facility"="shelter"](area.a);',
        "icon": "home",
        "label": "Shelter"
    }
}


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers."""
    R = 6371  # Earth's radius in km
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2 +
        math.cos(lat1_rad) * math.cos(lat2_rad) *
        math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


async def fetch_all_facilities() -> Dict[str, List[Dict]]:
    """
    Fetch all facilities in Sri Lanka from OpenStreetMap.
    Results are cached for 24 hours.
    """
    global _facilities_cache

    # Check cache freshness
    if _facilities_cache["last_updated"]:
        age = datetime.utcnow() - _facilities_cache["last_updated"]
        if age < timedelta(hours=24):
            logger.info("Using cached facilities data")
            return _facilities_cache

    logger.info("Fetching facilities from OpenStreetMap...")

    results = {}

    for facility_type, config in FACILITY_TYPES.items():
        try:
            query = f'''
            [out:json][timeout:60];
            area["name"="Sri Lanka"]->.a;
            ({config["query"]});
            out center;
            '''

            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(
                    OVERPASS_API_URL,
                    data={"data": query}
                )

                if response.status_code == 200:
                    data = response.json()
                    elements = data.get("elements", [])

                    facilities = []
                    for el in elements:
                        # Get coordinates (center for ways, direct for nodes)
                        lat = el.get("lat") or el.get("center", {}).get("lat")
                        lon = el.get("lon") or el.get("center", {}).get("lon")

                        if lat and lon:
                            tags = el.get("tags", {})
                            facilities.append({
                                "id": el.get("id"),
                                "name": tags.get("name", f"Unknown {config['label']}"),
                                "lat": lat,
                                "lon": lon,
                                "type": facility_type,
                                "label": config["label"],
                                "icon": config["icon"],
                                "emergency": tags.get("emergency", "unknown"),
                                "phone": tags.get("phone") or tags.get("contact:phone"),
                                "address": tags.get("addr:full") or tags.get("addr:street"),
                            })

                    results[facility_type] = facilities
                    logger.info(f"Fetched {len(facilities)} {facility_type}")

                else:
                    logger.warning(f"Failed to fetch {facility_type}: {response.status_code}")
                    results[facility_type] = _facilities_cache.get(facility_type, [])

        except Exception as e:
            logger.error(f"Error fetching {facility_type}: {e}")
            results[facility_type] = _facilities_cache.get(facility_type, [])

    # Update cache
    _facilities_cache = {
        **results,
        "last_updated": datetime.utcnow()
    }

    total = sum(len(v) for k, v in results.items() if k != "last_updated")
    logger.info(f"Total facilities cached: {total}")

    return _facilities_cache


def find_nearby_facilities(
    lat: float,
    lon: float,
    radius_km: float = 10.0,
    limit_per_type: int = 3
) -> Dict[str, List[Dict]]:
    """
    Find facilities near a given location.
    Returns nearest facilities of each type within radius.
    """
    results = {}

    for facility_type in FACILITY_TYPES.keys():
        facilities = _facilities_cache.get(facility_type, [])

        # Calculate distance and filter
        nearby = []
        for f in facilities:
            distance = _haversine_distance(lat, lon, f["lat"], f["lon"])
            if distance <= radius_km:
                nearby.append({
                    **f,
                    "distance_km": round(distance, 2)
                })

        # Sort by distance and limit
        nearby.sort(key=lambda x: x["distance_km"])
        results[facility_type] = nearby[:limit_per_type]

    return results


def get_nearest_hospital(lat: float, lon: float) -> Optional[Dict]:
    """Get the nearest hospital to a location."""
    hospitals = _facilities_cache.get("hospitals", [])

    if not hospitals:
        return None

    nearest = None
    min_distance = float("inf")

    for h in hospitals:
        distance = _haversine_distance(lat, lon, h["lat"], h["lon"])
        if distance < min_distance:
            min_distance = distance
            nearest = {**h, "distance_km": round(distance, 2)}

    return nearest


def get_facilities_summary() -> Dict[str, int]:
    """Get count of each facility type in cache."""
    return {
        facility_type: len(_facilities_cache.get(facility_type, []))
        for facility_type in FACILITY_TYPES.keys()
    }


async def refresh_facilities_cache() -> Dict[str, Any]:
    """Force refresh the facilities cache."""
    global _facilities_cache
    _facilities_cache["last_updated"] = None  # Invalidate cache
    return await fetch_all_facilities()
