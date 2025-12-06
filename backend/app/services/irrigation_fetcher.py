"""
Irrigation Department River Water Level Fetcher
Fetches real-time river water level data from Sri Lanka Irrigation Department's ArcGIS service.
Source: https://github.com/nuuuwan/lk_irrigation

This provides more accurate data than Navy scraping:
- Precise coordinates for each station
- Flood thresholds (alert, minor flood, major flood levels)
- District mapping
"""
import httpx
from typing import Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# ArcGIS REST API endpoint (Irrigation Dept)
ARCGIS_URL = "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/gauges_2_view/FeatureServer/0/query"

# GitHub raw data (fallback, updated hourly)
GITHUB_LATEST_URL = "https://raw.githubusercontent.com/nuuuwan/lk_irrigation/main/data/latest-100.json"
GITHUB_STATIONS_URL = "https://raw.githubusercontent.com/nuuuwan/lk_irrigation/main/data/static/stations.json"

# Station metadata with flood thresholds and coordinates
# From: https://raw.githubusercontent.com/nuuuwan/lk_irrigation/main/data/static/stations.json
STATION_METADATA = {
    "Glencourse": {
        "river": "Kelani Ganga",
        "district_ids": ["LK-11", "LK-12", "LK-92"],
        "lat": 6.975736673046383,
        "lon": 80.18660711562987,
        "alert_level_m": 15.0,
        "minor_flood_m": 16.5,
        "major_flood_m": 19.0,
    },
    "Hanwella": {
        "river": "Kelani Ganga",
        "district_ids": ["LK-11", "LK-12"],
        "lat": 6.909166666666667,
        "lon": 80.08194444444445,
        "alert_level_m": 5.5,   # DMC Official
        "minor_flood_m": 6.5,   # DMC Official: Minor Flood at 6.5m
        "major_flood_m": 10.0,  # DMC Official: Major Flood at 10.0m
    },
    "Nagalagam Street": {
        "river": "Kelani Ganga",
        "district_ids": ["LK-11", "LK-12"],
        "lat": 6.96027242132317,
        "lon": 79.87858326530204,
        # DMC Official thresholds (in feet - station measures and displays in feet)
        # Alert: 4.00 ft, Minor Flood: 5.00 ft, Major Flood: 7.00 ft
        "alert_level_m": 4.0,      # 4.00 ft (kept in feet, not meters)
        "minor_flood_m": 5.0,      # 5.00 ft (kept in feet, not meters)
        "major_flood_m": 7.0,      # 7.00 ft (kept in feet, not meters)
        "unit": "ft",  # This station reports in feet - DO NOT convert
    },
    "Kithulgala": {
        "river": "Kelani Ganga",
        "district_ids": ["LK-92"],
        "lat": 6.989722222222222,
        "lon": 80.41027777777778,
        "alert_level_m": 7.0,   # DMC Official
        "minor_flood_m": 8.5,   # DMC Official: Minor Flood at 8.5m
        "major_flood_m": 10.0,  # No DMC major flood defined, using estimate
    },
    "Holombuwa": {
        "river": "Kelani Ganga",
        "district_ids": ["LK-92"],
        "lat": 7.037777777777778,
        "lon": 80.26472222222222,
        "alert_level_m": 3.5,   # DMC Official
        "minor_flood_m": 4.5,   # DMC Official: Minor Flood at 4.5m
        "major_flood_m": 6.0,   # No DMC major flood defined, using estimate
    },
    "Deraniyagala": {
        "river": "Seethawaka Ganga",
        "district_ids": ["LK-92"],
        "lat": 6.9513888888888884,
        "lon": 80.33861111111111,
        "alert_level_m": 2.5,
        "minor_flood_m": 3.0,
        "major_flood_m": 4.0,
    },
    "Norwood": {
        "river": "Kehelgamu Oya",
        "district_ids": ["LK-23"],
        "lat": 6.835555555555556,
        "lon": 80.61416666666667,
        "alert_level_m": 2.0,
        "minor_flood_m": 2.5,
        "major_flood_m": 3.5,
    },
    "Ellagawa": {
        "river": "Kalu Ganga",
        "district_ids": ["LK-91", "LK-13"],
        "lat": 6.730399127799353,
        "lon": 80.21307042256922,
        "alert_level_m": 10.0,
        "minor_flood_m": 10.7,
        "major_flood_m": 12.2,
    },
    "Putupaula": {
        "river": "Kalu Ganga",
        "district_ids": ["LK-91"],
        "lat": 6.528611111111111,
        "lon": 80.05583333333334,
        "alert_level_m": 3.0,
        "minor_flood_m": 3.5,
        "major_flood_m": 4.5,
    },
    "Ratnapura": {
        "river": "Kalu Ganga",
        "district_ids": ["LK-91"],
        "lat": 6.681944444444444,
        "lon": 80.40527777777778,
        "alert_level_m": 6.0,
        "minor_flood_m": 7.0,
        "major_flood_m": 9.0,
    },
    "Millakanda": {
        "river": "Kalu Ganga",
        "district_ids": ["LK-91", "LK-13"],
        "lat": 6.601388888888889,
        "lon": 80.18027777777778,
        "alert_level_m": 4.0,
        "minor_flood_m": 5.0,
        "major_flood_m": 6.5,
    },
    "Kalawellawa": {
        "river": "Kuda Ganga",
        "district_ids": ["LK-91"],
        "lat": 6.526944444444444,
        "lon": 80.34194444444445,
        "alert_level_m": 2.5,
        "minor_flood_m": 3.0,
        "major_flood_m": 4.0,
    },
    "Thalgahagoda": {
        "river": "Nilwala Ganga",
        "district_ids": ["LK-32"],
        "lat": 6.1,  # Approximate - needs exact coordinates
        "lon": 80.45,  # Approximate - needs exact coordinates
        "alert_level_m": 1.4,   # Navy Official
        "minor_flood_m": 1.7,   # Navy Official
        "major_flood_m": 2.8,   # Navy Official
    },
    "Pitabeddara": {
        "river": "Nilwala Ganga",
        "district_ids": ["LK-32"],
        "lat": 6.198611111111111,
        "lon": 80.47527777777778,
        "alert_level_m": 4.0,   # Navy Official
        "minor_flood_m": 5.0,   # Navy Official
        "major_flood_m": 6.5,   # Navy Official (updated from 6.0)
    },
    "Panadugama": {
        "river": "Nilwala Ganga",
        "district_ids": ["LK-32"],
        "lat": 6.032777777777778,
        "lon": 80.51416666666667,
        "alert_level_m": 5.0,   # Navy Official (updated from 3.5)
        "minor_flood_m": 6.0,   # Navy Official (updated from 4.0)
        "major_flood_m": 7.5,   # Navy Official (updated from 5.0)
    },
    "Urawa": {
        "river": "Nilwala Ganga",
        "district_ids": ["LK-32"],
        "lat": 5.996388888888889,
        "lon": 80.54944444444445,
        "alert_level_m": 2.5,   # Navy Official (updated from 3.0)
        "minor_flood_m": 4.0,   # Navy Official (updated from 3.5)
        "major_flood_m": 6.0,   # Navy Official (updated from 4.5)
    },
    "Baddegama": {
        "river": "Gin Ganga",
        "district_ids": ["LK-31"],
        "lat": 6.189722222222222,
        "lon": 80.19833333333333,
        "alert_level_m": 4.0,
        "minor_flood_m": 5.0,
        "major_flood_m": 6.5,
    },
    "Tawalama": {
        "river": "Gin Ganga",
        "district_ids": ["LK-31"],
        "lat": 6.337777777777778,
        "lon": 80.30861111111111,
        "alert_level_m": 5.0,
        "minor_flood_m": 6.0,
        "major_flood_m": 7.5,
    },
    "Agaliya": {
        "river": "Gin Ganga",
        "district_ids": ["LK-31"],
        "lat": 6.103055555555556,
        "lon": 80.16305555555556,
        "alert_level_m": 2.5,
        "minor_flood_m": 3.0,
        "major_flood_m": 4.0,
    },
    "Magura": {
        "river": "Maha Oya",
        "district_ids": ["LK-12"],
        "lat": 7.198611111111111,
        "lon": 79.94833333333333,
        "alert_level_m": 3.0,
        "minor_flood_m": 3.5,
        "major_flood_m": 4.5,
    },
    "Dunamale": {
        "river": "Attanagalu Oya",
        "district_ids": ["LK-12"],
        "lat": 7.1325,
        "lon": 79.97916666666667,
        "alert_level_m": 3.0,
        "minor_flood_m": 3.5,
        "major_flood_m": 4.5,
    },
    "Colombo": {
        "river": "Colombo Lake",
        "district_ids": ["LK-11"],
        "lat": 6.915833333333333,
        "lon": 79.86472222222222,
        "alert_level_m": 0.6,
        "minor_flood_m": 0.8,
        "major_flood_m": 1.0,
    },
    "Thimbirigasyaya": {
        "river": "Wellawatta Canal",
        "district_ids": ["LK-11"],
        "lat": 6.893888888888889,
        "lon": 79.8675,
        "alert_level_m": 0.6,
        "minor_flood_m": 0.8,
        "major_flood_m": 1.0,
    },
    "Ingiriya": {
        "river": "Wak Oya",
        "district_ids": ["LK-13"],
        "lat": 6.715277777777778,
        "lon": 80.13611111111111,
        "alert_level_m": 2.5,
        "minor_flood_m": 3.0,
        "major_flood_m": 4.0,
    },
    "Manampitiya": {
        "river": "Mahaweli Ganga",
        "district_ids": ["LK-72"],
        "lat": 7.865277777777778,
        "lon": 81.11361111111111,
        "alert_level_m": 10.0,
        "minor_flood_m": 11.0,
        "major_flood_m": 13.0,
    },
    "Peradeniya": {
        "river": "Mahaweli Ganga",
        "district_ids": ["LK-21"],
        "lat": 7.258055555555556,
        "lon": 80.59472222222222,
        "alert_level_m": 5.0,
        "minor_flood_m": 6.0,
        "major_flood_m": 7.5,
    },
    "Weragantota": {
        "river": "Mahaweli Ganga",
        "district_ids": ["LK-22"],
        "lat": 7.34,
        "lon": 80.96638888888889,
        "alert_level_m": 8.0,
        "minor_flood_m": 9.0,
        "major_flood_m": 11.0,
    },
    "Nawalapitiya": {
        "river": "Mahaweli Ganga",
        "district_ids": ["LK-21"],
        "lat": 7.05,
        "lon": 80.53333333333333,
        "alert_level_m": 4.0,
        "minor_flood_m": 5.0,
        "major_flood_m": 6.5,
    },
    "Thaldena": {
        "river": "Badulu Oya",
        "district_ids": ["LK-81"],
        "lat": 6.995,
        "lon": 81.03333333333333,
        "alert_level_m": 4.0,
        "minor_flood_m": 5.0,
        "major_flood_m": 6.0,
    },
    "Wellawaya": {
        "river": "Menik Ganga",
        "district_ids": ["LK-82"],
        "lat": 6.736388888888889,
        "lon": 81.10305555555556,
        "alert_level_m": 2.0,
        "minor_flood_m": 2.5,
        "major_flood_m": 3.5,
    },
    "Kataragama": {
        "river": "Menik Ganga",
        "district_ids": ["LK-82"],
        "lat": 6.416388888888889,
        "lon": 81.33166666666666,
        "alert_level_m": 3.0,
        "minor_flood_m": 3.5,
        "major_flood_m": 4.5,
    },
    "Thanamalwila": {
        "river": "Kirindi Oya",
        "district_ids": ["LK-82"],
        "lat": 6.443888888888889,
        "lon": 81.12694444444444,
        "alert_level_m": 2.5,
        "minor_flood_m": 3.0,
        "major_flood_m": 4.0,
    },
    "Hulandawa": {
        "river": "Walawe Ganga",
        "district_ids": ["LK-91"],
        "lat": 6.419166666666667,
        "lon": 80.77305555555555,
        "alert_level_m": 5.0,
        "minor_flood_m": 6.0,
        "major_flood_m": 7.5,
    },
    "Moraketiya": {
        "river": "Walawe Ganga",
        "district_ids": ["LK-33"],
        "lat": 6.309722222222222,
        "lon": 80.84638888888889,
        "alert_level_m": 4.0,
        "minor_flood_m": 5.0,
        "major_flood_m": 6.5,
    },
    "Panapitiya": {
        "river": "Walawe Ganga",
        "district_ids": ["LK-33"],
        "lat": 6.165,
        "lon": 80.86333333333333,
        "alert_level_m": 3.0,
        "minor_flood_m": 3.5,
        "major_flood_m": 4.5,
    },
    "Embilipitiya": {
        "river": "Walawe Ganga",
        "district_ids": ["LK-91"],
        "lat": 6.333888888888889,
        "lon": 80.85027777777778,
        "alert_level_m": 4.0,
        "minor_flood_m": 5.0,
        "major_flood_m": 6.5,
    },
    "Kaluganga": {
        "river": "Kumbukkan Oya",
        "district_ids": ["LK-82"],
        "lat": 6.613611111111112,
        "lon": 81.36333333333333,
        "alert_level_m": 3.0,
        "minor_flood_m": 3.5,
        "major_flood_m": 4.5,
    },
    "Padiyatalawa": {
        "river": "Heda Oya",
        "district_ids": ["LK-52"],
        "lat": 7.385555555555555,
        "lon": 81.20555555555555,
        "alert_level_m": 3.0,
        "minor_flood_m": 3.5,
        "major_flood_m": 4.5,
    },
    "Rathkinda": {
        "river": "Maduru Oya",
        "district_ids": ["LK-72"],
        "lat": 7.582222222222222,
        "lon": 81.14611111111111,
        "alert_level_m": 4.0,
        "minor_flood_m": 5.0,
        "major_flood_m": 6.5,
    },
    "Puttalam Lagoon": {
        "river": "Puttalam Lagoon",
        "district_ids": ["LK-62"],
        "lat": 8.033333333333333,
        "lon": 79.83333333333333,
        "alert_level_m": 0.5,
        "minor_flood_m": 0.7,
        "major_flood_m": 1.0,
    },
}

