// src/lib/maps/complexQuadratic.ts
export interface ComplexPoint {
  real: number;
  imag: number;
}

export interface ComplexIterationResult {
  point: ComplexPoint;
  iterations: number;
  escaped: boolean;
  finalValue: ComplexPoint;
}

/**
 * Escape-time result carrying both the raw integer iteration count and the
 * smooth (normalised) iteration count `nu`, so callers can colour without
 * integer banding. See `computeSmoothIterationCount` for the formula.
 */
export interface FractalEscapeResult {
  /** Raw integer count from the escape loop. */
  iterations: number;
  /** True if the point escaped before `maxIterations`. */
  escaped: boolean;
  /**
   * Continuous iteration count. Equal to `maxIterations` for interior
   * (non-escaping) points so they keep rendering as a flat colour/black.
   */
  smoothIterations: number;
}

/**
 * Default escape radius. Must be large (>> 2) for the smooth/normalised
 * iteration count formula below to be accurate -- it relies on |z| already
 * being deep into the regime where |z_{n+1}| ~= |z_n|^2, which only holds
 * once |z| is well past the point where curvature from `c` still matters.
 */
export const DEFAULT_ESCAPE_RADIUS = 256;

/**
 * Continuous (smooth) iteration count, a.k.a. the normalised iteration
 * count. Removes the integer-banded contour lines you get from coloring on
 * the raw escape-time integer.
 *
 * nu = n + 1 - log2(log|z_n|)
 *
 * Reference: "Continuous (smooth) coloring", Wikipedia: Plotting algorithms
 * for the Mandelbrot set. Requires |z_n| > 1 (guaranteed once the point has
 * escaped past `DEFAULT_ESCAPE_RADIUS`).
 */
export function computeSmoothIterationCount(
  iterations: number,
  finalMagnitude: number,
  escaped: boolean,
  maxIterations: number
): number {
  if (!escaped) {
    return maxIterations;
  }

  // Guard against |z| <= 1 (shouldn't happen once escaped past a sane
  // escape radius, but log(log(x)) blows up for x <= 1).
  const safeMagnitude = Math.max(finalMagnitude, Math.E);
  const nu = iterations + 1 - Math.log2(Math.log(safeMagnitude));

  return nu;
}

/**
 * Complex number arithmetic operations
 */
export class ComplexNumber {
  constructor(public real: number, public imag: number) {}

  add(other: ComplexNumber): ComplexNumber {
    return new ComplexNumber(this.real + other.real, this.imag + other.imag);
  }

  multiply(other: ComplexNumber): ComplexNumber {
    return new ComplexNumber(
      this.real * other.real - this.imag * other.imag,
      this.real * other.imag + this.imag * other.real
    );
  }

  squared(): ComplexNumber {
    return new ComplexNumber(
      this.real * this.real - this.imag * this.imag,
      2 * this.real * this.imag
    );
  }

  magnitude(): number {
    return Math.sqrt(this.real * this.real + this.imag * this.imag);
  }

  magnitudeSquared(): number {
    return this.real * this.real + this.imag * this.imag;
  }
}

/**
 * Calculate a single iteration of the complex quadratic map
 * Equation: z_{n+1} = z_n² + c
 * @param z Current complex number
 * @param c Complex parameter
 * @returns New complex number after one iteration
 */
export function calculateComplexQuadraticIteration(
  z: ComplexNumber,
  c: ComplexNumber
): ComplexNumber {
  return z.squared().add(c);
}

/**
 * Calculate the complex quadratic map trajectory
 * @param c Complex parameter
 * @param z0 Initial complex number (default: 0 + 0i)
 * @param maxIterations Maximum iterations (default: 100)
 * @param escapeRadius Escape radius (default: `DEFAULT_ESCAPE_RADIUS`, 256 --
 *   large enough for the smooth iteration count formula to be accurate)
 * @returns Iteration result with trajectory information
 */
export function calculateComplexQuadraticMap(
  c: ComplexNumber,
  z0: ComplexNumber = new ComplexNumber(0, 0),
  maxIterations: number = 100,
  escapeRadius: number = DEFAULT_ESCAPE_RADIUS
): ComplexIterationResult {
  let z = z0;
  let iterations = 0;
  let escaped = false;

  while (iterations < maxIterations && z.magnitude() <= escapeRadius) {
    z = calculateComplexQuadraticIteration(z, c);
    iterations++;
  }

  escaped = z.magnitude() > escapeRadius;

  return {
    point: z,
    iterations,
    escaped,
    finalValue: z
  };
}

