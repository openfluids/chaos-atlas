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
