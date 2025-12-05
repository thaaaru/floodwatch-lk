/**
 * Wind Vector Utilities
 * Converts wind U/V components to direction, magnitude, and visual properties
 */

export interface WindVector {
  u: number;           // Eastward component (m/s)
  v: number;           // Northward component (m/s)
  speed: number;       // Magnitude (m/s)
  direction: number;   // Meteorological direction (degrees, 0=N, 90=E)
  cardinalDir: string; // Cardinal direction (N, NE, E, etc.)
}

/**
 * Convert U/V wind components to speed and direction
 */
export function uvToVector(u: number, v: number): WindVector {
  const speed = Math.sqrt(u * u + v * v);

  // Meteorological convention: direction wind is coming FROM
  // atan2(-u, -v) gives direction in radians, convert to degrees
  let direction = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;

  return {
    u,
    v,
    speed,
    direction,
    cardinalDir: degreesToCardinal(direction),
  };
}

/**
 * Convert degrees to cardinal direction
 */
export function degreesToCardinal(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * Get arrow rotation angle for canvas rendering
 * Returns angle in radians for drawing arrow pointing in wind direction
 */
export function getArrowAngle(u: number, v: number): number {
  // Direction wind is blowing TO (opposite of meteorological convention)
  return Math.atan2(-v, u);
}

/**
 * Calculate arrow length based on wind speed
 */
export function getArrowLength(speed: number, baseLength: number = 15, maxLength: number = 40): number {
  // Logarithmic scaling for better visualization of wide speed ranges
  const minSpeed = 1;
  const maxSpeed = 25;
  const normalizedSpeed = Math.max(minSpeed, Math.min(speed, maxSpeed));
  const t = Math.log(normalizedSpeed) / Math.log(maxSpeed);
  return baseLength + t * (maxLength - baseLength);
}

/**
 * Calculate arrow thickness based on wind speed
 */
export function getArrowThickness(speed: number, baseThickness: number = 1, maxThickness: number = 3): number {
  const t = Math.min(speed / 20, 1);
  return baseThickness + t * (maxThickness - baseThickness);
}

/**
 * Bilinear interpolation for wind field
 */
export function interpolateWind(
  lon: number,
  lat: number,
  lons: number[],
  lats: number[],
  uGrid: number[][],
  vGrid: number[][],
  speedGrid: number[][]
): WindVector | null {
  // Find grid cell
  let i0 = -1, j0 = -1;
  for (let i = 0; i < lons.length - 1; i++) {
    if (lon >= lons[i] && lon <= lons[i + 1]) { i0 = i; break; }
  }
  for (let j = 0; j < lats.length - 1; j++) {
    if (lat >= lats[j] && lat <= lats[j + 1]) { j0 = j; break; }
  }

  if (i0 < 0 || j0 < 0) return null;

  // Interpolation weights
  const tx = (lon - lons[i0]) / (lons[i0 + 1] - lons[i0]);
  const ty = (lat - lats[j0]) / (lats[j0 + 1] - lats[j0]);

  // Bilinear interpolation
  const interp = (arr: number[][]) => {
    const v00 = arr[j0][i0], v10 = arr[j0][i0 + 1];
    const v01 = arr[j0 + 1][i0], v11 = arr[j0 + 1][i0 + 1];
    return (1 - tx) * (1 - ty) * v00 + tx * (1 - ty) * v10 +
           (1 - tx) * ty * v01 + tx * ty * v11;
  };

  const u = interp(uGrid);
  const v = interp(vGrid);
  const speed = interp(speedGrid);

  return {
    u,
    v,
    speed,
    direction: (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360,
    cardinalDir: degreesToCardinal((Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360),
  };
}

/**
 * Level of Detail (LOD) configuration based on zoom level
 */
export interface LODConfig {
  arrowSpacing: number;      // Pixels between arrows
  particleCount: number;     // Number of particles
  particleSpeed: number;     // Particle movement speed multiplier
  showArrows: boolean;       // Whether to show arrows at this zoom
  arrowScale: number;        // Arrow size multiplier
  gridCellSize: number;      // Wind field cache grid size
}

export function getLODConfig(zoom: number): LODConfig {
  // Moderate particle counts - visible but not overwhelming
  if (zoom <= 4) {
    return {
      arrowSpacing: 100,
      particleCount: 1500,
      particleSpeed: 0.4,
      showArrows: false,
      arrowScale: 0.6,
      gridCellSize: 20,
    };
  } else if (zoom <= 5) {
    return {
      arrowSpacing: 80,
      particleCount: 2000,
      particleSpeed: 0.5,
      showArrows: true,
      arrowScale: 0.7,
      gridCellSize: 15,
    };
  } else if (zoom <= 6) {
    return {
      arrowSpacing: 60,
      particleCount: 2500,
      particleSpeed: 0.6,
      showArrows: true,
      arrowScale: 0.8,
      gridCellSize: 12,
    };
  } else if (zoom <= 7) {
    return {
      arrowSpacing: 50,
      particleCount: 3000,
      particleSpeed: 0.7,
      showArrows: true,
      arrowScale: 0.9,
      gridCellSize: 10,
    };
  } else if (zoom <= 8) {
    return {
      arrowSpacing: 40,
      particleCount: 3500,
      particleSpeed: 0.8,
      showArrows: true,
      arrowScale: 1.0,
      gridCellSize: 8,
    };
  } else {
    return {
      arrowSpacing: 35,
      particleCount: 4000,
      particleSpeed: 0.9,
      showArrows: true,
      arrowScale: 1.1,
      gridCellSize: 6,
    };
  }
}

/**
 * Format wind speed for display
 */
export function formatWindSpeed(speed: number, decimals: number = 1): string {
  return speed.toFixed(decimals);
}

/**
 * Format wind direction for display
 */
export function formatWindDirection(direction: number): string {
  return `${Math.round(direction)}°`;
}
