// src/lib/maps/duffing.ts
import { lyapunovSpectrum2D } from './lyapunov';

export interface DuffingPoint {
  x: number;
  y: number;
}

/**
 * Calculate a single iteration of the Duffing Map
 * Holmes cubic 2D Duffing map, the discretized double-well oscillator
 * Equations:
 * x_{n+1} = y_n
 * y_{n+1} = -b·x_n + a·y_n - y_n³
 *
 * Dissipative for 0 < b < 1, with a constant Jacobian determinant equal to
 * b everywhere.
 *
 * @param point Current point {x, y}
 * @param params Duffing parameters {a, b}
 * @returns New point after one iteration
 */
export function calculateDuffingIteration(
  point: DuffingPoint,
  params: { a: number; b: number }
): DuffingPoint {
  const { x, y } = point;
  const { a, b } = params;

  const newX = y;
  const newY = -b * x + a * y - y * y * y;

  return { x: newX, y: newY };
}

/**
 * Calculate the Duffing Map trajectory for a given number of iterations
 * @param initialPoint Initial point {x, y}
 * @param params Duffing parameters
 * @param iterations Number of iterations (default: 1000)
 * @param transient Transient iterations to discard (default: 100)
 * @returns Array of points representing the trajectory
 */
export function calculateDuffingMap(
  initialPoint: DuffingPoint,
  params: { a: number; b: number },
  iterations: number = 1000,
  transient: number = 100
): DuffingPoint[] {
  const points: DuffingPoint[] = [];
  let currentPoint = initialPoint;

  // Transient iterations
  for (let i = 0; i < transient; i++) {
    currentPoint = calculateDuffingIteration(currentPoint, params);
  }

  // Collect points
  for (let i = 0; i < iterations; i++) {
    points.push(currentPoint);
    currentPoint = calculateDuffingIteration(currentPoint, params);
  }

  return points;
}

/**
 * Generate Duffing attractor with double-well dynamics
 * @param params Duffing parameters
 * @param iterations Number of iterations (default: 2000)
 * @returns Array of points forming the attractor
 */
export function calculateDuffingAttractor(
  params: { a: number; b: number },
  iterations: number = 2000
): DuffingPoint[] {
  const initialPoint: DuffingPoint = { x: 0.1, y: 0.1 };
  return calculateDuffingMap(initialPoint, params, iterations, 500);
}

/**
 * Calculate the potential energy landscape for the Duffing Map
 * V(x) = -0.5·a·x² + 0.25·x⁴
 * @param a Parameter a
 * @param xRange Range of x values
 * @param numPoints Number of points to calculate
 * @returns Array of {x, potential} points
 */
export function calculateDuffingPotential(
  a: number,
  xRange: { min: number; max: number } = { min: -2, max: 2 },
  numPoints: number = 200
): { x: number; potential: number }[] {
  const points: { x: number; potential: number }[] = [];
  const step = (xRange.max - xRange.min) / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const x = xRange.min + i * step;
    const potential = -0.5 * a * x * x + 0.25 * x * x * x * x;
    points.push({ x, potential });
  }

  return points;
}

/**
 * Calculate bifurcation diagram for the Duffing Map
 * @param param Parameter to vary ('a' or 'b')
 * @param paramRange Range of parameter values
 * @param fixedParams Fixed parameters
 * @param iterations Number of iterations
 * @returns Bifurcation data points
 */
