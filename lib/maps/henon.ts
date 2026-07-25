// src/lib/maps/henon.ts
import { lyapunovSpectrum2D } from './lyapunov';

export interface HenonPoint {
  x: number;
  y: number;
}

/**
 * Calculate a single iteration of the Hénon map
 * @param x Current x value
 * @param y Current y value
 * @param a Parameter a (default: 1.4)
 * @param b Parameter b (default: 0.3)
 * @returns New point after one iteration
 */
export function calculateHenonIteration(
  x: number,
  y: number,
  a: number = 1.4,
  b: number = 0.3
): HenonPoint {
  const newX = 1 - a * x * x + y;
  const newY = b * x;
  return { x: newX, y: newY };
}

/**
 * Calculate the Hénon map for a given number of iterations
 * @param a Parameter a (default: 1.4)
 * @param b Parameter b (default: 0.3)
 * @param x0 Initial x value (default: 0.1)
 * @param y0 Initial y value (default: 0.1)
 * @param iterations Number of iterations (default: 1000)
 * @returns Array of points representing the Hénon map trajectory
 */
export function calculateHenonMap(
  a: number = 1.4,
  b: number = 0.3,
  x0: number = 0.1,
  y0: number = 0.1,
  iterations: number = 1000
): HenonPoint[] {
  const points: HenonPoint[] = [];
  let x = x0;
  let y = y0;
  
  for (let i = 0; i < iterations; i++) {
    points.push({ x, y });
    const newPoint = calculateHenonIteration(x, y, a, b);
    x = newPoint.x;
    y = newPoint.y;
  }
  
  return points;
}

/**
 * Calculate the Hénon attractor
 * This function is similar to calculateHenonMap but discards the first 100 iterations
 * to allow the system to settle onto the attractor
 * @param a Parameter a (default: 1.4)
 * @param b Parameter b (default: 0.3)
 * @param x0 Initial x value (default: 0.1)
 * @param y0 Initial y value (default: 0.1)
 * @param iterations Number of iterations to keep (default: 1000)
 * @returns Array of points representing the Hénon attractor
 */
export function calculateHenonAttractor(
  a: number = 1.4,
  b: number = 0.3,
  x0: number = 0.1,
  y0: number = 0.1,
  iterations: number = 1000
): HenonPoint[] {
  // Discard the first 100 iterations to allow the system to settle onto the attractor
  const transient = 100;
  const points: HenonPoint[] = [];
  let x = x0;
  let y = y0;
  
  // Run the transient iterations
  for (let i = 0; i < transient; i++) {
    const newPoint = calculateHenonIteration(x, y, a, b);
    x = newPoint.x;
    y = newPoint.y;
  }
  
  // Now collect the points for the attractor
  for (let i = 0; i < iterations; i++) {
    points.push({ x, y });
    const newPoint = calculateHenonIteration(x, y, a, b);
    x = newPoint.x;
    y = newPoint.y;
  }
  
  return points;
}

/**
 * Calculate the Lyapunov exponent for the Hénon map
 * @param a Parameter a (default: 1.4)
 * @param b Parameter b (default: 0.3)
 * @param x0 Initial x value (default: 0.1)
 * @param y0 Initial y value (default: 0.1)
 * @param iterations Number of iterations (default: 1000)
 * @returns Approximate Lyapunov exponent
 */
export function calculateHenonLyapunovExponent(
  a: number = 1.4,
  b: number = 0.3,
  x0: number = 0.1,
  y0: number = 0.1,
  iterations: number = 1000
): number {
  // Jacobian J = [[-2ax, 1], [b, 0]]
  const iterateFn = (x: number, y: number): [number, number] => {
    const p = calculateHenonIteration(x, y, a, b);
    return [p.x, p.y];
  };

  const jacobianFn = (x: number): [[number, number], [number, number]] => [
    [-2 * a * x, 1],
    [b, 0]
  ];

  const { lambda1 } = lyapunovSpectrum2D(
    iterateFn,
    (x, _y) => jacobianFn(x),
    x0,
    y0,
    iterations,
    100
  );

  return lambda1;
}
