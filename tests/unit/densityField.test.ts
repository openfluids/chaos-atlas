/**
 * Regression tests for the density-field renderer shared by the attractor
 * views (Hénon, Ikeda, Tinkerbell, Duffing): non-uniform occupancy must
 * survive normalisation (a linear `count / maxCount` collapses the heavy
 * tail to near-zero), and the max-finding must not use `Math.max(...array)`
 * (a spread blows the call stack on large binned arrays).
 *
 * Also pins Defect A (sparse attractors → visible markers) and Defect B
 * (astronomical finite extent → escaped).
 */
import {
  computeDensityField,
  computeDensityFieldDetailed,
  isOrbitEscaped,
  paintDensityField,
  paintSparseMarkers,
  SPARSE_OCCUPIED_BIN_THRESHOLD,
  MAX_SANE_ORBIT_COORD,
} from '@/components/visualizations/densityField';

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

  // Pinned: divergent Hénon (a ≥ 1.5) yields all-non-finite iterates. The
  // density path must return a valid zero field, never throw.
  it('returns a valid zero field for an all-non-finite point set', () => {
    const field = computeDensityField(
      [
        { x: Infinity, y: Infinity },
        { x: -Infinity, y: NaN },
        { x: NaN, y: NaN },
      ],
      { xDomain: [-1, 1], yDomain: [-1, 1], pixelWidth: 4, pixelHeight: 4 }
    );
    expect(field).toBeInstanceOf(Float32Array);
    expect(field.length).toBe(16);
    expect(Array.from(field).every((v) => v === 0)).toBe(true);
  });

  it('ignores non-finite points in a mixed finite/non-finite set', () => {
    const field = computeDensityField(
      [
        { x: Infinity, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: NaN, y: 1 },
        { x: -Infinity, y: Infinity },
      ],
      { xDomain: [0, 1], yDomain: [0, 1], pixelWidth: 2, pixelHeight: 2 }
    );
    const nonzero = Array.from(field).filter((v) => v > 0).length;
    expect(nonzero).toBe(1);
    expect(Math.max(...Array.from(field))).toBeCloseTo(1, 5);
  });

  it('returns a trivial zero field for non-finite pixel dimensions', () => {
    const field = computeDensityField([{ x: 0, y: 0 }], {
      xDomain: [-1, 1],
      yDomain: [-1, 1],
      pixelWidth: Number.NaN,
      pixelHeight: Number.POSITIVE_INFINITY,
    });
    expect(field.length).toBe(1);
    expect(field[0]).toBe(0);
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

/**
 * Defect A: a period-2 orbit is 2 lit density pixels — invisible on a large
 * field. Measured bin diversity below the sparse threshold must produce
 * multi-pixel markers (not single-pixel density).
 */
describe('sparse attractor markers (Defect A)', () => {
  it('measures exactly 2 occupied bins for a synthetic period-2 set', () => {
    const period2 = [
      { x: 0.2, y: 0.3 },
      { x: 0.8, y: 0.7 },
    ];
    // Many visits to the same two points (as a long orbit would).
    const points = Array.from({ length: 5000 }, (_, i) => period2[i % 2]);
    const result = computeDensityFieldDetailed(points, {
      xDomain: [0, 1],
      yDomain: [0, 1],
      pixelWidth: 100,
      pixelHeight: 100,
    });
    expect(result.distinctOccupied).toBe(2);
    expect(result.distinctOccupied).toBeLessThanOrEqual(SPARSE_OCCUPIED_BIN_THRESHOLD);
    expect(result.occupiedPixels).toHaveLength(2);
  });

  it('paints visible multi-pixel marks for a 2-point set (not single pixels)', () => {
    const period2 = [
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.75 },
    ];
    const points = Array.from({ length: 2000 }, (_, i) => period2[i % 2]);
    const w = 80;
    const h = 80;
    const result = computeDensityFieldDetailed(points, {
      xDomain: [0, 1],
      yDomain: [0, 1],
      pixelWidth: w,
      pixelHeight: h,
    });
    expect(result.distinctOccupied).toBe(2);

    const data = new Uint8ClampedArray(w * h * 4);
    const radius = 5;
    paintSparseMarkers(data, result.occupiedPixels, w, h, [255, 128, 0], radius);

    let lit = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) lit += 1;
    }
    // Two discs of radius 5: each has well more than 1 pixel; far above 2.
    expect(lit).toBeGreaterThan(2);
    // Disk area ≈ π r² each; two discs, allow some edge clipping.
    expect(lit).toBeGreaterThan(2 * Math.floor(Math.PI * radius * radius * 0.5));
  });

  it('keeps a dense multi-bin set above the sparse threshold (strange-attractor path)', () => {
    // Fill many distinct bins — mimics a strange attractor occupancy pattern.
    const points = Array.from({ length: 5000 }, (_, i) => ({
      x: (i % 100) / 100,
      y: (Math.floor(i / 100) % 100) / 100,
    }));
    const result = computeDensityFieldDetailed(points, {
      xDomain: [0, 1],
      yDomain: [0, 1],
      pixelWidth: 100,
      pixelHeight: 100,
    });
    expect(result.distinctOccupied).toBeGreaterThan(SPARSE_OCCUPIED_BIN_THRESHOLD);
    // Dense path: occupiedPixels list is not collected.
    expect(result.occupiedPixels).toHaveLength(0);
  });
});

/**
 * Defect B: slow divergence yields finite points spanning 1e267; the old
 * guard (`finitePoints.length === 0`) missed it. Extent past MAX_SANE_ORBIT_COORD
 * must classify as escaped.
 */
describe('orbit escape by extent (Defect B)', () => {
  it('classifies a point set spanning 1e200 as escaped', () => {
    expect(
      isOrbitEscaped([
        { x: 0, y: 0 },
        { x: 1e200, y: 1 },
        { x: -0.5, y: 0.2 },
      ])
    ).toBe(true);
  });

  it('classifies a single coordinate past the sane bound as escaped', () => {
    expect(
      isOrbitEscaped([{ x: MAX_SANE_ORBIT_COORD * 10, y: 0.1 }])
    ).toBe(true);
  });

  it('does not classify Hénon-scale attractor points as escaped', () => {
    expect(
      isOrbitEscaped([
        { x: -1.5, y: -0.4 },
        { x: 1.5, y: 0.4 },
        { x: 0.0, y: 0.0 },
      ])
    ).toBe(false);
  });

  it('classifies an all-non-finite set as escaped', () => {
    expect(
      isOrbitEscaped([
        { x: Infinity, y: 0 },
        { x: NaN, y: NaN },
      ])
    ).toBe(true);
  });

  it('classifies an empty set as escaped', () => {
    expect(isOrbitEscaped([])).toBe(true);
  });
});
