import httpx
from datetime import datetime, timedelta
import logging
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class OpenMeteoService:
    """Service for fetching weather data from Open-Meteo API."""

    def __init__(self):
        self.base_url = settings.open_meteo_url
        self.timeout = 30.0

    async def get_weather(self, latitude: float, longitude: float, hours: int = 24) -> dict:
        """
        Fetch comprehensive weather data for given coordinates.
        Includes data for rain prediction and danger level calculation.
        """
        forecast_days = max(4, (hours // 24) + 2)
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": ",".join([
                "precipitation",
                "precipitation_probability",
                "temperature_2m",
                "relative_humidity_2m",
                "surface_pressure",
                "cloud_cover",
                "cloud_cover_low",
                "cloud_cover_mid",
                "cloud_cover_high",
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m"
            ]),
            "current": ",".join([
                "precipitation",
                "temperature_2m",
                "relative_humidity_2m",
                "surface_pressure",
                "cloud_cover",
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m"
            ]),
            "timezone": "Asia/Colombo",
            "forecast_days": forecast_days,
            "past_days": 3
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                data = response.json()

                return self._parse_response(data, hours)
            except httpx.HTTPError as e:
                logger.error(f"Open-Meteo API error: {e}")
                raise

    def _parse_response(self, data: dict, hours: int = 24) -> dict:
        """Parse Open-Meteo API response with danger level calculation."""
        current = data.get("current", {})
        hourly = data.get("hourly", {})

        precipitation_hourly = hourly.get("precipitation", [])
        precip_probability = hourly.get("precipitation_probability", [])
        cloud_cover = hourly.get("cloud_cover", [])
        cloud_cover_low = hourly.get("cloud_cover_low", [])
        cloud_cover_high = hourly.get("cloud_cover_high", [])
        humidity = hourly.get("relative_humidity_2m", [])
        pressure = hourly.get("surface_pressure", [])
        wind_speed = hourly.get("wind_speed_10m", [])
        wind_gusts = hourly.get("wind_gusts_10m", [])
        times = hourly.get("time", [])

        # Find current hour index
        now = datetime.now()
        current_idx = 0
        for i, t in enumerate(times):
            try:
                time_dt = datetime.fromisoformat(t)
                if time_dt <= now:
                    current_idx = i
            except:
                pass

        # Calculate rainfall for different periods
        rainfall_24h = sum(precipitation_hourly[max(0, current_idx - 24):current_idx + 1]) if precipitation_hourly else 0.0
        rainfall_48h = sum(precipitation_hourly[max(0, current_idx - 48):current_idx + 1]) if len(precipitation_hourly) > 48 else 0.0
        rainfall_72h = sum(precipitation_hourly[max(0, current_idx - 72):current_idx + 1]) if len(precipitation_hourly) > 72 else 0.0

        # Forecast data for next 24, 48 hours
        forecast_precip_24h = sum(precipitation_hourly[current_idx:current_idx + 24]) if precipitation_hourly else 0.0
        forecast_precip_48h = sum(precipitation_hourly[current_idx:current_idx + 48]) if precipitation_hourly else 0.0

        # Average precipitation probability for next 24 hours
        future_precip_prob = precip_probability[current_idx:current_idx + 24]
        avg_precip_probability = sum(future_precip_prob) / len(future_precip_prob) if future_precip_prob else 0

        # Current conditions
        current_cloud_cover = current.get("cloud_cover", 0)
        current_humidity = current.get("relative_humidity_2m", 0)
        current_pressure = current.get("surface_pressure", 1013)
        current_wind_speed = current.get("wind_speed_10m", 0)
        current_wind_gusts = current.get("wind_gusts_10m", 0)

        # Pressure trend (falling pressure indicates incoming weather)
        pressure_data = pressure[max(0, current_idx - 6):current_idx + 1]
        pressure_trend = 0
        if len(pressure_data) >= 2:
            pressure_trend = pressure_data[-1] - pressure_data[0]  # Negative = falling

        # Calculate danger level
        danger_level, danger_score, danger_factors = self._calculate_danger_level(
            rainfall_24h=rainfall_24h,
            rainfall_48h=rainfall_48h,
            rainfall_72h=rainfall_72h,
            forecast_precip_24h=forecast_precip_24h,
            forecast_precip_48h=forecast_precip_48h,
            avg_precip_probability=avg_precip_probability,
            current_cloud_cover=current_cloud_cover,
            current_humidity=current_humidity,
            pressure_trend=pressure_trend,
            current_wind_speed=current_wind_speed,
            hours=hours
        )

        # Build forecast for next 24 hours
        forecast_24h = []
        for i in range(min(24, len(times) - current_idx)):
            idx = current_idx + i
            forecast_24h.append({
                "time": times[idx] if idx < len(times) else None,
                "precipitation_mm": precipitation_hourly[idx] if idx < len(precipitation_hourly) else 0,
                "precipitation_probability": precip_probability[idx] if idx < len(precip_probability) else 0,
                "temperature_c": hourly.get("temperature_2m", [])[idx] if idx < len(hourly.get("temperature_2m", [])) else None,
                "humidity_percent": humidity[idx] if idx < len(humidity) else None,
                "cloud_cover": cloud_cover[idx] if idx < len(cloud_cover) else None,
                "wind_speed_kmh": wind_speed[idx] if idx < len(wind_speed) else None,
                "wind_gusts_kmh": wind_gusts[idx] if idx < len(wind_gusts) else None
            })

        # Build 5-day forecast summary
        forecast_daily = self._build_daily_forecast(hourly, current_idx)

        return {
            "current_rainfall_mm": current.get("precipitation", 0.0),
            "rainfall_mm": rainfall_24h if hours == 24 else (rainfall_48h if hours == 48 else rainfall_72h),
            "rainfall_24h_mm": rainfall_24h,
            "rainfall_48h_mm": rainfall_48h,
            "rainfall_72h_mm": rainfall_72h,
            "forecast_precip_24h_mm": forecast_precip_24h,
            "forecast_precip_48h_mm": forecast_precip_48h,
            "precipitation_probability": avg_precip_probability,
            "hours": hours,
            "temperature_c": current.get("temperature_2m"),
            "humidity_percent": current_humidity,
            "pressure_hpa": current_pressure,
            "pressure_trend": pressure_trend,
            "cloud_cover_percent": current_cloud_cover,
            "wind_speed_kmh": current_wind_speed,
            "wind_gusts_kmh": current_wind_gusts,
            "wind_direction": current.get("wind_direction_10m"),
            "danger_level": danger_level,
            "danger_score": danger_score,
            "danger_factors": danger_factors,
            "forecast_24h": forecast_24h,
            "forecast_daily": forecast_daily
        }

    def _build_daily_forecast(self, hourly: dict, current_idx: int) -> list:
        """Build 5-day forecast with daily summaries."""
        times = hourly.get("time", [])
        precipitation = hourly.get("precipitation", [])
        precip_probability = hourly.get("precipitation_probability", [])
        temperature = hourly.get("temperature_2m", [])
        humidity = hourly.get("relative_humidity_2m", [])
        cloud_cover = hourly.get("cloud_cover", [])
        wind_speed = hourly.get("wind_speed_10m", [])

        daily_forecast = []

        # Start from tomorrow (skip remaining hours of today)
        now = datetime.now()
        start_of_tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

        # Find the index for start of tomorrow
        tomorrow_idx = current_idx
        for i, t in enumerate(times[current_idx:], start=current_idx):
            try:
                time_dt = datetime.fromisoformat(t)
                if time_dt >= start_of_tomorrow:
                    tomorrow_idx = i
                    break
            except:
                pass

        # Build 5 days of forecast
        for day in range(5):
            day_start = tomorrow_idx + (day * 24)
            day_end = day_start + 24

            if day_start >= len(times):
                break

            # Get the date for this day
            try:
                day_date = datetime.fromisoformat(times[day_start]).date()
            except:
                continue

            # Slice data for this day
            day_precip = precipitation[day_start:min(day_end, len(precipitation))]
            day_prob = precip_probability[day_start:min(day_end, len(precip_probability))]
            day_temp = temperature[day_start:min(day_end, len(temperature))]
            day_humidity = humidity[day_start:min(day_end, len(humidity))]
            day_clouds = cloud_cover[day_start:min(day_end, len(cloud_cover))]
            day_wind = wind_speed[day_start:min(day_end, len(wind_speed))]

            if not day_precip:
                continue

            # Calculate daily stats
            total_rainfall = sum(day_precip)
            max_rain_prob = max(day_prob) if day_prob else 0
            avg_rain_prob = sum(day_prob) / len(day_prob) if day_prob else 0
            temp_min = min(day_temp) if day_temp else None
            temp_max = max(day_temp) if day_temp else None
            avg_humidity = sum(day_humidity) / len(day_humidity) if day_humidity else None
            avg_clouds = sum(day_clouds) / len(day_clouds) if day_clouds else None
            max_wind = max(day_wind) if day_wind else None

            # Determine alert level for forecast
            if total_rainfall >= 150:
                forecast_alert = "red"
            elif total_rainfall >= 100:
                forecast_alert = "orange"
            elif total_rainfall >= 50:
                forecast_alert = "yellow"
            else:
                forecast_alert = "green"

            daily_forecast.append({
                "date": day_date.isoformat(),
                "day_name": day_date.strftime("%A"),
                "total_rainfall_mm": round(total_rainfall, 1),
                "max_precipitation_probability": round(max_rain_prob, 0),
                "avg_precipitation_probability": round(avg_rain_prob, 0),
                "temp_min_c": round(temp_min, 1) if temp_min is not None else None,
                "temp_max_c": round(temp_max, 1) if temp_max is not None else None,
                "avg_humidity_percent": round(avg_humidity, 0) if avg_humidity is not None else None,
                "avg_cloud_cover_percent": round(avg_clouds, 0) if avg_clouds is not None else None,
                "max_wind_speed_kmh": round(max_wind, 1) if max_wind is not None else None,
                "forecast_alert_level": forecast_alert
            })

        return daily_forecast

    def _calculate_danger_level(
        self,
        rainfall_24h: float,
        rainfall_48h: float,
        rainfall_72h: float,
        forecast_precip_24h: float,
        forecast_precip_48h: float,
        avg_precip_probability: float,
        current_cloud_cover: float,
        current_humidity: float,
        pressure_trend: float,
        current_wind_speed: float,
        hours: int
    ) -> tuple:
        """
        Calculate danger level based on multiple weather factors.
        Returns: (level: str, score: float, factors: list)

        Danger Level Thresholds:
        - LOW: score 0-30
        - MEDIUM: score 31-60
        - HIGH: score 61-100
        """
        score = 0
        factors = []

        # Factor 1: Past rainfall (0-25 points)
        # Saturated ground increases flood risk
        if rainfall_72h > 200:
            score += 25
            factors.append({"factor": "Heavy rainfall past 72h", "value": f"{rainfall_72h:.1f}mm", "severity": "high"})
        elif rainfall_72h > 100:
            score += 15
            factors.append({"factor": "Moderate rainfall past 72h", "value": f"{rainfall_72h:.1f}mm", "severity": "medium"})
        elif rainfall_48h > 75:
            score += 10
            factors.append({"factor": "Rainfall past 48h", "value": f"{rainfall_48h:.1f}mm", "severity": "medium"})
        elif rainfall_24h > 50:
            score += 5
            factors.append({"factor": "Rainfall past 24h", "value": f"{rainfall_24h:.1f}mm", "severity": "low"})

        # Factor 2: Forecast precipitation (0-30 points)
        if forecast_precip_24h > 100:
            score += 30
            factors.append({"factor": "Heavy rain forecast (24h)", "value": f"{forecast_precip_24h:.1f}mm", "severity": "high"})
        elif forecast_precip_24h > 50:
            score += 20
            factors.append({"factor": "Significant rain forecast (24h)", "value": f"{forecast_precip_24h:.1f}mm", "severity": "medium"})
        elif forecast_precip_24h > 25:
            score += 10
            factors.append({"factor": "Rain forecast (24h)", "value": f"{forecast_precip_24h:.1f}mm", "severity": "low"})

        # Factor 3: Precipitation probability (0-15 points)
        if avg_precip_probability > 80:
            score += 15
            factors.append({"factor": "Very high rain probability", "value": f"{avg_precip_probability:.0f}%", "severity": "high"})
        elif avg_precip_probability > 60:
            score += 10
            factors.append({"factor": "High rain probability", "value": f"{avg_precip_probability:.0f}%", "severity": "medium"})
        elif avg_precip_probability > 40:
            score += 5
            factors.append({"factor": "Moderate rain probability", "value": f"{avg_precip_probability:.0f}%", "severity": "low"})

        # Factor 4: Atmospheric conditions (0-15 points)
        # High humidity + high cloud cover = rain likely
        if current_humidity > 90 and current_cloud_cover > 80:
            score += 15
            factors.append({"factor": "Saturated atmosphere", "value": f"{current_humidity:.0f}% humidity", "severity": "high"})
        elif current_humidity > 80 and current_cloud_cover > 60:
            score += 8
            factors.append({"factor": "High humidity & clouds", "value": f"{current_humidity:.0f}% humidity", "severity": "medium"})

        # Factor 5: Pressure trend (0-10 points)
        # Falling pressure indicates incoming storm
        if pressure_trend < -5:
            score += 10
            factors.append({"factor": "Rapidly falling pressure", "value": f"{pressure_trend:.1f} hPa/6h", "severity": "high"})
        elif pressure_trend < -2:
            score += 5
            factors.append({"factor": "Falling pressure", "value": f"{pressure_trend:.1f} hPa/6h", "severity": "medium"})

        # Factor 6: Wind conditions (0-5 points)
        # Strong winds can indicate storm systems
        if current_wind_speed > 50:
            score += 5
            factors.append({"factor": "Strong winds", "value": f"{current_wind_speed:.0f} km/h", "severity": "medium"})

        # Determine level
        if score >= 61:
            level = "high"
        elif score >= 31:
            level = "medium"
        else:
            level = "low"

        return level, min(score, 100), factors

    async def get_bulk_weather(self, locations: list[dict]) -> list[dict]:
        """Fetch weather for multiple locations efficiently."""
        results = []

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for location in locations:
                try:
                    params = {
                        "latitude": location["latitude"],
                        "longitude": location["longitude"],
                        "hourly": "precipitation",
                        "timezone": "Asia/Colombo",
                        "forecast_days": 1
                    }
                    response = await client.get(self.base_url, params=params)
                    response.raise_for_status()
                    data = response.json()

                    precipitation = data.get("hourly", {}).get("precipitation", [])
                    rainfall_24h = sum(precipitation[:24]) if precipitation else 0.0

                    results.append({
                        "name": location["name"],
                        "rainfall_24h_mm": rainfall_24h,
                        "success": True
                    })
                except Exception as e:
                    logger.error(f"Error fetching weather for {location['name']}: {e}")
                    results.append({
                        "name": location["name"],
                        "rainfall_24h_mm": 0.0,
                        "success": False,
                        "error": str(e)
                    })

        return results