export function calculateDuffingBifurcation(
  param: 'a' | 'b' = 'a',
  paramRange: { min: number; max: number; step: number },
  fixedParams: { a?: number; b?: number },
  iterations: number = 1000
): { paramValue: number; x: number; y: number }[] {
  const points: { paramValue: number; x: number; y: number }[] = [];

  for (let value = paramRange.min; value <= paramRange.max; value += paramRange.step) {
    const params = { ...fixedParams, [param]: value } as { a: number; b: number };
    const trajectory = calculateDuffingMap({ x: 0.1, y: 0.1 }, params, iterations, 500);

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
 * Calculate basins of attraction for the Duffing map fixed points.
 *
 * Encoding (integer grid, consumed by renderBasins):
 *   -1  escaped
 *    0  converged to the origin fixed point
 *    1  basin of the negative fixed point (x=y=-sqrt(a-b-1))
 *    2  basin of the positive fixed point (x=y=+sqrt(a-b-1))
 *    3  bounded but did not settle on a fixed point (chaotic / strange)
 *
 * Classification uses the MAP attractors from calculateDuffingFixedPoints,
 * the converged tail of each orbit (no first-pass break), and a matching
 * tolerance that scales with the separation between the nonzero fixed points.
 * Grid samples sit at cell centres so the domain is symmetric about the origin.
 *
 * @param params Duffing parameters
 * @param gridSize Size of the grid to test (default: 100)
 * @param bounds Spatial bounds
 * @returns 2D array of basin labels (rows = y index, cols = x index)
 */
export function calculateDuffingBasins(
  params: { a: number; b: number },
  gridSize: number = 100,
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number } = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 }
): number[][] {
  const basins: number[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
  // Cell centres: x_i = xMin + (i+1/2)·Δx so the grid is odd-symmetric
  // about the origin (x_i + x_{n-1-i} = 0). Corner sampling (i·Δx) is not.
  const xStep = (bounds.xMax - bounds.xMin) / gridSize;
  const yStep = (bounds.yMax - bounds.yMin) / gridSize;

  const fixedPoints = calculateDuffingFixedPoints(params);
  const nonzero = fixedPoints.filter((p) => p.x !== 0 || p.y !== 0);

  // Matching radius scales with how far the two nonzero fixed points sit
  // apart. A fixed 0.5 overlaps both wells when a is only slightly above 1+b.
  let separation = 1;
  if (nonzero.length >= 2) {
    const p0 = nonzero[0];
    const p1 = nonzero[1];
    separation = Math.hypot(p0.x - p1.x, p0.y - p1.y);
  } else if (nonzero.length === 1) {
    separation = 2 * Math.hypot(nonzero[0].x, nonzero[0].y);
  }
  const matchTol = 0.25 * separation;
  // Orbit must actually settle: chaotic tails keep O(1) spread even when the
  // time-average drifts near a fixed point.
  const convergeTol = 0.05;

  const maxIter = 1000;
  const tailLen = 80;
  const escapeR = 10;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      let currentPoint: DuffingPoint = {
        x: bounds.xMin + (i + 0.5) * xStep,
        y: bounds.yMin + (j + 0.5) * yStep
      };

      let escaped = false;
      let meanX = 0;
      let meanY = 0;
      let tailCount = 0;
      // Ring buffer of the last tailLen points for spread after the mean is known.
      const tailX = new Float64Array(tailLen);
      const tailY = new Float64Array(tailLen);

      for (let iter = 0; iter < maxIter; iter++) {
        currentPoint = calculateDuffingIteration(currentPoint, params);

        if (Math.abs(currentPoint.x) > escapeR || Math.abs(currentPoint.y) > escapeR) {
          escaped = true;
          break;
        }

        if (iter >= maxIter - tailLen) {
          const t = tailCount;
          tailX[t] = currentPoint.x;
          tailY[t] = currentPoint.y;
          meanX += currentPoint.x;
          meanY += currentPoint.y;
          tailCount++;
        }
      }

      let basinId: number;
      if (escaped || tailCount === 0) {
        basinId = -1;
      } else {
        meanX /= tailCount;
        meanY /= tailCount;

        let spread = 0;
        for (let t = 0; t < tailCount; t++) {
          const d = Math.hypot(tailX[t] - meanX, tailY[t] - meanY);
          if (d > spread) spread = d;
        }

        if (spread > convergeTol) {
          basinId = 3; // bounded, not settled
        } else {
          let bestDist = Infinity;
          let best: DuffingPoint | null = null;
          for (const fp of fixedPoints) {
            const d = Math.hypot(meanX - fp.x, meanY - fp.y);
            if (d < bestDist) {
              bestDist = d;
              best = fp;
            }
          }

          if (best === null || bestDist > matchTol) {
            basinId = 3;
          } else if (best.x === 0 && best.y === 0) {
            basinId = 0;
          } else if (best.x < 0) {
            basinId = 1;
          } else {
            basinId = 2;
          }
        }
      }

      basins[j][i] = basinId;
    }
  }

  return basins;
}

/**
 * Calculate Lyapunov exponents for the Duffing Map
 * @param params Duffing parameters
 * @param iterations Number of iterations (default: 5000)
 * @returns Lyapunov exponents λ₁, λ₂
 */
export function calculateDuffingLyapunovExponents(
  params: { a: number; b: number },
  iterations: number = 5000
): { lambda1: number; lambda2: number } {
  const { a, b } = params;

  const iterateFn = (x: number, y: number): [number, number] => {
    const p = calculateDuffingIteration({ x, y }, params);
    return [p.x, p.y];
  };

  // Jacobian for x' = y; y' = -b x + a y - y^3 is [[0, 1], [-b, a - 3y^2]],
  // with det = b (constant), as the dissipative map requires.
  const jacobianFn = (y: number): [[number, number], [number, number]] => [
    [0, 1],
    [-b, a - 3 * y * y]
  ];

  return lyapunovSpectrum2D(
    iterateFn,
    (_x, y) => jacobianFn(y),
    0.1,
    0.1,
    iterations,
    100
  );
}

