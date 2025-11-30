from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from ..database import get_db
from ..models import WeatherLog
from ..schemas import WeatherResponse, WeatherSummary
from ..services.districts_service import get_district_by_name, get_all_districts
from ..services.open_meteo import OpenMeteoService
from ..services.weather_cache import weather_cache
from ..config import get_settings

router = APIRouter(prefix="/api/weather", tags=["weather"])

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
    """
    if hours not in [24, 48, 72]:
        hours = 24

    # Ensure cache is populated (will only fetch if cache is expired or empty)
    if not weather_cache.is_cache_valid():
        await weather_cache.refresh_cache()

    # Return cached data
    return weather_cache.get_all_weather(hours)


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
