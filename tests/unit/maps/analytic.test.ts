/**
 * Pin exact (or well-converged) analytic values, mirroring
 * python/tests/test_maps.py.
 */
import { calculateArnoldEigenvalues, calculateArnoldMatrixProperties } from '@/lib/maps/arnold';
import { calculateTentLyapunovExponent } from '@/lib/maps/tent';
import { calculateLogisticLyapunovExponent, calculateLogisticBifurcation } from '@/lib/maps/logistic';
import { calculateHenonLyapunovExponent } from '@/lib/maps/henon';

describe('arnold cat map', () => {
  // arnold.ts does not export a Lyapunov-exponent computation for the cat
  // map (unlike the Python `arnold.lyapunov()`), so this is pinned via the
  // matrix eigenvalues/determinant that ARE exported. Gap noted in the
  // worker report: exporting a `calculateArnoldLyapunovExponent` (returning
  // Math.log((3+Math.sqrt(5))/2)) would let this be asserted directly.
  it('eigenvalues are (3 +/- sqrt(5)) / 2', () => {
    const { lambda1, lambda2 } = calculateArnoldEigenvalues();
    expect(lambda1).toBeCloseTo((3 + Math.sqrt(5)) / 2, 10);
    expect(lambda2).toBeCloseTo((3 - Math.sqrt(5)) / 2, 10);
  });

  it('ln(lambda1) equals the published Lyapunov exponent 0.96242', () => {
    const { lambda1 } = calculateArnoldEigenvalues();
    expect(Math.log(lambda1)).toBeCloseTo(0.96242, 4);
  });

  it('matrix determinant is exactly 1 (area preserving)', () => {
    expect(calculateArnoldMatrixProperties().determinant).toBe(1);
  });
});

describe('tent map: lambda = ln(alpha) exactly by construction', () => {
  it.each([2.0, 1.5, 1.8])('alpha = %p', (alpha) => {
    const lambda = calculateTentLyapunovExponent(alpha, 0.4, 5000);
    expect(lambda).toBeCloseTo(Math.log(alpha), 10);
  });
});

describe('logistic map at r = 4', () => {
  it('lambda = ln(2) for a generic (non-preperiodic) x0', () => {
    // x0 = 0.5 is preperiodic at r = 4 (see the dedicated trap test below),
    // so a generic seed is required to hit the attractor's true exponent.
    const lambda = calculateLogisticLyapunovExponent(4.0, 0.2, 200000);
    expect(Math.abs(lambda - Math.log(2))).toBeLessThan(1e-2);
  });

  it('the x0 = 0.5 preperiodic trap reports its own orbit, not the attractor', () => {
    // 0.5 -> 1 -> 0 -> 0 -> ... lands on the unstable fixed point x = 0,
    // where |f'(x)| = r, so the "exponent" for that specific orbit is ln(4)
    // -- correct for the orbit, wrong for the attractor. Pinned so this
    // documented trap cannot regress into a silently different answer.
    const lambda = calculateLogisticLyapunovExponent(4.0, 0.5, 1000);
    expect(lambda).toBeCloseTo(Math.log(4.0), 9);
  });

  it('the bifurcation diagram at r=4 explores the full chaotic attractor, not the x0=0.5 trap', () => {
    const points = calculateLogisticBifurcation(4.0, 4.0, 1, 2000, 200);
    const distinct = new Set(points.map((p) => Math.round(p.y * 1e9) / 1e9));
    expect(distinct.size).toBeGreaterThan(50);
  });
});

describe('henon map: published lambda1 ~= 0.41922', () => {
  it('converges within 0.01 at 100k iterations', () => {
    // Convergence on the Henon attractor is slow and the running estimate
    // oscillates a few thousandths around the published value even at large
    // iteration counts (measured 0.4188-0.4209 across 50k-400k iterations
    // during test development). 100k iterations with an absolute tolerance
    // of 0.01 -- the same budget python/tests/test_maps.py uses -- comfortably
    // covers that oscillation without being loose enough to pass a broken
    // Jacobian or a missing Gram-Schmidt step (those are caught precisely by
    // jacobians.test.ts and invariants.test.ts instead).
    const lambda1 = calculateHenonLyapunovExponent(1.4, 0.3, 0.1, 0.1, 100000);
    expect(Math.abs(lambda1 - 0.41922)).toBeLessThan(0.01);
  });
});
