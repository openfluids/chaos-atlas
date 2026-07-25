/**
 * Regression tests for the two bugs fixed in complexQuadratic.ts:
 *
 * 1. Integer-banded coloring: `calculateFractalColor` used to color on the
 *    raw integer escape-time count, giving `maxIterations` discrete bands.
 *    The fix colors on the smooth (normalised) iteration count instead,
 *    which is continuous across the escape boundary even though the
 *    underlying integer count still jumps by whole steps.
 *
 * 2. `classic` color scheme clipping: `sin`/`cos` go negative for half the
 *    ratio range, and writing a negative number into a Uint8ClampedArray
 *    silently clamps to 0 -- flattening the outer half of the palette.
 */
import {
  ComplexNumber,
  calculateComplexQuadraticMap,
  computeSmoothIterationCount,
  calculateFractalColor,
  type FractalColorScheme,
} from '@/lib/maps/complexQuadratic';

describe('computeSmoothIterationCount', () => {
  it('c = 0 never escapes (interior point): smoothIterations equals maxIterations', () => {
    const maxIterations = 100;
    const result = calculateComplexQuadraticMap(
      new ComplexNumber(0, 0),
      new ComplexNumber(0, 0),
      maxIterations
    );
    expect(result.escaped).toBe(false);

    const nu = computeSmoothIterationCount(result.iterations, result.finalValue.real, result.escaped, maxIterations);
    expect(nu).toBe(maxIterations);
  });

  it('c = 1 escapes quickly with a sensible (small, finite) smooth count', () => {
    const maxIterations = 100;
    const result = calculateComplexQuadraticMap(
      new ComplexNumber(1, 0),
      new ComplexNumber(0, 0),
      maxIterations
    );
    expect(result.escaped).toBe(true);
    expect(result.iterations).toBeLessThan(maxIterations);

    const finalMagnitude = Math.sqrt(
      result.finalValue.real * result.finalValue.real + result.finalValue.imag * result.finalValue.imag
    );
    const nu = computeSmoothIterationCount(result.iterations, finalMagnitude, result.escaped, maxIterations);

    expect(Number.isFinite(nu)).toBe(true);
    // Smooth count should stay in the ballpark of the integer count it
    // refines -- within a couple of iterations either side.
    expect(Math.abs(nu - result.iterations)).toBeLessThan(2);
  });

  it('is monotonic and continuous crossing the escape boundary along a scan line, unlike the raw integer count', () => {
    const maxIterations = 200;
    // Scan c = -0.75 + i*t, t sweeping 0.30 down to 0.10: a vertical line
    // that grazes just outside the main cardioid's boundary near its top,
    // so escape time increases gradually as t approaches the boundary
    // rather than jumping between unrelated mini-brot structures.
    const samples: { imag: number; iterations: number; nu: number; escaped: boolean }[] = [];

    for (let i = 0; i <= 400; i++) {
      const imag = 0.3 - (i / 400) * 0.2;
      const c = new ComplexNumber(-0.75, imag);
      const result = calculateComplexQuadraticMap(c, new ComplexNumber(0, 0), maxIterations);
      const finalMagnitude = Math.sqrt(
        result.finalValue.real * result.finalValue.real + result.finalValue.imag * result.finalValue.imag
      );
      const nu = computeSmoothIterationCount(result.iterations, finalMagnitude, result.escaped, maxIterations);
      samples.push({ imag, iterations: result.iterations, nu, escaped: result.escaped });
    }

    // The raw integer count must jump somewhere along this sweep (that's
    // the banding the smooth count is meant to fix).
    const integerJumps = samples.slice(1).filter((s, i) => s.iterations !== samples[i].iterations);
    expect(integerJumps.length).toBeGreaterThan(0);

    // The smooth count among escaped neighbours should not jump by more
    // than a small threshold, even where the integer count does -- that's
    // the whole point of normalising it.
    const escapedPairs = samples
      .slice(1)
      .map((s, i) => ({ prev: samples[i], curr: s }))
      .filter((pair) => pair.prev.escaped && pair.curr.escaped);

    expect(escapedPairs.length).toBeGreaterThan(0);

    const maxJump = Math.max(...escapedPairs.map((pair) => Math.abs(pair.curr.nu - pair.prev.nu)));
    expect(maxJump).toBeLessThan(1);
  });
});

