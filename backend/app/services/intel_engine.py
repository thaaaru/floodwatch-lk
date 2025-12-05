"""
Intelligence Engine Service
Automated analysis of SOS data + weather to produce actionable intelligence
Now enhanced with GeoNames elevation data for terrain-based flood risk.
"""
import math
import asyncio
from typing import Optional
from datetime import datetime
from collections import defaultdict
import logging

from .sos_fetcher import sos_fetcher
from .weather_cache import weather_cache
from .geonames import get_elevation, calculate_elevation_risk, enrich_location_data

logger = logging.getLogger(__name__)


class IntelEngine:
    """
    Automated intelligence engine that produces actionable outputs:
    - Priority-ranked emergencies
    - Geographic clusters for efficient rescue
    - District summaries
    - Weather risk escalation
    """

    # Water level severity scores
    WATER_LEVEL_SCORES = {
        "ROOF": 40,
        "NECK": 35,
        "CHEST": 25,
        "WAIST": 15,
        "ANKLE": 5,
        "UNKNOWN": 10,
    }

    # Cluster radius in kilometers
    CLUSTER_RADIUS_KM = 2.0

    def __init__(self):
        self._last_analysis: Optional[datetime] = None
        self._cached_priorities: list[dict] = []
        self._cached_clusters: list[dict] = []
        self._cached_summary: dict = {}

    async def run_analysis(self) -> dict:
        """
        Main analysis pipeline - runs every 5 minutes.
        Returns complete intelligence package.
        """
        logger.info("Running intelligence analysis...")

        # 1. Fetch latest SOS data
        reports = await sos_fetcher.fetch_sos_reports()

        # 2. Fetch weather data for risk overlay
        weather_data = weather_cache.get_all_weather()

        # 3. Compute priority scores (now async for GeoNames elevation lookup)
        scored_reports = await self._compute_priorities(reports, weather_data)

        # 4. Detect clusters
        clusters = self._detect_clusters(scored_reports)

        # 5. Generate district summary
        summary = self._generate_summary(scored_reports, clusters, weather_data)

        # Cache results
        self._cached_priorities = scored_reports
        self._cached_clusters = clusters
        self._cached_summary = summary
        self._last_analysis = datetime.utcnow()

        logger.info(
            f"Analysis complete: {len(scored_reports)} reports, "
            f"{len(clusters)} clusters, {len(summary['districts'])} districts"
        )

        return {
            "priorities": scored_reports,
            "clusters": clusters,
            "summary": summary,
            "analyzed_at": self._last_analysis.isoformat(),
        }

    async def _compute_priorities(
        self, reports: list[dict], weather_data: list[dict]
    ) -> list[dict]:
        """
        Compute urgency score for each report.
        Score range: 0-115 (higher = more urgent), capped at 100
        Now includes elevation-based terrain risk from GeoNames.
        """
        # Build weather lookup by district
        weather_by_district = {}
        for w in weather_data:
            district = (w.get("district") or "").lower()
            weather_by_district[district] = w

        # Pre-fetch elevation data for reports with coordinates (batch)
        elevation_cache = {}
        coords_to_fetch = [
            (r.get("latitude"), r.get("longitude"))
            for r in reports
            if r.get("latitude") and r.get("longitude")
        ]

        # Fetch elevations with rate limiting
        for lat, lng in coords_to_fetch[:50]:  # Limit to 50 to avoid rate limits
            if lat and lng:
                try:
                    elevation = await get_elevation(lat, lng)
                    elevation_cache[(round(lat, 2), round(lng, 2))] = elevation
                except Exception as e:
                    logger.warning(f"Elevation fetch failed: {e}")

        scored = []
        for report in reports:
            score = 0
            factors = []

            # 1. Water level (0-40 points)
            water_level = (report.get("water_level") or "UNKNOWN").upper()
            water_score = self.WATER_LEVEL_SCORES.get(water_level, 10)
            score += water_score
            factors.append(f"water_level:{water_level}={water_score}")

            # 2. Vulnerable population (0-30 points)
            if report.get("has_medical_emergency"):
                score += 15
                factors.append("medical_emergency=15")
            if report.get("has_disabled"):
                score += 8
                factors.append("disabled=8")
            if report.get("has_elderly"):
                score += 5
                factors.append("elderly=5")
            if report.get("has_children"):
                score += 2
                factors.append("children=2")

            # 3. Time pressure (0-20 points)
            safe_hours = report.get("safe_for_hours")
            if safe_hours is not None:
                if safe_hours <= 1:
                    score += 20
                    factors.append("safe_hours<=1=20")
                elif safe_hours <= 3:
                    score += 15
                    factors.append("safe_hours<=3=15")
                elif safe_hours <= 6:
                    score += 10
                    factors.append("safe_hours<=6=10")
                elif safe_hours <= 12:
                    score += 5
                    factors.append("safe_hours<=12=5")

            # 4. People count (0-10 points)
            people = min(report.get("number_of_people", 1), 10)
            score += people
            factors.append(f"people={people}")

            # 5. Resource scarcity (0-10 points)
            if not report.get("has_food"):
                score += 3
                factors.append("no_food=3")
            if not report.get("has_water"):
                score += 5
                factors.append("no_water=5")
            if not report.get("has_power") and (report.get("battery_percent") or 0) < 20:
                score += 2
                factors.append("low_battery=2")

            # 6. Weather escalation (0-15 bonus points)
            district = (report.get("district") or "").lower()
            weather = weather_by_district.get(district)
            weather_risk = 0
            if weather:
                forecast_rain = weather.get("forecast_precip_24h_mm", 0) or 0
                if forecast_rain > 100:
                    weather_risk = 15
                    factors.append(f"forecast_rain>{forecast_rain}mm=15")
                elif forecast_rain > 50:
                    weather_risk = 10
                    factors.append(f"forecast_rain>{forecast_rain}mm=10")
                elif forecast_rain > 25:
                    weather_risk = 5
                    factors.append(f"forecast_rain>{forecast_rain}mm=5")
                score += weather_risk

            # 7. Elevation/Terrain risk (0-15 bonus points) - NEW from GeoNames
            elevation_risk = 0
            elevation_m = None
            elevation_risk_level = "UNKNOWN"
            lat, lng = report.get("latitude"), report.get("longitude")
            if lat and lng:
                cache_key = (round(lat, 2), round(lng, 2))
                elevation_m = elevation_cache.get(cache_key)
                if elevation_m is not None:
                    elevation_risk, elevation_risk_level = calculate_elevation_risk(elevation_m)
                    score += elevation_risk
                    if elevation_risk > 0:
                        factors.append(f"elevation:{elevation_m}m={elevation_risk}")

            # Cap at 100
            score = min(score, 100)

            # Determine urgency tier
            if score >= 70:
                urgency = "CRITICAL"
            elif score >= 50:
                urgency = "HIGH"
            elif score >= 30:
                urgency = "MEDIUM"
            else:
                urgency = "LOW"

            scored.append({
                **report,
                "urgency_score": score,
                "urgency_tier": urgency,
                "score_factors": factors,
                "weather_risk": weather_risk,
                "elevation_m": elevation_m,
                "elevation_risk": elevation_risk,
                "elevation_risk_level": elevation_risk_level,
            })

        # Sort by score descending
        scored.sort(key=lambda x: x["urgency_score"], reverse=True)

        return scored

    def _detect_clusters(self, reports: list[dict]) -> list[dict]:
        """
        Group nearby emergencies into clusters for efficient rescue routing.
        Uses simple distance-based clustering.
        """
        # Filter reports with valid coordinates
        geo_reports = [
            r for r in reports
            if r.get("latitude") and r.get("longitude")
        ]

        if not geo_reports:
            # Fall back to district-based clustering
            return self._cluster_by_district(reports)

        clusters = []
        used = set()

        for i, report in enumerate(geo_reports):
            if i in used:
                continue

            # Start new cluster
            cluster_reports = [report]
            used.add(i)

            # Find nearby reports
            for j, other in enumerate(geo_reports):
                if j in used:
                    continue

                distance = self._haversine_distance(
                    report["latitude"], report["longitude"],
                    other["latitude"], other["longitude"]
                )

                if distance <= self.CLUSTER_RADIUS_KM:
                    cluster_reports.append(other)
                    used.add(j)

            # Create cluster if 2+ reports
            if len(cluster_reports) >= 1:
                clusters.append(self._build_cluster(cluster_reports))

        # Sort clusters by total urgency
        clusters.sort(key=lambda c: c["total_urgency"], reverse=True)

        return clusters

    def _cluster_by_district(self, reports: list[dict]) -> list[dict]:
        """Fallback clustering by district when GPS unavailable."""
        by_district = defaultdict(list)
        for r in reports:
            by_district[r.get("district", "Unknown")].append(r)

        clusters = []
        for district, district_reports in by_district.items():
            clusters.append(self._build_cluster(district_reports, district))

        clusters.sort(key=lambda c: c["total_urgency"], reverse=True)
        return clusters

    def _build_cluster(
        self, reports: list[dict], name: Optional[str] = None
    ) -> dict:
        """Build cluster summary from reports."""
        total_people = sum(r.get("number_of_people", 1) for r in reports)
        total_urgency = sum(r.get("urgency_score", 0) for r in reports)
        avg_urgency = total_urgency / len(reports) if reports else 0

        # Calculate centroid
        lats = [r["latitude"] for r in reports if r.get("latitude")]
        lngs = [r["longitude"] for r in reports if r.get("longitude")]

        centroid_lat = sum(lats) / len(lats) if lats else None
        centroid_lng = sum(lngs) / len(lngs) if lngs else None

        # Get districts in cluster
        districts = list(set(r.get("district", "Unknown") for r in reports))

        # Count critical cases
        critical_count = sum(1 for r in reports if r.get("urgency_tier") == "CRITICAL")
        high_count = sum(1 for r in reports if r.get("urgency_tier") == "HIGH")

        # Vulnerability summary
        has_medical = any(r.get("has_medical_emergency") for r in reports)
        has_elderly = any(r.get("has_elderly") for r in reports)
        has_children = any(r.get("has_children") for r in reports)
        has_disabled = any(r.get("has_disabled") for r in reports)

        return {
            "cluster_id": f"cluster_{reports[0].get('id', 'unknown')}",
            "name": name or f"Cluster near {districts[0] if districts else 'Unknown'}",
            "districts": districts,
            "report_count": len(reports),
            "total_people": total_people,
            "total_urgency": total_urgency,
            "avg_urgency": round(avg_urgency, 1),
            "critical_count": critical_count,
            "high_count": high_count,
            "centroid": {
                "latitude": centroid_lat,
                "longitude": centroid_lng,
            },
            "vulnerabilities": {
                "medical_emergency": has_medical,
                "elderly": has_elderly,
                "children": has_children,
                "disabled": has_disabled,
            },
            "reports": [r["id"] for r in reports],
            "top_reports": reports[:5],  # Top 5 by urgency
        }

    def _generate_summary(
        self,
        reports: list[dict],
        clusters: list[dict],
        weather_data: list[dict]
    ) -> dict:
        """Generate actionable summary statistics."""
        # District breakdown
        district_stats = defaultdict(lambda: {
            "count": 0,
            "total_people": 0,
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "avg_urgency": 0,
            "needs_food": 0,
            "needs_water": 0,
            "has_medical": 0,
        })

        for r in reports:
            d = r.get("district") or "Unknown"
            district_stats[d]["count"] += 1
            district_stats[d]["total_people"] += r.get("number_of_people", 1)
            district_stats[d][r.get("urgency_tier", "medium").lower()] += 1
            if not r.get("has_food"):
                district_stats[d]["needs_food"] += 1
            if not r.get("has_water"):
                district_stats[d]["needs_water"] += 1
            if r.get("has_medical_emergency"):
                district_stats[d]["has_medical"] += 1

        # Calculate averages and add weather risk
        weather_by_district = {(w.get("district") or "").lower(): w for w in weather_data}

        for d, stats in district_stats.items():
            if stats["count"] > 0:
                urgency_sum = sum(
                    r.get("urgency_score", 0)
                    for r in reports
                    if r.get("district") == d
                )
                stats["avg_urgency"] = round(urgency_sum / stats["count"], 1)

            # Add weather forecast
            weather = weather_by_district.get((d or "").lower(), {})
            stats["forecast_rain_24h"] = weather.get("forecast_precip_24h_mm", 0)
            stats["current_alert_level"] = weather.get("alert_level", "green")

        # Overall stats
        total_people = sum(r.get("number_of_people", 1) for r in reports)
        critical_count = sum(1 for r in reports if r.get("urgency_tier") == "CRITICAL")
        high_count = sum(1 for r in reports if r.get("urgency_tier") == "HIGH")

        # Identify most affected districts (by critical + high count)
        sorted_districts = sorted(
            district_stats.items(),
            key=lambda x: (x[1]["critical"] + x[1]["high"], x[1]["count"]),
            reverse=True
        )

        return {
            "total_reports": len(reports),
            "total_people_affected": total_people,
            "total_clusters": len(clusters),
            "urgency_breakdown": {
                "critical": critical_count,
                "high": high_count,
                "medium": sum(1 for r in reports if r.get("urgency_tier") == "MEDIUM"),
                "low": sum(1 for r in reports if r.get("urgency_tier") == "LOW"),
            },
            "resource_needs": {
                "needs_food": sum(1 for r in reports if not r.get("has_food")),
                "needs_water": sum(1 for r in reports if not r.get("has_water")),
                "medical_emergencies": sum(1 for r in reports if r.get("has_medical_emergency")),
            },
            "vulnerability_counts": {
                "with_elderly": sum(1 for r in reports if r.get("has_elderly")),
                "with_children": sum(1 for r in reports if r.get("has_children")),
                "with_disabled": sum(1 for r in reports if r.get("has_disabled")),
            },
            "most_affected_districts": [
                {"district": d, **stats}
                for d, stats in sorted_districts[:10]
            ],
            "districts": dict(district_stats),
            "analyzed_at": datetime.utcnow().isoformat(),
        }

    def _haversine_distance(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """Calculate distance between two points in kilometers."""
        R = 6371  # Earth's radius in km

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_lat / 2) ** 2 +
            math.cos(lat1_rad) * math.cos(lat2_rad) *
            math.sin(delta_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    def get_priorities(self, limit: int = 50) -> list[dict]:
        """Get cached priority-ranked reports."""
        return self._cached_priorities[:limit]

    def get_clusters(self) -> list[dict]:
        """Get cached clusters."""
        return self._cached_clusters

    def get_summary(self) -> dict:
        """Get cached summary."""
        return self._cached_summary

    def get_district_intel(self, district: str) -> dict:
        """Get intelligence for a specific district."""
        district_lower = district.lower()

        reports = [
            r for r in self._cached_priorities
            if (r.get("district") or "").lower() == district_lower
        ]

        clusters = [
            c for c in self._cached_clusters
            if district_lower in [(d or "").lower() for d in c.get("districts", [])]
        ]

        district_summary = self._cached_summary.get("districts", {}).get(district, {})

        return {
            "district": district,
            "reports": reports,
            "clusters": clusters,
            "summary": district_summary,
            "report_count": len(reports),
            "total_people": sum(r.get("number_of_people", 1) for r in reports),
        }


# Singleton instance
intel_engine = IntelEngine()
