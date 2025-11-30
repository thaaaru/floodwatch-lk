"""
Intelligence API Router
Provides automated actionable intelligence for damage control
"""
from fastapi import APIRouter, Query, BackgroundTasks
from typing import Optional

from ..services.intel_engine import intel_engine
from ..services.sos_fetcher import sos_fetcher
from ..services.river_fetcher import river_fetcher
from ..services.osm_facilities import (
    fetch_all_facilities,
    find_nearby_facilities,
    get_nearest_hospital,
    get_facilities_summary,
    refresh_facilities_cache,
)
from ..services.weatherapi_alerts import weatherapi_service
from ..services.marine_weather import marine_service

router = APIRouter(prefix="/api/intel", tags=["intelligence"])


@router.get("/priorities")
async def get_priorities(
    limit: int = Query(50, le=200, description="Max number of reports"),
    district: Optional[str] = Query(None, description="Filter by district"),
    urgency: Optional[str] = Query(None, description="Filter by urgency tier: CRITICAL, HIGH, MEDIUM, LOW"),
):
    """
    Get priority-ranked emergency reports.

    Returns reports sorted by urgency score (0-100).
    Higher score = more urgent = needs immediate attention.

    Urgency factors:
    - Water level (ROOF=40, NECK=35, CHEST=25, WAIST=15, ANKLE=5)
    - Vulnerable people (medical=15, disabled=8, elderly=5, children=2)
    - Time pressure (safe_hours <= 1 = 20 points)
    - People count (up to 10 points)
    - Resource scarcity (no food=3, no water=5)
    - Weather escalation (forecast rain >100mm = 15 points)
    """
    # Run fresh analysis if cache is empty
    if not intel_engine.get_priorities():
        await intel_engine.run_analysis()

    reports = intel_engine.get_priorities(limit=200)

    # Apply filters
    if district:
        reports = [r for r in reports if r.get("district", "").lower() == district.lower()]

    if urgency:
        reports = [r for r in reports if r.get("urgency_tier", "").upper() == urgency.upper()]

    return {
        "count": len(reports[:limit]),
        "reports": reports[:limit],
    }


@router.get("/clusters")
async def get_clusters(
    district: Optional[str] = Query(None, description="Filter by district"),
):
    """
    Get geographic clusters of emergencies.

    Clusters group nearby emergencies (within 2km) for efficient rescue routing.
    Each cluster includes:
    - Total people affected
    - Urgency breakdown (critical/high/medium/low)
    - Centroid coordinates for navigation
    - Vulnerability summary
    """
    if not intel_engine.get_clusters():
        await intel_engine.run_analysis()

    clusters = intel_engine.get_clusters()

    if district:
        clusters = [
            c for c in clusters
            if district.lower() in [d.lower() for d in c.get("districts", [])]
        ]

    return {
        "count": len(clusters),
        "clusters": clusters,
    }


@router.get("/summary")
async def get_summary():
    """
    Get overall intelligence summary.

    Provides:
    - Total reports and people affected
    - Urgency breakdown across all reports
    - Resource needs (food, water, medical)
    - Vulnerability counts
    - Most affected districts ranked by severity
    - Weather risk overlay per district
    """
    if not intel_engine.get_summary():
        await intel_engine.run_analysis()

    return intel_engine.get_summary()


@router.get("/district/{district}")
async def get_district_intel(district: str):
    """
    Get detailed intelligence for a specific district.

    Includes all reports, clusters, and summary stats for the district.
    """
    if not intel_engine.get_priorities():
        await intel_engine.run_analysis()

    return intel_engine.get_district_intel(district)


@router.post("/refresh")
async def refresh_analysis(background_tasks: BackgroundTasks):
    """
    Trigger immediate analysis refresh.

    Normally runs automatically every 5 minutes.
    Use this endpoint to force an immediate update.
    """
    await intel_engine.run_analysis()

    return {
        "status": "refreshed",
        "summary": intel_engine.get_summary(),
    }


@router.get("/raw-sos")
async def get_raw_sos(
    limit: int = Query(100, le=200),
):
    """
    Get raw SOS data from floodsupport.org (for debugging).
    """
    reports = await sos_fetcher.fetch_sos_reports(limit=limit)
    return {
        "count": len(reports),
        "reports": reports,
    }


