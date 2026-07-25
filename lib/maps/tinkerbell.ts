// src/lib/maps/tinkerbell.ts
import { lyapunovSpectrum2D } from './lyapunov';

export interface TinkerbellPoint {
  x: number;
  y: number;
}

/**
 * Calculate a single iteration of the Tinkerbell Map
 * Equation:
 * x_{n+1} = x_n² - y_n² + a·x_n + b·y_n
 * y_{n+1} = 2·x_n·y_n + c·x_n + d·y_n
 *
 * @param point Current point {x, y}
 * @param params Tinkerbell parameters {a, b, c, d}
 * @returns New point after one iteration
 */
export function calculateTinkerbellIteration(
  point: TinkerbellPoint,
  params: { a: number; b: number; c: number; d: number }
): TinkerbellPoint {
  const { x, y } = point;
  const { a, b, c, d } = params;

  const newX = x * x - y * y + a * x + b * y;
  const newY = 2 * x * y + c * x + d * y;

  return { x: newX, y: newY };
}

/**
 * Calculate the Tinkerbell Map trajectory for a given number of iterations
 * @param initialPoint Initial point {x, y}
 * @param params Tinkerbell parameters
 * @param iterations Number of iterations (default: 1000)
 * @param transient Transient iterations to discard (default: 100)
 * @returns Array of points representing the trajectory
 */
export function calculateTinkerbellMap(
  initialPoint: TinkerbellPoint,
  params: { a: number; b: number; c: number; d: number },
  iterations: number = 1000,
  transient: number = 100
): TinkerbellPoint[] {
  const points: TinkerbellPoint[] = [];
  let currentPoint = initialPoint;

  // Transient iterations
  for (let i = 0; i < transient; i++) {
    currentPoint = calculateTinkerbellIteration(currentPoint, params);
  }

  // Collect points
  for (let i = 0; i < iterations; i++) {
    points.push(currentPoint);
    currentPoint = calculateTinkerbellIteration(currentPoint, params);
  }

  return points;
}

/**
 * Generate Tinkerbell attractor with multi-loop structure
 * @param params Tinkerbell parameters
 * @param iterations Number of iterations (default: 2000)
 * @returns Array of points forming the attractor
 */
export function calculateTinkerbellAttractor(
  params: { a: number; b: number; c: number; d: number },
  iterations: number = 2000
): TinkerbellPoint[] {
  const initialPoint: TinkerbellPoint = { x: 0.1, y: -0.1 };
  return calculateTinkerbellMap(initialPoint, params, iterations, 500);
}

/**
 * Calculate basin of attraction for the Tinkerbell Map
 * @param params Tinkerbell parameters
 * @param gridSize Size of the grid to test (default: 100)
 * @param bounds Spatial bounds {xMin, xMax, yMin, yMax}
 * @returns 2D array indicating attraction basin
 */
export function calculateTinkerbellBasinOfAttraction(
  params: { a: number; b: number; c: number; d: number },
  gridSize: number = 100,
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number } = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 }
): number[][] {
  const basin: number[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
  const xStep = (bounds.xMax - bounds.xMin) / gridSize;
  const yStep = (bounds.yMax - bounds.yMin) / gridSize;

  // Test each grid point
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const initialPoint: TinkerbellPoint = {
        x: bounds.xMin + i * xStep,
        y: bounds.yMin + j * yStep
      };

      // Iterate to see where it converges
      let currentPoint = initialPoint;
      let basinId = 0;

      for (let iter = 0; iter < 1000; iter++) {
        currentPoint = calculateTinkerbellIteration(currentPoint, params);

        // Check if point escapes to infinity
        if (Math.abs(currentPoint.x) > 10 || Math.abs(currentPoint.y) > 10) {
          basinId = -1; // Escapes
          break;
        }

        // Check for convergence to known attractors (simplified)
        // In practice, you would compare with known fixed points
        if (iter > 500) {
          const radius = Math.sqrt(currentPoint.x * currentPoint.x + currentPoint.y * currentPoint.y);
          if (radius < 0.1) {
            basinId = 1; // Converges to origin
            break;
          }
        }
      }

      basin[j][i] = basinId;
    }
  }

  return basin;
}

