"""
GeoNames API integration for elevation and location data.
Enhances flood risk assessment with terrain information.
"""
import httpx
import logging
from typing import Optional, Dict, Any, Tuple
from functools import lru_cache
import asyncio

logger = logging.getLogger(__name__)

GEONAMES_USERNAME = "thaaaru"
GEONAMES_BASE_URL = "http://api.geonames.org"

# Cache for elevation data (coordinates -> elevation)
_elevation_cache: Dict[Tuple[float, float], int] = {}
_place_cache: Dict[Tuple[float, float], Dict[str, Any]] = {}


async def get_elevation(lat: float, lng: float) -> Optional[int]:
    """
    Get elevation in meters for coordinates using SRTM3 data.
    Lower elevation = higher flood risk.

    Returns None if API fails or coordinates invalid.
    """
    # Round to 2 decimal places for caching
    cache_key = (round(lat, 2), round(lng, 2))

    if cache_key in _elevation_cache:
        return _elevation_cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{GEONAMES_BASE_URL}/srtm3JSON",
                params={
                    "lat": lat,
                    "lng": lng,
                    "username": GEONAMES_USERNAME
                }
            )

            if response.status_code == 200:
                data = response.json()
                elevation = data.get("srtm3")

                # -32768 means no data available (ocean or missing)
                if elevation is not None and elevation != -32768:
                    _elevation_cache[cache_key] = elevation
                    return elevation

    except Exception as e:
        logger.warning(f"GeoNames elevation lookup failed: {e}")

    return None


async def get_nearby_place(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """
    Get nearest populated place for coordinates.
    Returns place name, district, and distance.
    """
    cache_key = (round(lat, 2), round(lng, 2))

    if cache_key in _place_cache:
        return _place_cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{GEONAMES_BASE_URL}/findNearbyPlaceNameJSON",
                params={
                    "lat": lat,
                    "lng": lng,
                    "username": GEONAMES_USERNAME,
                    "radius": 10,  # 10km radius
                    "maxRows": 1
                }
            )

            if response.status_code == 200:
                data = response.json()
                geonames = data.get("geonames", [])

                if geonames:
                    place = geonames[0]
                    result = {
                        "name": place.get("name"),
                        "admin_name": place.get("adminName1"),  # Province
                        "distance_km": float(place.get("distance", 0)),
                        "population": place.get("population", 0),
                        "country": place.get("countryName")
                    }
                    _place_cache[cache_key] = result
                    return result

    except Exception as e:
        logger.warning(f"GeoNames place lookup failed: {e}")

    return None


def calculate_elevation_risk(elevation: Optional[int]) -> Tuple[int, str]:
    """
    Calculate flood risk score based on elevation.

    Returns:
        (risk_score, risk_level)

    Risk scoring:
    - < 5m: CRITICAL (15 points) - Coastal/extremely low
    - 5-15m: HIGH (10 points) - Low-lying flood plains
    - 15-50m: MEDIUM (5 points) - Moderate risk
    - 50-100m: LOW (2 points) - Some risk from flash floods
    - > 100m: MINIMAL (0 points) - Hill/mountain areas
    """
    if elevation is None:
        return 0, "UNKNOWN"

    if elevation < 5:
        return 15, "CRITICAL"
    elif elevation < 15:
        return 10, "HIGH"
    elif elevation < 50:
        return 5, "MEDIUM"
    elif elevation < 100:
        return 2, "LOW"
    else:
        return 0, "MINIMAL"


async def enrich_location_data(lat: Optional[float], lng: Optional[float]) -> Dict[str, Any]:
    """
    Enrich location with elevation and place data.

    Returns dict with:
    - elevation_m: elevation in meters
    - elevation_risk: risk score (0-15)
    - elevation_risk_level: CRITICAL/HIGH/MEDIUM/LOW/MINIMAL
    - nearby_place: nearest populated place name
    - province: administrative region
    """
    result = {
        "elevation_m": None,
        "elevation_risk": 0,
        "elevation_risk_level": "UNKNOWN",
        "nearby_place": None,
        "province": None
    }

    if lat is None or lng is None:
        return result

    # Fetch elevation and place data concurrently
    try:
        elevation_task = get_elevation(lat, lng)
        place_task = get_nearby_place(lat, lng)

        elevation, place = await asyncio.gather(elevation_task, place_task)

        if elevation is not None:
            result["elevation_m"] = elevation
            risk_score, risk_level = calculate_elevation_risk(elevation)
            result["elevation_risk"] = risk_score
            result["elevation_risk_level"] = risk_level

        if place:
            result["nearby_place"] = place.get("name")
            result["province"] = place.get("admin_name")

    except Exception as e:
        logger.error(f"Error enriching location data: {e}")

    return result


async def batch_get_elevations(coordinates: list[Tuple[float, float]]) -> Dict[Tuple[float, float], Optional[int]]:
    """
    Get elevations for multiple coordinates efficiently.
    Uses caching to minimize API calls.
    """
    results = {}
    tasks = []

    for lat, lng in coordinates:
        cache_key = (round(lat, 2), round(lng, 2))
        if cache_key in _elevation_cache:
            results[cache_key] = _elevation_cache[cache_key]
        else:
            tasks.append((cache_key, get_elevation(lat, lng)))

    # Fetch uncached elevations (with rate limiting)
    for i, (key, task) in enumerate(tasks):
        if i > 0 and i % 10 == 0:
            # GeoNames free tier rate limit - be nice
            await asyncio.sleep(0.5)

        elevation = await task
        results[key] = elevation

    return results


def clear_cache():
    """Clear all cached data."""
    _elevation_cache.clear()
    _place_cache.clear()
    logger.info("GeoNames cache cleared")