/**
 * Generate Julia set data
 * @param c Complex parameter for Julia set
 * @param xMin, xMax, yMin, yMax Viewport bounds
 * @param width, height Image dimensions
 * @param maxIterations Maximum iterations per point
 * @returns 2D array of iteration counts
 */
export function calculateJuliaSet(
  c: ComplexNumber,
  xMin: number = -2,
  xMax: number = 2,
  yMin: number = -2,
  yMax: number = 2,
  width: number = 400,
  height: number = 400,
  maxIterations: number = 100
): FractalEscapeResult[][] {
  const data: FractalEscapeResult[][] = [];
  const xStep = (xMax - xMin) / width;
  const yStep = (yMax - yMin) / height;

  for (let y = 0; y < height; y++) {
    const row: FractalEscapeResult[] = [];
    const imag = yMin + y * yStep;

    for (let x = 0; x < width; x++) {
      const real = xMin + x * xStep;
      const z0 = new ComplexNumber(real, imag);
      const result = calculateComplexQuadraticMap(c, z0, maxIterations);
      const finalMagnitude = Math.sqrt(
        result.finalValue.real * result.finalValue.real +
        result.finalValue.imag * result.finalValue.imag
      );
      row.push({
        iterations: result.iterations,
        escaped: result.escaped,
        smoothIterations: computeSmoothIterationCount(
          result.iterations,
          finalMagnitude,
          result.escaped,
          maxIterations
        ),
      });
    }

    data.push(row);
  }

  return data;
}

/**
 * Generate Mandelbrot set data
 * @param xMin, xMax, yMin, yMax Viewport bounds
 * @param width, height Image dimensions
 * @param maxIterations Maximum iterations per point
 * @returns 2D array of iteration counts
 */
export function calculateMandelbrotSet(
  xMin: number = -2.5,
  xMax: number = 1,
  yMin: number = -1.25,
  yMax: number = 1.25,
  width: number = 400,
  height: number = 400,
  maxIterations: number = 100
): FractalEscapeResult[][] {
  const data: FractalEscapeResult[][] = [];
  const xStep = (xMax - xMin) / width;
  const yStep = (yMax - yMin) / height;

  for (let y = 0; y < height; y++) {
    const row: FractalEscapeResult[] = [];
    const imag = yMin + y * yStep;

    for (let x = 0; x < width; x++) {
      const real = xMin + x * xStep;
      const c = new ComplexNumber(real, imag);
      const z0 = new ComplexNumber(0, 0);
      const result = calculateComplexQuadraticMap(c, z0, maxIterations);
      const finalMagnitude = Math.sqrt(
        result.finalValue.real * result.finalValue.real +
        result.finalValue.imag * result.finalValue.imag
      );
      row.push({
        iterations: result.iterations,
        escaped: result.escaped,
        smoothIterations: computeSmoothIterationCount(
          result.iterations,
          finalMagnitude,
          result.escaped,
          maxIterations
        ),
      });
    }

    data.push(row);
  }

  return data;
}

/**
 * Generate interesting Julia set parameters
 * @returns Array of well-known Julia set parameters
 */
export function getInterestingJuliaParameters(): { name: string; c: ComplexNumber }[] {
  return [
    { name: "Dragon", c: new ComplexNumber(-0.8, 0.156) },
    { name: "Spiral", c: new ComplexNumber(0.285, 0.01) },
    { name: "Rabbit", c: new ComplexNumber(-0.123, 0.745) },
    { name: "Dendrite", c: new ComplexNumber(0, 1) },
    { name: "Lightning", c: new ComplexNumber(-0.4, 0.6) },
    { name: "Galaxy", c: new ComplexNumber(-0.7269, 0.1889) },
    { name: "Siegel Disk", c: new ComplexNumber(-0.391, 0.587) },
    { name: "Douady Rabbit", c: new ComplexNumber(-0.123, 0.745) },
    { name: "San Marco", c: new ComplexNumber(-0.75, 0) },
    { name: "Feather", c: new ComplexNumber(-0.48, 0.48) }
  ];
}

/**
 * Calculate the distance estimate for Mandelbrot set (for coloring)
 * @param c Complex parameter
 * @param iterations Number of iterations
 * @param escaped Whether the point escaped
 * @param z Final complex value
 * @returns Distance estimate value
 */
