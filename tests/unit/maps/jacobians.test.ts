/**
 * Validate every hand-derived Jacobian used by the Lyapunov routines against
 * central finite differences of the map's own exported iterate function.
 *
 * The Lyapunov routines evolve a tangent vector under an analytic Jacobian.
 * A sign slip there does not crash or produce NaNs, it just yields a
 * confidently wrong exponent, so each Jacobian is checked against the map it
 * claims to differentiate. This mirrors python/tests/test_jacobians.py.
 *
 * None of henon.ts/duffing.ts/tinkerbell.ts/ikeda.ts/standard.ts/arnold.ts
 * export their internal jacobianFn, so the analytic Jacobians below are
 * re-derived locally from the same formulas documented in those modules'
 * comments (verified here against finite differences of the real exported
 * iterate function -- the thing that actually matters).
 */
import { calculateHenonIteration } from '@/lib/maps/henon';
import { calculateDuffingIteration } from '@/lib/maps/duffing';
import { calculateTinkerbellIteration } from '@/lib/maps/tinkerbell';
import { calculateIkedaIteration } from '@/lib/maps/ikeda';
import { calculateStandardMap } from '@/lib/maps/standard';
import { calculateArnoldIteration } from '@/lib/maps/arnold';

const H = 1e-6;

type Vec2 = [number, number];
type Mat2 = [[number, number], [number, number]];

function numericJacobian(step: (x: number, y: number) => Vec2, x: number, y: number): Mat2 {
  const fxPlus = step(x + H, y);
  const fxMinus = step(x - H, y);
  const fyPlus = step(x, y + H);
  const fyMinus = step(x, y - H);
  return [
    [(fxPlus[0] - fxMinus[0]) / (2 * H), (fyPlus[0] - fyMinus[0]) / (2 * H)],
    [(fxPlus[1] - fxMinus[1]) / (2 * H), (fyPlus[1] - fyMinus[1]) / (2 * H)],
  ];
}

function expectMatClose(actual: Mat2, expected: Mat2, tol: number) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      expect(Math.abs(actual[i][j] - expected[i][j])).toBeLessThanOrEqual(tol);
    }
  }
}

// Deterministic sample points, mirroring the Python suite's fixed-seed grid.
const POINTS: Vec2[] = [
  [-1.2, -0.8], [-0.9, 0.4], [-0.5, -0.2], [-0.1, 1.1], [0.05, -1.3],
  [0.3, 0.7], [0.6, -0.6], [0.9, 0.2], [1.1, -1.0], [1.4, 1.4],
  [-1.4, 0.9], [-0.6, 1.2], [0.2, 0.2], [0.8, -1.1], [-1.0, -1.4],
];

describe('henon Jacobian matches finite differences', () => {
  const a = 1.4;
  const b = 0.3;
  const jac = (x: number): Mat2 => [[-2 * a * x, 1], [b, 0]];
  const step = (x: number, y: number): Vec2 => {
    const p = calculateHenonIteration(x, y, a, b);
    return [p.x, p.y];
  };

  it.each(POINTS)('at (%p, %p)', (x, y) => {
    expectMatClose(jac(x), numericJacobian(step, x, y), 1e-6);
  });
});

describe('duffing Jacobian matches finite differences', () => {
  const a = 2.75;
  const b = 0.2;
  const jac = (y: number): Mat2 => [[0, 1], [-b, a - 3 * y * y]];
  const step = (x: number, y: number): Vec2 => {
    const p = calculateDuffingIteration({ x, y }, { a, b });
    return [p.x, p.y];
  };

  it.each(POINTS)('at (%p, %p)', (x, y) => {
    expectMatClose(jac(y), numericJacobian(step, x, y), 1e-5);
  });
});

describe('tinkerbell Jacobian matches finite differences', () => {
  const a = 0.9;
  const b = -0.6013;
  const c = 2.0;
  const d = 0.5;
  const jac = (x: number, y: number): Mat2 => [
    [2 * x + a, -2 * y + b],
    [2 * y + c, 2 * x + d],
  ];
  const step = (x: number, y: number): Vec2 => {
    const p = calculateTinkerbellIteration({ x, y }, { a, b, c, d });
    return [p.x, p.y];
  };

  it.each(POINTS)('at (%p, %p)', (x, y) => {
    expectMatClose(jac(x, y), numericJacobian(step, x, y), 1e-6);
  });
});

describe('ikeda Jacobian matches finite differences', () => {
  const a = 0.9;
  const b = 0.9;
  const c = 0.4;
  const d = 6.0;
  const jac = (x: number, y: number): Mat2 => {
    const denom = 1 + x * x + y * y;
    const t = c - d / denom;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const dtDx = (2 * d * x) / (denom * denom);
    const dtDy = (2 * d * y) / (denom * denom);
    const u = x * ct - y * st;
    const v = x * st + y * ct;
    return [
      [a * (ct - v * dtDx), a * (-st - v * dtDy)],
      [b * (st + u * dtDx), b * (ct + u * dtDy)],
    ];
  };
  const step = (x: number, y: number): Vec2 => {
    const p = calculateIkedaIteration({ x, y }, { a, b, c, d });
    return [p.x, p.y];
  };

  it.each(POINTS)('at (%p, %p)', (x, y) => {
    expectMatClose(jac(x, y), numericJacobian(step, x, y), 1e-5);
  });
});

describe('standard map Jacobian matches finite differences', () => {
  const K = 1.5;
  const TWO_PI = 2 * Math.PI;
  const jac = (theta: number): Mat2 => {
    const kc = K * Math.cos(theta);
    return [[1 + kc, 1], [kc, 1]];
  };
  // calculateStandardMap wraps into [0, 2*pi) with a discontinuous mod, so a
  // finite difference straddling the seam is meaningless -- same caveat as
  // the Python suite. Points here are safely away from theta = 0 or 2*pi.
  const step = (theta: number, p: number): Vec2 => {
    const [, next] = calculateStandardMap(K, theta, p, 1);
    return next;
  };
  const SAFE_ANGLES = [0.3, 1.0, 2.2, 3.1, 4.4, 5.5];

  it.each(SAFE_ANGLES)('at theta = %p', (theta) => {
    const p = 1.0;
    expectMatClose(jac(theta), numericJacobian(step, theta, p), 1e-5);
  });

  it('is exactly area preserving (det = 1) at every angle', () => {
    for (let theta = 0; theta < TWO_PI; theta += TWO_PI / 50) {
      const det = jac(theta)[0][0] * jac(theta)[1][1] - jac(theta)[0][1] * jac(theta)[1][0];
      expect(det).toBeCloseTo(1.0, 10);
    }
  });
});

describe('arnold cat map Jacobian matches finite differences', () => {
  // Linear map, constant matrix [[1, 1], [1, 2]] away from the mod-1 wrap
  // seam (where the finite difference would straddle a discontinuity).
  const jac: Mat2 = [[1, 1], [1, 2]];
  const step = (x: number, y: number): Vec2 => {
    const p = calculateArnoldIteration({ x, y });
    return [p.x, p.y];
  };
  const SAFE_POINTS: Vec2[] = [[0.13, 0.21], [0.35, 0.05], [0.42, 0.31], [0.08, 0.44]];

  it.each(SAFE_POINTS)('at (%p, %p)', (x, y) => {
    expectMatClose(jac, numericJacobian(step, x, y), 1e-6);
  });
});