/**
 * Find fixed points of the Duffing Map
 * @param params Duffing parameters
 * @returns Array of fixed points
 */
export function calculateDuffingFixedPoints(
  params: { a: number; b: number }
): DuffingPoint[] {
  const { a, b } = params;
  const fixedPoints: DuffingPoint[] = [];

  // Fixed points satisfy: x = y, y = -b·y + a·x - x³
  // This gives us: x = -b·x + a·x - x³
  // Simplifying: 0 = -(b+1)·x + a·x - x³
  // 0 = x·(a - b - 1 - x²)

  // Solution 1: x = 0, y = 0
  fixedPoints.push({ x: 0, y: 0 });

  // Solution 2: x² = a - b - 1
  const discriminant = a - b - 1;
  if (discriminant > 0) {
    const x1 = Math.sqrt(discriminant);
    const x2 = -Math.sqrt(discriminant);

    fixedPoints.push({ x: x1, y: x1 });
    fixedPoints.push({ x: x2, y: x2 });
  }

  return fixedPoints;
}

/**
 * Calculate energy landscape and trajectories
 * @param params Duffing parameters
 * @param initialConditions Array of initial conditions
 * @param iterations Number of iterations
 * @returns Array of trajectories with energy information
 */
export function calculateDuffingEnergyTrajectories(
  params: { a: number; b: number },
  initialConditions: DuffingPoint[],
  iterations: number = 500
): {
    trajectory: DuffingPoint[];
    energy: number[];
    well: 'left' | 'right' | 'center' | 'escape';
  }[] {
  return initialConditions.map(initialPoint => {
    const trajectory = calculateDuffingMap(initialPoint, params, iterations, 0);
    const energy: number[] = [];

    trajectory.forEach(point => {
      // Kinetic energy: KE = 0.5·y²
      // Potential energy: PE = -0.5·a·x² + 0.25·x⁴
      const kineticEnergy = 0.5 * point.y * point.y;
      const potentialEnergy = -0.5 * params.a * point.x * point.x + 0.25 * point.x * point.x * point.x * point.x;
      energy.push(kineticEnergy + potentialEnergy);
    });

    // Determine which well the trajectory ends up in
    const finalPoint = trajectory[trajectory.length - 1];
    let well: 'left' | 'right' | 'center' | 'escape';

    if (Math.abs(finalPoint.x) > 3) {
      well = 'escape';
    } else if (finalPoint.x < -0.5) {
      well = 'left';
    } else if (finalPoint.x > 0.5) {
      well = 'right';
    } else {
      well = 'center';
    }

    return { trajectory, energy, well };
  });
}

/**
 * Generate interesting Duffing parameter sets.
 * Canonical chaos is a=2.75, b=0.2. Other slots keep the same names but use
 * bounded, non-origin parameters verified by measurement (4000 pts after 2000
 * transient; calculateDuffingLyapunovExponents). b=0 is avoided: det J = b
 * collapses the map to one dimension.
 */
export function getInterestingDuffingParameters(): {
  name: string;
  params: { a: number; b: number };
  description: string;
  classification: 'chaotic' | 'periodic' | 'quasiperiodic' | 'fixed-point';
}[] {
  return [
    {
      name: "Classic Bistable",
      params: { a: 1.6, b: 0.2 },
      classification: 'fixed-point',
      description: "Double-well fixed point off the origin (a>1+b), lambda1 ~ -0.80"
    },
    {
      name: "Chaotic Regime",
      params: { a: 2.75, b: 0.2 },
      classification: 'chaotic',
      description: "Canonical parameters producing chaotic dynamics, lambda1 ~ +0.49"
    },
    {
      name: "Low Barrier",
      params: { a: 1.4, b: 0.2 },
      classification: 'fixed-point',
      description: "Shallowest double-well barrier (a^2/4 = 0.49), lambda1 ~ -0.80"
    },
    {
      name: "Deep Wells",
      params: { a: 2.0, b: 0.2 },
      classification: 'fixed-point',
      description: "Deepest regular double-well barrier (a^2/4 = 1.00), lambda1 ~ -0.80"
    },
    {
      name: "High Damping",
      params: { a: 2.75, b: 0.4 },
      classification: 'fixed-point',
      description: "High damping at the chaotic a-value collapses to a fixed point, lambda1 ~ -0.22"
    },
    {
      name: "Weak Damping Chaos",
      params: { a: 2.5, b: 0.1 },
      classification: 'chaotic',
      description: "Weakest damping in the table (b=0.1); bounded chaos, lambda1 ~ +0.20"
    }
  ];
}