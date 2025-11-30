import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from ..models import AlertHistory, Subscriber, WeatherLog
from ..services.open_meteo import OpenMeteoService
from ..services.gdacs import GDACSService
from ..services.twilio_sms import get_sms_service
from ..services.whatsapp_service import whatsapp_service
from ..services.districts_service import get_all_districts
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class AlertEngine:
    """Engine for processing weather data and triggering alerts."""

    def __init__(self, db: Session):
        self.db = db
        self.weather_service = OpenMeteoService()
        self.gdacs_service = GDACSService()
        self.sms_service = get_sms_service()

    def get_alert_level(self, rainfall_mm: float) -> Optional[str]:
        """Determine alert level based on rainfall. Returns None if below threshold."""
        if rainfall_mm >= settings.threshold_red:
            return "red"
        elif rainfall_mm >= settings.threshold_orange:
            return "orange"
        elif rainfall_mm >= settings.threshold_yellow:
            return "yellow"
        return None

    async def check_all_districts(self) -> list[dict]:
        """
        Check weather conditions for all districts and trigger alerts if needed.
        Returns list of triggered alerts.
        """
        districts = get_all_districts()
        triggered_alerts = []

        for district in districts:
            try:
                # Fetch current weather
                weather = await self.weather_service.get_weather(
                    district["latitude"],
                    district["longitude"]
                )

                rainfall_24h = weather.get("rainfall_24h_mm", 0.0)

                # Log weather data
                self._log_weather(
                    district["name"],
                    rainfall_24h,
                    weather.get("temperature_c"),
                    weather.get("humidity_percent")
                )

                # Check if alert threshold is met
                alert_level = self.get_alert_level(rainfall_24h)

                if alert_level:
                    # Check if we've already sent an alert for this district recently
                    if not self._has_recent_alert(district["name"], alert_level):
                        alert = await self._trigger_alert(
                            district["name"],
                            alert_level,
                            rainfall_24h,
                            "open-meteo"
                        )
                        triggered_alerts.append(alert)

            except Exception as e:
                logger.error(f"Error checking district {district['name']}: {e}")

        return triggered_alerts

    async def check_gdacs_alerts(self) -> list[dict]:
        """Check GDACS for any flood alerts in Sri Lanka."""
        triggered_alerts = []

        try:
            gdacs_alerts = await self.gdacs_service.get_flood_alerts()

            for gdacs_alert in gdacs_alerts:
                alert_level = self.gdacs_service.gdacs_level_to_our_level(
                    gdacs_alert["alert_level"]
                )

                # Find closest district
                district = self._find_closest_district(
                    gdacs_alert["latitude"],
                    gdacs_alert["longitude"]
                )

                if district and not self._has_recent_alert(district, alert_level):
                    alert = await self._trigger_alert(
                        district,
                        alert_level,
                        0.0,  # Rainfall not provided by GDACS
                        "gdacs",
                        gdacs_alert.get("description", "GDACS flood alert")
                    )
                    triggered_alerts.append(alert)

        except Exception as e:
            logger.error(f"Error checking GDACS: {e}")

        return triggered_alerts

    def _log_weather(
        self,
        district: str,
        rainfall_mm: float,
        temperature_c: Optional[float],
        humidity_percent: Optional[int]
    ):
        """Log weather data to database."""
        log = WeatherLog(
            district=district,
            rainfall_mm=rainfall_mm,
            temperature_c=temperature_c,
            humidity_percent=humidity_percent
        )
        self.db.add(log)
        self.db.commit()

    def _has_recent_alert(self, district: str, level: str, hours: int = 6) -> bool:
        """Check if an alert of the same level was sent recently for this district."""
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        existing = self.db.query(AlertHistory).filter(
            AlertHistory.district == district,
            AlertHistory.alert_level == level,
            AlertHistory.sent_at >= cutoff
        ).first()
        return existing is not None

    async def _trigger_alert(
        self,
        district: str,
        level: str,
        rainfall_mm: float,
        source: str,
        message: Optional[str] = None
    ) -> dict:
        """Create alert record and send SMS to subscribers."""
        # Default message
        if not message:
            message = f"Heavy rainfall detected: {rainfall_mm:.1f}mm in the last 24 hours."

        # Create alert history record
        alert = AlertHistory(
            district=district,
            alert_level=level,
            rainfall_mm=rainfall_mm,
            source=source,
            message=message
        )
        self.db.add(alert)
        self.db.commit()
        self.db.refresh(alert)

        logger.info(f"Alert triggered: {district} - {level} - {rainfall_mm}mm")

        # Send SMS to subscribers
        await self._notify_subscribers(district, level, rainfall_mm)

        return {
            "id": alert.id,
            "district": district,
            "level": level,
            "rainfall_mm": rainfall_mm,
            "source": source,
            "message": message
        }

    async def _notify_subscribers(
        self,
        district: str,
        level: str,
        rainfall_mm: float
    ):
        """Send alerts to all active subscribers for the given district via SMS or WhatsApp."""
        # Query all active subscribers
        all_subscribers = self.db.query(Subscriber).filter(
            Subscriber.active == True
        ).all()

        # Filter by district (districts is stored as JSON)
        subscribers = [s for s in all_subscribers if district in s.districts]

        logger.info(f"Notifying {len(subscribers)} subscribers for {district}")

        sms_sent = 0
        sms_failed = 0
        whatsapp_sent = 0
        whatsapp_failed = 0

        for subscriber in subscribers:
            try:
                channel = getattr(subscriber, 'channel', 'sms') or 'sms'
                whatsapp_opted_in = getattr(subscriber, 'whatsapp_opted_in', False)

                # Send via WhatsApp if opted in, otherwise SMS
                if channel == 'whatsapp' and whatsapp_opted_in and whatsapp_service.is_configured():
                    result = await whatsapp_service.send_alert_message(
                        to_phone=subscriber.phone_number,
                        district=district,
                        alert_level=level.upper(),
                        rainfall_mm=rainfall_mm,
                        language=subscriber.language
                    )
                    if result.get("success"):
                        whatsapp_sent += 1
                    else:
                        whatsapp_failed += 1
                else:
                    # Fall back to SMS
                    result = self.sms_service.send_alert(
                        subscriber.phone_number,
                        district,
                        level,
                        rainfall_mm,
                        subscriber.language
                    )
                    if result:
                        sms_sent += 1
                    else:
                        sms_failed += 1

            except Exception as e:
                logger.error(f"Error sending alert to {subscriber.phone_number}: {e}")
                if channel == 'whatsapp':
                    whatsapp_failed += 1
                else:
                    sms_failed += 1

        logger.info(
            f"Notifications sent - SMS: {sms_sent} (failed: {sms_failed}), "
            f"WhatsApp: {whatsapp_sent} (failed: {whatsapp_failed})"
        )

    def _find_closest_district(self, lat: float, lon: float) -> Optional[str]:
        """Find the district closest to the given coordinates."""
        districts = get_all_districts()
        closest = None
        min_distance = float("inf")

        for district in districts:
            # Simple Euclidean distance (good enough for small area like Sri Lanka)
            d = ((district["latitude"] - lat) ** 2 + (district["longitude"] - lon) ** 2) ** 0.5
            if d < min_distance:
                min_distance = d
                closest = district["name"]

        return closest
