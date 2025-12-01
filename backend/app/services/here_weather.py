"""
HERE Destination Weather API integration.
Provides weather forecasts, observations, and alerts for locations in Sri Lanka.
"""
import httpx
import logging
from typing import Optional
from datetime import datetime

from ..config import get_settings

logger = logging.getLogger(__name__)

# Sri Lanka district centers for weather data
SRI_LANKA_LOCATIONS = [
    {"name": "Colombo", "lat": 6.9271, "lon": 79.8612},
    {"name": "Gampaha", "lat": 7.0917, "lon": 80.0000},
    {"name": "Kalutara", "lat": 6.5833, "lon": 79.9500},
    {"name": "Kandy", "lat": 7.2906, "lon": 80.6337},
    {"name": "Matale", "lat": 7.4667, "lon": 80.6167},
    {"name": "Nuwara Eliya", "lat": 6.9697, "lon": 80.7700},
    {"name": "Galle", "lat": 6.0535, "lon": 80.2210},
    {"name": "Matara", "lat": 5.9485, "lon": 80.5353},
    {"name": "Hambantota", "lat": 6.1241, "lon": 81.1185},
    {"name": "Jaffna", "lat": 9.6615, "lon": 80.0255},
    {"name": "Kilinochchi", "lat": 9.3803, "lon": 80.3770},
    {"name": "Mannar", "lat": 8.9810, "lon": 79.9044},
    {"name": "Vavuniya", "lat": 8.7542, "lon": 80.4982},
    {"name": "Mullaitivu", "lat": 9.2671, "lon": 80.8142},
    {"name": "Batticaloa", "lat": 7.7310, "lon": 81.6747},
    {"name": "Ampara", "lat": 7.2975, "lon": 81.6820},
    {"name": "Trincomalee", "lat": 8.5874, "lon": 81.2152},
    {"name": "Kurunegala", "lat": 7.4863, "lon": 80.3647},
    {"name": "Puttalam", "lat": 8.0362, "lon": 79.8283},
    {"name": "Anuradhapura", "lat": 8.3114, "lon": 80.4037},
    {"name": "Polonnaruwa", "lat": 7.9403, "lon": 81.0188},
    {"name": "Badulla", "lat": 6.9934, "lon": 81.0550},
    {"name": "Monaragala", "lat": 6.8728, "lon": 81.3507},
    {"name": "Ratnapura", "lat": 6.6828, "lon": 80.3992},
    {"name": "Kegalle", "lat": 7.2513, "lon": 80.3464},
]