@router.get("/actions")
async def get_recommended_actions():
    """
    Get automated action recommendations based on current intelligence.

    Returns prioritized list of actions that should be taken.
    """
    if not intel_engine.get_summary():
        await intel_engine.run_analysis()

    summary = intel_engine.get_summary()
    priorities = intel_engine.get_priorities(limit=100)
    clusters = intel_engine.get_clusters()

    actions = []

    # Action 1: Critical cases needing immediate rescue
    critical = [p for p in priorities if p.get("urgency_tier") == "CRITICAL"]
    if critical:
        actions.append({
            "priority": 1,
            "action": "IMMEDIATE_RESCUE",
            "description": f"Deploy rescue teams to {len(critical)} CRITICAL cases immediately",
            "targets": [
                {
                    "id": c["id"],
                    "location": c.get("address") or c.get("district"),
                    "people": c.get("number_of_people"),
                    "water_level": c.get("water_level"),
                    "contact": c.get("phone"),
                }
                for c in critical[:10]
            ],
        })

    # Action 2: Medical emergencies
    medical = [p for p in priorities if p.get("has_medical_emergency")]
    if medical:
        actions.append({
            "priority": 2,
            "action": "MEDICAL_RESPONSE",
            "description": f"Dispatch medical teams to {len(medical)} cases with medical emergencies",
            "targets": [
                {
                    "id": m["id"],
                    "location": m.get("address") or m.get("district"),
                    "people": m.get("number_of_people"),
                    "contact": m.get("phone"),
                }
                for m in medical[:10]
            ],
        })

    # Action 3: Food and water distribution
    needs_supplies = summary.get("resource_needs", {})
    if needs_supplies.get("needs_water", 0) > 0 or needs_supplies.get("needs_food", 0) > 0:
        # Find districts with most supply needs
        districts_needing = sorted(
            summary.get("most_affected_districts", []),
            key=lambda d: d.get("needs_water", 0) + d.get("needs_food", 0),
            reverse=True
        )[:5]

        actions.append({
            "priority": 3,
            "action": "SUPPLY_DISTRIBUTION",
            "description": f"Distribute supplies: {needs_supplies.get('needs_water', 0)} need water, {needs_supplies.get('needs_food', 0)} need food",
            "targets": [
                {
                    "district": d["district"],
                    "needs_water": d.get("needs_water", 0),
                    "needs_food": d.get("needs_food", 0),
                    "total_people": d.get("total_people", 0),
                }
                for d in districts_needing
            ],
        })

    # Action 4: Cluster-based rescue operations
    high_urgency_clusters = [c for c in clusters if c.get("avg_urgency", 0) >= 50]
    if high_urgency_clusters:
        actions.append({
            "priority": 4,
            "action": "CLUSTER_RESCUE",
            "description": f"Coordinate rescue operations for {len(high_urgency_clusters)} high-urgency clusters",
            "targets": [
                {
                    "cluster_id": c["cluster_id"],
                    "name": c["name"],
                    "report_count": c["report_count"],
                    "total_people": c["total_people"],
                    "centroid": c["centroid"],
                    "critical_count": c.get("critical_count", 0),
                }
                for c in high_urgency_clusters[:5]
            ],
        })

    # Action 5: Weather escalation warnings
    escalating_districts = [
        d for d in summary.get("most_affected_districts", [])
        if d.get("forecast_rain_24h", 0) > 50
    ]
    if escalating_districts:
        actions.append({
            "priority": 5,
            "action": "WEATHER_ALERT",
            "description": f"Issue warnings for {len(escalating_districts)} districts expecting >50mm rain in 24hrs",
            "targets": [
                {
                    "district": d["district"],
                    "forecast_rain_24h": d.get("forecast_rain_24h", 0),
                    "current_cases": d.get("count", 0),
                }
                for d in escalating_districts
            ],
        })

    return {
        "generated_at": summary.get("analyzed_at"),
        "total_actions": len(actions),
        "actions": actions,
    }


# ============================================================
# Emergency Facilities Endpoints (OpenStreetMap Data)
# ============================================================

