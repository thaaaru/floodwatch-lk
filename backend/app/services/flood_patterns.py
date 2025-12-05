"""
Flood Pattern Analysis Service
Analyzes historical weather data to identify flood patterns in Sri Lanka.
Uses Open-Meteo Historical API for 30+ years of rainfall data.
"""
import httpx
import logging
from typing import Optional
from datetime import datetime, timedelta, date
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)

# Sri Lanka district coordinates for historical data fetching
DISTRICT_COORDS = {
    "Colombo": {"lat": 6.9271, "lon": 79.8612},
    "Gampaha": {"lat": 7.0873, "lon": 80.0144},
    "Kalutara": {"lat": 6.5854, "lon": 79.9607},
    "Kandy": {"lat": 7.2906, "lon": 80.6337},
    "Matale": {"lat": 7.4675, "lon": 80.6234},
    "Nuwara Eliya": {"lat": 6.9497, "lon": 80.7891},
    "Galle": {"lat": 6.0535, "lon": 80.2210},
    "Matara": {"lat": 5.9485, "lon": 80.5353},
    "Hambantota": {"lat": 6.1241, "lon": 81.1185},
    "Jaffna": {"lat": 9.6615, "lon": 80.0255},
    "Kilinochchi": {"lat": 9.3803, "lon": 80.3770},
    "Mannar": {"lat": 8.9810, "lon": 79.9044},
    "Vavuniya": {"lat": 8.7542, "lon": 80.4982},
    "Mullaitivu": {"lat": 9.2671, "lon": 80.8142},
    "Batticaloa": {"lat": 7.7310, "lon": 81.6747},
    "Ampara": {"lat": 7.2970, "lon": 81.6720},
    "Trincomalee": {"lat": 8.5874, "lon": 81.2152},
    "Kurunegala": {"lat": 7.4863, "lon": 80.3647},
    "Puttalam": {"lat": 8.0362, "lon": 79.8283},
    "Anuradhapura": {"lat": 8.3114, "lon": 80.4037},
    "Polonnaruwa": {"lat": 7.9403, "lon": 81.0188},
    "Badulla": {"lat": 6.9934, "lon": 81.0550},
    "Monaragala": {"lat": 6.8728, "lon": 81.3507},
    "Ratnapura": {"lat": 6.6828, "lon": 80.3992},
    "Kegalle": {"lat": 7.2513, "lon": 80.3464},
}

# Known flood-prone districts based on historical data
FLOOD_PRONE_DISTRICTS = [
    "Colombo", "Gampaha", "Kalutara", "Ratnapura", "Kegalle",
    "Galle", "Matara", "Batticaloa", "Ampara", "Trincomalee"
]

# Monsoon seasons in Sri Lanka
MONSOON_SEASONS = {
    "southwest": {"months": [5, 6, 7, 8, 9], "name": "Southwest Monsoon (Yala)"},
    "northeast": {"months": [10, 11, 12, 1, 2], "name": "Northeast Monsoon (Maha)"},
    "inter_1": {"months": [3, 4], "name": "First Inter-Monsoon"},
    "inter_2": {"months": [10], "name": "Second Inter-Monsoon"},
}


