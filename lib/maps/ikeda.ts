// src/lib/maps/ikeda.ts
import { lyapunovSpectrum2D } from './lyapunov';

export interface IkedaPoint {
  x: number;
  y: number;
  t?: number; // Phase parameter
}

/**
 * Calculate a single iteration of the Ikeda Map
 * Origin: Nonlinear optics, modeling laser cavities with feedback
 *
 * Equations:
 * t_n = c - d/(1 + x_n² + y_n²)
 * x_{n+1} = 1 + a·(x_n·cos(t_n) - y_n·sin(t_n))
 * y_{n+1} = b·(x_n·sin(t_n) + y_n·cos(t_n))
 *
 * @param point Current point {x, y}
 * @param params Ikeda parameters {a, b, c, d}
 * @returns New point after one iteration
 */
export function calculateIkedaIteration(
  point: IkedaPoint,
  params: { a: number; b: number; c: number; d: number }
): IkedaPoint {
  const { x, y } = point;
  const { a, b, c, d } = params;

  // Calculate phase parameter t
  const denominator = 1 + x * x + y * y;
  const t = c - d / denominator;

  // Calculate new coordinates
  const newX = 1 + a * (x * Math.cos(t) - y * Math.sin(t));
  const newY = b * (x * Math.sin(t) + y * Math.cos(t));

  return { x: newX, y: newY, t };
}

/**
 * Calculate the Ikeda Map trajectory for a given number of iterations
 * @param initialPoint Initial point {x, y}
 * @param params Ikeda parameters
 * @param iterations Number of iterations (default: 1000)
 * @param transient Transient iterations to discard (default: 100)
 * @returns Array of points representing the trajectory
 */
export function calculateIkedaMap(
  initialPoint: IkedaPoint,
  params: { a: number; b: number; c: number; d: number },
  iterations: number = 1000,
  transient: number = 100
): IkedaPoint[] {
  const points: IkedaPoint[] = [];
  let currentPoint = initialPoint;

  // Transient iterations
  for (let i = 0; i < transient; i++) {
    currentPoint = calculateIkedaIteration(currentPoint, params);
  }

  // Collect points
  for (let i = 0; i < iterations; i++) {
    points.push(currentPoint);
    currentPoint = calculateIkedaIteration(currentPoint, params);
  }

  return points;
}

/**
 * Generate Ikeda attractor with phase information
 * @param params Ikeda parameters
 * @param iterations Number of iterations (default: 2000)
 * @returns Array of points with phase information
 */
export function calculateIkedaAttractor(
  params: { a: number; b: number; c: number; d: number },
  iterations: number = 2000
): IkedaPoint[] {
  const initialPoint: IkedaPoint = { x: 0.1, y: 0.1 };
  return calculateIkedaMap(initialPoint, params, iterations, 500);
}

/**
 * Calculate Ikeda Map bifurcation diagram
 * @param param Parameter to vary (default: 'b')
 * @param paramRange Range of parameter values
 * @param fixedParams Fixed parameters
 * @param iterations Number of iterations (default: 1000)
 * @returns Array of points for bifurcation diagram
 */
export function calculateIkedaBifurcation(
  param: 'a' | 'b' | 'c' | 'd' = 'b',
  paramRange: { min: number; max: number; step: number },
  fixedParams: { a?: number; b?: number; c?: number; d?: number },
  iterations: number = 1000
): { paramValue: number; x: number; y: number }[] {
  const points: { paramValue: number; x: number; y: number }[] = [];

  for (let value = paramRange.min; value <= paramRange.max; value += paramRange.step) {
    const params = { ...fixedParams, [param]: value } as { a: number; b: number; c: number; d: number };
    const trajectory = calculateIkedaMap({ x: 0.1, y: 0.1 }, params, iterations, 500);

    // Sample points from trajectory
    for (let i = 0; i < trajectory.length; i += 10) {
      points.push({
        paramValue: value,
        x: trajectory[i].x,
        y: trajectory[i].y
      });
    }
  }

  return points;
}

/**
 * Calculate phase space trajectory with time evolution
 * @param params Ikeda parameters
 * @param iterations Number of iterations
 * @returns Array with time evolution information
 */
export function calculateIkedaTimeEvolution(
  params: { a: number; b: number; c: number; d: number },
  iterations: number = 500
): { time: number; x: number; y: number; phase: number; radius: number }[] {
  const initialPoint: IkedaPoint = { x: 0.1, y: 0.1 };
  const trajectory: { time: number; x: number; y: number; phase: number; radius: number }[] = [];
  let currentPoint = initialPoint;

  for (let i = 0; i < iterations; i++) {
    const result = calculateIkedaIteration(currentPoint, params);
    const phase = Math.atan2(result.y, result.x);
    const radius = Math.sqrt(result.x * result.x + result.y * result.y);

    trajectory.push({
      time: i,
      x: result.x,
      y: result.y,
      phase,
      radius
    });

    currentPoint = result;
  }

  return trajectory;
}

/**
 * Calculate Lyapunov exponents for the Ikeda Map
 * @param params Ikeda parameters
 * @param iterations Number of iterations (default: 5000)
 * @returns Lyapunov exponents λ₁, λ₂
 */