export function calculateMandelbrotDistance(
  c: ComplexNumber,
  iterations: number,
  escaped: boolean,
  z: ComplexNumber
): number {
  if (!escaped) {
    return 0; // Point is in the Mandelbrot set
  }

  // Distance estimation formula
  const magnitude = z.magnitude();
  const distance = magnitude * Math.log(magnitude) / Math.pow(2, iterations);

  return distance;
}

export type FractalColorScheme =
  | 'viridis'
  | 'inferno'
  | 'magma'
  | 'classic'
  | 'fire'
  | 'ocean'
  | 'rainbow';

/**
 * Anchor colors for the perceptually-uniform matplotlib colormaps
 * (viridis/inferno/magma), sampled at t = 0, 0.25, 0.5, 0.75, 1. These are
 * the standard published control points for each map; piecewise-linear
 * interpolation between them is a well-known cheap approximation that stays
 * monotonic in perceived lightness, which is the property that actually
 * matters here (unlike the raw HSL `rainbow` sweep below).
 *
 * `d3-scale-chromatic` ships the exact (denser) versions of these maps and
 * is already a project dependency, but it is an ESM-only package that this
 * project's Jest config (next/jest + babel-jest, no transformIgnorePatterns
 * override) cannot transform -- lib/maps is unit-tested directly, so
 * importing it here would break `npx jest tests/unit/maps`. The anchor
 * points below give the same qualitative result (monotonic luminance, no
 * false banding) without that dependency.
 */
const COLORMAP_ANCHORS: Record<'viridis' | 'inferno' | 'magma', [number, number, number][]> = {
  viridis: [
    [68, 1, 84],
    [59, 82, 139],
    [33, 144, 140],
    [93, 200, 99],
    [253, 231, 37],
  ],
  inferno: [
    [0, 0, 4],
    [86, 16, 110],
    [188, 55, 84],
    [249, 140, 10],
    [252, 255, 164],
  ],
  magma: [
    [0, 0, 4],
    [81, 18, 124],
    [183, 55, 121],
    [251, 135, 97],
    [252, 253, 191],
  ],
};

function sampleColormap(scheme: 'viridis' | 'inferno' | 'magma', ratio: number): { r: number; g: number; b: number } {
  const anchors = COLORMAP_ANCHORS[scheme];
  const segments = anchors.length - 1;
  // Math.min/max propagate NaN rather than clamping it, and Math.floor(NaN)
  // is NaN, so a NaN ratio would index the anchor table out of bounds and
  // destructure undefined. Collapse it to 0 explicitly.
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const scaled = safeRatio * segments;
  const index = Math.min(Math.floor(scaled), segments - 1);
  const t = scaled - index;

  const [r0, g0, b0] = anchors[index];
  const [r1, g1, b1] = anchors[index + 1];

  return {
    r: Math.round(r0 + (r1 - r0) * t),
    g: Math.round(g0 + (g1 - g0) * t),
    b: Math.round(b0 + (b1 - b0) * t),
  };
}

/**
 * Convert HSL to RGB color space.
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360 / 360;
  s = s / 100;
  l = l / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Generate color mapping for fractal visualization.
 *
 * Colors on the smooth (normalised) iteration count rather than the raw
 * integer escape-time, so adjacent pixels get a continuous gradient instead
 * of banded contour rings. `viridis`/`inferno`/`magma` are perceptually
 * uniform and are the recommended schemes (`viridis` is the default); the
 * legacy named schemes are kept selectable but corrected so no channel ever
 * goes negative (which previously clamped to 0 and silently clipped color
 * ranges).
 *
 * @param smoothIterations Continuous (normalised) iteration count `nu` --
 *   see `computeSmoothIterationCount`. Ignored (rendered black) when
 *   `escaped` is false.
 * @param maxIterations Maximum iterations used for this render
 * @param colorScheme Color scheme to use
 * @param escaped Whether the point escaped; interior (non-escaping) points
 *   render black regardless of scheme, matching the original behaviour
 * @returns RGB color object, each channel guaranteed within [0, 255]
 */
