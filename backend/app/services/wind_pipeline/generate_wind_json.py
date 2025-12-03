"""
GFS Wind Data Pipeline
Downloads GFS GRIB2 files (UGRD + VGRD @ 10m) from NOAA NOMADS,
processes them, and outputs JSON vector fields for wind visualization.
"""
import os
import json
import math
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
import httpx
import numpy as np

logger = logging.getLogger(__name__)

# NOAA NOMADS GFS data URL patterns
NOMADS_BASE = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl"

# Output directory for processed wind data
WIND_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "wind_data")

# Sri Lanka + surrounding ocean (expanded for detecting approaching weather systems)
# Covers Bay of Bengal, Arabian Sea, and Indian Ocean around Sri Lanka
SRI_LANKA_BOUNDS = {
    "lat_min": -5.0,   # Extended south into Indian Ocean
    "lat_max": 20.0,   # Extended north to cover Bay of Bengal / India
    "lon_min": 68.0,   # Extended west into Arabian Sea
    "lon_max": 95.0    # Extended east into Bay of Bengal
}

# Wider regional bounds (South Asia / Indian Ocean)
REGIONAL_BOUNDS = {
    "lat_min": -10.0,
    "lat_max": 30.0,
    "lon_min": 60.0,
    "lon_max": 100.0
}

# Global bounds for full earth view
GLOBAL_BOUNDS = {
    "lat_min": -90.0,
    "lat_max": 90.0,
    "lon_min": 0.0,
    "lon_max": 360.0
}

# Grid resolution for output (degrees)
OUTPUT_RESOLUTION = 0.5  # Downsample from 0.25 to 0.5 for performance


