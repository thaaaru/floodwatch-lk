"""
Open-Meteo Marine API integration for coastal weather data.
Provides wave height, sea conditions for coastal flood risk assessment.
"""
import httpx
import logging
from typing import Optional
from datetime import datetime

from ..config import get_settings

logger = logging.getLogger(__name__)

# Sri Lanka coastal points for marine data
COASTAL_POINTS = [
    {"name": "Colombo Coast", "district": "Colombo", "lat": 6.9271, "lon": 79.8612},
    {"name": "Galle Coast", "district": "Galle", "lat": 6.0535, "lon": 80.2210},
    {"name": "Matara Coast", "district": "Matara", "lat": 5.9549, "lon": 80.5550},
    {"name": "Hambantota Coast", "district": "Hambantota", "lat": 6.1241, "lon": 81.1185},
    {"name": "Trincomalee Coast", "district": "Trincomalee", "lat": 8.5874, "lon": 81.2152},
    {"name": "Batticaloa Coast", "district": "Batticaloa", "lat": 7.7310, "lon": 81.6747},
    {"name": "Jaffna Coast", "district": "Jaffna", "lat": 9.6615, "lon": 80.0255},
    {"name": "Mannar Coast", "district": "Mannar", "lat": 8.9810, "lon": 79.9044},
    {"name": "Puttalam Coast", "district": "Puttalam", "lat": 8.0362, "lon": 79.8283},
    {"name": "Kalutara Coast", "district": "Kalutara", "lat": 6.5854, "lon": 79.9607},
    {"name": "Negombo Coast", "district": "Gampaha", "lat": 7.2008, "lon": 79.8358},
    {"name": "Ampara Coast", "district": "Ampara", "lat": 7.2833, "lon": 81.6747},
    {"name": "Mullaitivu Coast", "district": "Mullaitivu", "lat": 9.2671, "lon": 80.8142},
    {"name": "Kilinochchi Coast", "district": "Kilinochchi", "lat": 9.3803, "lon": 80.3770},
]


class MarineCondition:
    """Represents marine weather conditions"""
    def __init__(
        self,
        location: str,
        district: str,
        lat: float,
        lon: float,
        wave_height_m: float,
        wave_direction: int,
        wave_period_s: float,
        wind_wave_height_m: float,
        swell_wave_height_m: float,
        sea_surface_temp_c: Optional[float],
        risk_level: str,
        risk_factors: list[str],
    ):
        self.location = location
        self.district = district
        self.lat = lat
        self.lon = lon
        self.wave_height_m = wave_height_m
        self.wave_direction = wave_direction
        self.wave_period_s = wave_period_s
        self.wind_wave_height_m = wind_wave_height_m
        self.swell_wave_height_m = swell_wave_height_m
        self.sea_surface_temp_c = sea_surface_temp_c
        self.risk_level = risk_level
        self.risk_factors = risk_factors

    def to_dict(self) -> dict:
        return {
            "location": self.location,
            "district": self.district,
            "lat": self.lat,
            "lon": self.lon,
            "wave_height_m": self.wave_height_m,
            "wave_direction": self.wave_direction,
            "wave_period_s": self.wave_period_s,
            "wind_wave_height_m": self.wind_wave_height_m,
            "swell_wave_height_m": self.swell_wave_height_m,
            "sea_surface_temp_c": self.sea_surface_temp_c,
            "risk_level": self.risk_level,
            "risk_factors": self.risk_factors,
        }


def calculate_coastal_risk(wave_height: float, swell_height: float) -> tuple[str, list[str]]:
    """Calculate coastal flood risk based on wave conditions"""
    factors = []
    score = 0

    # Wave height risk
    if wave_height >= 4.0:
        factors.append(f"Dangerous waves: {wave_height:.1f}m")
        score += 40
    elif wave_height >= 2.5:
        factors.append(f"High waves: {wave_height:.1f}m")
        score += 25
    elif wave_height >= 1.5:
        factors.append(f"Moderate waves: {wave_height:.1f}m")
        score += 10

    # Swell risk
    if swell_height >= 3.0:
        factors.append(f"Large swell: {swell_height:.1f}m")
        score += 30
    elif swell_height >= 2.0:
        factors.append(f"Moderate swell: {swell_height:.1f}m")
        score += 15

    # Combined effect
    total_height = wave_height + swell_height
    if total_height >= 5.0:
        factors.append(f"Combined sea state dangerous")
        score += 20

    # Determine risk level
    if score >= 50:
        risk_level = "high"
    elif score >= 25:
        risk_level = "medium"
    else:
        risk_level = "low"

    return risk_level, factors


