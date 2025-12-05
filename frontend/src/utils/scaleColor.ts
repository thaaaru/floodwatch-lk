/**
 * Wind Speed Color Scale Utilities
 * Provides continuous gradient color mapping for wind speed visualization
 */

// Continuous gradient color stops (speed in m/s -> RGB)
const COLOR_STOPS = [
  { speed: 0, color: [100, 149, 237] },    // Cornflower blue - calm
  { speed: 2, color: [65, 182, 230] },     // Light blue
  { speed: 4, color: [72, 209, 204] },     // Cyan
  { speed: 6, color: [60, 179, 113] },     // Medium sea green
  { speed: 8, color: [124, 205, 82] },     // Yellow-green
  { speed: 10, color: [192, 229, 65] },    // Lime
  { speed: 12, color: [255, 235, 59] },    // Yellow
  { speed: 15, color: [255, 193, 7] },     // Amber
  { speed: 18, color: [255, 152, 0] },     // Orange
  { speed: 21, color: [255, 87, 34] },     // Deep orange
  { speed: 25, color: [244, 67, 54] },     // Red
  { speed: 30, color: [183, 28, 28] },     // Dark red
  { speed: 40, color: [156, 39, 176] },    // Purple - storm
];

/**
 * Interpolate between two colors
 */
function lerpColor(color1: number[], color2: number[], t: number): number[] {
  return [
    Math.round(color1[0] + (color2[0] - color1[0]) * t),
    Math.round(color1[1] + (color2[1] - color1[1]) * t),
    Math.round(color1[2] + (color2[2] - color1[2]) * t),
  ];
}

/**
 * Get RGB color for a given wind speed using continuous interpolation
 */
export function getWindSpeedColor(speed: number): number[] {
  if (speed <= COLOR_STOPS[0].speed) {
    return COLOR_STOPS[0].color;
  }
  if (speed >= COLOR_STOPS[COLOR_STOPS.length - 1].speed) {
    return COLOR_STOPS[COLOR_STOPS.length - 1].color;
  }

  // Find the two color stops to interpolate between
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (speed >= COLOR_STOPS[i].speed && speed < COLOR_STOPS[i + 1].speed) {
      const t = (speed - COLOR_STOPS[i].speed) / (COLOR_STOPS[i + 1].speed - COLOR_STOPS[i].speed);
      return lerpColor(COLOR_STOPS[i].color, COLOR_STOPS[i + 1].color, t);
    }
  }

  return COLOR_STOPS[COLOR_STOPS.length - 1].color;
}

/**
 * Get CSS color string for a given wind speed
 */
export function getWindSpeedColorCSS(speed: number, alpha: number = 1): string {
  const rgb = getWindSpeedColor(speed);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Get hex color for a given wind speed
 */
export function getWindSpeedColorHex(speed: number): string {
  const rgb = getWindSpeedColor(speed);
  return `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Generate gradient stops for CSS/Canvas gradient
 */
export function generateGradientStops(minSpeed: number, maxSpeed: number, numStops: number = 10): Array<{ offset: number; color: string }> {
  const stops: Array<{ offset: number; color: string }> = [];
  for (let i = 0; i <= numStops; i++) {
    const speed = minSpeed + (maxSpeed - minSpeed) * (i / numStops);
    const offset = i / numStops;
    stops.push({
      offset,
      color: getWindSpeedColorHex(speed),
    });
  }
  return stops;
}

/**
 * Pre-computed color lookup table for performance
 */
export function createColorLUT(maxSpeed: number = 50, resolution: number = 100): Uint8Array {
  const lut = new Uint8Array(resolution * 3);
  for (let i = 0; i < resolution; i++) {
    const speed = (i / resolution) * maxSpeed;
    const rgb = getWindSpeedColor(speed);
    lut[i * 3] = rgb[0];
    lut[i * 3 + 1] = rgb[1];
    lut[i * 3 + 2] = rgb[2];
  }
  return lut;
}

/**
 * Get color from pre-computed LUT
 */
export function getColorFromLUT(lut: Uint8Array, speed: number, maxSpeed: number = 50): number[] {
  const resolution = lut.length / 3;
  const index = Math.min(Math.floor((speed / maxSpeed) * resolution), resolution - 1);
  return [lut[index * 3], lut[index * 3 + 1], lut[index * 3 + 2]];
}

/**
 * Get the color stops for legend display
 */
export function getColorStops(): typeof COLOR_STOPS {
  return COLOR_STOPS;
}

export { COLOR_STOPS };
