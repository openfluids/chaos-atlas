// Generic 2-D Lyapunov spectrum by tangent-space propagation with
// Gram-Schmidt orthonormalisation at every step. This is the standard
// Benettin et al. algorithm: without re-orthonormalising the second
// tangent vector against the first, it collapses onto the direction of
// fastest growth and both accumulated sums converge to the same
// (largest) exponent. The projection step below is what fixes that.

/**
 * Compute the full 2-D Lyapunov spectrum {lambda1, lambda2} of a 2-D map
 * by propagating two tangent vectors through the Jacobian at every step,
 * normalising the first, Gram-Schmidt-orthogonalising the second against
 * the first, normalising the second, and accumulating the logarithms of
 * the two normalisation factors.
 *
 * @param iterate Map function (x, y) -> [xNext, yNext]
 * @param jacobian Jacobian of the map at (x, y), as [[j11, j12], [j21, j22]]
 * @param x0 Initial x
 * @param y0 Initial y
 * @param iterations Number of iterations to accumulate over (default: 10000)
 * @param transient Number of iterations to discard before accumulating (default: 100)
 * @returns The two Lyapunov exponents, lambda1 >= lambda2, in nats/iteration
 */
export function lyapunovSpectrum2D(
  iterate: (x: number, y: number) => [number, number],
  jacobian: (x: number, y: number) => [[number, number], [number, number]],
  x0: number,
  y0: number,
  iterations: number = 10000,
  transient: number = 100
): { lambda1: number; lambda2: number } {
  let x = x0;
  let y = y0;

  for (let i = 0; i < transient; i++) {
    [x, y] = iterate(x, y);
  }

  // Two tangent vectors, initialised to the standard basis.
  let v1x = 1;
  let v1y = 0;
  let v2x = 0;
  let v2y = 1;

  let sum1 = 0;
  let sum2 = 0;

  for (let i = 0; i < iterations; i++) {
    const [[j11, j12], [j21, j22]] = jacobian(x, y);

    // Push both tangent vectors through the Jacobian.
    const w1x = j11 * v1x + j12 * v1y;
    const w1y = j21 * v1x + j22 * v1y;
    const w2x = j11 * v2x + j12 * v2y;
    const w2y = j21 * v2x + j22 * v2y;

    // Normalise v1 and accumulate its growth.
    const norm1 = Math.sqrt(w1x * w1x + w1y * w1y);
    let n1x = 0;
    let n1y = 0;
    if (norm1 > 0) {
      n1x = w1x / norm1;
      n1y = w1y / norm1;
      sum1 += Math.log(norm1);
    }

    // Gram-Schmidt: subtract the (w2 . n1) n1 projection from w2 before
    // normalising, so v2 tracks the second-fastest growth direction
    // instead of collapsing onto v1's direction.
    const proj = w2x * n1x + w2y * n1y;
    const orthoX = w2x - proj * n1x;
    const orthoY = w2y - proj * n1y;

    const norm2 = Math.sqrt(orthoX * orthoX + orthoY * orthoY);
    let n2x = 0;
    let n2y = 0;
    if (norm2 > 0) {
      n2x = orthoX / norm2;
      n2y = orthoY / norm2;
      sum2 += Math.log(norm2);
    }

    v1x = n1x;
    v1y = n1y;
    v2x = n2x;
    v2y = n2y;

    [x, y] = iterate(x, y);
  }

  return {
    lambda1: sum1 / iterations,
    lambda2: sum2 / iterations,
  };
}
