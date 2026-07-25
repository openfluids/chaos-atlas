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
 * @param escapeRadius Escape radius (default: 2)
 * @returns Iteration result with trajectory information
 */
export function calculateComplexQuadraticMap(
  c: ComplexNumber,
  z0: ComplexNumber = new ComplexNumber(0, 0),
  maxIterations: number = 100,
  escapeRadius: number = 2
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
): number[][] {
  const data: number[][] = [];
  const xStep = (xMax - xMin) / width;
  const yStep = (yMax - yMin) / height;

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    const imag = yMin + y * yStep;

    for (let x = 0; x < width; x++) {
      const real = xMin + x * xStep;
      const z0 = new ComplexNumber(real, imag);
      const result = calculateComplexQuadraticMap(c, z0, maxIterations);
      row.push(result.iterations);
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
): number[][] {
  const data: number[][] = [];
  const xStep = (xMax - xMin) / width;
  const yStep = (yMax - yMin) / height;

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    const imag = yMin + y * yStep;

    for (let x = 0; x < width; x++) {
      const real = xMin + x * xStep;
      const c = new ComplexNumber(real, imag);
      const z0 = new ComplexNumber(0, 0);
      const result = calculateComplexQuadraticMap(c, z0, maxIterations);
      row.push(result.iterations);
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

/**
 * Generate color mapping for fractal visualization
 * @param iterations Number of iterations
 * @param maxIterations Maximum iterations
 * @param colorScheme Color scheme to use
 * @returns RGB color object
 */
export function calculateFractalColor(
  iterations: number,
  maxIterations: number,
  colorScheme: 'classic' | 'fire' | 'ocean' | 'rainbow' = 'classic'
): { r: number; g: number; b: number } {
  if (iterations === maxIterations) {
    return { r: 0, g: 0, b: 0 }; // Black for points in the set
  }

  const ratio = iterations / maxIterations;

  switch (colorScheme) {
    case 'classic':
      return {
        r: Math.floor(255 * Math.sin(ratio * Math.PI)),
        g: Math.floor(255 * Math.sin(ratio * Math.PI * 2)),
        b: Math.floor(255 * Math.cos(ratio * Math.PI))
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

    case 'rainbow':
      const hue = ratio * 360;
      return hslToRgb(hue, 100, 50);

    default:
      return { r: 255, g: 255, b: 255 };
  }
}

/**
 * Convert HSL to RGB color space
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255)
  };
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
): number[][] {
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