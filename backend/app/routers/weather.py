from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta, date
import json
import os
import asyncio

from ..database import get_db
from ..models import WeatherLog
from ..schemas import WeatherResponse, WeatherSummary
from ..services.districts_service import get_district_by_name, get_all_districts
from ..services.open_meteo import OpenMeteoService
from ..services.weather_cache import weather_cache
from ..config import get_settings

router = APIRouter(prefix="/api/weather", tags=["weather"])

# Cache file for yesterday's stats - persists across restarts
YESTERDAY_STATS_CACHE_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "cache", "yesterday_stats.json"
)

settings = get_settings()
weather_service = OpenMeteoService()  # Keep for individual district requests


def get_alert_level(rainfall_mm: float, hours: int = 24) -> str:
    """Determine alert level based on rainfall. Thresholds scale with time period."""
    # Scale thresholds based on hours (24h is base)
    scale = hours / 24
    if rainfall_mm >= settings.threshold_red * scale:
        return "red"
    elif rainfall_mm >= settings.threshold_orange * scale:
        return "orange"
    elif rainfall_mm >= settings.threshold_yellow * scale:
        return "yellow"
    return "green"


@router.get("/all")
async def get_all_weather(
    hours: int = Query(24, description="Rainfall period: 24, 48, or 72 hours"),
    db: Session = Depends(get_db)
):
    """
    Get weather summary for all districts. Used by the dashboard map.
    Data is cached and refreshed every 30 minutes to avoid API rate limits.
    Returns stale data immediately if available, triggers background refresh.
    """
    import asyncio

    if hours not in [24, 48, 72]:
        hours = 24

    # Check if we have any cached data (even if stale)
    cached_data = weather_cache.get_all_weather(hours)

    # If cache is invalid, trigger background refresh (don't wait)
    if not weather_cache.is_cache_valid():
        if cached_data:
            # Have stale data - return it immediately, refresh in background
            asyncio.create_task(weather_cache.refresh_cache())
            return cached_data
        else:
            # No cached data at all - must wait for refresh
            try:
                await weather_cache.refresh_cache()
                return weather_cache.get_all_weather(hours)
            except Exception as e:
                raise HTTPException(
                    status_code=503,
                    detail=f"Weather service unavailable and no cached data: {str(e)}"
                )

    # Return fresh cached data
    return cached_data


@router.get("/cache-status")
async def get_cache_status():
    """Get information about the weather data cache."""
    return weather_cache.get_cache_info()


@router.post("/refresh-cache")
async def refresh_cache():
    """Force refresh the weather cache. Use sparingly to avoid rate limits."""
    success = await weather_cache.refresh_cache(force=True)
    return {
        "success": success,
        "cache_info": weather_cache.get_cache_info()
    }