export function calculateIkedaLyapunovExponents(
  params: { a: number; b: number; c: number; d: number },
  iterations: number = 5000
): { lambda1: number; lambda2: number } {
  const { a, b, c, d } = params;

  const iterateFn = (x: number, y: number): [number, number] => {
    const result = calculateIkedaIteration({ x, y }, params);
    return [result.x, result.y];
  };

  // Jacobian matrix for Ikeda Map.
  // With u = x cos t - y sin t, v = x sin t + y cos t:
  // J = [[a(cos t - v*t_x),  a(-sin t - v*t_y)],
  //      [b(sin t + u*t_x),  b( cos t + u*t_y)]]
  // where t_x = 2 d x / (1+x^2+y^2)^2, t_y = 2 d y / (1+x^2+y^2)^2.
  const jacobianFn = (x: number, y: number): [[number, number], [number, number]] => {
    const denominator = 1 + x * x + y * y;
    const t = c - d / denominator;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);

    const dt_dx = (2 * d * x) / (denominator * denominator);
    const dt_dy = (2 * d * y) / (denominator * denominator);

    const u = x * cosT - y * sinT;
    const v = x * sinT + y * cosT;

    const j11 = a * (cosT - v * dt_dx);
    const j12 = a * (-sinT - v * dt_dy);
    const j21 = b * (sinT + u * dt_dx);
    const j22 = b * (cosT + u * dt_dy);

    return [[j11, j12], [j21, j22]];
  };

  return lyapunovSpectrum2D(iterateFn, jacobianFn, 0.1, 0.1, iterations, 100);
}

/**
 * Generate interesting Ikeda parameter sets
 * @returns Array of parameter configurations with descriptions
 */
export function getInterestingIkedaParameters(): {
  name: string;
  params: { a: number; b: number; c: number; d: number };
  description: string;
}[] {
  return [
    {
      name: "Classic Spiral",
      params: { a: 0.9, b: 0.9, c: 0.4, d: 6.0 },
      description: "Classic Ikeda attractor with beautiful spiral structure"
    },
    {
      name: "Diffuse Spiral",
      params: { a: 0.8, b: 0.8, c: 0.3, d: 5.0 },
      description: "More diffuse spiral with less defined structure"
    },
    {
      name: "Tight Spiral",
      params: { a: 0.95, b: 0.95, c: 0.5, d: 7.0 },
      description: "Tightly wound spiral with clear fractal structure"
    },
    {
      name: "Broken Spiral",
      params: { a: 1.0, b: 0.9, c: 0.4, d: 6.0 },
      description: "Fragmented spiral structure showing chaotic behavior"
    },
    {
      name: "Optical Chaos",
      params: { a: 0.85, b: 0.85, c: 0.6, d: 8.0 },
      description: "Highly chaotic regime from optical cavity model"
    },
    {
      name: "Periodic Orbit",
      params: { a: 0.7, b: 0.7, c: 0.2, d: 4.0 },
      description: "Regular periodic behavior with low chaos"
    }
  ];
}

/**
 * Calculate power spectrum of Ikeda trajectory
 * @param trajectory Array of points from calculateIkedaTimeEvolution
 * @returns Frequency domain data for spectral analysis
 */
export function calculateIkedaPowerSpectrum(
  trajectory: { time: number; x: number; y: number }[]
): { frequency: number; powerX: number; powerY: number }[] {
  const n = trajectory.length;
  const spectrum: { frequency: number; powerX: number; powerY: number }[] = [];

  // Simple FFT implementation (simplified)
  for (let k = 0; k < n / 2; k++) {
    let sumX = 0;
    let sumY = 0;

    for (let j = 0; j < n; j++) {
      const angle = -2 * Math.PI * k * j / n;
      sumX += trajectory[j].x * Math.cos(angle) - trajectory[j].y * Math.sin(angle);
      sumY += trajectory[j].x * Math.sin(angle) + trajectory[j].y * Math.cos(angle);
    }

    const frequency = k / n;
    const powerX = (sumX * sumX) / (n * n);
    const powerY = (sumY * sumY) / (n * n);

    spectrum.push({ frequency, powerX, powerY });
  }

  return spectrum;
}

/**
 * Calculate return map (Poincaré section) for Ikeda dynamics
 * @param trajectory Array of points
 * @param sectionValue Value of x for Poincaré section (default: 0)
 * @returns Points crossing the section
 */
export function calculateIkedaReturnMap(
  trajectory: IkedaPoint[],
  sectionValue: number = 0
): { x: number; y: number }[] {
  const returnPoints: { x: number; y: number }[] = [];

  for (let i = 1; i < trajectory.length; i++) {
    const prev = trajectory[i - 1];
    const curr = trajectory[i];

    // Check if trajectory crosses the section
    if ((prev.x <= sectionValue && curr.x > sectionValue) ||
        (prev.x >= sectionValue && curr.x < sectionValue)) {

      // Linear interpolation to find exact crossing point
      const t = (sectionValue - prev.x) / (curr.x - prev.x);
      const y = prev.y + t * (curr.y - prev.y);

      returnPoints.push({ x: sectionValue, y });
    }
  }

  return returnPoints;
}