class FloodPatternAnalyzer:
    """Analyzes historical flood patterns using weather data"""

    OPEN_METEO_HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/archive"
    CACHE_DURATION_HOURS = 24  # Cache results for 24 hours

    def __init__(self):
        self._analysis_cache: dict = {}  # {district_years: {data, cached_at}}
        self._rainfall_cache: dict = {}  # {(lat, lon, year): data}

    async def fetch_historical_rainfall(
        self,
        lat: float,
        lon: float,
        start_year: int = 1995,
        end_year: int = None  # Will default to current year
    ) -> list[dict]:
        """
        Fetch historical daily rainfall data from Open-Meteo.
        Returns daily precipitation totals. Uses per-year caching.
        For current year, fetches data up to yesterday.
        """
        from datetime import date

        # Default end_year to current year
        if end_year is None:
            end_year = date.today().year

        yesterday = date.today() - timedelta(days=1)

        all_data = []
        lat_rounded = round(lat, 2)
        lon_rounded = round(lon, 2)

        # Fetch in yearly chunks to avoid API limits
        for year in range(start_year, end_year + 1):
            # For current year, use special cache key including yesterday's date
            if year == date.today().year:
                cache_key = (lat_rounded, lon_rounded, year, yesterday.isoformat())
            else:
                cache_key = (lat_rounded, lon_rounded, year)

            # Check cache first
            if cache_key in self._rainfall_cache:
                all_data.extend(self._rainfall_cache[cache_key])
                continue

            try:
                # For current year, only fetch up to yesterday
                if year == date.today().year:
                    end_date = yesterday.isoformat()
                else:
                    end_date = f"{year}-12-31"

                params = {
                    "latitude": lat,
                    "longitude": lon,
                    "start_date": f"{year}-01-01",
                    "end_date": end_date,
                    "daily": "precipitation_sum,rain_sum",
                    "timezone": "Asia/Colombo",
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(self.OPEN_METEO_HISTORICAL_URL, params=params)
                    response.raise_for_status()
                    data = response.json()

                daily = data.get("daily", {})
                times = daily.get("time", [])
                precip = daily.get("precipitation_sum", [])
                rain = daily.get("rain_sum", [])

                year_data = []
                for i, date_str in enumerate(times):
                    record = {
                        "date": date_str,
                        "year": int(date_str[:4]),
                        "month": int(date_str[5:7]),
                        "day": int(date_str[8:10]),
                        "precipitation_mm": precip[i] if i < len(precip) and precip[i] is not None else 0,
                        "rain_mm": rain[i] if i < len(rain) and rain[i] is not None else 0,
                    }
                    year_data.append(record)

                # Cache this year's data
                self._rainfall_cache[cache_key] = year_data
                all_data.extend(year_data)

            except Exception as e:
                logger.warning(f"Failed to fetch data for {year}: {e}")
                continue

        return all_data

    def analyze_monthly_patterns(self, rainfall_data: list[dict]) -> dict:
        """Analyze monthly rainfall patterns from historical data"""
        monthly_totals = defaultdict(list)
        monthly_max_daily = defaultdict(list)

        for record in rainfall_data:
            month = record["month"]
            precip = record["precipitation_mm"]
            monthly_totals[month].append(precip)
            monthly_max_daily[month].append(precip)

        patterns = {}
        for month in range(1, 13):
            totals = monthly_totals.get(month, [0])
            # Calculate monthly sum per year
            years_data = defaultdict(float)
            for record in rainfall_data:
                if record["month"] == month:
                    years_data[record["year"]] += record["precipitation_mm"]

            monthly_sums = list(years_data.values()) if years_data else [0]

            patterns[month] = {
                "month_name": datetime(2000, month, 1).strftime("%B"),
                "avg_monthly_rainfall_mm": round(statistics.mean(monthly_sums), 1) if monthly_sums else 0,
                "max_monthly_rainfall_mm": round(max(monthly_sums), 1) if monthly_sums else 0,
                "min_monthly_rainfall_mm": round(min(monthly_sums), 1) if monthly_sums else 0,
                "avg_daily_rainfall_mm": round(statistics.mean(totals), 2) if totals else 0,
                "max_daily_rainfall_mm": round(max(totals), 1) if totals else 0,
                "rainy_days_avg": round(len([t for t in totals if t > 1]) / max(1, len(set(r["year"] for r in rainfall_data if r["month"] == month))), 1),
                "flood_risk": self._calculate_flood_risk(monthly_sums, totals),
            }

        return patterns

    def _calculate_flood_risk(self, monthly_sums: list, daily_values: list) -> str:
        """Calculate flood risk based on historical rainfall patterns"""
        if not monthly_sums:
            return "LOW"

        avg_monthly = statistics.mean(monthly_sums)
        max_daily = max(daily_values) if daily_values else 0

        # High risk: avg monthly > 300mm or max daily > 100mm
        if avg_monthly > 300 or max_daily > 150:
            return "HIGH"
        elif avg_monthly > 200 or max_daily > 100:
            return "MEDIUM"
        else:
            return "LOW"

    def analyze_extreme_events(self, rainfall_data: list[dict], threshold_mm: float = 100) -> list[dict]:
        """Identify extreme rainfall events (potential flood triggers)"""
        extreme_events = []

        for record in rainfall_data:
            if record["precipitation_mm"] >= threshold_mm:
                extreme_events.append({
                    "date": record["date"],
                    "precipitation_mm": record["precipitation_mm"],
                    "month": record["month"],
                    "year": record["year"],
                })

        # Sort by precipitation descending
        extreme_events.sort(key=lambda x: x["precipitation_mm"], reverse=True)
        return extreme_events[:50]  # Top 50 events

    def analyze_seasonal_patterns(self, rainfall_data: list[dict]) -> dict:
        """Analyze rainfall patterns by monsoon season"""
        seasonal_data = {
            "southwest": [],
            "northeast": [],
            "inter_monsoon": [],
        }

        for record in rainfall_data:
            month = record["month"]
            precip = record["precipitation_mm"]

            if month in [5, 6, 7, 8, 9]:
                seasonal_data["southwest"].append(precip)
            elif month in [11, 12, 1, 2]:
                seasonal_data["northeast"].append(precip)
            else:
                seasonal_data["inter_monsoon"].append(precip)

        result = {}
        for season, data in seasonal_data.items():
            if data:
                result[season] = {
                    "name": {
                        "southwest": "Southwest Monsoon (May-Sep)",
                        "northeast": "Northeast Monsoon (Nov-Feb)",
                        "inter_monsoon": "Inter-Monsoon (Mar-Apr, Oct)",
                    }[season],
                    "avg_daily_mm": round(statistics.mean(data), 2),
                    "total_days": len(data),
                    "rainy_days": len([d for d in data if d > 1]),
                    "heavy_rain_days": len([d for d in data if d > 50]),
                    "extreme_rain_days": len([d for d in data if d > 100]),
                    "max_daily_mm": round(max(data), 1),
                }

        return result

    def analyze_yearly_trends(self, rainfall_data: list[dict]) -> list[dict]:
        """Analyze yearly rainfall trends"""
        yearly_data = defaultdict(lambda: {"total": 0, "rainy_days": 0, "extreme_days": 0, "max_daily": 0})

        for record in rainfall_data:
            year = record["year"]
            precip = record["precipitation_mm"]
            yearly_data[year]["total"] += precip
            if precip > 1:
                yearly_data[year]["rainy_days"] += 1
            if precip > 100:
                yearly_data[year]["extreme_days"] += 1
            yearly_data[year]["max_daily"] = max(yearly_data[year]["max_daily"], precip)

        trends = []
        for year in sorted(yearly_data.keys()):
            data = yearly_data[year]
            trends.append({
                "year": year,
                "total_rainfall_mm": round(data["total"], 1),
                "rainy_days": data["rainy_days"],
                "extreme_days": data["extreme_days"],
                "max_daily_mm": round(data["max_daily"], 1),
            })

        return trends

    def analyze_climate_change_trends(self, rainfall_data: list[dict], yearly_trends: list[dict]) -> dict:
        """
        Analyze how climate has changed over 30 years.
        Compares decades and calculates trend statistics.
        """
        if not yearly_trends or len(yearly_trends) < 20:
            return {}

        # Split into three decades
        years = [y["year"] for y in yearly_trends]
        min_year = min(years)
        max_year = max(years)

        decade1_end = min_year + 10
        decade2_end = min_year + 20

        decade1 = [y for y in yearly_trends if y["year"] < decade1_end]
        decade2 = [y for y in yearly_trends if decade1_end <= y["year"] < decade2_end]
        decade3 = [y for y in yearly_trends if y["year"] >= decade2_end]

        def calc_decade_stats(decade_data: list) -> dict:
            if not decade_data:
                return None
            return {
                "years": f"{decade_data[0]['year']}-{decade_data[-1]['year']}",
                "avg_annual_rainfall_mm": round(statistics.mean([d["total_rainfall_mm"] for d in decade_data]), 1),
                "avg_rainy_days": round(statistics.mean([d["rainy_days"] for d in decade_data]), 1),
                "avg_extreme_days": round(statistics.mean([d["extreme_days"] for d in decade_data]), 2),
                "total_extreme_days": sum([d["extreme_days"] for d in decade_data]),
                "max_daily_mm": max([d["max_daily_mm"] for d in decade_data]),
                "wettest_year": max(decade_data, key=lambda x: x["total_rainfall_mm"]),
                "driest_year": min(decade_data, key=lambda x: x["total_rainfall_mm"]),
            }

        decade1_stats = calc_decade_stats(decade1)
        decade2_stats = calc_decade_stats(decade2)
        decade3_stats = calc_decade_stats(decade3)

        # Calculate changes between decades
        changes = []

        if decade1_stats and decade3_stats:
            rainfall_change = decade3_stats["avg_annual_rainfall_mm"] - decade1_stats["avg_annual_rainfall_mm"]
            rainfall_change_pct = (rainfall_change / decade1_stats["avg_annual_rainfall_mm"]) * 100 if decade1_stats["avg_annual_rainfall_mm"] > 0 else 0

            extreme_change = decade3_stats["avg_extreme_days"] - decade1_stats["avg_extreme_days"]
            extreme_change_pct = (extreme_change / decade1_stats["avg_extreme_days"]) * 100 if decade1_stats["avg_extreme_days"] > 0 else 0

            rainy_days_change = decade3_stats["avg_rainy_days"] - decade1_stats["avg_rainy_days"]
            rainy_days_change_pct = (rainy_days_change / decade1_stats["avg_rainy_days"]) * 100 if decade1_stats["avg_rainy_days"] > 0 else 0

            max_intensity_change = decade3_stats["max_daily_mm"] - decade1_stats["max_daily_mm"]

            changes = [
                {
                    "metric": "Annual Rainfall",
                    "first_decade": f"{decade1_stats['avg_annual_rainfall_mm']:.0f} mm",
                    "last_decade": f"{decade3_stats['avg_annual_rainfall_mm']:.0f} mm",
                    "change": f"{rainfall_change:+.0f} mm",
                    "change_pct": round(rainfall_change_pct, 1),
                    "trend": "increasing" if rainfall_change > 0 else "decreasing" if rainfall_change < 0 else "stable",
                },
                {
                    "metric": "Extreme Rain Days (>100mm)",
                    "first_decade": f"{decade1_stats['avg_extreme_days']:.1f} days/yr",
                    "last_decade": f"{decade3_stats['avg_extreme_days']:.1f} days/yr",
                    "change": f"{extreme_change:+.2f} days/yr",
                    "change_pct": round(extreme_change_pct, 1),
                    "trend": "increasing" if extreme_change > 0 else "decreasing" if extreme_change < 0 else "stable",
                },
                {
                    "metric": "Rainy Days per Year",
                    "first_decade": f"{decade1_stats['avg_rainy_days']:.0f} days",
                    "last_decade": f"{decade3_stats['avg_rainy_days']:.0f} days",
                    "change": f"{rainy_days_change:+.0f} days",
                    "change_pct": round(rainy_days_change_pct, 1),
                    "trend": "increasing" if rainy_days_change > 0 else "decreasing" if rainy_days_change < 0 else "stable",
                },
                {
                    "metric": "Max Daily Intensity",
                    "first_decade": f"{decade1_stats['max_daily_mm']:.0f} mm",
                    "last_decade": f"{decade3_stats['max_daily_mm']:.0f} mm",
                    "change": f"{max_intensity_change:+.0f} mm",
                    "change_pct": round((max_intensity_change / decade1_stats['max_daily_mm']) * 100, 1) if decade1_stats['max_daily_mm'] > 0 else 0,
                    "trend": "increasing" if max_intensity_change > 0 else "decreasing" if max_intensity_change < 0 else "stable",
                },
            ]

        # Calculate 5-year moving averages for trend line
        moving_avg_5yr = []
        for i in range(len(yearly_trends)):
            if i >= 4:  # Need at least 5 years
                window = yearly_trends[i-4:i+1]
                moving_avg_5yr.append({
                    "year": yearly_trends[i]["year"],
                    "avg_rainfall_mm": round(statistics.mean([w["total_rainfall_mm"] for w in window]), 1),
                    "avg_extreme_days": round(statistics.mean([w["extreme_days"] for w in window]), 2),
                })

        # Extreme events by decade
        extreme_by_decade = {
            "decade1": {"years": decade1_stats["years"] if decade1_stats else "", "count": 0, "events": []},
            "decade2": {"years": decade2_stats["years"] if decade2_stats else "", "count": 0, "events": []},
            "decade3": {"years": decade3_stats["years"] if decade3_stats else "", "count": 0, "events": []},
        }

        for record in rainfall_data:
            if record["precipitation_mm"] >= 100:
                year = record["year"]
                event = {"date": record["date"], "precipitation_mm": record["precipitation_mm"]}
                if year < decade1_end:
                    extreme_by_decade["decade1"]["count"] += 1
                    extreme_by_decade["decade1"]["events"].append(event)
                elif year < decade2_end:
                    extreme_by_decade["decade2"]["count"] += 1
                    extreme_by_decade["decade2"]["events"].append(event)
                else:
                    extreme_by_decade["decade3"]["count"] += 1
                    extreme_by_decade["decade3"]["events"].append(event)

        # Sort and limit events per decade
        for d in extreme_by_decade.values():
            d["events"] = sorted(d["events"], key=lambda x: x["precipitation_mm"], reverse=True)[:5]

        return {
            "period_analyzed": f"{min_year}-{max_year}",
            "decades": {
                "first": decade1_stats,
                "second": decade2_stats,
                "third": decade3_stats,
            },
            "changes": changes,
            "moving_average_5yr": moving_avg_5yr,
            "extreme_events_by_decade": extreme_by_decade,
            "key_findings": self._generate_key_findings(changes, extreme_by_decade),
        }

    def _generate_key_findings(self, changes: list, extreme_by_decade: dict) -> list[str]:
        """Generate human-readable key findings from climate analysis"""
        findings = []

        for change in changes:
            if change["metric"] == "Annual Rainfall":
                if abs(change["change_pct"]) > 5:
                    direction = "increased" if change["change_pct"] > 0 else "decreased"
                    findings.append(f"Annual rainfall has {direction} by {abs(change['change_pct']):.1f}% over 30 years")

            elif change["metric"] == "Extreme Rain Days (>100mm)":
                if change["change_pct"] > 20:
                    findings.append(f"Extreme rainfall events (>100mm/day) have increased by {change['change_pct']:.0f}%")
                elif change["change_pct"] < -20:
                    findings.append(f"Extreme rainfall events have decreased by {abs(change['change_pct']):.0f}%")

            elif change["metric"] == "Max Daily Intensity":
                if change["change_pct"] > 10:
                    findings.append(f"Maximum daily rainfall intensity has increased by {change['change_pct']:.0f}%")

        # Compare extreme events across decades
        d1_count = extreme_by_decade["decade1"]["count"]
        d3_count = extreme_by_decade["decade3"]["count"]
        if d3_count > d1_count * 1.5:
            findings.append(f"Extreme events in the last decade ({d3_count}) are significantly higher than the first decade ({d1_count})")
        elif d3_count < d1_count * 0.7:
            findings.append(f"Extreme events have reduced from {d1_count} in the first decade to {d3_count} in the last")

        if not findings:
            findings.append("Climate patterns have remained relatively stable over the 30-year period")

        return findings

    def get_flood_risk_by_month(self, patterns: dict) -> list[dict]:
        """Get flood risk ranking by month"""
        risk_scores = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
        months = []

        for month_num, data in patterns.items():
            months.append({
                "month": month_num,
                "month_name": data["month_name"],
                "flood_risk": data["flood_risk"],
                "risk_score": risk_scores.get(data["flood_risk"], 1),
                "avg_rainfall_mm": data["avg_monthly_rainfall_mm"],
                "max_daily_mm": data["max_daily_rainfall_mm"],
            })

        # Sort by risk score descending
        months.sort(key=lambda x: (x["risk_score"], x["avg_rainfall_mm"]), reverse=True)
        return months

    async def run_full_analysis(self, district: str = "Colombo", years: int = 30) -> dict:
        """
        Run comprehensive flood pattern analysis for a district.
        Results are cached for 24 hours. Cache key includes yesterday's date
        to ensure data is refreshed daily.
        """
        from datetime import date
        yesterday = date.today() - timedelta(days=1)
        cache_key = f"{district}_{years}_{yesterday.isoformat()}"

        # Check if we have a valid cached result
        if cache_key in self._analysis_cache:
            cached = self._analysis_cache[cache_key]
            cache_age = (datetime.utcnow() - cached["cached_at"]).total_seconds() / 3600
            if cache_age < self.CACHE_DURATION_HOURS:
                logger.info(f"Returning cached analysis for {district} ({cache_age:.1f}h old)")
                return cached["data"]

        coords = DISTRICT_COORDS.get(district, DISTRICT_COORDS["Colombo"])
        end_year = datetime.now().year
        start_year = end_year - years

        logger.info(f"Fetching historical data for {district} ({start_year}-{end_year})...")

        # Fetch historical rainfall data
        rainfall_data = await self.fetch_historical_rainfall(
            coords["lat"], coords["lon"],
            start_year, end_year
        )

        if not rainfall_data:
            return {"error": "Failed to fetch historical data"}

        logger.info(f"Analyzing {len(rainfall_data)} days of data...")

        # Run analyses
        monthly_patterns = self.analyze_monthly_patterns(rainfall_data)
        seasonal_patterns = self.analyze_seasonal_patterns(rainfall_data)
        extreme_events = self.analyze_extreme_events(rainfall_data)
        yearly_trends = self.analyze_yearly_trends(rainfall_data)
        flood_risk_months = self.get_flood_risk_by_month(monthly_patterns)
        climate_change = self.analyze_climate_change_trends(rainfall_data, yearly_trends)

        # Calculate summary statistics
        total_records = len(rainfall_data)
        all_precip = [r["precipitation_mm"] for r in rainfall_data]

        result = {
            "district": district,
            "coordinates": coords,
            "period": f"{start_year}-{end_year}",
            "total_days_analyzed": total_records,
            "summary": {
                "total_rainfall_mm": round(sum(all_precip), 1),
                "avg_annual_rainfall_mm": round(sum(all_precip) / max(1, years), 1),
                "avg_daily_rainfall_mm": round(statistics.mean(all_precip), 2) if all_precip else 0,
                "max_daily_rainfall_mm": round(max(all_precip), 1) if all_precip else 0,
                "rainy_days_total": len([p for p in all_precip if p > 1]),
                "heavy_rain_days": len([p for p in all_precip if p > 50]),
                "extreme_rain_days": len([p for p in all_precip if p > 100]),
            },
            "monthly_patterns": monthly_patterns,
            "seasonal_patterns": seasonal_patterns,
            "flood_risk_months": flood_risk_months,
            "extreme_events": extreme_events[:20],  # Top 20
            "yearly_trends": yearly_trends,
            "climate_change": climate_change,
            "analyzed_at": datetime.utcnow().isoformat(),
            "cached": True,
        }

        # Cache the result
        self._analysis_cache[cache_key] = {
            "data": result,
            "cached_at": datetime.utcnow(),
        }
        logger.info(f"Cached analysis for {district} ({years} years)")

        return result

    async def get_national_flood_patterns(self) -> dict:
        """
        Get aggregated flood patterns across multiple districts.
        Uses cached data from key flood-prone districts.
        """
        # Analyze 3 key districts as a representative sample
        key_districts = ["Colombo", "Ratnapura", "Batticaloa"]
        all_monthly = defaultdict(lambda: {"rainfall": [], "risk_scores": []})
        all_extreme = []

        risk_scores = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}

        for district in key_districts:
            try:
                analysis = await self.run_full_analysis(district, years=30)
                if "error" not in analysis:
                    for month, data in analysis["monthly_patterns"].items():
                        all_monthly[month]["rainfall"].append(data["avg_monthly_rainfall_mm"])
                        all_monthly[month]["risk_scores"].append(risk_scores.get(data["flood_risk"], 1))

                    all_extreme.extend(analysis["extreme_events"])
            except Exception as e:
                logger.warning(f"Failed analysis for {district}: {e}")

        # Aggregate monthly patterns
        national_monthly = {}
        for month, data in all_monthly.items():
            avg_rainfall = statistics.mean(data["rainfall"]) if data["rainfall"] else 0
            avg_risk = statistics.mean(data["risk_scores"]) if data["risk_scores"] else 1

            if avg_risk >= 2.5:
                risk_level = "HIGH"
            elif avg_risk >= 1.5:
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"

            national_monthly[month] = {
                "month_name": datetime(2000, int(month), 1).strftime("%B"),
                "avg_rainfall_mm": round(avg_rainfall, 1),
                "flood_risk": risk_level,
            }

        # Sort extreme events
        all_extreme.sort(key=lambda x: x["precipitation_mm"], reverse=True)

        return {
            "districts_analyzed": key_districts,
            "monthly_patterns": national_monthly,
            "top_extreme_events": all_extreme[:30],
            "peak_flood_months": [
                m for m, d in national_monthly.items()
                if d["flood_risk"] == "HIGH"
            ],
            "analyzed_at": datetime.utcnow().isoformat(),
        }


# Singleton instance
flood_analyzer = FloodPatternAnalyzer()