class HereWeatherService:
    """Service for fetching weather data from HERE Destination Weather API"""

    BASE_URL = "https://weather.hereapi.com/v3"

    def __init__(self):
        self.settings = get_settings()
        self._observations_cache: list[dict] = []
        self._forecasts_cache: list[dict] = []
        self._alerts_cache: list[dict] = []
        self._last_fetch: Optional[datetime] = None
        self._cache_duration_seconds = 1800  # 30 minutes

    async def fetch_observation(self, lat: float, lon: float, name: str) -> Optional[dict]:
        """Fetch current weather observation for a location"""
        api_key = self.settings.here_api_key

        if not api_key:
            return None

        try:
            url = f"{self.BASE_URL}/report"
            params = {
                "apiKey": api_key,
                "location": f"{lat},{lon}",
                "products": "observation",
                "oneObservation": "true",
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

            places = data.get("places", [])
            if not places:
                return None

            observations = places[0].get("observations", [])
            if not observations:
                return None

            obs = observations[0]

            return {
                "location": name,
                "lat": lat,
                "lon": lon,
                "time": obs.get("time"),
                "temperature_c": obs.get("temperature"),
                "feels_like_c": obs.get("temperatureFeelsLike"),
                "humidity_percent": obs.get("humidity"),
                "dew_point_c": obs.get("dewPoint"),
                "wind_speed_kmh": obs.get("windSpeed"),
                "wind_direction": obs.get("windDirection"),
                "wind_gust_kmh": obs.get("windGust"),
                "pressure_hpa": obs.get("barometerPressure"),
                "visibility_km": obs.get("visibility"),
                "uv_index": obs.get("uvIndex"),
                "precipitation_mm": obs.get("precipitation1H"),
                "precipitation_12h_mm": obs.get("precipitation12H"),
                "precipitation_24h_mm": obs.get("precipitation24H"),
                "description": obs.get("description"),
                "icon": obs.get("iconName"),
                "source": "here",
            }

        except Exception as e:
            logger.error(f"Failed to fetch HERE weather observation for {name}: {e}")
            return None

    async def fetch_forecast(self, lat: float, lon: float, name: str) -> Optional[dict]:
        """Fetch weather forecast for a location"""
        api_key = self.settings.here_api_key

        if not api_key:
            return None

        try:
            url = f"{self.BASE_URL}/report"
            params = {
                "apiKey": api_key,
                "location": f"{lat},{lon}",
                "products": "forecast7days",
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

            places = data.get("places", [])
            if not places:
                return None

            forecasts = places[0].get("dailyForecasts", {}).get("forecasts", [])
            if not forecasts:
                return None

            daily_forecasts = []
            for fc in forecasts[:7]:
                daily_forecasts.append({
                    "date": fc.get("time"),
                    "high_c": fc.get("highTemperature"),
                    "low_c": fc.get("lowTemperature"),
                    "humidity_percent": fc.get("humidity"),
                    "precipitation_probability": fc.get("precipitationProbability"),
                    "precipitation_mm": fc.get("precipitation"),
                    "description": fc.get("description"),
                    "icon": fc.get("iconName"),
                    "wind_speed_kmh": fc.get("windSpeed"),
                    "uv_index": fc.get("uvIndex"),
                })

            return {
                "location": name,
                "lat": lat,
                "lon": lon,
                "forecasts": daily_forecasts,
                "source": "here",
            }

        except Exception as e:
            logger.error(f"Failed to fetch HERE weather forecast for {name}: {e}")
            return None

    async def fetch_alerts(self, lat: float, lon: float, name: str) -> list[dict]:
        """Fetch weather alerts for a location"""
        api_key = self.settings.here_api_key

        if not api_key:
            return []

        try:
            url = f"{self.BASE_URL}/report"
            params = {
                "apiKey": api_key,
                "location": f"{lat},{lon}",
                "products": "alerts",
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

            places = data.get("places", [])
            if not places:
                return []

            nws_alerts = places[0].get("nwsAlerts", {}).get("alerts", [])
            alerts = []

            for alert in nws_alerts:
                alerts.append({
                    "location": name,
                    "lat": lat,
                    "lon": lon,
                    "type": alert.get("type"),
                    "severity": alert.get("severity"),
                    "description": alert.get("description"),
                    "message": alert.get("message"),
                    "valid_from": alert.get("validFromTimeLocal"),
                    "valid_until": alert.get("validUntilTimeLocal"),
                    "source": "here",
                })

            return alerts

        except Exception as e:
            logger.error(f"Failed to fetch HERE weather alerts for {name}: {e}")
            return []

    async def fetch_all_observations(self) -> list[dict]:
        """Fetch current weather for all locations in parallel"""
        import asyncio

        api_key = self.settings.here_api_key

        if not api_key:
            logger.warning("HERE API key not configured")
            return []

        # Fetch all observations in parallel for much faster response
        tasks = [
            self.fetch_observation(loc["lat"], loc["lon"], loc["name"])
            for loc in SRI_LANKA_LOCATIONS
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        observations = []
        for result in results:
            if result and not isinstance(result, Exception):
                observations.append(result)

        self._observations_cache = observations
        self._last_fetch = datetime.utcnow()

        logger.info(f"Fetched HERE weather observations for {len(observations)} locations (parallel)")
        return observations

    async def fetch_all_forecasts(self) -> list[dict]:
        """Fetch forecasts for all locations in parallel"""
        import asyncio

        api_key = self.settings.here_api_key

        if not api_key:
            logger.warning("HERE API key not configured")
            return []

        # Fetch all forecasts in parallel for much faster response
        tasks = [
            self.fetch_forecast(loc["lat"], loc["lon"], loc["name"])
            for loc in SRI_LANKA_LOCATIONS
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        forecasts = []
        for result in results:
            if result and not isinstance(result, Exception):
                forecasts.append(result)

        self._forecasts_cache = forecasts
        logger.info(f"Fetched HERE weather forecasts for {len(forecasts)} locations (parallel)")
        return forecasts

    async def fetch_all_alerts(self) -> list[dict]:
        """Fetch weather alerts for all locations"""
        api_key = self.settings.here_api_key

        if not api_key:
            logger.warning("HERE API key not configured")
            return []

        all_alerts = []

        for loc in SRI_LANKA_LOCATIONS:
            alerts = await self.fetch_alerts(loc["lat"], loc["lon"], loc["name"])
            all_alerts.extend(alerts)

        self._alerts_cache = all_alerts
        logger.info(f"Fetched {len(all_alerts)} HERE weather alerts")
        return all_alerts

    def get_cached_observations(self) -> list[dict]:
        return self._observations_cache

    def get_cached_forecasts(self) -> list[dict]:
        return self._forecasts_cache

    def get_cached_alerts(self) -> list[dict]:
        return self._alerts_cache

    def is_cache_valid(self) -> bool:
        if not self._last_fetch:
            return False
        elapsed = (datetime.utcnow() - self._last_fetch).total_seconds()
        return elapsed < self._cache_duration_seconds

    def get_summary(self) -> dict:
        """Get summary of current weather conditions"""
        if not self._observations_cache:
            return {
                "total_locations": 0,
                "avg_temperature_c": 0,
                "avg_humidity": 0,
                "total_precipitation_mm": 0,
                "active_alerts": 0,
            }

        total_temp = 0
        total_humidity = 0
        total_precip = 0
        count = 0

        for obs in self._observations_cache:
            if obs.get("temperature_c") is not None:
                total_temp += obs["temperature_c"]
                count += 1
            if obs.get("humidity_percent") is not None:
                total_humidity += obs["humidity_percent"]
            if obs.get("precipitation_24h_mm") is not None:
                total_precip += obs["precipitation_24h_mm"]

        return {
            "total_locations": len(self._observations_cache),
            "avg_temperature_c": round(total_temp / count, 1) if count > 0 else 0,
            "avg_humidity": round(total_humidity / len(self._observations_cache), 1) if self._observations_cache else 0,
            "total_precipitation_mm": round(total_precip, 1),
            "active_alerts": len(self._alerts_cache),
        }


# Singleton instance
here_weather_service = HereWeatherService()
