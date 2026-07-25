// src/lib/maps/arnold.ts
export interface ArnoldPoint {
  x: number;
  y: number;
}

export interface ArnoldImagePoint {
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  color: { r: number; g: number; b: number };
}

/**
 * Calculate a single iteration of the Arnold Cat Map
 * Equation:
 * x_{n+1} = (x_n + y_n) mod 1
 * y_{n+1} = (x_n + 2·y_n) mod 1
 * @param point Current point {x, y}
 * @returns New point after one iteration
 */
export function calculateArnoldIteration(point: ArnoldPoint): ArnoldPoint {
  const { x, y } = point;

  // JS `%` is remainder, not modulo, so it can return negative values for
  // negative inputs. Fold onto the unit torus with a true modulo.
  const newX = (((x + y) % 1) + 1) % 1;
  const newY = (((x + 2 * y) % 1) + 1) % 1;

  return { x: newX, y: newY };
}

/**
 * Calculate the Arnold Cat Map trajectory for a given number of iterations
 * @param initialPoint Initial point {x, y}
 * @param iterations Number of iterations (default: 100)
 * @returns Array of points representing the trajectory
 */
export function calculateArnoldMap(
  initialPoint: ArnoldPoint,
  iterations: number = 100
): ArnoldPoint[] {
  const points: ArnoldPoint[] = [];
  let currentPoint = initialPoint;

  for (let i = 0; i < iterations; i++) {
    points.push(currentPoint);
    currentPoint = calculateArnoldIteration(currentPoint);
  }

  return points;
}

/**
 * Calculate Arnold Cat Map iterations on a discrete grid
 * @param gridSize Size of the square grid (default: 16)
 * @param iterations Number of iterations to apply (default: 1)
 * @returns 2D array representing the transformed grid
 */
export function calculateArnoldGridTransform(
  gridSize: number = 16,
  iterations: number = 1
): number[][] {
  // Initialize grid with sequential values
  let grid: number[][] = [];
  for (let y = 0; y < gridSize; y++) {
    const row: number[] = [];
    for (let x = 0; x < gridSize; x++) {
      row.push(y * gridSize + x);
    }
    grid.push(row);
  }

  // Apply transformations
  for (let iter = 0; iter < iterations; iter++) {
    const newGrid: number[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const newX = (x + y) % gridSize;
        const newY = (x + 2 * y) % gridSize;
        newGrid[newY][newX] = grid[y][x];
      }
    }

    grid = newGrid;
  }

  return grid;
}

/**
 * Generate image scrambling animation using Arnold Cat Map
 * @param width Image width (default: 32)
 * @param height Image height (default: 32)
 * @param iterations Number of scrambling iterations (default: 12)
 * @returns Array of scrambled image frames for animation
 */
export function calculateArnoldImageScrambling(
  width: number = 32,
  height: number = 32,
  iterations: number = 12
): ArnoldImagePoint[][][] {
  const animationFrames: ArnoldImagePoint[][][] = [];

  // Generate initial "image" (pattern with clear structure)
  let currentFrame: ArnoldImagePoint[][] = [];

  for (let y = 0; y < height; y++) {
    const row: ArnoldImagePoint[] = [];
    for (let x = 0; x < width; x++) {
      // Create a pattern (concentric squares or gradient)
      const centerX = width / 2;
      const centerY = height / 2;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
      const normalizedDistance = distance / maxDistance;

      // Color based on distance from center
      const color = {
        r: Math.floor(255 * normalizedDistance),
        g: Math.floor(255 * (1 - normalizedDistance)),
        b: 128
      };

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
  animationFrames.push(JSON.parse(JSON.stringify(currentFrame)));

  // Apply Arnold Cat Map transformations
  for (let iter = 0; iter < iterations; iter++) {
    const newFrame: ArnoldImagePoint[][] = Array(height).fill(null).map(() => Array(width).fill(null));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currentPoint = currentFrame[y][x];
        const transformedPoint = calculateArnoldIteration({
          x: currentPoint.x,
          y: currentPoint.y
        });

        // Find corresponding pixel in the grid
        const newX = Math.floor(transformedPoint.x * width) % width;
        const newY = Math.floor(transformedPoint.y * height) % height;

        newFrame[newY][newX] = currentPoint;
      }
    }

    currentFrame = newFrame;
    animationFrames.push(JSON.parse(JSON.stringify(currentFrame)));
  }

  return animationFrames;
}

/**
 * Calculate the period of a rational point under Arnold Cat Map
 * @param point Rational point {x, y} where x and y are rational numbers
 * @param maxIterations Maximum iterations to check for period (default: 1000)
 * @returns Period length or 0 if no period found within maxIterations
 */