def get_latest_gfs_run() -> Tuple[str, str]:
    """
    Get the latest available GFS model run.
    GFS runs at 00, 06, 12, 18 UTC.
    Returns (date_str, hour_str) e.g., ("20231215", "12")
    """
    now = datetime.utcnow()
    # GFS data is typically available ~4 hours after run time
    available_time = now - timedelta(hours=5)

    # Find the latest run hour
    run_hour = (available_time.hour // 6) * 6
    run_time = available_time.replace(hour=run_hour, minute=0, second=0, microsecond=0)

    date_str = run_time.strftime("%Y%m%d")
    hour_str = f"{run_hour:02d}"

    return date_str, hour_str


def download_gfs_wind_data(
    date_str: str,
    run_hour: str,
    forecast_hour: int,
    bounds: Dict = None
) -> Optional[Dict]:
    """
    Download U and V wind components from NOAA NOMADS.
    Tries OPeNDAP first (no special libraries needed), then GRIB2, then synthetic.
    """
    if bounds is None:
        bounds = SRI_LANKA_BOUNDS

    # Try OPeNDAP first (ASCII format, no special libs needed)
    try:
        from .opendap_fetcher import fetch_gfs_wind_opendap
        logger.info(f"Trying OPeNDAP for {date_str}/{run_hour} f{forecast_hour:03d}")
        real_data = fetch_gfs_wind_opendap(
            date_str, run_hour, forecast_hour, bounds,
            resolution=OUTPUT_RESOLUTION
        )
        if real_data:
            logger.info("Successfully fetched wind data via OPeNDAP")
            return real_data
    except ImportError:
        logger.info("OPeNDAP fetcher not available")
    except Exception as e:
        logger.warning(f"OPeNDAP fetch failed: {e}")

    # Try GRIB2 method (requires cfgrib)
    try:
        from .gfs_fetcher import fetch_and_process_gfs
        real_data = fetch_and_process_gfs(date_str, run_hour, forecast_hour, bounds)
        if real_data:
            return process_raw_wind_data(real_data, bounds)
    except ImportError:
        logger.info("GFS GRIB2 fetcher not available")
    except Exception as e:
        logger.warning(f"GRIB2 fetch failed: {e}")

    # Fallback to synthetic data
    logger.info("Falling back to synthetic wind data")
    return generate_synthetic_wind_data(bounds, forecast_hour)


def process_raw_wind_data(raw_data: Dict, bounds: Dict) -> Dict:
    """
    Process raw wind data (from GRIB2 decode) into final format.
    Handles resampling, speed calculation, and metadata.
    """
    lon = np.array(raw_data["lon"])
    lat = np.array(raw_data["lat"])
    u = np.array(raw_data["u"])
    v = np.array(raw_data["v"])

    # Calculate speed
    speed = np.sqrt(u ** 2 + v ** 2)

    return {
        "lon": lon.tolist(),
        "lat": lat.tolist(),
        "u": u.tolist(),
        "v": v.tolist(),
        "speed": speed.tolist(),
        "meta": {
            "min_speed": float(np.min(speed)),
            "max_speed": float(np.max(speed)),
            "mean_speed": float(np.mean(speed)),
            "grid_resolution": OUTPUT_RESOLUTION,
            "bounds": bounds,
            "data_source": "gfs"
        }
    }


def generate_synthetic_wind_data(bounds: Dict, forecast_hour: int = 0) -> Dict:
    """
    Generate realistic synthetic wind data for demonstration.
    Simulates monsoon patterns and cyclonic features.
    """
    # Create grid
    lons = np.arange(bounds["lon_min"], bounds["lon_max"] + OUTPUT_RESOLUTION, OUTPUT_RESOLUTION)
    lats = np.arange(bounds["lat_min"], bounds["lat_max"] + OUTPUT_RESOLUTION, OUTPUT_RESOLUTION)

    # Create meshgrid
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    # Generate realistic wind patterns
    # Base flow (trade winds / monsoon pattern for Sri Lanka)
    np.random.seed(int(datetime.utcnow().timestamp()) % 1000 + forecast_hour)

    # Determine monsoon season (SW: May-Sep, NE: Nov-Feb)
    month = datetime.utcnow().month
    if 5 <= month <= 9:
        # Southwest monsoon - winds FROM SW, blowing TO NE
        # U positive = eastward, V positive = northward
        base_u = 5.0 + np.random.randn(*lon_grid.shape) * 2
        base_v = 3.0 + np.random.randn(*lon_grid.shape) * 2
    elif month >= 11 or month <= 2:
        # Northeast monsoon - winds FROM NE, blowing TO SW
        # U negative = westward, V negative = southward
        base_u = -4.0 + np.random.randn(*lon_grid.shape) * 2
        base_v = -4.0 + np.random.randn(*lon_grid.shape) * 2
    else:
        # Inter-monsoon - variable
        base_u = np.random.randn(*lon_grid.shape) * 3
        base_v = np.random.randn(*lon_grid.shape) * 3

    # Add spatial variation (cyclonic patterns)
    center_lon = (bounds["lon_min"] + bounds["lon_max"]) / 2
    center_lat = (bounds["lat_min"] + bounds["lat_max"]) / 2

    # Distance from center
    dx = lon_grid - center_lon
    dy = lat_grid - center_lat
    r = np.sqrt(dx ** 2 + dy ** 2)

    # Add rotational component (weak cyclonic tendency)
    rotation_strength = 2.0 * np.exp(-r / 3.0)
    u_rotation = -dy * rotation_strength / (r + 0.1)
    v_rotation = dx * rotation_strength / (r + 0.1)

    # Combine with temporal variation
    u = base_u + u_rotation + np.sin(lon_grid * 0.5 + forecast_hour * 0.1) * 2
    v = base_v + v_rotation + np.cos(lat_grid * 0.5 + forecast_hour * 0.1) * 2

    # Add time-based variation
    time_factor = 1.0 + 0.2 * np.sin(forecast_hour * np.pi / 12)
    u *= time_factor
    v *= time_factor

    # Calculate speed
    speed = np.sqrt(u ** 2 + v ** 2)

    return {
        "lon": lons.tolist(),
        "lat": lats.tolist(),
        "u": u.tolist(),
        "v": v.tolist(),
        "speed": speed.tolist(),
        "meta": {
            "min_speed": float(np.min(speed)),
            "max_speed": float(np.max(speed)),
            "mean_speed": float(np.mean(speed)),
            "grid_resolution": OUTPUT_RESOLUTION,
            "bounds": bounds,
            "data_source": "synthetic"
        }
    }


def save_wind_json(data: Dict, run_date: str, run_hour: str, forecast_hour: int):
    """
    Save processed wind data to JSON file.
    """
    os.makedirs(WIND_DATA_DIR, exist_ok=True)

    # Create run directory
    run_dir = os.path.join(WIND_DATA_DIR, f"{run_date}_{run_hour}")
    os.makedirs(run_dir, exist_ok=True)

    # Save JSON
    filename = f"wind_f{forecast_hour:03d}.json"
    filepath = os.path.join(run_dir, filename)

    # Add metadata
    data["run_date"] = run_date
    data["run_hour"] = run_hour
    data["forecast_hour"] = forecast_hour
    data["valid_time"] = (
        datetime.strptime(f"{run_date}{run_hour}", "%Y%m%d%H") +
        timedelta(hours=forecast_hour)
    ).isoformat()
    data["generated_at"] = datetime.utcnow().isoformat()

    with open(filepath, 'w') as f:
        json.dump(data, f)

    logger.info(f"Saved wind data to {filepath}")
    return filepath


def generate_all_forecast_hours(
    run_date: str = None,
    run_hour: str = None,
    max_hours: int = 120,
    step: int = 3,
    bounds: Dict = None
):
    """
    Generate wind JSON files for multiple forecast hours.
    """
    if run_date is None or run_hour is None:
        run_date, run_hour = get_latest_gfs_run()

    if bounds is None:
        bounds = SRI_LANKA_BOUNDS

    logger.info(f"Generating wind data for run {run_date}/{run_hour}")

    generated_files = []
    for fhr in range(0, max_hours + 1, step):
        try:
            data = download_gfs_wind_data(run_date, run_hour, fhr, bounds)
            if data:
                filepath = save_wind_json(data, run_date, run_hour, fhr)
                generated_files.append(filepath)
        except Exception as e:
            logger.error(f"Failed to generate f{fhr:03d}: {e}")

    # Save metadata file
    meta = {
        "run_date": run_date,
        "run_hour": run_hour,
        "forecast_hours": list(range(0, max_hours + 1, step)),
        "bounds": bounds,
        "generated_at": datetime.utcnow().isoformat(),
        "file_count": len(generated_files)
    }

    meta_path = os.path.join(WIND_DATA_DIR, f"{run_date}_{run_hour}", "meta.json")
    with open(meta_path, 'w') as f:
        json.dump(meta, f)

    return generated_files


def get_available_runs() -> List[Dict]:
    """
    Get list of available model runs with their forecast hours.
    """
    runs = []

    if not os.path.exists(WIND_DATA_DIR):
        return runs

    for dirname in sorted(os.listdir(WIND_DATA_DIR), reverse=True):
        run_dir = os.path.join(WIND_DATA_DIR, dirname)
        if os.path.isdir(run_dir):
            meta_path = os.path.join(run_dir, "meta.json")
            if os.path.exists(meta_path):
                with open(meta_path, 'r') as f:
                    meta = json.load(f)
                    runs.append(meta)
            else:
                # Scan for available hours
                hours = []
                for fname in os.listdir(run_dir):
                    if fname.startswith("wind_f") and fname.endswith(".json"):
                        try:
                            hour = int(fname[6:9])
                            hours.append(hour)
                        except:
                            pass

                if hours:
                    parts = dirname.split("_")
                    if len(parts) == 2:
                        runs.append({
                            "run_date": parts[0],
                            "run_hour": parts[1],
                            "forecast_hours": sorted(hours)
                        })

    return runs


def get_wind_data(run_date: str, run_hour: str, forecast_hour: int) -> Optional[Dict]:
    """
    Load wind data for a specific run and forecast hour.
    """
    filepath = os.path.join(
        WIND_DATA_DIR,
        f"{run_date}_{run_hour}",
        f"wind_f{forecast_hour:03d}.json"
    )

    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return json.load(f)

    return None


# CLI entry point
if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser(description="Generate GFS wind data JSON files")
    parser.add_argument("--date", help="Run date (YYYYMMDD)")
    parser.add_argument("--hour", help="Run hour (00/06/12/18)")
    parser.add_argument("--max-hours", type=int, default=120, help="Maximum forecast hours")
    parser.add_argument("--step", type=int, default=3, help="Hour step")
    parser.add_argument("--region", choices=["srilanka", "regional", "global"], default="srilanka")

    args = parser.parse_args()

    if args.region == "srilanka":
        bounds = SRI_LANKA_BOUNDS
    elif args.region == "regional":
        bounds = REGIONAL_BOUNDS
    else:
        bounds = GLOBAL_BOUNDS

    files = generate_all_forecast_hours(
        run_date=args.date,
        run_hour=args.hour,
        max_hours=args.max_hours,
        step=args.step,
        bounds=bounds
    )

    print(f"Generated {len(files)} wind data files")
