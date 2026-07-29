/**
 * Basins of attraction for the Holmes cubic Duffing map.
 *
 * The map is odd: f(-x,-y) = -f(x,y). On a grid centered at the origin the
 * two basins are exact mirror images, so cell (i,j) and its antipode must
 * carry mirrored labels. That symmetry is the real gate — a lopsided map is
 * wrong regardless of how it looks.
 *
 * Encoding: -1 escaped · 0 origin · 1 left FP · 2 right FP · 3 chaotic.
 */
import {
  calculateDuffingBasins,
  calculateDuffingFixedPoints,
  getInterestingDuffingParameters,
} from '@/lib/maps/duffing';

const GRID = 60;
const BOUNDS = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 };

/** Mirror of a basin label under (x,y) -> (-x,-y). */
function mirrorLabel(label: number): number {
  if (label === 1) return 2;
  if (label === 2) return 1;
  return label;
}

function countLabels(basins: number[][]): Record<string, number> {
  const counts = { escaped: 0, origin: 0, basin1: 0, basin2: 0, chaotic: 0, other: 0 };
  for (const row of basins) {
    for (const v of row) {
      if (v === -1) counts.escaped++;
      else if (v === 0) counts.origin++;
      else if (v === 1) counts.basin1++;
      else if (v === 2) counts.basin2++;
      else if (v === 3) counts.chaotic++;
      else counts.other++;
    }
  }
  return counts;
}

/** Half the number of antipodal pairs that fail the mirror rule. */
function symmetryMismatchCount(basins: number[][]): number {
  const n = basins.length;
  let mismatches = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const ii = n - 1 - i;
      const jj = n - 1 - j;
      if (mirrorLabel(basins[j][i]) !== basins[jj][ii]) {
        mismatches++;
      }
    }
  }
  // Each mismatched pair is counted twice (once from each side).
  return mismatches / 2;
}

function preset(name: string): { a: number; b: number } {
  const row = getInterestingDuffingParameters().find((p) => p.name === name);
  if (!row) throw new Error(`missing preset ${name}`);
  return row.params;
}

describe('calculateDuffingBasins', () => {
  describe('grid is symmetric about the origin', () => {
    it('cell centres pair as exact antipodes (even gridSize)', () => {
      // Premise of the symmetry test: with cell-centred sampling,
      // x_i + x_{n-1-i} = 0 (and same for y).
      const n = GRID;
      const xStep = (BOUNDS.xMax - BOUNDS.xMin) / n;
      const yStep = (BOUNDS.yMax - BOUNDS.yMin) / n;
      for (let i = 0; i < n; i++) {
        const x = BOUNDS.xMin + (i + 0.5) * xStep;
        const xAnti = BOUNDS.xMin + (n - 1 - i + 0.5) * xStep;
        expect(x + xAnti).toBeCloseTo(0, 12);
        const y = BOUNDS.yMin + (i + 0.5) * yStep;
        const yAnti = BOUNDS.yMin + (n - 1 - i + 0.5) * yStep;
        expect(y + yAnti).toBeCloseTo(0, 12);
      }
    });
  });

  describe('bistable presets populate both basins and respect odd symmetry', () => {
    // The map is exactly odd, but the grid coordinates are not exactly
    // antipodal: xMin + (i+0.5)*step and its partner are different products
    // and different sums, so they agree to ~1e-16 rather than bit-exactly.
    // Near a fractal basin boundary that difference decides the basin, so a
    // few mismatched pairs are expected and the count tracks how intricate
    // the boundary is. Measured: 0 for the three low-damping presets, 2 for
    // High Damping (b=0.4), whose boundary is the most convoluted here.
    const MAX_SYMMETRY_MISMATCH = 8;

    const cases = [
      'Classic Bistable',
      'Deep Wells',
      'Low Barrier',
      'High Damping',
    ] as const;

    it.each(cases)('%s: both basins >10% of non-escaped, symmetry holds', (name) => {
      const params = preset(name);
      const fps = calculateDuffingFixedPoints(params);
      // Classifier must use map fixed points, not ±sqrt(a).
      expect(fps.some((p) => p.x < 0 && p.y < 0)).toBe(true);
      expect(fps.some((p) => p.x > 0 && p.y > 0)).toBe(true);

      const basins = calculateDuffingBasins(params, GRID, BOUNDS);
      expect(basins.length).toBe(GRID);
      expect(basins[0].length).toBe(GRID);

      const c = countLabels(basins);
      const nonEscaped = GRID * GRID - c.escaped;
      expect(nonEscaped).toBeGreaterThan(0);

      expect(c.basin1 / nonEscaped).toBeGreaterThan(0.1);
      expect(c.basin2 / nonEscaped).toBeGreaterThan(0.1);
      // Bistable orbits settle; nothing should sit in the chaotic bucket.
      expect(c.chaotic).toBe(0);
      expect(c.other).toBe(0);

      const mism = symmetryMismatchCount(basins);
      expect(mism).toBeLessThanOrEqual(MAX_SYMMETRY_MISMATCH);
    });
  });

  describe('chaotic regime is not painted as a well or as Center', () => {
    // Both presets whose nonzero fixed points are unstable: at a=2.75,b=0.2
    // the multiplier is 1.79 and at a=2.5,b=0.1 it is 1.64, so no open set
    // converges to them and every bounded cell belongs to the strange
    // attractor instead.
    it.each(['Chaotic Regime', 'Weak Damping Chaos'] as const)(
      '%s: bounded non-fixed cells are labelled chaotic (3)',
      (name) => {
      const params = preset(name);
      const basins = calculateDuffingBasins(params, GRID, BOUNDS);
      const c = countLabels(basins);
      const nonEscaped = GRID * GRID - c.escaped;

      expect(c.chaotic).toBeGreaterThan(0.5 * nonEscaped);
      // Must not silently dump chaos into the fixed-point basins.
      expect(c.basin1 + c.basin2).toBeLessThan(0.1 * nonEscaped);
      // Origin (0) is a real fixed point, not a dump for "unclassified".
      // Chaotic orbits do not converge there.
      expect(c.origin).toBe(0);

      // Even under chaos the map is odd; allow a few FP-noise mismatches.
      const mism = symmetryMismatchCount(basins);
      expect(mism).toBeLessThanOrEqual(8);
    });
  });

  describe('encoding contract', () => {
    it('uses only -1, 0, 1, 2, 3', () => {
      const params = preset('Classic Bistable');
      const basins = calculateDuffingBasins(params, 20, BOUNDS);
      const allowed = new Set([-1, 0, 1, 2, 3]);
      for (const row of basins) {
        for (const v of row) {
          expect(allowed.has(v)).toBe(true);
        }
      }
    });
  });
});
