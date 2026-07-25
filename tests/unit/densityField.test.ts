/**
 * Regression tests for the density-field renderer shared by the attractor
 * views (Hénon, Ikeda, Tinkerbell, Duffing): non-uniform occupancy must
 * survive normalisation (a linear `count / maxCount` collapses the heavy
 * tail to near-zero), and the max-finding must not use `Math.max(...array)`
 * (a spread blows the call stack on large binned arrays).
 */
import { computeDensityField, paintDensityField } from '@/components/visualizations/densityField';

describe('computeDensityField', () => {
  it('normalises with log1p, not linearly, so sparse bins stay visible', () => {
    // One heavily-occupied bin and many singly-occupied bins, mimicking a
    // fractal attractor's folds vs. its tails.
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 10000; i++) points.push({ x: 0.1, y: 0.1 }); // dense bin
    for (let i = 0; i < 20; i++) points.push({ x: 0.9, y: 0.9 }); // sparse bin

    const field = computeDensityField(points, {
      xDomain: [0, 1],
      yDomain: [0, 1],
      pixelWidth: 10,
      pixelHeight: 10,
    });

    const denseIdx = 1 * 10 + 1; // (0.1, 0.1) -> pixel (1, 8) flipped y, but just check nonzero magnitude relatively
    const denseValue = Math.max(...Array.from(field));
    expect(denseValue).toBeCloseTo(1, 5); // densest bin normalises to 1

    // Under linear normalisation the sparse bin would be ~20/10020 = 0.002,
    // effectively invisible. log1p keeps it two orders of magnitude higher.
    const sparseValue = field.filter(v => v > 0 && v < denseValue).reduce((a, b) => Math.max(a, b), 0);
    expect(sparseValue).toBeGreaterThan(0.2);
    void denseIdx;
  });

  it('handles more than 65536 bins without a stack overflow (no Math.max(...array))', () => {
    const points = Array.from({ length: 5000 }, (_, i) => ({
      x: (i % 800) / 800,
      y: (i % 600) / 600,
    }));

    expect(() =>
      computeDensityField(points, {
        xDomain: [0, 1],
        yDomain: [0, 1],
        pixelWidth: 800,
        pixelHeight: 600, // 480,000 bins -- well past the ~65536 argument-spread limit
      })
    ).not.toThrow();
  });

  it('returns an all-zero field for no points, without dividing by zero', () => {
    const field = computeDensityField([], {
      xDomain: [-1, 1],
      yDomain: [-1, 1],
      pixelWidth: 4,
      pixelHeight: 4,
    });
    expect(Array.from(field).every(v => v === 0)).toBe(true);
  });

  it('drops out-of-domain points instead of wrapping or clamping into an edge bin', () => {
    const field = computeDensityField(
      [{ x: 100, y: 100 }, { x: 0.5, y: 0.5 }],
      { xDomain: [0, 1], yDomain: [0, 1], pixelWidth: 2, pixelHeight: 2 }
    );
    const total = Array.from(field).filter(v => v > 0).length;
    expect(total).toBe(1);
  });
});

describe('paintDensityField', () => {
  it('leaves zero-density pixels fully transparent', () => {
    const field = new Float32Array([0, 1]);
    const data = new Uint8ClampedArray(8);
    // A trivial 2-step LUT: index 0 -> black, index 1 -> red.
    const lut = new Uint8ClampedArray([0, 0, 0, 255, 0, 0]);
    paintDensityField(data, field, lut);
    expect(data[3]).toBe(0); // pixel 0 alpha
    expect(data[7]).toBe(255); // pixel 1 alpha
    expect(data[4]).toBe(255); // pixel 1 red channel from the LUT's top step
  });
});
