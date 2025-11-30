"""
WeatherAPI.com integration for official weather alerts.
Fetches weather alerts and warnings for Sri Lanka.
"""
import httpx
import logging
from typing import Optional
from datetime import datetime

from ..config import get_settings

logger = logging.getLogger(__name__)

WEATHERAPI_BASE_URL = "https://api.weatherapi.com/v1"

# Sri Lanka major cities for alert coverage
SRI_LANKA_LOCATIONS = [
    {"name": "Colombo", "query": "Colombo,Sri Lanka", "lat": 6.9271, "lon": 79.8612},
    {"name": "Kandy", "query": "Kandy,Sri Lanka", "lat": 7.2906, "lon": 80.6337},
    {"name": "Galle", "query": "Galle,Sri Lanka", "lat": 6.0535, "lon": 80.2210},
    {"name": "Jaffna", "query": "Jaffna,Sri Lanka", "lat": 9.6615, "lon": 80.0255},
    {"name": "Trincomalee", "query": "Trincomalee,Sri Lanka", "lat": 8.5874, "lon": 81.2152},
    {"name": "Batticaloa", "query": "Batticaloa,Sri Lanka", "lat": 7.7310, "lon": 81.6747},
    {"name": "Anuradhapura", "query": "Anuradhapura,Sri Lanka", "lat": 8.3114, "lon": 80.4037},
    {"name": "Ratnapura", "query": "Ratnapura,Sri Lanka", "lat": 6.6828, "lon": 80.3992},
    {"name": "Badulla", "query": "Badulla,Sri Lanka", "lat": 6.9934, "lon": 81.0550},
    {"name": "Matara", "query": "Matara,Sri Lanka", "lat": 5.9549, "lon": 80.5550},
]


class WeatherAlert:
    """Represents a weather alert from WeatherAPI"""
    def __init__(
        self,
        headline: str,
        severity: str,
        urgency: str,
        event: str,
        effective: str,
        expires: str,
        description: str,
        instruction: str,
        areas: list[str],
    ):
        self.headline = headline
        self.severity = severity  # Extreme, Severe, Moderate, Minor
        self.urgency = urgency    # Immediate, Expected, Future
        self.event = event        # Type of event (flood, storm, etc.)
        self.effective = effective
        self.expires = expires
        self.description = description
        self.instruction = instruction
        self.areas = areas

    def to_dict(self) -> dict:
        return {
            "headline": self.headline,
            "severity": self.severity,
            "urgency": self.urgency,
            "event": self.event,
            "effective": self.effective,
            "expires": self.expires,
            "description": self.description,
            "instruction": self.instruction,
            "areas": self.areas,
        }


class WeatherAPIService:
    """Service for fetching weather alerts from WeatherAPI.com"""

    def __init__(self):
        self.settings = get_settings()
        self._cache: list[dict] = []
        self._last_fetch: Optional[datetime] = None
        self._cache_duration_seconds = 900  # 15 minutes

    def _get_api_key(self) -> str:
        return self.settings.weatherapi_key

    async def fetch_alerts_for_location(self, query: str) -> list[WeatherAlert]:
        """Fetch weather alerts for a specific location"""
        api_key = self._get_api_key()
        if not api_key:
            logger.warning("WeatherAPI key not configured")
            return []

        try:
            url = f"{WEATHERAPI_BASE_URL}/alerts.json"
            params = {
                "key": api_key,
                "q": query,
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                alerts = []
                alert_data = data.get("alerts", {}).get("alert", [])

                for alert in alert_data:
                    alerts.append(WeatherAlert(
                        headline=alert.get("headline", ""),
                        severity=alert.get("severity", "Unknown"),
                        urgency=alert.get("urgency", "Unknown"),
                        event=alert.get("event", "Weather Alert"),
                        effective=alert.get("effective", ""),
                        expires=alert.get("expires", ""),
                        description=alert.get("desc", ""),
                        instruction=alert.get("instruction", ""),
                        areas=alert.get("areas", "").split("; ") if alert.get("areas") else [],
                    ))

                return alerts

        except Exception as e:
            logger.error(f"Failed to fetch alerts for {query}: {e}")
            return []

    async def fetch_all_alerts(self) -> list[dict]:
        """Fetch weather alerts for all Sri Lanka locations"""
        all_alerts = []
        seen_headlines = set()  # Avoid duplicates

        for location in SRI_LANKA_LOCATIONS:
            alerts = await self.fetch_alerts_for_location(location["query"])

            for alert in alerts:
                # Deduplicate by headline
                if alert.headline not in seen_headlines:
                    seen_headlines.add(alert.headline)
                    alert_dict = alert.to_dict()
                    alert_dict["location"] = location["name"]
                    alert_dict["latitude"] = location["lat"]
                    alert_dict["longitude"] = location["lon"]
                    all_alerts.append(alert_dict)

        self._cache = all_alerts
        self._last_fetch = datetime.utcnow()

        logger.info(f"Fetched {len(all_alerts)} weather alerts for Sri Lanka")
        return all_alerts

    async def fetch_current_weather(self, query: str) -> Optional[dict]:
        """Fetch current weather with alerts for a location"""
        api_key = self._get_api_key()
        if not api_key:
            return None

        try:
            url = f"{WEATHERAPI_BASE_URL}/forecast.json"
            params = {
                "key": api_key,
                "q": query,
                "days": 3,
                "alerts": "yes",
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                current = data.get("current", {})
                location = data.get("location", {})
                alerts = data.get("alerts", {}).get("alert", [])

                return {
                    "location": location.get("name"),
                    "region": location.get("region"),
                    "country": location.get("country"),
                    "lat": location.get("lat"),
                    "lon": location.get("lon"),
                    "temp_c": current.get("temp_c"),
                    "humidity": current.get("humidity"),
                    "wind_kph": current.get("wind_kph"),
                    "wind_dir": current.get("wind_dir"),
                    "pressure_mb": current.get("pressure_mb"),
                    "precip_mm": current.get("precip_mm"),
                    "cloud": current.get("cloud"),
                    "condition": current.get("condition", {}).get("text"),
                    "condition_icon": current.get("condition", {}).get("icon"),
                    "alerts_count": len(alerts),
                    "alerts": [
                        {
                            "headline": a.get("headline"),
                            "severity": a.get("severity"),
                            "event": a.get("event"),
                        }
                        for a in alerts
                    ],
                }

        except Exception as e:
            logger.error(f"Failed to fetch weather for {query}: {e}")
            return None

    def get_cached_alerts(self) -> list[dict]:
        """Get cached alerts"""
        return self._cache

    def is_cache_valid(self) -> bool:
        """Check if cache is still valid"""
        if not self._last_fetch:
            return False
        elapsed = (datetime.utcnow() - self._last_fetch).total_seconds()
        return elapsed < self._cache_duration_seconds


# Singleton instance
weatherapi_service = WeatherAPIService()
