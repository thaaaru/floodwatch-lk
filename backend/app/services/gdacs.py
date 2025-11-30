import httpx
from datetime import datetime, timedelta
from typing import Optional
import logging
from xml.etree import ElementTree

from ..config import get_settings
from ..services.districts_service import get_bounding_box

logger = logging.getLogger(__name__)
settings = get_settings()


class GDACSService:
    """Service for fetching flood alerts from GDACS (Global Disaster Alert and Coordination System)."""

    def __init__(self):
        self.base_url = settings.gdacs_api_url
        self.timeout = 30.0
        self.bbox = get_bounding_box()

    async def get_flood_alerts(self, days_back: int = 7) -> list[dict]:
        """
        Fetch flood alerts from GDACS filtered for Sri Lanka region.
        """
        from_date = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")
        to_date = datetime.utcnow().strftime("%Y-%m-%d")

        params = {
            "eventtype": "FL",  # Flood events
            "fromdate": from_date,
            "todate": to_date,
            "alertlevel": "green;orange;red",
            "country": "LKA"  # Sri Lanka ISO code
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()

                # GDACS returns XML
                alerts = self._parse_gdacs_response(response.text)
                return self._filter_by_bounding_box(alerts)
            except httpx.HTTPError as e:
                logger.error(f"GDACS API error: {e}")
                return []

    def _parse_gdacs_response(self, xml_content: str) -> list[dict]:
        """Parse GDACS XML response into list of alerts."""
        alerts = []

        try:
            root = ElementTree.fromstring(xml_content)

            # GDACS uses RSS/GeoRSS format
            for item in root.findall(".//item"):
                alert = self._parse_item(item)
                if alert:
                    alerts.append(alert)

        except ElementTree.ParseError as e:
            logger.error(f"Error parsing GDACS XML: {e}")

        return alerts

    def _parse_item(self, item: ElementTree.Element) -> Optional[dict]:
        """Parse a single GDACS item element."""
        try:
            # Extract basic info
            title = item.findtext("title", "")
            description = item.findtext("description", "")
            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")

            # GDACS-specific fields (may be in different namespaces)
            gdacs_ns = {"gdacs": "http://www.gdacs.org"}

            event_type = item.findtext("gdacs:eventtype", "FL", namespaces=gdacs_ns)
            event_id = item.findtext("gdacs:eventid", "", namespaces=gdacs_ns)
            alert_level = item.findtext("gdacs:alertlevel", "green", namespaces=gdacs_ns)
            country = item.findtext("gdacs:country", "", namespaces=gdacs_ns)
            severity = item.findtext("gdacs:severity", "", namespaces=gdacs_ns)

            # GeoRSS point
            geo_ns = {"geo": "http://www.w3.org/2003/01/geo/wgs84_pos#"}
            lat = item.findtext("geo:lat", "0", namespaces=geo_ns)
            lon = item.findtext("geo:long", "0", namespaces=geo_ns)

            # Try alternative GeoRSS format
            if lat == "0" and lon == "0":
                georss_ns = {"georss": "http://www.georss.org/georss"}
                point = item.findtext("georss:point", "", namespaces=georss_ns)
                if point:
                    parts = point.split()
                    if len(parts) == 2:
                        lat, lon = parts

            return {
                "event_id": event_id or title[:50],
                "event_type": event_type,
                "alert_level": alert_level.lower(),
                "country": country or "Sri Lanka",
                "description": description or title,
                "latitude": float(lat),
                "longitude": float(lon),
                "from_date": pub_date,
                "severity": severity,
                "url": link
            }
        except Exception as e:
            logger.warning(f"Error parsing GDACS item: {e}")
            return None

    def _filter_by_bounding_box(self, alerts: list[dict]) -> list[dict]:
        """Filter alerts to only those within Sri Lanka bounding box."""
        filtered = []
        for alert in alerts:
            lat = alert.get("latitude", 0)
            lon = alert.get("longitude", 0)

            if (self.bbox["min_lat"] <= lat <= self.bbox["max_lat"] and
                self.bbox["min_lon"] <= lon <= self.bbox["max_lon"]):
                filtered.append(alert)

        return filtered

    def gdacs_level_to_our_level(self, gdacs_level: str) -> str:
        """Convert GDACS alert level to our alert level."""
        mapping = {
            "green": "yellow",
            "orange": "orange",
            "red": "red"
        }
        return mapping.get(gdacs_level.lower(), "yellow")
