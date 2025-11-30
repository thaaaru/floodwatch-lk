"""
SOS Data Fetcher Service
Fetches emergency SOS data from floodsupport.org API
"""
import httpx
from typing import Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

SOS_API_URL = "https://floodsupport.org/api/sos"


class SOSFetcher:
    """Fetches and normalizes SOS emergency data with incremental sync."""

    def __init__(self):
        self._cache: dict[int, dict] = {}  # Use dict for O(1) lookup by ID
        self._last_fetch: Optional[datetime] = None
        self._cache_duration_seconds = 60  # 1 minute cache

    async def fetch_sos_reports(
        self,
        limit: int = 10000
    ) -> list[dict]:
        """Fetch SOS reports from floodsupport.org API with incremental sync."""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(
                    SOS_API_URL,
                    params={"limit": limit}
                )
                response.raise_for_status()
                data = response.json()

                # Normalize and merge with existing cache
                new_reports = self._normalize_reports(data)
                added, updated = self._merge_reports(new_reports)
                self._last_fetch = datetime.utcnow()

                logger.info(f"Fetched {len(new_reports)} SOS reports (added: {added}, updated: {updated})")
                return list(self._cache.values())

        except Exception as e:
            logger.error(f"Failed to fetch SOS data: {e}")
            return list(self._cache.values())  # Return cached data on error

    def _merge_reports(self, new_reports: list[dict]) -> tuple[int, int]:
        """Merge new/updated reports into cache. Returns (added, updated) counts."""
        added = 0
        updated = 0
        for report in new_reports:
            report_id = report.get("id")
            if report_id is None:
                continue
            if report_id in self._cache:
                # Update if changed
                if self._cache[report_id] != report:
                    self._cache[report_id] = report
                    updated += 1
            else:
                self._cache[report_id] = report
                added += 1
        return added, updated

    def _normalize_reports(self, data: list | dict) -> list[dict]:
        """Normalize API response to consistent format."""
        if isinstance(data, dict):
            # Handle if API returns {data: [...]} or similar
            data = data.get("data", data.get("results", [data]))

        if not isinstance(data, list):
            data = [data]

        normalized = []
        for item in data:
            if not isinstance(item, dict):
                continue

            report = {
                "id": item.get("id"),
                "reference": item.get("referenceNumber"),
                "name": item.get("fullName", "Unknown"),
                "phone": item.get("phoneNumber"),
                "alternate_phone": item.get("alternatePhone"),
                "address": item.get("address", ""),
                "landmark": item.get("landmark", ""),
                "district": item.get("district", "Unknown"),
                "latitude": self._parse_float(item.get("latitude")),
                "longitude": self._parse_float(item.get("longitude")),
                "emergency_type": item.get("emergencyType", "UNKNOWN"),
                "number_of_people": self._parse_int(item.get("numberOfPeople", 1)),
                "water_level": item.get("waterLevel", "UNKNOWN"),
                "building_type": item.get("buildingType"),
                "floor_level": item.get("floorLevel"),
                "safe_for_hours": self._parse_float(item.get("safeForHours")),
                "description": item.get("description", ""),
                "title": item.get("title", ""),
                "has_children": item.get("hasChildren", False),
                "has_elderly": item.get("hasElderly", False),
                "has_disabled": item.get("hasDisabled", False),
                "has_medical_emergency": item.get("hasMedicalEmergency", False),
                "has_food": item.get("hasFood", True),
                "has_water": item.get("hasWater", True),
                "has_power": item.get("hasPowerBank", False),
                "battery_percent": self._parse_int(item.get("batteryPercentage")),
                "status": item.get("status", "PENDING"),
                "priority": item.get("priority", "MEDIUM"),
                "source": item.get("source", "UNKNOWN"),
                "rescue_team": item.get("rescueTeam"),
                "verified_by": item.get("verifiedBy"),
                "acknowledged_at": item.get("acknowledgedAt"),
                "rescued_at": item.get("rescuedAt"),
                "completed_at": item.get("completedAt"),
                "created_at": item.get("createdAt"),
                "updated_at": item.get("updatedAt"),
            }
            normalized.append(report)

        return normalized

    def _parse_float(self, value) -> Optional[float]:
        """Safely parse float value."""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    def _parse_int(self, value, default: int = 0) -> int:
        """Safely parse int value."""
        if value is None:
            return default
        try:
            return int(value)
        except (ValueError, TypeError):
            return default

    def get_cached_reports(self) -> list[dict]:
        """Get cached reports without fetching."""
        return list(self._cache.values())

    def is_cache_valid(self) -> bool:
        """Check if cache is still valid."""
        if not self._last_fetch:
            return False
        elapsed = (datetime.utcnow() - self._last_fetch).total_seconds()
        return elapsed < self._cache_duration_seconds


# Singleton instance
sos_fetcher = SOSFetcher()