class MarineWeatherService:
    """Service for fetching marine weather from Open-Meteo"""

    def __init__(self):
        self.settings = get_settings()
        self._cache: list[dict] = []
        self._last_fetch: Optional[datetime] = None
        self._cache_duration_seconds = 1800  # 30 minutes

    async def fetch_marine_data(self, lat: float, lon: float) -> Optional[dict]:
        """Fetch marine data for a specific location"""
        try:
            url = self.settings.open_meteo_marine_url
            params = {
                "latitude": lat,
                "longitude": lon,
                "current": [
                    "wave_height",
                    "wave_direction",
                    "wave_period",
                    "wind_wave_height",
                    "swell_wave_height",
                ],
                "hourly": [
                    "wave_height",
                    "swell_wave_height",
                ],
                "forecast_days": 3,
                "timezone": "Asia/Colombo",
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                current = data.get("current", {})
                hourly = data.get("hourly", {})

                # Get max wave height in next 24 hours
                wave_heights = hourly.get("wave_height", [])[:24]
                swell_heights = hourly.get("swell_wave_height", [])[:24]
                max_wave_24h = max(wave_heights) if wave_heights else 0
                max_swell_24h = max(swell_heights) if swell_heights else 0

                return {
                    "wave_height_m": current.get("wave_height", 0),
                    "wave_direction": current.get("wave_direction", 0),
                    "wave_period_s": current.get("wave_period", 0),
                    "wind_wave_height_m": current.get("wind_wave_height", 0),
                    "swell_wave_height_m": current.get("swell_wave_height", 0),
                    "max_wave_24h_m": max_wave_24h,
                    "max_swell_24h_m": max_swell_24h,
                }

        except Exception as e:
            logger.error(f"Failed to fetch marine data for {lat}, {lon}: {e}")
            return None

    async def fetch_all_coastal_data(self) -> list[dict]:
        """Fetch marine data for all Sri Lanka coastal points"""
        results = []

        for point in COASTAL_POINTS:
            data = await self.fetch_marine_data(point["lat"], point["lon"])

            if data:
                wave_height = data.get("wave_height_m", 0)
                swell_height = data.get("swell_wave_height_m", 0)
                risk_level, risk_factors = calculate_coastal_risk(wave_height, swell_height)

                condition = MarineCondition(
                    location=point["name"],
                    district=point["district"],
                    lat=point["lat"],
                    lon=point["lon"],
                    wave_height_m=wave_height,
                    wave_direction=data.get("wave_direction", 0),
                    wave_period_s=data.get("wave_period_s", 0),
                    wind_wave_height_m=data.get("wind_wave_height_m", 0),
                    swell_wave_height_m=swell_height,
                    sea_surface_temp_c=None,  # Not available in free tier
                    risk_level=risk_level,
                    risk_factors=risk_factors,
                )
                results.append(condition.to_dict())

        self._cache = results
        self._last_fetch = datetime.utcnow()

        logger.info(f"Fetched marine data for {len(results)} coastal points")
        return results

    def get_cached_data(self) -> list[dict]:
        """Get cached marine data"""
        return self._cache

    def is_cache_valid(self) -> bool:
        """Check if cache is still valid"""
        if not self._last_fetch:
            return False
        elapsed = (datetime.utcnow() - self._last_fetch).total_seconds()
        return elapsed < self._cache_duration_seconds

    def get_summary(self) -> dict:
        """Get summary of coastal conditions"""
        if not self._cache:
            return {"total": 0, "high_risk": 0, "medium_risk": 0, "low_risk": 0}

        high = sum(1 for c in self._cache if c["risk_level"] == "high")
        medium = sum(1 for c in self._cache if c["risk_level"] == "medium")
        low = sum(1 for c in self._cache if c["risk_level"] == "low")

        return {
            "total": len(self._cache),
            "high_risk": high,
            "medium_risk": medium,
            "low_risk": low,
            "max_wave_height": max((c["wave_height_m"] for c in self._cache), default=0),
        }


# Singleton instance
marine_service = MarineWeatherService()
