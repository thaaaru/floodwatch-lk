from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://user:password@localhost:5432/floodwatch"

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""  # SMS number
    twilio_whatsapp_number: str = ""  # WhatsApp number (e.g., +14155238886 for sandbox)

    # External APIs
    gdacs_api_url: str = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
    open_meteo_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_marine_url: str = "https://marine-api.open-meteo.com/v1/marine"
    tomorrow_io_api_key: str = ""
    weatherapi_key: str = ""  # WeatherAPI.com key for alerts
    tomtom_api_key: str = ""  # TomTom Traffic API key
    here_api_key: str = ""  # HERE Traffic API key

    # Application
    alert_check_interval_minutes: int = 15
    frontend_url: str = "https://floodwatch.vercel.app"
    debug: bool = False

    # Alert thresholds (mm in 24 hours)
    threshold_yellow: float = 50.0
    threshold_orange: float = 100.0
    threshold_red: float = 150.0

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
