"""
NOAA NOMADS OPeNDAP (DODS) Wind Data Fetcher

Fetches real GFS wind data via OPeNDAP protocol, which returns ASCII data.
No GRIB libraries needed - parses directly from ASCII response.

DODS URL format:
https://nomads.ncep.noaa.gov/dods/gfs_0p25/gfs{YYYYMMDD}/gfs_0p25_{HH}z.ascii?{variable}[time][lat][lon]

Variables:
- ugrd10m: U-component of wind at 10m above ground (m/s)
- vgrd10m: V-component of wind at 10m above ground (m/s)

Grid indices:
- Time: forecast hours index (0, 1, 2, ... for f000, f003, f006, etc.)
- Lat: 0-720 (90S to 90N, 0.25 degree steps) - index = (lat + 90) / 0.25
- Lon: 0-1439 (0E to 359.75E, 0.25 degree steps) - index = lon / 0.25
"""
import re
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
import httpx
import numpy as np

logger = logging.getLogger(__name__)

# NOMADS DODS base URL
NOMADS_DODS_BASE = "https://nomads.ncep.noaa.gov/dods/gfs_0p25"

# Timeout for downloads
DOWNLOAD_TIMEOUT = 120.0


def lat_to_index(lat: float) -> int:
    """Convert latitude to DODS grid index. South to North: -90 to 90."""
    return int((lat + 90.0) / 0.25)


def lon_to_index(lon: float) -> int:
    """Convert longitude to DODS grid index. 0 to 360."""
    if lon < 0:
        lon += 360
    return int(lon / 0.25)


def index_to_lat(idx: int) -> float:
    """Convert DODS grid index to latitude."""
    return -90.0 + idx * 0.25


def index_to_lon(idx: int) -> float:
    """Convert DODS grid index to longitude."""
    return idx * 0.25


def forecast_hour_to_time_index(forecast_hour: int) -> int:
    """
    Convert forecast hour to time index in DODS.
    GFS 0.25 has 3-hourly output: f000, f003, f006, etc.
    """
    return forecast_hour // 3