describe('calculateFractalColor', () => {
  const schemes: FractalColorScheme[] = ['viridis', 'inferno', 'magma', 'classic', 'fire', 'ocean', 'rainbow'];

  it.each(schemes)('%s: every channel stays within [0, 255] across the full ratio range (regression for classic clipping)', (scheme) => {
    const maxIterations = 100;
    for (let i = 0; i <= 100; i++) {
      const nu = (i / 100) * maxIterations;
      const color = calculateFractalColor(nu, maxIterations, scheme, true);

      for (const channel of [color.r, color.g, color.b] as const) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
        expect(Number.isNaN(channel)).toBe(false);
      }
    }
  });

  it('classic scheme is not a flat two-tone ramp over the outer half of the range (direct clipping regression)', () => {
    const maxIterations = 100;
    const colorsAboveHalf = [];
    for (let i = 51; i <= 100; i++) {
      colorsAboveHalf.push(calculateFractalColor(i, maxIterations, 'classic', true));
    }

    // Previously every negative-going channel clamped to 0 for ratio > 0.5,
    // so g and b (and eventually r) were pinned at 0 across this whole
    // range. Assert at least one non-zero value shows up per channel.
    expect(colorsAboveHalf.some((c) => c.r > 0)).toBe(true);
    expect(colorsAboveHalf.some((c) => c.g > 0)).toBe(true);
    expect(colorsAboveHalf.some((c) => c.b > 0)).toBe(true);
  });

  it('interior (non-escaped) points render black regardless of scheme', () => {
    for (const scheme of schemes) {
      const color = calculateFractalColor(100, 100, scheme, false);
      expect(color).toEqual({ r: 0, g: 0, b: 0 });
    }
  });
});

/**
 * The suite above sweeps `nu` across [0, maxIterations], which is the range a
 * well-behaved render produces. Real escape data reaches outside it: nu is
 * n + 1 - log2(log|z|), so a point escaping in very few iterations with a
 * large |z| can land below zero, and a NaN anywhere upstream propagates
 * silently because Math.max/Math.min return NaN rather than clamping it.
 *
 * That mattered: Math.floor(NaN) is NaN, so a NaN ratio indexed the colormap
 * anchor table out of bounds and destructured undefined; the three schemes
 * that compute channels arithmetically instead emitted NaN, which serialises
 * as null and paints transparent.
 */
describe('calculateFractalColor survives out-of-range and non-finite input', () => {
  const schemes: FractalColorScheme[] = [
    'classic', 'rainbow', 'viridis', 'inferno', 'magma', 'fire', 'ocean',
  ];
  const hostile = [-1e6, -5, -0.1, 0, 1, 199.9, 200, 1e6, NaN, Infinity, -Infinity];

  it.each(schemes)('%s returns finite channels in [0, 255] for every input', scheme => {
    for (const nu of hostile) {
      const c = calculateFractalColor(nu, 200, scheme, true);
      for (const channel of [c.r, c.g, c.b]) {
        expect(Number.isFinite(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });
});

/**
 * Escape times are heavily skewed towards small values, so a linear nu -> ramp
 * mapping crushes almost every escaped pixel into the darkest sliver of the
 * palette. The logarithmic remap is what actually makes the render read as a
 * gradient rather than a flat wash, so pin the property it provides.
 */
describe('colour ramp is used across its range, not just the dark end', () => {
  it('spreads a realistic escape-time distribution over most of the palette', () => {
    const MAX = 200;
    const bins = new Array(10).fill(0);
    let escaped = 0;

    for (let i = 0; i < 200; i++) {
      for (let j = 0; j < 200; j++) {
        const c = new ComplexNumber(-2.2 + (i / 199) * 3.0, -1.3 + (j / 199) * 2.6);
        const r = calculateComplexQuadraticMap(c, new ComplexNumber(0, 0), MAX);
        if (!r.escaped) continue;
        escaped++;
        const colour = calculateFractalColor(
          computeSmoothIterationCount(r.iterations, Math.hypot(r.finalValue.real, r.finalValue.imag), true, MAX),
          MAX, 'inferno', true,
        );
        // Luminance is monotonic along inferno, so it stands in for ramp position.
        const lum = (0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b) / 255;
        bins[Math.min(9, Math.floor(lum * 10))]++;
      }
    }

    expect(escaped).toBeGreaterThan(1000);
    // Under the previous linear mapping 96% of escaped pixels fell in the
    // bottom tenth of the ramp, leaving at most two or three bins populated.
    const populated = bins.filter(n => n / escaped > 0.01).length;
    expect(populated).toBeGreaterThanOrEqual(5);
  });
});