# District ID to name mapping
DISTRICT_MAP = {
    "LK-11": "Colombo",
    "LK-12": "Gampaha",
    "LK-13": "Kalutara",
    "LK-21": "Kandy",
    "LK-22": "Matale",
    "LK-23": "Nuwara Eliya",
    "LK-31": "Galle",
    "LK-32": "Matara",
    "LK-33": "Hambantota",
    "LK-41": "Jaffna",
    "LK-42": "Kilinochchi",
    "LK-43": "Mannar",
    "LK-44": "Vavuniya",
    "LK-45": "Mullaitivu",
    "LK-51": "Batticaloa",
    "LK-52": "Ampara",
    "LK-53": "Trincomalee",
    "LK-61": "Kurunegala",
    "LK-62": "Puttalam",
    "LK-71": "Anuradhapura",
    "LK-72": "Polonnaruwa",
    "LK-81": "Badulla",
    "LK-82": "Monaragala",
    "LK-91": "Ratnapura",
    "LK-92": "Kegalle",
}


class IrrigationFetcher:
    """Fetches river water levels from Irrigation Department ArcGIS service"""

    def __init__(self):
        self._cache: list[dict] = []
        self._last_fetch: Optional[datetime] = None
        self._cache_duration_seconds = 300  # 5 minute cache

    async def fetch_water_levels(self) -> list[dict]:
        """
        Fetch river water levels from ArcGIS API.
        Falls back to GitHub data if ArcGIS fails.
        """
        try:
            # Try ArcGIS API first (real-time)
            data = await self._fetch_from_arcgis()
            if data:
                self._cache = data
                self._last_fetch = datetime.utcnow()
                logger.info(f"Fetched {len(data)} stations from ArcGIS")
                return data
        except Exception as e:
            logger.warning(f"ArcGIS fetch failed: {e}, trying GitHub fallback")

        try:
            # Fallback to GitHub (hourly updates)
            data = await self._fetch_from_github()
            if data:
                self._cache = data
                self._last_fetch = datetime.utcnow()
                logger.info(f"Fetched {len(data)} stations from GitHub")
                return data
        except Exception as e:
            logger.error(f"GitHub fallback also failed: {e}")

        return self._cache  # Return cached data on error

    async def _fetch_from_arcgis(self) -> list[dict]:
        """Fetch from ArcGIS REST API"""
        params = {
            "where": "1=1",
            "outFields": "*",
            "orderByFields": "EditDate DESC",
            "resultRecordCount": 200,
            "f": "json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(ARCGIS_URL, params=params)
            response.raise_for_status()
            data = response.json()

        features = data.get("features", [])
        if not features:
            return []

        # Group by station (get latest reading for each)
        station_readings = {}
        for feature in features:
            attrs = feature.get("attributes", {})
            station_name = attrs.get("gauge", "").strip()
            if not station_name:
                continue

            # Only keep latest reading per station
            if station_name not in station_readings:
                station_readings[station_name] = attrs

        # Convert to our format with metadata
        results = []
        for station_name, attrs in station_readings.items():
            result = self._build_station_data(station_name, attrs)
            if result:
                results.append(result)

        return results

    async def _fetch_from_github(self) -> list[dict]:
        """Fetch from GitHub (pre-processed data)"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(GITHUB_LATEST_URL)
            response.raise_for_status()
            readings = response.json()

        # Group by station (get latest reading for each)
        station_readings = {}
        for reading in readings:
            station_name = reading.get("station_name", "").strip()
            if not station_name:
                continue

            time_ut = reading.get("time_ut", 0)
            if station_name not in station_readings or time_ut > station_readings[station_name].get("time_ut", 0):
                station_readings[station_name] = reading

        # Convert to our format with metadata
        results = []
        for station_name, reading in station_readings.items():
            result = self._build_station_data_github(station_name, reading)
            if result:
                results.append(result)

        return results

    def _build_station_data(self, station_name: str, attrs: dict) -> Optional[dict]:
        """Build station data from ArcGIS attributes"""
        metadata = STATION_METADATA.get(station_name)
        if not metadata:
            # Try partial match
            for name, meta in STATION_METADATA.items():
                if name.lower() in station_name.lower() or station_name.lower() in name.lower():
                    metadata = meta
                    break

        if not metadata:
            logger.debug(f"No metadata for station: {station_name}")
            return None

        # Get water level
        water_level_raw = attrs.get("water_level", 0) or 0

        # Check if station reports in feet (based on metadata)
        station_unit = metadata.get("unit", "m")  # Default to meters

        # Get thresholds (in same unit as station reports)
        alert_level = metadata["alert_level_m"]
        minor_flood = metadata["minor_flood_m"]
        major_flood = metadata["major_flood_m"]

        if station_unit == "ft":
            # Station reports in feet - keep raw value, thresholds are also in feet
            water_level = water_level_raw  # Keep as feet, do NOT convert
        else:
            # Station reports in meters
            water_level = water_level_raw
            if water_level > 50:  # Legacy check: very high values might be in feet
                water_level = water_level * 0.3048

        # Determine flood status (compare in native unit)
        if water_level >= major_flood:
            status = "major_flood"
        elif water_level >= minor_flood:
            status = "minor_flood"
        elif water_level >= alert_level:
            status = "alert"
        else:
            status = "normal"

        # Calculate percentage to thresholds
        pct_to_alert = (water_level / alert_level * 100) if alert_level > 0 else 0
        pct_to_minor = (water_level / minor_flood * 100) if minor_flood > 0 else 0
        pct_to_major = (water_level / major_flood * 100) if major_flood > 0 else 0

        # Get district names
        districts = [DISTRICT_MAP.get(d, d) for d in metadata["district_ids"]]

        # Timestamp
        edit_date = attrs.get("EditDate")
        if edit_date:
            # ArcGIS returns milliseconds
            last_updated = datetime.utcfromtimestamp(edit_date / 1000).isoformat()
        else:
            last_updated = datetime.utcnow().isoformat()

        return {
            "station": station_name,
            "river": metadata["river"],
            "lat": metadata["lat"],
            "lon": metadata["lon"],
            "districts": districts,
            "district_ids": metadata["district_ids"],
            "water_level_m": round(water_level, 2),
            "alert_level_m": alert_level,
            "minor_flood_level_m": minor_flood,
            "major_flood_level_m": major_flood,
            "status": status,
            "pct_to_alert": round(pct_to_alert, 1),
            "pct_to_minor_flood": round(pct_to_minor, 1),
            "pct_to_major_flood": round(pct_to_major, 1),
            "last_updated": last_updated,
        }

    def _build_station_data_github(self, station_name: str, reading: dict) -> Optional[dict]:
        """Build station data from GitHub reading"""
        metadata = STATION_METADATA.get(station_name)
        if not metadata:
            # Try partial match
            for name, meta in STATION_METADATA.items():
                if name.lower() in station_name.lower() or station_name.lower() in name.lower():
                    metadata = meta
                    break

        if not metadata:
            return None

        water_level_raw = reading.get("water_level_m", 0) or 0

        # Check if station reports in feet (based on metadata)
        station_unit = metadata.get("unit", "m")  # Default to meters

        # Get thresholds (in same unit as station reports)
        alert_level = metadata["alert_level_m"]
        minor_flood = metadata["minor_flood_m"]
        major_flood = metadata["major_flood_m"]

        if station_unit == "ft":
            # Station reports in feet - keep raw value, thresholds are also in feet
            water_level = water_level_raw  # Keep as feet, do NOT convert
        else:
            water_level = water_level_raw

        # Determine flood status (compare in native unit)
        if water_level >= major_flood:
            status = "major_flood"
        elif water_level >= minor_flood:
            status = "minor_flood"
        elif water_level >= alert_level:
            status = "alert"
        else:
            status = "normal"

        # Calculate percentages
        pct_to_alert = (water_level / alert_level * 100) if alert_level > 0 else 0
        pct_to_minor = (water_level / minor_flood * 100) if minor_flood > 0 else 0
        pct_to_major = (water_level / major_flood * 100) if major_flood > 0 else 0

        # Get district names
        districts = [DISTRICT_MAP.get(d, d) for d in metadata["district_ids"]]

        # Timestamp
        time_ut = reading.get("time_ut", 0)
        last_updated = datetime.utcfromtimestamp(time_ut).isoformat() if time_ut else datetime.utcnow().isoformat()

        return {
            "station": station_name,
            "river": metadata["river"],
            "lat": metadata["lat"],
            "lon": metadata["lon"],
            "districts": districts,
            "district_ids": metadata["district_ids"],
            "water_level_m": round(water_level, 2),
            "alert_level_m": alert_level,
            "minor_flood_level_m": minor_flood,
            "major_flood_level_m": major_flood,
            "status": status,
            "pct_to_alert": round(pct_to_alert, 1),
            "pct_to_minor_flood": round(pct_to_minor, 1),
            "pct_to_major_flood": round(pct_to_major, 1),
            "last_updated": last_updated,
        }

    def get_cached_data(self) -> list[dict]:
        """Get cached data without fetching"""
        return self._cache

    def is_cache_valid(self) -> bool:
        """Check if cache is still valid"""
        if not self._last_fetch:
            return False
        elapsed = (datetime.utcnow() - self._last_fetch).total_seconds()
        return elapsed < self._cache_duration_seconds

    def get_summary(self) -> dict:
        """Get summary statistics"""
        data = self._cache
        if not data:
            return {
                "total_stations": 0,
                "normal": 0,
                "alert": 0,
                "minor_flood": 0,
                "major_flood": 0,
                "highest_risk_station": None,
            }

        status_counts = {"normal": 0, "alert": 0, "minor_flood": 0, "major_flood": 0}
        highest_risk = None
        highest_pct = 0

        for station in data:
            status = station.get("status", "normal")
            status_counts[status] = status_counts.get(status, 0) + 1

            pct = station.get("pct_to_major_flood", 0)
            if pct > highest_pct:
                highest_pct = pct
                highest_risk = station

        return {
            "total_stations": len(data),
            **status_counts,
            "highest_risk_station": highest_risk,
        }

    def get_stations_by_district(self, district: str) -> list[dict]:
        """Get stations affecting a specific district"""
        district_lower = district.lower()
        return [
            s for s in self._cache
            if any(d.lower() == district_lower for d in s.get("districts", []))
        ]

    def get_flood_risk_for_district(self, district: str) -> dict:
        """Calculate flood risk for a district based on river levels"""
        stations = self.get_stations_by_district(district)
        if not stations:
            return {"risk_level": "unknown", "risk_score": 0, "stations": []}

        # Calculate risk score based on highest station risk
        max_pct = max(s.get("pct_to_major_flood", 0) for s in stations)

        if max_pct >= 100:
            risk_level = "major_flood"
            risk_score = 100
        elif max_pct >= 80:
            risk_level = "high"
            risk_score = 80 + (max_pct - 80) * 0.5
        elif max_pct >= 60:
            risk_level = "medium"
            risk_score = 50 + (max_pct - 60) * 1.5
        elif max_pct >= 40:
            risk_level = "low"
            risk_score = 20 + (max_pct - 40) * 1.5
        else:
            risk_level = "minimal"
            risk_score = max_pct * 0.5

        return {
            "district": district,
            "risk_level": risk_level,
            "risk_score": round(min(risk_score, 100), 1),
            "max_pct_to_flood": round(max_pct, 1),
            "station_count": len(stations),
            "stations": stations,
        }


# Singleton instance
irrigation_fetcher = IrrigationFetcher()