def get_available_gfs_runs(hours_back: int = 24) -> List[Tuple[str, str]]:
    """Check which GFS runs are available on NOMADS DODS."""
    available = []
    now = datetime.utcnow()

    for hours_ago in range(0, hours_back, 6):
        check_time = now - timedelta(hours=hours_ago + 4)  # GFS available ~4h after
        run_hour = (check_time.hour // 6) * 6
        run_time = check_time.replace(hour=run_hour, minute=0, second=0, microsecond=0)

        date_str = run_time.strftime("%Y%m%d")
        hour_str = f"{run_hour:02d}"

        # Quick check if this run exists
        url = f"{NOMADS_DODS_BASE}/gfs{date_str}"
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.head(url, follow_redirects=True)
                if resp.status_code == 200:
                    available.append((date_str, hour_str))
        except Exception:
            pass

    return available


def parse_dods_ascii(response_text: str) -> Tuple[np.ndarray, List[float], List[float]]:
    """
    Parse DODS ASCII response into numpy array and coordinate arrays.

    DODS ASCII format example:
    ugrd10m, [1][4][4]
    [0][0], -8.608691, -8.918692, -8.488691, -8.228691
    [0][1], -8.588691, -8.988691, -8.738691, -8.398691
    ...

    time, [1]
    739589.25
    lat, [4]
    -10.0, -9.5, -9.0, -8.5
    lon, [4]
    79.0, 79.5, 80.0, 80.5
    """
    lines = response_text.strip().split('\n')

    data_lines = []
    lat_values = []
    lon_values = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1

        if not line:
            continue

        # Check for lat coordinate array
        if line.startswith('lat,'):
            # Next line contains the values
            if i < len(lines):
                lat_line = lines[i].strip()
                lat_values = [float(x.strip()) for x in lat_line.split(',') if x.strip()]
                i += 1
            continue

        # Check for lon coordinate array
        if line.startswith('lon,'):
            # Next line contains the values
            if i < len(lines):
                lon_line = lines[i].strip()
                lon_values = [float(x.strip()) for x in lon_line.split(',') if x.strip()]
                i += 1
            continue

        # Check for data lines (start with [time][lat], value, value, ...)
        if line.startswith('['):
            # Extract values after the index prefix
            # Format: [0][0], 1.234, 5.678, ...
            match = re.match(r'\[\d+\]\[\d+\],\s*(.*)', line)
            if match:
                value_str = match.group(1)
                values = [float(x.strip()) for x in value_str.split(',') if x.strip()]
                data_lines.append(values)

    if not data_lines:
        raise ValueError("No data found in DODS response")

    # Convert to numpy array
    data = np.array(data_lines)

    return data, lat_values, lon_values


def fetch_wind_component(
    date_str: str,
    run_hour: str,
    forecast_hour: int,
    variable: str,
    lat_min: float,
    lat_max: float,
    lon_min: float,
    lon_max: float,
    step: int = 2  # Skip every N points for lower resolution
) -> Optional[Tuple[np.ndarray, List[float], List[float]]]:
    """
    Fetch a single wind component (ugrd10m or vgrd10m) from NOMADS DODS.

    Returns (data_array, lat_list, lon_list) or None on failure.
    """
    # Convert bounds to grid indices
    # Note: lat indices go S to N (index 0 = -90, index 720 = +90)
    lat_idx_start = lat_to_index(lat_min)
    lat_idx_end = lat_to_index(lat_max)
    lon_idx_start = lon_to_index(lon_min)
    lon_idx_end = lon_to_index(lon_max)

    time_idx = forecast_hour_to_time_index(forecast_hour)

    # Build DODS URL with subsampling
    # Format: variable[time:time][lat_start:step:lat_end][lon_start:step:lon_end]
    url = (
        f"{NOMADS_DODS_BASE}/gfs{date_str}/gfs_0p25_{run_hour}z.ascii?"
        f"{variable}[{time_idx}][{lat_idx_start}:{step}:{lat_idx_end}][{lon_idx_start}:{step}:{lon_idx_end}]"
    )

    logger.info(f"Fetching {variable} from NOMADS DODS: forecast_hour={forecast_hour}")
    logger.debug(f"URL: {url}")

    try:
        with httpx.Client(timeout=DOWNLOAD_TIMEOUT) as client:
            response = client.get(url)

            if response.status_code != 200:
                logger.error(f"DODS request failed with status {response.status_code}")
                return None

            content = response.text

            # Check for error messages
            if "Error" in content or "error" in content[:200].lower():
                logger.error(f"DODS returned error: {content[:500]}")
                return None

            # Parse the ASCII response
            data, lats, lons = parse_dods_ascii(content)

            return data, lats, lons

    except httpx.TimeoutException:
        logger.error("DODS request timed out")
        return None
    except Exception as e:
        logger.error(f"Failed to fetch from DODS: {e}")
        return None


def fetch_gfs_wind_opendap(
    date_str: str,
    run_hour: str,
    forecast_hour: int,
    bounds: Dict,
    resolution: float = 0.5  # Output resolution in degrees
) -> Optional[Dict]:
    """
    Fetch GFS wind data (U and V components) via OPeNDAP.

    Args:
        date_str: Run date (YYYYMMDD)
        run_hour: Run hour (00/06/12/18)
        forecast_hour: Forecast hour (0, 3, 6, ... must be multiple of 3)
        bounds: Dict with lat_min, lat_max, lon_min, lon_max
        resolution: Output resolution in degrees (0.5 = every 2 grid points)

    Returns:
        Dict with lon, lat, u, v, speed arrays and metadata
    """
    # Calculate step for subsampling (0.25 * step = resolution)
    step = max(1, int(resolution / 0.25))

    # Fetch U component
    u_result = fetch_wind_component(
        date_str, run_hour, forecast_hour,
        "ugrd10m",
        bounds["lat_min"], bounds["lat_max"],
        bounds["lon_min"], bounds["lon_max"],
        step=step
    )

    if u_result is None:
        logger.error("Failed to fetch U component")
        return None

    u_data, lats, lons = u_result

    # Fetch V component
    v_result = fetch_wind_component(
        date_str, run_hour, forecast_hour,
        "vgrd10m",
        bounds["lat_min"], bounds["lat_max"],
        bounds["lon_min"], bounds["lon_max"],
        step=step
    )

    if v_result is None:
        logger.error("Failed to fetch V component")
        return None

    v_data, _, _ = v_result

    # Calculate speed
    speed = np.sqrt(u_data ** 2 + v_data ** 2)

    # Convert longitude from 0-360 to -180-180 if needed
    lons_converted = [lon if lon <= 180 else lon - 360 for lon in lons]

    return {
        "lon": lons_converted,
        "lat": lats,
        "u": u_data.tolist(),
        "v": v_data.tolist(),
        "speed": speed.tolist(),
        "meta": {
            "min_speed": float(np.min(speed)),
            "max_speed": float(np.max(speed)),
            "mean_speed": float(np.mean(speed)),
            "grid_resolution": resolution,
            "bounds": bounds,
            "data_source": "gfs_opendap"
        }
    }


# Test function
if __name__ == "__main__":
    import json

    logging.basicConfig(level=logging.INFO)

    # Get latest available run
    runs = get_available_gfs_runs()
    if runs:
        date_str, run_hour = runs[0]
        print(f"Latest run: {date_str}/{run_hour}Z")

        # Fetch wind data for Sri Lanka region
        bounds = {
            "lat_min": 5.0,
            "lat_max": 10.0,
            "lon_min": 79.0,
            "lon_max": 82.0
        }

        result = fetch_gfs_wind_opendap(date_str, run_hour, 0, bounds, resolution=0.5)

        if result:
            print(f"Got {len(result['lat'])} lat x {len(result['lon'])} lon grid")
            print(f"Speed range: {result['meta']['min_speed']:.1f} - {result['meta']['max_speed']:.1f} m/s")
            print(json.dumps(result['meta'], indent=2))
        else:
            print("Failed to fetch wind data")
    else:
        print("No GFS runs available")