@router.get("/{district_name}", response_model=WeatherResponse)
async def get_district_weather(district_name: str, db: Session = Depends(get_db)):
    """Get detailed weather data for a specific district."""
    district = get_district_by_name(district_name)

    if not district:
        raise HTTPException(status_code=404, detail=f"District '{district_name}' not found")

    # First try to get from cache (especially when in freeze mode)
    cached_data = weather_cache.get_district_weather(district_name)
    if cached_data:
        rainfall_24h = cached_data.get("rainfall_24h_mm", 0.0)
        return WeatherResponse(
            district=district["name"],
            latitude=district["latitude"],
            longitude=district["longitude"],
            current_rainfall_mm=cached_data.get("current_rainfall_mm", 0.0),
            rainfall_24h_mm=rainfall_24h,
            temperature_c=cached_data.get("temperature_c"),
            humidity_percent=cached_data.get("humidity_percent"),
            forecast_24h=cached_data.get("forecast_24h", []),
            alert_level=get_alert_level(rainfall_24h),
            last_updated=datetime.utcnow()
        )

    # If not in cache, try to fetch (will fail if rate limited)
    try:
        weather_data = await weather_service.get_weather(
            district["latitude"],
            district["longitude"]
        )

        # Log weather data
        log = WeatherLog(
            district=district["name"],
            rainfall_mm=weather_data.get("rainfall_24h_mm", 0.0),
            temperature_c=weather_data.get("temperature_c"),
            humidity_percent=weather_data.get("humidity_percent")
        )
        db.add(log)
        db.commit()

        rainfall_24h = weather_data.get("rainfall_24h_mm", 0.0)

        return WeatherResponse(
            district=district["name"],
            latitude=district["latitude"],
            longitude=district["longitude"],
            current_rainfall_mm=weather_data.get("current_rainfall_mm", 0.0),
            rainfall_24h_mm=rainfall_24h,
            temperature_c=weather_data.get("temperature_c"),
            humidity_percent=weather_data.get("humidity_percent"),
            forecast_24h=weather_data.get("forecast_24h", []),
            alert_level=get_alert_level(rainfall_24h),
            last_updated=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Weather service unavailable: {str(e)}")


@router.get("/forecast/all")
async def get_all_forecast(
    db: Session = Depends(get_db)
):
    """
    Get 5-day forecast for all districts.
    Data is extracted from the cached weather data.
    """
    if not weather_cache.is_cache_valid():
        await weather_cache.refresh_cache()

    return weather_cache.get_all_forecast()


def _load_yesterday_stats_cache():
    """Load cached yesterday stats if valid for today."""
    try:
        if os.path.exists(YESTERDAY_STATS_CACHE_FILE):
            with open(YESTERDAY_STATS_CACHE_FILE, "r") as f:
                cached = json.load(f)
            # Check if cache is for yesterday's date
            yesterday_str = (date.today() - timedelta(days=1)).isoformat()
            if cached.get("date") == yesterday_str:
                return cached
    except Exception:
        pass
    return None


def _save_yesterday_stats_cache(stats: dict):
    """Save yesterday stats to cache file."""
    try:
        os.makedirs(os.path.dirname(YESTERDAY_STATS_CACHE_FILE), exist_ok=True)
        with open(YESTERDAY_STATS_CACHE_FILE, "w") as f:
            json.dump(stats, f)
    except Exception:
        pass


@router.get("/yesterday/stats")
async def get_yesterday_stats():
    """
    Get yesterday's weather statistics for all districts.
    Uses Open-Meteo historical API to fetch data from yesterday.
    Results are cached for the entire day since yesterday's data won't change.
    Returns summary with total rainfall, districts with rain, max rainfall, etc.
    """
    import httpx

    # Check cache first - yesterday's data doesn't change
    cached_stats = _load_yesterday_stats_cache()
    if cached_stats:
        return cached_stats

    yesterday = date.today() - timedelta(days=1)
    yesterday_str = yesterday.isoformat()

    districts = get_all_districts()

    stats = {
        "date": yesterday_str,
        "total_districts": len(districts),
        "districts_with_rain": 0,
        "total_rainfall_mm": 0.0,
        "avg_rainfall_mm": 0.0,
        "max_rainfall_mm": 0.0,
        "max_rainfall_district": None,
        "heavy_rain_districts": [],  # >50mm
        "moderate_rain_districts": [],  # 25-50mm
        "light_rain_districts": [],  # >0 and <25mm
        "dry_districts": [],  # 0mm
        "district_data": []
    }

    async def fetch_district_data(client: httpx.AsyncClient, district: dict):
        """Fetch weather data for a single district."""
        try:
            # Use forecast API with past_days for better recent data coverage
            params = {
                "latitude": district["latitude"],
                "longitude": district["longitude"],
                "past_days": 1,  # Get yesterday's data
                "daily": "precipitation_sum,rain_sum,temperature_2m_max,temperature_2m_min",
                "timezone": "Asia/Colombo"
            }

            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params=params,
                timeout=30.0  # Per-request timeout
            )

            if resp.status_code == 200:
                data = resp.json()
                daily = data.get("daily", {})
                if daily and len(daily.get("precipitation_sum", [])) > 0:
                    precip = daily.get("precipitation_sum", [0])[0] or 0
                    rain = daily.get("rain_sum", [0])[0] or 0
                    rainfall = max(precip, rain)
                    temp_max = daily.get("temperature_2m_max", [None])[0]
                    temp_min = daily.get("temperature_2m_min", [None])[0]

                    return {
                        "district": district["name"],
                        "rainfall_mm": round(rainfall, 1),
                        "temp_max_c": round(temp_max, 1) if temp_max else None,
                        "temp_min_c": round(temp_min, 1) if temp_min else None
                    }
        except Exception as e:
            # Silently fail but log to console for debugging
            print(f"Failed to fetch data for {district.get('name', 'unknown')}: {str(e)[:50]}")
        return None

    # Fetch all districts in batches to avoid rate limiting
    batch_size = 25  # Process 25 districts at a time
    results = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        for i in range(0, len(districts), batch_size):
            batch = districts[i:i + batch_size]
            tasks = [fetch_district_data(client, d) for d in batch]
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)
            # Small delay between batches to avoid rate limiting
            if i + batch_size < len(districts):
                await asyncio.sleep(0.5)

    # Process results
    for district_info in results:
        if district_info is None:
            continue

        stats["district_data"].append(district_info)
        rainfall = district_info["rainfall_mm"]

        stats["total_rainfall_mm"] += rainfall

        if rainfall > 0:
            stats["districts_with_rain"] += 1

        if rainfall > stats["max_rainfall_mm"]:
            stats["max_rainfall_mm"] = rainfall
            stats["max_rainfall_district"] = district_info["district"]

        if rainfall >= 50:
            stats["heavy_rain_districts"].append({
                "district": district_info["district"],
                "rainfall_mm": rainfall
            })
        elif rainfall >= 25:
            stats["moderate_rain_districts"].append({
                "district": district_info["district"],
                "rainfall_mm": rainfall
            })
        elif rainfall > 0:
            stats["light_rain_districts"].append({
                "district": district_info["district"],
                "rainfall_mm": rainfall
            })
        else:
            stats["dry_districts"].append(district_info["district"])

    # Calculate averages
    if stats["district_data"]:
        stats["avg_rainfall_mm"] = round(
            stats["total_rainfall_mm"] / len(stats["district_data"]), 1
        )

    stats["total_rainfall_mm"] = round(stats["total_rainfall_mm"], 1)
    stats["max_rainfall_mm"] = round(stats["max_rainfall_mm"], 1)

    # Sort district data by rainfall (descending)
    stats["district_data"].sort(key=lambda x: x["rainfall_mm"], reverse=True)
    stats["heavy_rain_districts"].sort(key=lambda x: x["rainfall_mm"], reverse=True)
    stats["moderate_rain_districts"].sort(key=lambda x: x["rainfall_mm"], reverse=True)

    # Cache the results for the rest of the day
    _save_yesterday_stats_cache(stats)

    return stats


@router.get("/{district_name}/history")
async def get_weather_history(
    district_name: str,
    days: int = Query(7, le=30),
    db: Session = Depends(get_db)
):
    """Get historical weather data for a district."""
    district = get_district_by_name(district_name)

    if not district:
        raise HTTPException(status_code=404, detail=f"District '{district_name}' not found")

    cutoff = datetime.utcnow() - timedelta(days=days)

    logs = db.query(WeatherLog).filter(
        WeatherLog.district == district["name"],
        WeatherLog.recorded_at >= cutoff
    ).order_by(WeatherLog.recorded_at.asc()).all()

    return {
        "district": district["name"],
        "period_days": days,
        "data": [
            {
                "rainfall_mm": float(log.rainfall_mm) if log.rainfall_mm else 0.0,
                "temperature_c": float(log.temperature_c) if log.temperature_c else None,
                "humidity_percent": log.humidity_percent,
                "recorded_at": log.recorded_at.isoformat()
            }
            for log in logs
        ]
    }