@router.get("/facilities")
async def get_all_facilities():
    """
    Get all emergency facilities in Sri Lanka from OpenStreetMap.

    Includes:
    - Hospitals
    - Police stations
    - Fire stations
    - Emergency shelters

    Data is cached for 24 hours and refreshed automatically.
    """
    facilities = await fetch_all_facilities()
    summary = get_facilities_summary()

    return {
        "hospitals": facilities.get("hospitals", []),
        "police": facilities.get("police", []),
        "fire_stations": facilities.get("fire_stations", []),
        "shelters": facilities.get("shelters", []),
        "summary": summary,
        "last_updated": facilities.get("last_updated").isoformat() if facilities.get("last_updated") else None,
    }


@router.get("/facilities/nearby")
async def get_nearby_facilities(
    lat: float = Query(..., description="Latitude of the location"),
    lon: float = Query(..., description="Longitude of the location"),
    radius_km: float = Query(10.0, description="Search radius in kilometers"),
    limit_per_type: int = Query(3, le=10, description="Max facilities per type"),
):
    """
    Find emergency facilities near a specific location.

    Returns the nearest hospitals, police stations, fire stations,
    and shelters within the specified radius.

    Useful for:
    - Finding nearest hospital for medical emergencies
    - Locating shelter options for evacuees
    - Coordinating with nearby police/fire stations
    """
    # Ensure facilities cache is populated
    await fetch_all_facilities()

    nearby = find_nearby_facilities(
        lat=lat,
        lon=lon,
        radius_km=radius_km,
        limit_per_type=limit_per_type,
    )

    total = sum(len(v) for v in nearby.values())

    return {
        "location": {"latitude": lat, "longitude": lon},
        "radius_km": radius_km,
        "total_found": total,
        **nearby,
    }


@router.get("/facilities/nearest-hospital")
async def get_nearest_hospital_endpoint(
    lat: float = Query(..., description="Latitude of the location"),
    lon: float = Query(..., description="Longitude of the location"),
):
    """
    Get the single nearest hospital to a location.

    Quick lookup for emergency medical response.
    """
    # Ensure facilities cache is populated
    await fetch_all_facilities()

    hospital = get_nearest_hospital(lat, lon)

    if hospital:
        return {
            "found": True,
            "hospital": hospital,
        }
    else:
        return {
            "found": False,
            "message": "No hospitals in cache. Try refreshing facilities data.",
        }


@router.post("/facilities/refresh")
async def refresh_facilities():
    """
    Force refresh the facilities cache from OpenStreetMap.

    Normally refreshed automatically every 24 hours.
    Use this to get the latest data immediately.
    """
    facilities = await refresh_facilities_cache()
    summary = get_facilities_summary()

    return {
        "status": "refreshed",
        "summary": summary,
        "last_updated": facilities.get("last_updated").isoformat() if facilities.get("last_updated") else None,
    }


# ============================================================
# River Water Level Endpoints (Sri Lanka Navy Flood Monitoring)
# ============================================================

@router.get("/rivers")
async def get_river_levels():
    """
    Get real-time river water levels from Sri Lanka Navy flood monitoring system.

    Returns data from 45+ gauging stations across major rivers including:
    - Current water level (meters)
    - Water level 1 hour ago
    - Water level at 9am
    - 24-hour rainfall (mm)
    - Station status: normal, alert, rising, falling

    Data is cached for 5 minutes and sourced from https://floodms.navy.lk
    """
    if not river_fetcher.is_cache_valid():
        await river_fetcher.fetch_river_levels()

    stations = river_fetcher.get_cached_data()

    # Calculate summary stats
    status_counts = {"normal": 0, "alert": 0, "rising": 0, "falling": 0, "unknown": 0}
    for station in stations:
        status = station.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1

    return {
        "count": len(stations),
        "summary": {
            "normal": status_counts["normal"],
            "alert": status_counts["alert"],
            "rising": status_counts["rising"],
            "falling": status_counts["falling"],
        },
        "stations": stations,
    }


@router.post("/rivers/refresh")
async def refresh_river_levels():
    """
    Force refresh river water level data from Navy flood monitoring.

    Normally cached for 5 minutes. Use this to get immediate update.
    """
    stations = await river_fetcher.fetch_river_levels()

    status_counts = {"normal": 0, "alert": 0, "rising": 0, "falling": 0, "unknown": 0}
    for station in stations:
        status = station.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1

    return {
        "status": "refreshed",
        "count": len(stations),
        "summary": {
            "normal": status_counts["normal"],
            "alert": status_counts["alert"],
            "rising": status_counts["rising"],
            "falling": status_counts["falling"],
        },
    }