export function calculateFractalColor(
  smoothIterations: number,
  maxIterations: number,
  colorScheme: FractalColorScheme = 'viridis',
  escaped: boolean = true
): { r: number; g: number; b: number } {
  if (!escaped) {
    return { r: 0, g: 0, b: 0 }; // Black for points in the set
  }

  // Escape times are heavily skewed towards small values: over the standard
  // view, the median nu is around 2% of maxIterations and 96% of escaped
  // points fall in the bottom tenth of the range. Mapping nu linearly onto
  // the colour ramp therefore crushes almost the whole image into the
  // darkest sliver of the palette and leaves 90% of it unused -- which is
  // what makes an otherwise-correct render look flat.
  //
  // A logarithmic remap spreads that dense low end out. Measured over a
  // 300x300 sample of the default view, with a 1200px line crossing the
  // boundary of the upper bulb:
  //
  //            ramp bins used (of 20)   distinct colours on the line
  //   linear             4                        88
  //   sqrt               7                       146
  //   log1p             10                       178
  //
  // (for reference, integer escape time gives 44 on the same line)
  // Math.max/min propagate NaN rather than clamping it, so guard explicitly:
  // the arithmetic schemes below would otherwise emit NaN channels, which
  // JSON-serialise as null and paint as transparent.
  const nu = Number.isFinite(smoothIterations) ? Math.max(0, smoothIterations) : 0;
  const ratio = Math.min(1, Math.log1p(nu) / Math.log1p(Math.max(1, maxIterations)));

  switch (colorScheme) {
    case 'inferno':
      return sampleColormap('inferno', ratio);

    case 'magma':
      return sampleColormap('magma', ratio);

    case 'classic':
      // Shifted/rescaled sine & cosine waves: sin/cos oscillate in [-1, 1],
      // so `0.5 + 0.5 * wave` re-centers them into [0, 1] before scaling to
      // [0, 255]. The previous version wrote the raw (possibly negative)
      // wave straight into a Uint8ClampedArray, which clamped every
      // negative half to 0 -- silently flattening the outer half of the
      // range to a two-tone ramp.
      return {
        r: Math.floor(255 * (0.5 + 0.5 * Math.sin(ratio * Math.PI * 4))),
        g: Math.floor(255 * (0.5 + 0.5 * Math.sin(ratio * Math.PI * 4 + 2))),
        b: Math.floor(255 * (0.5 + 0.5 * Math.cos(ratio * Math.PI * 2))),
      };

    case 'fire':
      return {
        r: Math.floor(255 * Math.min(1, ratio * 3)),
        g: Math.floor(255 * Math.max(0, Math.min(1, ratio * 3 - 1))),
        b: Math.floor(255 * Math.max(0, ratio * 3 - 2))
      };

    case 'ocean':
      return {
        r: Math.floor(255 * ratio * 0.3),
        g: Math.floor(255 * ratio * 0.6),
        b: Math.floor(255 * Math.min(1, ratio * 2))
      };

    case 'rainbow': {
      const hue = ratio * 360;
      return hslToRgb(hue, 100, 50);
    }

    case 'viridis':
    default:
      return sampleColormap('viridis', ratio);
  }
}

/**
 * Zoom into a specific region of the Mandelbrot set
 * @param centerX, centerY Center of zoom region
 * @param zoom Zoom level
 * @param width, height Image dimensions
 * @param maxIterations Maximum iterations
 * @returns Zoomed Mandelbrot data
 */
export function calculateMandelbrotZoom(
  centerX: number,
  centerY: number,
  zoom: number,
  width: number = 400,
  height: number = 400,
  maxIterations: number = 100
): FractalEscapeResult[][] {
  const range = 4 / zoom;
  const xMin = centerX - range / 2;
  const xMax = centerX + range / 2;
  const yMin = centerY - range / 2;
  const yMax = centerY + range / 2;

  return calculateMandelbrotSet(xMin, xMax, yMin, yMax, width, height, maxIterations);
}

/**
 * Find interesting zoom locations in the Mandelbrot set
 * @returns Array of interesting coordinates for zooming
 */
export function getInterestingMandelbrotLocations(): {
  name: string;
  x: number;
  y: number;
  zoom: number;
  maxIterations: number
}[] {
  return [
    { name: "Main Cardioid", x: -0.5, y: 0, zoom: 1, maxIterations: 100 },
    { name: "Seahorse Valley", x: -0.75, y: 0.1, zoom: 50, maxIterations: 200 },
    { name: "Triple Spiral", x: -0.088, y: 0.654, zoom: 100, maxIterations: 300 },
    { name: "Mini Mandelbrot", x: -1.768778833, y: -0.001738996, zoom: 5000, maxIterations: 500 },
    { name: "Spiral Galaxy", x: -0.761574, y: -0.0847596, zoom: 1000, maxIterations: 400 },
    { name: "Lightning Storm", x: -1.25066, y: 0.02012, zoom: 2000, maxIterations: 600 },
    { name: "Elephant Valley", x: 0.275, y: 0.007, zoom: 100, maxIterations: 200 }
  ];
}