from twilio.rest import Client
from twilio.base.exceptions import TwilioException
import logging
from typing import Optional

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class TwilioSMSService:
    """Service for sending SMS via Twilio."""

    def __init__(self):
        self.account_sid = settings.twilio_account_sid
        self.auth_token = settings.twilio_auth_token
        self.from_number = settings.twilio_phone_number
        self.client = None

        if self.account_sid and self.auth_token:
            self.client = Client(self.account_sid, self.auth_token)

    def is_configured(self) -> bool:
        """Check if Twilio is properly configured."""
        return self.client is not None

    def send_sms(self, to_number: str, message: str) -> Optional[str]:
        """
        Send an SMS message.
        Returns message SID on success, None on failure.
        """
        if not self.is_configured():
            logger.warning("Twilio not configured, skipping SMS")
            return None

        try:
            msg = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=to_number
            )
            logger.info(f"SMS sent to {to_number}, SID: {msg.sid}")
            return msg.sid
        except TwilioException as e:
            logger.error(f"Twilio error sending to {to_number}: {e}")
            return None

    def send_alert(
        self,
        to_number: str,
        district: str,
        alert_level: str,
        rainfall_mm: float,
        language: str = "en"
    ) -> Optional[str]:
        """Send a flood alert SMS in the specified language."""
        message = self._format_alert_message(
            district, alert_level, rainfall_mm, language
        )
        return self.send_sms(to_number, message)

    def send_confirmation(self, to_number: str, language: str = "en") -> Optional[str]:
        """Send subscription confirmation SMS."""
        messages = {
            "en": (
                "Welcome to FloodWatch LK! You're now subscribed to flood alerts. "
                "Reply STOP to unsubscribe. Visit floodwatch.lk for more info."
            ),
            "si": (
                "FloodWatch LK වෙත සාදරයෙන් පිළිගනිමු! ඔබ දැන් ගංවතුර අනතුරු ඇඟවීම් සඳහා ලියාපදිංචි වී ඇත. "
                "නැවැත්වීමට STOP යැයි පිළිතුරු දෙන්න."
            ),
            "ta": (
                "FloodWatch LK க்கு வரவேற்கிறோம்! வெள்ள எச்சரிக்கைகளுக்கு நீங்கள் பதிவு செய்துள்ளீர்கள். "
                "நிறுத்த STOP என்று பதிலளிக்கவும்."
            )
        }
        message = messages.get(language, messages["en"])
        return self.send_sms(to_number, message)

    def _format_alert_message(
        self,
        district: str,
        alert_level: str,
        rainfall_mm: float,
        language: str
    ) -> str:
        """Format alert message in the specified language."""
        level_display = alert_level.upper()

        if language == "si":
            return (
                f"🚨 ගංවතුර අනතුරු ඇඟවීම [{level_display}]\n"
                f"දිස්ත්‍රික්කය: {district}\n"
                f"වර්ෂාපතනය: {rainfall_mm:.1f}mm/24h\n"
                f"ආරක්ෂාව සලසා ගන්න.\n"
                f"floodwatch.lk බලන්න."
            )
        elif language == "ta":
            return (
                f"🚨 வெள்ள எச்சரிக்கை [{level_display}]\n"
                f"மாவட்டம்: {district}\n"
                f"மழை: {rainfall_mm:.1f}mm/24h\n"
                f"பாதுகாப்பாக இருங்கள்.\n"
                f"floodwatch.lk பார்க்கவும்."
            )
        else:  # English
            return (
                f"🚨 FLOOD ALERT [{level_display}]\n"
                f"District: {district}\n"
                f"Rainfall: {rainfall_mm:.1f}mm/24h\n"
                f"Stay safe. Visit floodwatch.lk for updates.\n"
                f"Reply STOP to unsubscribe."
            )


# Singleton instance
_sms_service: Optional[TwilioSMSService] = None


def get_sms_service() -> TwilioSMSService:
    """Get or create the SMS service singleton."""
    global _sms_service
    if _sms_service is None:
        _sms_service = TwilioSMSService()
    return _sms_service
