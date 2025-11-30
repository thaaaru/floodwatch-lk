from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timedelta
import json
import os

from ..database import get_db
from ..models import WeatherLog
from ..schemas import DistrictInfo
from ..config import get_settings

router = APIRouter(prefix="/api/districts", tags=["districts"])

settings = get_settings()


def load_districts() -> dict:
    """Load district data from JSON file."""
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "districts.json")
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_alert_level(rainfall_mm: float) -> str:
    """Determine alert level based on rainfall."""
    if rainfall_mm >= settings.threshold_red:
        return "red"
    elif rainfall_mm >= settings.threshold_orange:
        return "orange"
    elif rainfall_mm >= settings.threshold_yellow:
        return "yellow"
    return "green"


@router.get("", response_model=list[DistrictInfo])
async def get_districts(db: Session = Depends(get_db)):
    """Get list of all monitored districts with their current status."""
    district_data = load_districts()
    result = []

    for district in district_data["districts"]:
        # Get latest weather log for this district
        latest_log = db.query(WeatherLog).filter(
            WeatherLog.district == district["name"],
            WeatherLog.recorded_at >= datetime.utcnow() - timedelta(hours=24)
        ).order_by(WeatherLog.recorded_at.desc()).first()

        rainfall = float(latest_log.rainfall_mm) if latest_log and latest_log.rainfall_mm else 0.0

        result.append(DistrictInfo(
            name=district["name"],
            latitude=district["latitude"],
            longitude=district["longitude"],
            current_alert_level=get_alert_level(rainfall),
            rainfall_24h_mm=rainfall
        ))

    return result


@router.get("/{district_name}", response_model=DistrictInfo)
async def get_district(district_name: str, db: Session = Depends(get_db)):
    """Get information for a specific district."""
    district_data = load_districts()
    district = next(
        (d for d in district_data["districts"] if d["name"].lower() == district_name.lower()),
        None
    )

    if not district:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"District '{district_name}' not found")

    # Get latest weather log
    latest_log = db.query(WeatherLog).filter(
        WeatherLog.district == district["name"],
        WeatherLog.recorded_at >= datetime.utcnow() - timedelta(hours=24)
    ).order_by(WeatherLog.recorded_at.desc()).first()

    rainfall = float(latest_log.rainfall_mm) if latest_log and latest_log.rainfall_mm else 0.0

    return DistrictInfo(
        name=district["name"],
        latitude=district["latitude"],
        longitude=district["longitude"],
        current_alert_level=get_alert_level(rainfall),
        rainfall_24h_mm=rainfall
    )