# ============================================================
# Weather Alerts Endpoints (WeatherAPI.com)
# ============================================================

@router.get("/weather-alerts")
async def get_weather_alerts():
    """
    Get official weather alerts for Sri Lanka from WeatherAPI.com.

    Returns active weather warnings including:
    - Flood warnings
    - Storm warnings
    - Heavy rain alerts
    - Cyclone advisories

    Data is cached for 15 minutes.
    """
    if not weatherapi_service.is_cache_valid():
        await weatherapi_service.fetch_all_alerts()

    alerts = weatherapi_service.get_cached_alerts()

    # Group by severity
    severity_counts = {"Extreme": 0, "Severe": 0, "Moderate": 0, "Minor": 0, "Unknown": 0}
    for alert in alerts:
        severity = alert.get("severity", "Unknown")
        severity_counts[severity] = severity_counts.get(severity, 0) + 1

    return {
        "count": len(alerts),
        "summary": {
            "extreme": severity_counts.get("Extreme", 0),
            "severe": severity_counts.get("Severe", 0),
            "moderate": severity_counts.get("Moderate", 0),
            "minor": severity_counts.get("Minor", 0),
        },
        "alerts": alerts,
    }


@router.post("/weather-alerts/refresh")
async def refresh_weather_alerts():
    """
    Force refresh weather alerts from WeatherAPI.com.

    Normally cached for 15 minutes. Use this to get immediate update.
    """
    alerts = await weatherapi_service.fetch_all_alerts()

    severity_counts = {"Extreme": 0, "Severe": 0, "Moderate": 0, "Minor": 0}
    for alert in alerts:
        severity = alert.get("severity", "Unknown")
        if severity in severity_counts:
            severity_counts[severity] += 1

    return {
        "status": "refreshed",
        "count": len(alerts),
        "summary": severity_counts,
    }


@router.get("/weather-alerts/location")
async def get_weather_for_location(
    location: str = Query(..., description="Location query (e.g., 'Colombo,Sri Lanka')"),
):
    """
    Get current weather and alerts for a specific location.

    Returns current conditions plus any active alerts.
    """
    weather = await weatherapi_service.fetch_current_weather(location)

    if weather:
        return weather
    else:
        return {"error": "Failed to fetch weather data", "location": location}


# ============================================================
# Marine Weather Endpoints (Open-Meteo Marine)
# ============================================================

@router.get("/marine")
async def get_marine_conditions():
    """
    Get marine/coastal weather conditions for Sri Lanka.

    Returns wave heights, swell conditions, and coastal flood risk for
    all major coastal districts. Useful for:
    - Storm surge warnings
    - Coastal flooding assessment
    - Maritime safety advisories

    Data is cached for 30 minutes from Open-Meteo Marine API.
    """
    if not marine_service.is_cache_valid():
        await marine_service.fetch_all_coastal_data()

    conditions = marine_service.get_cached_data()
    summary = marine_service.get_summary()

    return {
        "count": len(conditions),
        "summary": summary,
        "conditions": conditions,
    }


@router.post("/marine/refresh")
async def refresh_marine_conditions():
    """
    Force refresh marine weather data.

    Normally cached for 30 minutes. Use this to get immediate update.
    """
    conditions = await marine_service.fetch_all_coastal_data()
    summary = marine_service.get_summary()

    return {
        "status": "refreshed",
        "count": len(conditions),
        "summary": summary,
    }


@router.get("/marine/district/{district}")
async def get_marine_for_district(district: str):
    """
    Get marine conditions for a specific coastal district.

    Returns wave height, risk level, and risk factors.
    """
    if not marine_service.is_cache_valid():
        await marine_service.fetch_all_coastal_data()

    conditions = marine_service.get_cached_data()

    # Find matching district
    for cond in conditions:
        if cond.get("district", "").lower() == district.lower():
            return cond

    return {"error": f"No marine data for district: {district}", "available_districts": list(set(c["district"] for c in conditions))}
