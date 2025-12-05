import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..services.alert_engine import AlertEngine
from ..services.weather_cache import weather_cache
from ..services.intel_engine import intel_engine
from ..services.osm_facilities import fetch_all_facilities
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = AsyncIOScheduler()

WEATHER_CACHE_INTERVAL_MINUTES = 60  # Refresh every 60 minutes to minimize API calls
INTEL_ANALYSIS_INTERVAL_MINUTES = 30  # Reduced to minimize API load
FACILITIES_REFRESH_INTERVAL_HOURS = 24  # Daily refresh for OSM facilities


async def refresh_weather_cache():
    """Background job to refresh weather data cache."""
    logger.info("Starting weather cache refresh...")
    try:
        success = await weather_cache.refresh_cache(force=True)
        if success:
            logger.info("Weather cache refreshed successfully")
        else:
            logger.warning("Weather cache refresh failed")
    except Exception as e:
        logger.error(f"Error refreshing weather cache: {e}")


async def check_weather_and_alerts():
    """Background job to check weather conditions and trigger alerts."""
    logger.info("Starting weather and alerts check...")

    db: Session = SessionLocal()
    try:
        engine = AlertEngine(db)

        # Check weather for all districts
        weather_alerts = await engine.check_all_districts()
        logger.info(f"Weather check complete. {len(weather_alerts)} alerts triggered.")

        # Check GDACS for flood alerts
        gdacs_alerts = await engine.check_gdacs_alerts()
        logger.info(f"GDACS check complete. {len(gdacs_alerts)} alerts triggered.")

    except Exception as e:
        logger.error(f"Error in weather/alert check: {e}")
    finally:
        db.close()


async def refresh_intel_analysis():
    """Background job to refresh SOS intelligence analysis."""
    logger.info("Starting intelligence analysis refresh...")
    try:
        result = await intel_engine.run_analysis()
        summary = result.get("summary", {})
        logger.info(
            f"Intel analysis complete: {summary.get('total_reports', 0)} reports, "
            f"{summary.get('urgency_breakdown', {}).get('critical', 0)} critical"
        )
    except Exception as e:
        logger.error(f"Error in intel analysis: {e}")


async def refresh_osm_facilities():
    """Background job to refresh OpenStreetMap facilities cache."""
    logger.info("Starting OSM facilities refresh...")
    try:
        facilities = await fetch_all_facilities()
        total = sum(
            len(facilities.get(k, []))
            for k in ["hospitals", "police", "fire_stations", "shelters"]
        )
        logger.info(f"OSM facilities refreshed: {total} facilities cached")
    except Exception as e:
        logger.error(f"Error refreshing OSM facilities: {e}")


def start_scheduler():
    """Initialize and start the background scheduler."""
    interval_minutes = settings.alert_check_interval_minutes

    # Weather cache refresh job - every 30 minutes
    scheduler.add_job(
        refresh_weather_cache,
        trigger=IntervalTrigger(minutes=WEATHER_CACHE_INTERVAL_MINUTES),
        id="weather_cache_refresh",
        name="Refresh weather data cache",
        replace_existing=True
    )

    # Alert check job
    scheduler.add_job(
        check_weather_and_alerts,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="weather_alerts_check",
        name="Check weather and alerts",
        replace_existing=True
    )

    # Intel analysis job - every 15 minutes
    scheduler.add_job(
        refresh_intel_analysis,
        trigger=IntervalTrigger(minutes=INTEL_ANALYSIS_INTERVAL_MINUTES),
        id="intel_analysis_refresh",
        name="Refresh SOS intelligence analysis",
        replace_existing=True
    )

    # OSM facilities refresh - every 24 hours
    scheduler.add_job(
        refresh_osm_facilities,
        trigger=IntervalTrigger(hours=FACILITIES_REFRESH_INTERVAL_HOURS),
        id="osm_facilities_refresh",
        name="Refresh OpenStreetMap facilities cache",
        replace_existing=True
    )

    scheduler.start()
    logger.info(
        f"Scheduler started. Cache: {WEATHER_CACHE_INTERVAL_MINUTES}min, "
        f"Alerts: {interval_minutes}min, Intel: {INTEL_ANALYSIS_INTERVAL_MINUTES}min, "
        f"Facilities: {FACILITIES_REFRESH_INTERVAL_HOURS}h"
    )

    # Initial tasks on startup
    asyncio.get_event_loop().create_task(refresh_weather_cache())
    asyncio.get_event_loop().create_task(refresh_intel_analysis())
    asyncio.get_event_loop().create_task(refresh_osm_facilities())


def stop_scheduler():
    """Stop the background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped.")
