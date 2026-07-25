/**
 * Exercise the exported Lyapunov entry points -- the functions the
 * visualizations actually call -- rather than re-deriving the mathematics
 * in the test file.
 *
 * This distinction matters more than it looks. invariants.test.ts checks
 * lyapunovSpectrum2D against Jacobians written out locally in the test, so it
 * proves the shared QR routine is sound but says nothing about the Jacobian
 * each map hands it. Those Jacobians live in closures inside
 * calculate*LyapunovExponents and are not exported, so the only way to reach
 * them is through the public function. Corrupting the real Ikeda Jacobian
 * leaves every other test in this directory green; the assertions below are
 * what fail.
 *
 * The leverage comes from maps whose Jacobian determinant is a constant:
 *
 *   Ikeda    det J = a*b       (the rotation is orthogonal, so only the
 *                               two scale factors survive)
 *   Duffing  det J = b         (uniform dissipation -- this is what makes it
 *                               a damped oscillator in the first place)
 *
 * For those, sum(lambda) == log|det J| is a closed-form target with no
 * reference implementation and no tolerance argument to lose. A wrong
 * Jacobian cannot satisfy it by accident.
 */
import { calculateIkedaLyapunovExponents } from '@/lib/maps/ikeda';
import { calculateDuffingLyapunovExponents } from '@/lib/maps/duffing';
import {
  calculateTinkerbellLyapunovExponents,
  calculateTinkerbellIteration,
} from '@/lib/maps/tinkerbell';

const ITERATIONS = 50000;

describe('exported Lyapunov entry points satisfy the conservation identity', () => {
  it('ikeda: lambda1 + lambda2 === log(a*b), det J being exactly a*b', () => {
    const params = { a: 0.9, b: 0.9, c: 0.4, d: 6.0 };
    const { lambda1, lambda2 } = calculateIkedaLyapunovExponents(params, ITERATIONS);

    expect(lambda1 + lambda2).toBeCloseTo(Math.log(params.a * params.b), 4);
  });

  it('ikeda: lambda2 is negative -- the map contracts area every step', () => {
    // The pre-fix implementation reported lambda1 = +0.6258, lambda2 = +0.2759.
    // Two positive exponents for a map with |det J| = 0.81 < 1 is impossible,
    // and it was displayed on the site beside the words "Chaotic behavior".
    const { lambda1, lambda2 } = calculateIkedaLyapunovExponents(
      { a: 0.9, b: 0.9, c: 0.4, d: 6.0 },
      ITERATIONS,
    );

    expect(lambda2).toBeLessThan(0);
    expect(lambda1).toBeGreaterThan(0);
  });

  it('duffing: lambda1 + lambda2 === log(b), det J being exactly b', () => {
    const params = { a: 2.75, b: 0.2 };
    const { lambda1, lambda2 } = calculateDuffingLyapunovExponents(params, ITERATIONS);

    expect(lambda1 + lambda2).toBeCloseTo(Math.log(params.b), 4);
  });

  it('duffing: lambda1 is pinned to its measured value, not merely positive', () => {
    // Under the pre-fix (transposed) map form every preset had lambda1 < 0,
    // including the one labelled "Chaotic Regime".
    //
    // The tolerance here is deliberately tight. det J = b holds no matter what
    // the (1,1) entry of the Jacobian is -- with J[0][0] = 0, the determinant
    // is -1 * J[1][0] and the a - 3y^2 term cancels out entirely. So the
    // identity above cannot see an error in that entry, and a loose "is it
    // positive" check cannot either: perturbing it by 0.31 moves lambda1 only
    // from 0.4785 to 0.4569. This function is fully deterministic (fixed x0,
    // fixed iteration count), so there is no sampling noise to leave room for.
    const { lambda1 } = calculateDuffingLyapunovExponents({ a: 2.75, b: 0.2 }, ITERATIONS);

    expect(lambda1).toBeCloseTo(0.4785, 2);
  });

  it('tinkerbell: lambda1 + lambda2 matches the mean log|det J| along the orbit', () => {
    // Tinkerbell's determinant is state-dependent, so the reference has to be
    // accumulated rather than written down. Deriving it here independently is
    // the point: if the Jacobian inside calculateTinkerbellLyapunovExponents
    // disagrees with the one below, the two numbers separate.
    const params = { a: 0.9, b: -0.6013, c: 2.0, d: 0.5 };
    const { lambda1, lambda2 } = calculateTinkerbellLyapunovExponents(params, ITERATIONS);

    let point = { x: 0.1, y: -0.1 };
    for (let i = 0; i < 100; i++) {
      point = calculateTinkerbellIteration(point, params);
    }

    let total = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      const det =
        (2 * point.x + params.a) * (2 * point.x + params.d) -
        (-2 * point.y + params.b) * (2 * point.y + params.c);
      total += Math.log(Math.abs(det));
      point = calculateTinkerbellIteration(point, params);
    }

    expect(lambda1 + lambda2).toBeCloseTo(total / ITERATIONS, 2);
  });

  it('tinkerbell: lambda1 matches the published value for the classic attractor', () => {
    const { lambda1 } = calculateTinkerbellLyapunovExponents(
      { a: 0.9, b: -0.6013, c: 2.0, d: 0.5 },
      ITERATIONS,
    );

    // Pre-fix this returned 0.2436 -- 22% high, from a QR that normalised the
    // two columns independently instead of orthogonalising them.
    expect(lambda1).toBeCloseTo(0.2001, 2);
  });
});
