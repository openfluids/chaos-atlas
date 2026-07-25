/**
 * Pins for the five scientific bugs just fixed in lib/maps/*.ts. Each test
 * name states the specific regression it guards against.
 */
import { calculateLyapunovExponent } from '@/lib/maps/standard';
import { calculateDuffingIteration, calculateDuffingMap } from '@/lib/maps/duffing';
import { calculateLogisticBifurcation } from '@/lib/maps/logistic';
import { calculateArnoldIteration } from '@/lib/maps/arnold';
import { calculateBakersIteration } from '@/lib/maps/bakers';

describe('standard map: regular orbit must not report spurious chaos', () => {
  it('K = 0.5 from theta0=0.7, p0=0.3 (regular region) gives lambda < 0.01', () => {
    // The old buggy Jacobian gave +0.2244 here. theta0=0.7, p0=0.3 sits well
    // inside a regular (KAM) island at this K, away from the separatrix.
    // Note: theta0=0.1, p0=0.1 is deliberately NOT used -- that point sits in
    // a thin stochastic layer near the separatrix and legitimately gives a
    // small positive exponent (~0.06), which would make this test flaky/wrong.
    const lambda = calculateLyapunovExponent(0.5, 0.7, 0.3, 20000);
    expect(lambda).toBeLessThan(0.01);
  });
});

describe('duffing map: literature form and numerical stability', () => {
  it('first component of the iterate is exactly the previous y (x_next = y)', () => {
    const point = { x: 0.37, y: -0.82 };
    const params = { a: 2.75, b: 0.2 };
    const next = calculateDuffingIteration(point, params);
    expect(next.x).toBe(point.y);
  });

  it('every trajectory value is finite at the canonical a=2.75, b=0.2', () => {
    // A transposed x/y recurrence blows up almost immediately at these
    // canonical parameters; the correct map does not.
    const trajectory = calculateDuffingMap({ x: 0.1, y: 0.1 }, { a: 2.75, b: 0.2 }, 2000, 0);
    for (const p of trajectory) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe('logistic map: bifurcation data at r=4 must not collapse', () => {
  it('contains more than 50 distinct values, not a single point', () => {
    const points = calculateLogisticBifurcation(4.0, 4.0, 1, 500, 200);
    const distinct = new Set(points.map((p) => Math.round(p.y * 1e9) / 1e9));
    expect(distinct.size).toBeGreaterThan(50);
  });
});

describe('negative inputs wrap correctly onto [0, 1) (JS % is remainder, not modulo)', () => {
  it('arnold cat map folds a negative x into [0, 1)', () => {
    const { x, y } = calculateArnoldIteration({ x: -0.3, y: 0.2 });
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(1);
    // (x + y) mod 1 = (-0.3 + 0.2) mod 1 = (-0.1) mod 1 = 0.9
    expect(x).toBeCloseTo(0.9, 10);
  });

  it("baker's map folds a negative x into [0, 1)", () => {
    const { x } = calculateBakersIteration({ x: -0.3, y: 0.1 });
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
    // (2 * -0.3) mod 1 = (-0.6) mod 1 = 0.4
    expect(x).toBeCloseTo(0.4, 10);
  });
});