export function calculateArnoldPeriod(
  point: ArnoldPoint,
  maxIterations: number = 1000
): number {
  let currentPoint = point;
  const visitedPoints = new Map<string, number>();

  for (let i = 0; i < maxIterations; i++) {
    const key = `${currentPoint.x.toFixed(6)},${currentPoint.y.toFixed(6)}`;

    if (visitedPoints.has(key)) {
      return i - visitedPoints.get(key)!;
    }

    visitedPoints.set(key, i);
    currentPoint = calculateArnoldIteration(currentPoint);
  }

  return 0; // No period found
}

/**
 * Generate periodic orbits for rational points
 * @param denominator Denominator for rational points (default: 5)
 * @returns Array of periodic orbits with their periods
 */
export function calculateArnoldPeriodicOrbits(
  denominator: number = 5
): { orbit: ArnoldPoint[], period: number }[] {
  const orbits: { orbit: ArnoldPoint[], period: number }[] = [];

  for (let p = 0; p < denominator; p++) {
    for (let q = 0; q < denominator; q++) {
      const point = {
        x: p / denominator,
        y: q / denominator
      };

      const period = calculateArnoldPeriod(point, 500);
      if (period > 0) {
        const orbit = calculateArnoldMap(point, period);
        orbits.push({ orbit, period });
      }
    }
  }

  // Remove duplicate orbits
  const uniqueOrbits = orbits.filter((orbit, index, self) =>
    index === self.findIndex(o =>
      o.period === orbit.period &&
      o.orbit[0].x === orbit.orbit[0].x &&
      o.orbit[0].y === orbit.orbit[0].y
    )
  );

  return uniqueOrbits;
}

/**
 * Calculate the eigenvalues of the Arnold Cat Map transformation matrix
 * The matrix is [[1, 1], [1, 2]]
 * @returns Eigenvalues λ₁ and λ₂
 */
export function calculateArnoldEigenvalues(): { lambda1: number; lambda2: number } {
  // For matrix [[1, 1], [1, 2]], eigenvalues are (3 ± √5) / 2
  const sqrt5 = Math.sqrt(5);
  const lambda1 = (3 + sqrt5) / 2;
  const lambda2 = (3 - sqrt5) / 2;

  return { lambda1, lambda2 };
}

/**
 * Calculate the trace and determinant of the transformation matrix
 * @returns Object with trace and determinant
 */
export function calculateArnoldMatrixProperties(): { trace: number; determinant: number } {
  // For matrix [[1, 1], [1, 2]]
  const trace = 1 + 2; // = 3
  const determinant = (1 * 2) - (1 * 1); // = 1

  return { trace, determinant };
}

/**
 * Generate Fibonacci-related visualization data
 * Arnold Cat Map is related to Fibonacci sequence through its eigenvalues
 * @param count Number of Fibonacci numbers to generate (default: 20)
 * @returns Array of Fibonacci numbers and ratios
 */
export function calculateArnoldFibonacciRelation(count: number = 20): {
  n: number;
  fibonacci: number;
  ratio: number;
  eigenvalueApproximation: number;
}[] {
  const result: {
    n: number;
    fibonacci: number;
    ratio: number;
    eigenvalueApproximation: number;
  }[] = [];

  const { lambda1 } = calculateArnoldEigenvalues();

  // Generate Fibonacci sequence
  let fibPrev = 0;
  let fibCurr = 1;

  for (let n = 0; n < count; n++) {
    if (n === 0) {
      result.push({
        n,
        fibonacci: 0,
        ratio: 0,
        eigenvalueApproximation: 0
      });
    } else if (n === 1) {
      result.push({
        n,
        fibonacci: 1,
        ratio: 1,
        eigenvalueApproximation: 1
      });
    } else {
      const fibNext = fibPrev + fibCurr;
      const ratio = fibCurr / fibPrev;
      const eigenvalueApproximation = Math.abs(ratio - lambda1);

      result.push({
        n,
        fibonacci: fibNext,
        ratio,
        eigenvalueApproximation
      });

      fibPrev = fibCurr;
      fibCurr = fibNext;
    }
  }

  return result;
}

/**
 * Calculate the area-preserving property verification
 * @param points Array of points forming a shape
 * @param iterations Number of iterations to test (default: 10)
 * @returns Object showing area preservation
 */
export function calculateArnoldAreaPreservation(
  points: ArnoldPoint[],
  iterations: number = 10
): { originalArea: number; transformedAreas: number[]; preserved: boolean } {
  // Calculate original area using shoelace formula
  const calculateArea = (pts: ArnoldPoint[]): number => {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area / 2);
  };

  const originalArea = calculateArea(points);
  const transformedAreas: number[] = [];

  let currentPoints = points;
  for (let i = 0; i < iterations; i++) {
    currentPoints = currentPoints.map(p => calculateArnoldIteration(p));
    transformedAreas.push(calculateArea(currentPoints));
  }

  const preserved = transformedAreas.every(area =>
    Math.abs(area - originalArea) < 1e-10
  );

  return { originalArea, transformedAreas, preserved };
}