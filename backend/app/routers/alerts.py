from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from ..database import get_db
from ..models import AlertHistory
from ..schemas import AlertResponse
from ..services.weather_cache import weather_cache

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
async def get_active_alerts(
    district: Optional[str] = None,
    level: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get active flood alerts. Alerts from the last 24 hours are considered active."""
    query = db.query(AlertHistory).filter(
        AlertHistory.sent_at >= datetime.utcnow() - timedelta(hours=24)
    )

    if district:
        query = query.filter(AlertHistory.district == district)

    if level:
        query = query.filter(AlertHistory.alert_level == level)

    alerts = query.order_by(AlertHistory.sent_at.desc()).all()
    return alerts


@router.get("/history", response_model=list[AlertResponse])
async def get_alert_history(
    district: Optional[str] = None,
    level: Optional[str] = None,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    """Get historical alerts with filtering options."""
    query = db.query(AlertHistory)

    if district:
        query = query.filter(AlertHistory.district == district)

    if level:
        query = query.filter(AlertHistory.alert_level == level)

    if start_date:
        query = query.filter(AlertHistory.sent_at >= start_date)

    if end_date:
        query = query.filter(AlertHistory.sent_at <= end_date)

    alerts = query.order_by(AlertHistory.sent_at.desc()).offset(offset).limit(limit).all()
    return alerts


@router.get("/count")
async def get_alert_counts(
    days: int = Query(7, le=365),
    db: Session = Depends(get_db)
):
    """Get alert counts by level for the specified number of days."""
    from sqlalchemy import func

    cutoff = datetime.utcnow() - timedelta(days=days)

    counts = db.query(
        AlertHistory.alert_level,
        func.count(AlertHistory.id).label("count")
    ).filter(
        AlertHistory.sent_at >= cutoff
    ).group_by(AlertHistory.alert_level).all()

    return {
        "period_days": days,
        "counts": {level: count for level, count in counts}
    }


@router.get("/forecast")
async def get_forecast_alerts():
    """
    Get predicted alerts based on 5-day weather forecast.
    Returns locations that are expected to exceed alert thresholds.
    """
    if not weather_cache.is_cache_valid():
        await weather_cache.refresh_cache()

    forecast_data = weather_cache.get_all_forecast()
    forecast_alerts = []

    for district in forecast_data:
        for day in district.get("forecast_daily", []):
            alert_level = day.get("forecast_alert_level", "green")
            if alert_level != "green":
                forecast_alerts.append({
                    "district": district["district"],
                    "date": day["date"],
                    "day_name": day["day_name"],
                    "alert_level": alert_level,
                    "predicted_rainfall_mm": day["total_rainfall_mm"],
                    "precipitation_probability": day["max_precipitation_probability"],
                    "message": _get_forecast_message(alert_level, day["total_rainfall_mm"], day["day_name"]),
                    "source": "forecast"
                })

    # Sort by date and then by severity
    level_order = {"red": 0, "orange": 1, "yellow": 2}
    forecast_alerts.sort(key=lambda x: (x["date"], level_order.get(x["alert_level"], 3)))

    return forecast_alerts


def _get_forecast_message(level: str, rainfall: float, day_name: str) -> str:
    """Generate a human-readable forecast alert message."""
    if level == "red":
        return f"EMERGENCY: Heavy rainfall ({rainfall:.0f}mm) expected on {day_name}. High flood risk."
    elif level == "orange":
        return f"WARNING: Significant rainfall ({rainfall:.0f}mm) expected on {day_name}. Moderate flood risk."
    elif level == "yellow":
        return f"WATCH: Above normal rainfall ({rainfall:.0f}mm) expected on {day_name}. Be prepared."
    return f"Normal conditions expected on {day_name}."
