/**
 * Cross-check the full Lyapunov spectrum against the conservation identity.
 *
 * For any 2D map, the sum of the two Lyapunov exponents must equal the time
 * average of log|det J| along the orbit -- volumes contract or expand at
 * exactly the rate the Jacobian determinant says they do, and nothing else.
 * A Gram-Schmidt step that has been skipped or botched (e.g. renormalising
 * the two tangent vectors independently instead of orthonormalising them
 * together) lets both vectors collapse onto the dominant direction; the sum
 * of the two "exponents" it then reports drifts away from this identity even
 * though each individual exponent can look plausible on its own. That makes
 * the identity the most sensitive test in this file. Mirrors
 * python/tests/test_lyapunov_spectrum.py.
 */
import { lyapunovSpectrum2D } from '@/lib/maps/lyapunov';
import { calculateHenonIteration } from '@/lib/maps/henon';
import { calculateDuffingIteration } from '@/lib/maps/duffing';
import { calculateTinkerbellIteration } from '@/lib/maps/tinkerbell';
import { calculateIkedaIteration } from '@/lib/maps/ikeda';
import { calculateStandardMap } from '@/lib/maps/standard';

type Vec2 = [number, number];
type Mat2 = [[number, number], [number, number]];

function meanLogAbsDet(
  iterate: (x: number, y: number) => Vec2,
  jacobian: (x: number, y: number) => Mat2,
  x0: number,
  y0: number,
  iterations: number,
  transient: number
): number {
  let x = x0;
  let y = y0;
  for (let i = 0; i < transient; i++) {
    [x, y] = iterate(x, y);
  }
  let total = 0;
  for (let i = 0; i < iterations; i++) {
    const [[j11, j12], [j21, j22]] = jacobian(x, y);
    const det = j11 * j22 - j12 * j21;
    total += Math.log(Math.abs(det));
    [x, y] = iterate(x, y);
  }
  return total / iterations;
}

const henonJac = (x: number, _y: number, a = 1.4, b = 0.3): Mat2 => [[-2 * a * x, 1], [b, 0]];
const henonIterate = (x: number, y: number): Vec2 => {
  const p = calculateHenonIteration(x, y);
  return [p.x, p.y];
};

const duffingJac = (_x: number, y: number, a = 2.75, b = 0.2): Mat2 => [[0, 1], [-b, a - 3 * y * y]];
const duffingIterate = (x: number, y: number): Vec2 => {
  const p = calculateDuffingIteration({ x, y }, { a: 2.75, b: 0.2 });
  return [p.x, p.y];
};

const tinkerbellJac = (x: number, y: number, a = 0.9, b = -0.6013, c = 2.0, d = 0.5): Mat2 => [
  [2 * x + a, -2 * y + b],
  [2 * y + c, 2 * x + d],
];
const tinkerbellIterate = (x: number, y: number): Vec2 => {
  const p = calculateTinkerbellIteration({ x, y }, { a: 0.9, b: -0.6013, c: 2.0, d: 0.5 });
  return [p.x, p.y];
};

const ikedaJac = (x: number, y: number, a = 0.9, b = 0.9, c = 0.4, d = 6.0): Mat2 => {
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
const ikedaIterate = (x: number, y: number): Vec2 => {
  const p = calculateIkedaIteration({ x, y }, { a: 0.9, b: 0.9, c: 0.4, d: 6.0 });
  return [p.x, p.y];
};

const standardJac = (theta: number, _p: number, k = 1.5): Mat2 => {
  const kc = k * Math.cos(theta);
  return [[1 + kc, 1], [kc, 1]];
};
const standardIterate = (theta: number, p: number): Vec2 => {
  const [, next] = calculateStandardMap(1.5, theta, p, 1);
  return next;
};

const CASES: Record<
  string,
  { iterate: (x: number, y: number) => Vec2; jacobian: (x: number, y: number) => Mat2; state: Vec2 }
> = {
  henon: { iterate: henonIterate, jacobian: henonJac, state: [0.1, 0.1] },
  ikeda: { iterate: ikedaIterate, jacobian: ikedaJac, state: [0.1, 0.1] },
  duffing: { iterate: duffingIterate, jacobian: duffingJac, state: [0.1, 0.1] },
  tinkerbell: { iterate: tinkerbellIterate, jacobian: tinkerbellJac, state: [-0.72, -0.64] },
  standard: { iterate: standardIterate, jacobian: standardJac, state: [0.1, 0.1] },
};

describe('lambda1 + lambda2 equals the mean log|det J| identity', () => {
  const iterations = 20000;
  const transient = 200;

  it.each(Object.keys(CASES))('holds for %s', (name) => {
    const { iterate, jacobian, state } = CASES[name];
    const { lambda1, lambda2 } = lyapunovSpectrum2D(iterate, jacobian, state[0], state[1], iterations, transient);
    const expected = meanLogAbsDet(iterate, jacobian, state[0], state[1], iterations, transient);
    expect(Math.abs(lambda1 + lambda2 - expected)).toBeLessThan(1e-3);
  });

  it.each(Object.keys(CASES))('lambda2 < lambda1 with a real margin for %s', (name) => {
    const { iterate, jacobian, state } = CASES[name];
    const { lambda1, lambda2 } = lyapunovSpectrum2D(iterate, jacobian, state[0], state[1], iterations, transient);
    // A missing Gram-Schmidt step makes both exponents converge to the same
    // (largest) value, so demand real separation, not just <.
    expect(lambda1 - lambda2).toBeGreaterThan(0.05);
  });
});

describe('determinant identities', () => {
  it('standard map: det J = 1 everywhere (area-preserving)', () => {
    for (let theta = 0; theta < 2 * Math.PI; theta += (2 * Math.PI) / 25) {
      const [[j11, j12], [j21, j22]] = standardJac(theta, 0);
      expect(j11 * j22 - j12 * j21).toBeCloseTo(1.0, 10);
    }
  });

  it('henon: det J = -b everywhere', () => {
    for (let x = -1.5; x <= 1.5; x += 3 / 25) {
      const [[j11, j12], [j21, j22]] = henonJac(x, 0);
      expect(j11 * j22 - j12 * j21).toBeCloseTo(-0.3, 10);
    }
  });

  it('duffing: det J = b everywhere (from [[0,1],[-b, a-3y^2]])', () => {
    for (let y = -1.5; y <= 1.5; y += 3 / 25) {
      const [[j11, j12], [j21, j22]] = duffingJac(0, y);
      expect(j11 * j22 - j12 * j21).toBeCloseTo(0.2, 10);
    }
  });

  it('ikeda: det J = a*b everywhere', () => {
    const points: Vec2[] = [[0.1, 0.1], [0.5, -0.3], [1.2, 0.7], [-0.4, 0.9]];
    for (const [x, y] of points) {
      const [[j11, j12], [j21, j22]] = ikedaJac(x, y);
      expect(j11 * j22 - j12 * j21).toBeCloseTo(0.81, 10);
    }
  });
});

describe('ikeda dissipation (regression: old code reported two positive exponents)', () => {
  it('lambda2 < 0', () => {
    const { lambda2 } = lyapunovSpectrum2D(ikedaIterate, ikedaJac, 0.1, 0.1, 20000, 200);
    expect(lambda2).toBeLessThan(0);
  });

  it('lambda1 + lambda2 approx ln(a*b) = ln(0.81)', () => {
    const { lambda1, lambda2 } = lyapunovSpectrum2D(ikedaIterate, ikedaJac, 0.1, 0.1, 20000, 200);
    expect(lambda1 + lambda2).toBeCloseTo(Math.log(0.81), 2);
  });
});
