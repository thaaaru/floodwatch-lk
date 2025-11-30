"""
Weather data caching service.
Fetches data from Open-Meteo every 30 minutes and serves cached data to users.
"""
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
import asyncio

from .open_meteo import OpenMeteoService
from .districts_service import get_all_districts

logger = logging.getLogger(__name__)

# Cache configuration
CACHE_DIR = Path(__file__).parent.parent.parent / "cache"
CACHE_FILE = CACHE_DIR / "weather_data.json"
CACHE_DURATION_MINUTES = 30


class WeatherCache:
    """Manages cached weather data for all districts."""

    _instance: Optional["WeatherCache"] = None
    _lock = asyncio.Lock()

    def __init__(self):
        self.weather_service = OpenMeteoService()
        self._cache: dict = {}
        self._last_update: Optional[datetime] = None
        self._ensure_cache_dir()
        self._load_cache_from_disk()

    @classmethod
    def get_instance(cls) -> "WeatherCache":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = WeatherCache()
        return cls._instance

    def _ensure_cache_dir(self):
        """Create cache directory if it doesn't exist."""
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _load_cache_from_disk(self):
        """Load cached data from disk on startup."""
        try:
            if CACHE_FILE.exists():
                with open(CACHE_FILE, "r") as f:
                    data = json.load(f)
                    self._cache = data.get("weather", {})
                    last_update_str = data.get("last_update")
                    if last_update_str:
                        self._last_update = datetime.fromisoformat(last_update_str)
                    logger.info(f"Loaded weather cache from disk, last update: {self._last_update}")
        except Exception as e:
            logger.warning(f"Failed to load cache from disk: {e}")
            self._cache = {}
            self._last_update = None

    def _save_cache_to_disk(self):
        """Save cached data to disk."""
        try:
            with open(CACHE_FILE, "w") as f:
                json.dump({
                    "weather": self._cache,
                    "last_update": self._last_update.isoformat() if self._last_update else None
                }, f)
            logger.info("Saved weather cache to disk")
        except Exception as e:
            logger.error(f"Failed to save cache to disk: {e}")

    def is_cache_valid(self) -> bool:
        """Check if cache is still valid (less than 30 minutes old)."""
        if not self._last_update or not self._cache:
            return False
        age = datetime.now() - self._last_update
        return age < timedelta(minutes=CACHE_DURATION_MINUTES)

    def get_cache_age_seconds(self) -> int:
        """Get age of cache in seconds."""
        if not self._last_update:
            return -1
        return int((datetime.now() - self._last_update).total_seconds())

    async def refresh_cache(self, force: bool = False) -> bool:
        """
        Refresh weather data for all districts.
        Returns True if refresh was successful.
        """
        async with self._lock:
            # Skip if cache is still valid and not forced
            if not force and self.is_cache_valid():
                logger.debug("Cache still valid, skipping refresh")
                return True

            logger.info("Refreshing weather cache for all districts...")
            districts = get_all_districts()
            new_cache = {}
            success_count = 0

            for district in districts:
                try:
                    # Fetch weather data for all time periods
                    weather_data = await self.weather_service.get_weather(
                        district["latitude"],
                        district["longitude"],
                        hours=72  # Get max period, we can extract 24/48/72 from it
                    )

                    new_cache[district["name"]] = {
                        "district": district["name"],
                        "latitude": district["latitude"],
                        "longitude": district["longitude"],
                        "data": weather_data,
                        "fetched_at": datetime.now().isoformat()
                    }
                    success_count += 1

                    # Small delay to avoid rate limiting
                    await asyncio.sleep(0.1)

                except Exception as e:
                    logger.error(f"Failed to fetch weather for {district['name']}: {e}")
                    # Keep old data if available
                    if district["name"] in self._cache:
                        new_cache[district["name"]] = self._cache[district["name"]]

            if success_count > 0:
                self._cache = new_cache
                self._last_update = datetime.now()
                self._save_cache_to_disk()
                logger.info(f"Weather cache refreshed: {success_count}/{len(districts)} districts updated")
                return True
            else:
                logger.error("Failed to refresh any district data")
                return False

    def get_all_weather(self, hours: int = 24) -> list[dict]:
        """Get weather data for all districts from cache."""
        from .open_meteo import OpenMeteoService
        from ..routers.weather import get_alert_level

        result = []

        for district_name, cached in self._cache.items():
            try:
                data = cached["data"]
                rainfall = data.get("rainfall_24h_mm", 0.0) if hours == 24 else \
                          (data.get("rainfall_48h_mm", 0.0) if hours == 48 else data.get("rainfall_72h_mm", 0.0))

                result.append({
                    "district": cached["district"],
                    "latitude": cached["latitude"],
                    "longitude": cached["longitude"],
                    "rainfall_mm": rainfall,
                    "rainfall_24h_mm": data.get("rainfall_24h_mm", 0.0),
                    "rainfall_48h_mm": data.get("rainfall_48h_mm", 0.0),
                    "rainfall_72h_mm": data.get("rainfall_72h_mm", 0.0),
                    "forecast_precip_24h_mm": data.get("forecast_precip_24h_mm", 0.0),
                    "forecast_precip_48h_mm": data.get("forecast_precip_48h_mm", 0.0),
                    "precipitation_probability": data.get("precipitation_probability", 0),
                    "temperature_c": data.get("temperature_c"),
                    "humidity_percent": data.get("humidity_percent"),
                    "pressure_hpa": data.get("pressure_hpa"),
                    "pressure_trend": data.get("pressure_trend", 0),
                    "cloud_cover_percent": data.get("cloud_cover_percent"),
                    "wind_speed_kmh": data.get("wind_speed_kmh"),
                    "wind_gusts_kmh": data.get("wind_gusts_kmh"),
                    "wind_direction": data.get("wind_direction"),
                    "hours": hours,
                    "alert_level": get_alert_level(rainfall, hours),
                    "danger_level": data.get("danger_level", "low"),
                    "danger_score": data.get("danger_score", 0),
                    "danger_factors": data.get("danger_factors", [])
                })
            except Exception as e:
                logger.error(f"Error processing cached data for {district_name}: {e}")

        return result

    def get_district_weather(self, district_name: str) -> Optional[dict]:
        """Get weather data for a specific district from cache."""
        cached = self._cache.get(district_name)
        if cached:
            return cached["data"]
        return None

    def get_all_forecast(self) -> list[dict]:
        """Get 5-day forecast for all districts from cache."""
        result = []

        for district_name, cached in self._cache.items():
            try:
                data = cached["data"]
                forecast_daily = data.get("forecast_daily", [])

                if forecast_daily:
                    result.append({
                        "district": cached["district"],
                        "latitude": cached["latitude"],
                        "longitude": cached["longitude"],
                        "forecast_daily": forecast_daily,
                        "forecast_precip_24h_mm": data.get("forecast_precip_24h_mm", 0.0),
                        "forecast_precip_48h_mm": data.get("forecast_precip_48h_mm", 0.0),
                    })
            except Exception as e:
                logger.error(f"Error processing forecast for {district_name}: {e}")

        return result

    def get_cache_info(self) -> dict:
        """Get cache status information."""
        return {
            "cached_districts": len(self._cache),
            "last_update": self._last_update.isoformat() if self._last_update else None,
            "cache_age_seconds": self.get_cache_age_seconds(),
            "is_valid": self.is_cache_valid(),
            "next_refresh_seconds": max(0, CACHE_DURATION_MINUTES * 60 - self.get_cache_age_seconds()) if self._last_update else 0
        }


# Singleton instance
weather_cache = WeatherCache.get_instance()