/**
 * Calculate bifurcation diagram for Tinkerbell Map
 * @param param Parameter to vary (default: 'a')
 * @param paramRange Range of parameter values
 * @param fixedParams Fixed parameters
 * @param iterations Number of iterations
 * @returns Bifurcation data points
 */
export function calculateTinkerbellBifurcation(
  param: 'a' | 'b' | 'c' | 'd' = 'a',
  paramRange: { min: number; max: number; step: number },
  fixedParams: { a?: number; b?: number; c?: number; d?: number },
  iterations: number = 1000
): { paramValue: number; x: number; y: number }[] {
  const points: { paramValue: number; x: number; y: number }[] = [];

  for (let value = paramRange.min; value <= paramRange.max; value += paramRange.step) {
    const params = { ...fixedParams, [param]: value } as { a: number; b: number; c: number; d: number };
    const trajectory = calculateTinkerbellMap({ x: 0.1, y: -0.1 }, params, iterations, 500);

    // Sample points from trajectory
    for (let i = 0; i < trajectory.length; i += 20) {
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
 * Calculate Lyapunov exponents for the Tinkerbell Map
 * @param params Tinkerbell parameters
 * @param iterations Number of iterations (default: 5000)
 * @returns Lyapunov exponents λ₁, λ₂
 */
export function calculateTinkerbellLyapunovExponents(
  params: { a: number; b: number; c: number; d: number },
  iterations: number = 5000
): { lambda1: number; lambda2: number } {
  const { a, b, c, d } = params;

  const iterateFn = (x: number, y: number): [number, number] => {
    const p = calculateTinkerbellIteration({ x, y }, params);
    return [p.x, p.y];
  };

  const jacobianFn = (x: number, y: number): [[number, number], [number, number]] => [
    [2 * x + a, -2 * y + b],
    [2 * y + c, 2 * x + d]
  ];

  return lyapunovSpectrum2D(iterateFn, jacobianFn, 0.1, -0.1, iterations, 100);
}

/**
 * Find fixed points of the Tinkerbell Map
 * @param params Tinkerbell parameters
 * @returns Array of fixed points
 */
export function calculateTinkerbellFixedPoints(
  params: { a: number; b: number; c: number; d: number }
): TinkerbellPoint[] {
  const { a, b, c, d } = params;
  const fixedPoints: TinkerbellPoint[] = [];

  // Fixed points solve G(x, y) = f(x, y) - (x, y) = 0:
  //   x² - y² + (a-1)·x + b·y = 0
  //   2·x·y + c·x + (d-1)·y = 0
  //
  // These are repelling for the parameters that produce the classic
  // attractor, so simply iterating the map cannot reach them -- an orbit
  // started nearby runs away. Newton's method on G converges regardless of
  // stability, which is the whole reason to use it here.
  //
  //   J_G = J_f - I = [[2x + a - 1,  -2y + b   ],
  //                    [2y + c,       2x + d - 1]]

  const newton = (guess: TinkerbellPoint): TinkerbellPoint | null => {
    let { x, y } = guess;

    for (let iter = 0; iter < 100; iter++) {
      const gx = x * x - y * y + (a - 1) * x + b * y;
      const gy = 2 * x * y + c * x + (d - 1) * y;

      if (Math.abs(gx) < 1e-12 && Math.abs(gy) < 1e-12) {
        return { x, y };
      }

      const j11 = 2 * x + a - 1;
      const j12 = -2 * y + b;
      const j21 = 2 * y + c;
      const j22 = 2 * x + d - 1;

      const det = j11 * j22 - j12 * j21;
      if (Math.abs(det) < 1e-14) return null; // singular; this guess is a dead end

      x -= (j22 * gx - j12 * gy) / det;
      y -= (-j21 * gx + j11 * gy) / det;

      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    }

    return null;
  };

  // The origin solves both equations identically for every parameter set,
  // since every term carries a factor of x or y.
  const guesses: TinkerbellPoint[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 0.5, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 1, y: 1 }, { x: -1, y: -1 },
    { x: -1.5, y: 0.5 }, { x: 1.5, y: -0.5 }, { x: -0.2, y: -0.8 }
  ];

  for (const guess of guesses) {
    const root = newton(guess);
    if (!root) continue;

    const isUnique = !fixedPoints.some(
      fp => Math.abs(fp.x - root.x) < 1e-6 && Math.abs(fp.y - root.y) < 1e-6
    );
    if (isUnique) fixedPoints.push(root);
  }

  return fixedPoints;
}

/**
 * Calculate crisis-induced merging behavior
 * @param param Parameter to vary
 * @param paramRange Range for parameter variation
 * @param fixedParams Other fixed parameters
 * @returns Data showing merging behavior
 */
export function calculateTinkerbellCrisisBehavior(
  param: 'a' | 'b' | 'c' | 'd' = 'a',
  paramRange: { min: number; max: number; step: number },
  fixedParams: { a?: number; b?: number; c?: number; d?: number }
): { paramValue: number; attractorSize: number; lyapunov: number }[] {
  const results: { paramValue: number; attractorSize: number; lyapunov: number }[] = [];

  for (let value = paramRange.min; value <= paramRange.max; value += paramRange.step) {
    const params = { ...fixedParams, [param]: value } as { a: number; b: number; c: number; d: number };

    const trajectory = calculateTinkerbellMap({ x: 0.1, y: -0.1 }, params, 2000, 500);

    // Calculate attractor size (standard deviation)
    const meanX = trajectory.reduce((sum, p) => sum + p.x, 0) / trajectory.length;
    const meanY = trajectory.reduce((sum, p) => sum + p.y, 0) / trajectory.length;

    const variance = trajectory.reduce((sum, p) => {
      const dx = p.x - meanX;
      const dy = p.y - meanY;
      return sum + dx * dx + dy * dy;
    }, 0) / trajectory.length;

    const attractorSize = Math.sqrt(variance);

    // Calculate Lyapunov exponents
    const lyapunov = calculateTinkerbellLyapunovExponents(params, 1000);

    results.push({
      paramValue: value,
      attractorSize,
      lyapunov: lyapunov.lambda1 + lyapunov.lambda2
    });
  }

  return results;
}

/**
 * Generate interesting Tinkerbell parameter sets
 * @returns Array of parameter configurations with descriptions
 */
export function getInterestingTinkerbellParameters(): {
  name: string;
  params: { a: number; b: number; c: number; d: number };
  description: string;
}[] {
  return [
    {
      name: "Classic Multi-loop",
      params: { a: 0.9, b: -0.6013, c: 2.0, d: 0.5 },
      description: "Classic Tinkerbell attractor with beautiful multi-loop structure"
    },
    {
      name: "Bistable Configuration",
      params: { a: 0.3, b: 0.6, c: 2.0, d: 0.5 },
      description: "Shows bistability with two distinct attractor basins"
    },
    {
      name: "Complex Multi-loop",
      params: { a: 1.0, b: -0.7, c: 2.0, d: 0.5 },
      description: "More complex multi-loop dynamics with fractal structure"
    },
    {
      name: "Crisis Region",
      params: { a: 0.7, b: -0.5, c: 2.0, d: 0.5 },
      description: "Parameter region showing crisis-induced behavior"
    },
    {
      name: "Stable Single Loop",
      params: { a: 0.5, b: -0.4, c: 1.8, d: 0.4 },
      description: "Simpler single-loop attractor with stable dynamics"
    },
    {
      name: "Chaotic Regime",
      params: { a: 1.2, b: -0.8, c: 2.2, d: 0.6 },
      description: "Highly chaotic parameter regime"
    }
  ];
}

/**
 * Calculate return map for period analysis
 * @param trajectory Array of points
 * @param coordinate Coordinate to analyze ('x' or 'y')
 * @param lag Lag for return map (default: 1)
 * @returns Return map data
 */
export function calculateTinkerbellReturnMap(
  trajectory: TinkerbellPoint[],
  coordinate: 'x' | 'y' = 'x',
  lag: number = 1
): { current: number; next: number }[] {
  const returnMap: { current: number; next: number }[] = [];

  for (let i = 0; i < trajectory.length - lag; i++) {
    returnMap.push({
      current: trajectory[i][coordinate],
      next: trajectory[i + lag][coordinate]
    });
  }

  return returnMap;
}