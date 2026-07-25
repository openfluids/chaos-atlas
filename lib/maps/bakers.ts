// src/lib/maps/bakers.ts
export interface BakersPoint {
  x: number;
  y: number;
}

export interface BakersImagePoint {
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  color: { r: number; g: number; b: number };
}

/**
 * Calculate a single iteration of the Baker's Map
 * Equation:
 * x_{n+1} = 2·x_n (mod 1)
 * y_{n+1} = { y_n/2, if x_n < 0.5
 *          { (y_n + 1)/2, if x_n ≥ 0.5
 * @param point Current point {x, y}
 * @returns New point after one iteration
 */
export function calculateBakersIteration(point: BakersPoint): BakersPoint {
  const { x, y } = point;

  // JS `%` is remainder, not modulo, so it can return negative values for
  // negative inputs. Fold onto the unit interval with a true modulo.
  const newX = (((2 * x) % 1) + 1) % 1;

  let newY;
  if (x < 0.5) {
    newY = y / 2;
  } else {
    newY = (y + 1) / 2;
  }

  return { x: newX, y: newY };
}

/**
 * Calculate the Baker's Map trajectory for a given number of iterations
 * @param initialPoint Initial point {x, y}
 * @param iterations Number of iterations (default: 100)
 * @returns Array of points representing the trajectory
 */
export function calculateBakersMap(
  initialPoint: BakersPoint,
  iterations: number = 100
): BakersPoint[] {
  const points: BakersPoint[] = [];
  let currentPoint = initialPoint;

  for (let i = 0; i < iterations; i++) {
    points.push(currentPoint);
    currentPoint = calculateBakersIteration(currentPoint);
  }

  return points;
}

/**
 * Generate multiple trajectories to show mixing behavior
 * @param numPoints Number of initial points (default: 20)
 * @param iterations Number of iterations per trajectory (default: 50)
 * @returns Array of trajectories
 */
export function calculateBakersMixing(
  numPoints: number = 20,
  iterations: number = 50
): BakersPoint[][] {
  const trajectories: BakersPoint[][] = [];

  for (let i = 0; i < numPoints; i++) {
    // Start with points in a small cluster
    const initialPoint = {
      x: 0.25 + (Math.random() - 0.5) * 0.1,
      y: 0.25 + (Math.random() - 0.5) * 0.1
    };
    trajectories.push(calculateBakersMap(initialPoint, iterations));
  }

  return trajectories;
}

/**
 * Calculate the Baker's Map symbolic dynamics (binary sequence)
 * @param initialPoint Initial point {x, y}
 * @param iterations Number of iterations (default: 100)
 * @returns Array of binary symbols representing the dynamics
 */
export function calculateBakersSymbolicDynamics(
  initialPoint: BakersPoint,
  iterations: number = 100
): string[] {
  const symbols: string[] = [];
  let currentPoint = initialPoint;

  for (let i = 0; i < iterations; i++) {
    symbols.push(currentPoint.x < 0.5 ? '0' : '1');
    currentPoint = calculateBakersIteration(currentPoint);
  }

  return symbols;
}

/**
 * Generate image scrambling simulation
 * @param width Image width (default: 32)
 * @param height Image height (default: 32)
 * @param iterations Number of scrambling iterations (default: 10)
 * @returns Array of scrambled image data for animation
 */
export function calculateBakersImageScrambling(
  width: number = 32,
  height: number = 32,
  iterations: number = 10
): BakersImagePoint[][][] {
  const animationFrames: BakersImagePoint[][][] = [];

  // Generate initial "image" (grid of colored pixels)
  let currentFrame: BakersImagePoint[][] = [];

  for (let y = 0; y < height; y++) {
    const row: BakersImagePoint[] = [];
    for (let x = 0; x < width; x++) {
      // Create a pattern (checkerboard or gradient)
      const isEven = (x + y) % 2 === 0;
      const color = isEven
        ? { r: 255, g: 100, b: 100 }  // Red
        : { r: 100, g: 100, b: 255 }; // Blue

      row.push({
        x: x / width,
        y: y / height,
        originalX: x / width,
        originalY: y / height,
        color
      });
    }
    currentFrame.push(row);
  }

  // Store initial frame
  animationFrames.push(currentFrame);

  // Apply Baker's Map transformations
  for (let iter = 0; iter < iterations; iter++) {
    const nextFrame: BakersImagePoint[][] = [];

    for (let y = 0; y < height; y++) {
      const row: BakersImagePoint[] = [];
      for (let x = 0; x < width; x++) {
        const currentPoint = currentFrame[y][x];
        const transformedPoint = calculateBakersIteration({
          x: currentPoint.x,
          y: currentPoint.y
        });

        row.push({
          x: transformedPoint.x,
          y: transformedPoint.y,
          originalX: currentPoint.originalX,
          originalY: currentPoint.originalY,
          color: currentPoint.color
        });
      }
      nextFrame.push(row);
    }

    currentFrame = nextFrame;
    animationFrames.push(currentFrame);
  }

  return animationFrames;
}

/**
 * Calculate the invariant measure (uniform distribution for Baker's Map)
 * @param samples Number of sample points (default: 10000)
 * @param bins Number of histogram bins (default: 20)
 * @returns 2D histogram representing the invariant measure
 */
export function calculateBakersInvariantMeasure(
  samples: number = 10000,
  bins: number = 20
): number[][] {
  const histogram = Array(bins).fill(null).map(() => Array(bins).fill(0));

  // Generate samples from a uniform distribution
  for (let i = 0; i < samples; i++) {
    const point = {
      x: Math.random(),
      y: Math.random()
    };

    // Apply several iterations to reach the invariant measure
    let currentPoint = point;
    for (let j = 0; j < 50; j++) {
      currentPoint = calculateBakersIteration(currentPoint);
    }

    // Bin the result
    const xBin = Math.floor(currentPoint.x * bins);
    const yBin = Math.floor(currentPoint.y * bins);

    if (xBin >= 0 && xBin < bins && yBin >= 0 && yBin < bins) {
      histogram[yBin][xBin]++;
    }
  }

  // Normalize
  const maxCount = Math.max(...histogram.flat());
  return histogram.map(row => row.map(count => count / maxCount));
}

/**
 * Calculate the topological entropy (log(2) for Baker's Map)
 * @returns The theoretical topological entropy value
 */
export function calculateBakersTopologicalEntropy(): number {
  return Math.log(2);
}

/**
 * Calculate the Kolmogorov-Sinai entropy (equal to topological entropy for Baker's Map)
 * @returns The KS entropy value
 */
export function calculateBakersKSEntropy(): number {
  return Math.log(2);
}

/**
 * Generate phase space partition for symbolic dynamics analysis
 * @param resolution Number of partition cells (default: 16)
 * @returns Partition grid and symbolic sequences
 */
export function calculateBakersPhaseSpacePartition(
  resolution: number = 16
): { grid: number[][], symbols: string[][] } {
  const grid: number[][] = [];
  const symbols: string[][] = [];

  for (let y = 0; y < resolution; y++) {
    const gridRow: number[] = [];
    const symbolRow: string[] = [];

    for (let x = 0; x < resolution; x++) {
      const point = {
        x: x / resolution,
        y: y / resolution
      };

      // Determine which partition the point belongs to
      const partition = point.x < 0.5 ? 0 : 1;
      gridRow.push(partition);
      symbolRow.push(partition.toString());
    }

    grid.push(gridRow);
    symbols.push(symbolRow);
  }

  return { grid, symbols };
}