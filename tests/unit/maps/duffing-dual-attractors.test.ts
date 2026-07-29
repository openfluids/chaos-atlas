/**
 * Dual-IC attractor seeds for the Holmes cubic Duffing map.
 *
 * One orbit is started near each nonzero fixed point. Bistable presets must
 * land on the two fixed-point attractors; presets whose fixed points are
 * unstable either share one strange attractor or (under odd symmetry) a
 * conjugate pair — sameSet reports which.
 */
import {
  calculateDuffingDualAttractors,
  calculateDuffingFixedPoints,
  getInterestingDuffingParameters,
} from '@/lib/maps/duffing';

function preset(name: string): { a: number; b: number } {
  const row = getInterestingDuffingParameters().find((p) => p.name === name);
  if (!row) throw new Error(`missing preset ${name}`);
  return row.params;
}

function fmtPt(p: { x: number; y: number }): string {
  return `(${p.x.toFixed(4)},${p.y.toFixed(4)})`;
}

function logProbe(
  name: string,
  result: ReturnType<typeof calculateDuffingDualAttractors>
): void {
  const seeds =
    result.seeds.length >= 2
      ? `${fmtPt(result.seeds[0])}|${fmtPt(result.seeds[1])}`
      : `${fmtPt(result.seeds[0])}|-`;
  const means =
    result.tailMeans.length >= 2
      ? `${fmtPt(result.tailMeans[0])}|${fmtPt(result.tailMeans[1])}`
      : `${fmtPt(result.tailMeans[0])}|-`;
  // Exact form required by the cycle-27/28 gates. Write to stdout so the
  // line survives multi-file jest runs (console.log is swallowed there).
  process.stdout.write(
    `PROBE ${name} seeds=${seeds} tailMeans=${means} sameSet=${result.sameSet}\n`
  );
}

/** Axis-aligned bounding box of finite points in an orbit (test oracle). */
function orbitBBox(orbit: readonly { x: number; y: number }[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  w: number;
  h: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of orbit) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

/** Mean of finite points (centroid) for an orbit. */
function orbitCentroid(orbit: readonly { x: number; y: number }[]): {
  x: number;
  y: number;
} {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const p of orbit) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    sx += p.x;
    sy += p.y;
    n++;
  }
  if (n === 0) return { x: NaN, y: NaN };
  return { x: sx / n, y: sy / n };
}

function logBbox(
  name: string,
  b0: ReturnType<typeof orbitBBox>,
  b1: ReturnType<typeof orbitBBox>,
  c0: { x: number; y: number },
  c1: { x: number; y: number },
  tol: number
): void {
  // Exact form required by the cycle-28 gate. stdout — see logProbe.
  process.stdout.write(
    `BBOX ${name} ` +
      `o0=[${b0.minX.toFixed(3)},${b0.maxX.toFixed(3)}]x[${b0.minY.toFixed(3)},${b0.maxY.toFixed(3)}] ` +
      `o1=[${b1.minX.toFixed(3)},${b1.maxX.toFixed(3)}]x[${b1.minY.toFixed(3)},${b1.maxY.toFixed(3)}] ` +
      `c0=${fmtPt(c0)} c1=${fmtPt(c1)} tol=${tol.toFixed(4)}\n`
  );
}

const BISTABLE = [
  'Classic Bistable',
  'Deep Wells',
  'Low Barrier',
  'High Damping',
] as const;

const CHAOTIC_SAME_SET = ['Chaotic Regime'] as const;

const CHAOTIC_CONJUGATE = ['Weak Damping Chaos'] as const;

describe('calculateDuffingDualAttractors', () => {
  it('covers every interesting preset (six rows)', () => {
    expect(getInterestingDuffingParameters()).toHaveLength(6);
  });

  describe('bistable presets: two distinct fixed-point attractors', () => {
    it.each(BISTABLE)(
      '%s: sameSet=false and tail means match the nonzero fixed points',
      (name) => {
        const params = preset(name);
        const fps = calculateDuffingFixedPoints(params);
        const nonzero = fps
          .filter((p) => p.x !== 0 || p.y !== 0)
          .slice()
          .sort((a, b) => a.x - b.x);
        expect(nonzero).toHaveLength(2);

        const dual = calculateDuffingDualAttractors(params, 2000);
        logProbe(name, dual);

        expect(dual.seeds).toHaveLength(2);
        expect(dual.orbits).toHaveLength(2);
        expect(dual.sameSet).toBe(false);

        // Seeds are perturbations of the fixed points, not hardcoded coords.
        for (let i = 0; i < 2; i++) {
          expect(Math.hypot(dual.seeds[i].x - nonzero[i].x, dual.seeds[i].y - nonzero[i].y)).toBeLessThan(0.1);
          expect(dual.seeds[i].x).not.toBe(nonzero[i].x);
        }

        // Tail means sit on the two nonzero fixed points (left, right).
        const meanTol = 0.05;
        expect(dual.tailMeans[0].x).toBeCloseTo(nonzero[0].x, 1);
        expect(dual.tailMeans[0].y).toBeCloseTo(nonzero[0].y, 1);
        expect(dual.tailMeans[1].x).toBeCloseTo(nonzero[1].x, 1);
        expect(dual.tailMeans[1].y).toBeCloseTo(nonzero[1].y, 1);
        expect(
          Math.hypot(
            dual.tailMeans[0].x - nonzero[0].x,
            dual.tailMeans[0].y - nonzero[0].y
          )
        ).toBeLessThan(meanTol);
        expect(
          Math.hypot(
            dual.tailMeans[1].x - nonzero[1].x,
            dual.tailMeans[1].y - nonzero[1].y
          )
        ).toBeLessThan(meanTol);
      }
    );
  });

  describe('shared strange attractor (unstable fixed points, one set)', () => {
    // Geometry oracle (independent of sameSet): both seeds fill the same
    // cloud, so axis-aligned bounding boxes agree within a fraction of the
    // set's diameter. Measured cycle-27 spread ≈ 3.45 for a=2.75, b=0.2.
    it.each(CHAOTIC_SAME_SET)(
      '%s: coinciding orbit bounding boxes (shared set)',
      (name) => {
        const params = preset(name);
        const dual = calculateDuffingDualAttractors(params, 4000);
        logProbe(name, dual);

        expect(dual.seeds).toHaveLength(2);
        expect(dual.orbits).toHaveLength(2);

        const b0 = orbitBBox(dual.orbits[0]);
        const b1 = orbitBBox(dual.orbits[1]);
        const c0 = orbitCentroid(dual.orbits[0]);
        const c1 = orbitCentroid(dual.orbits[1]);
        const diam = Math.max(b0.w, b0.h, b1.w, b1.h, 1e-9);
        // Boxes coincide to within 15% of the larger side (same attractor).
        const boxTol = 0.15 * diam;
        logBbox(name, b0, b1, c0, c1, boxTol);

        expect(Math.abs(b0.minX - b1.minX)).toBeLessThan(boxTol);
        expect(Math.abs(b0.maxX - b1.maxX)).toBeLessThan(boxTol);
        expect(Math.abs(b0.minY - b1.minY)).toBeLessThan(boxTol);
        expect(Math.abs(b0.maxY - b1.maxY)).toBeLessThan(boxTol);
        // Centroids also sit on the same cloud (not a mirror pair).
        expect(Math.hypot(c0.x - c1.x, c0.y - c1.y)).toBeLessThan(0.25 * diam);

        expect(dual.sameSet).toBe(true);
      }
    );
  });

  describe('conjugate strange attractors (odd pair, two sets)', () => {
    // a=2.5, b=0.1: the map is odd, so if A is an attractor so is −A. Geometry
    // oracle: bounding boxes are disjoint and centroids are approximate
    // mirrors. Measured cycle-27: centroids ≈ ±(1.09, 1.10), spread ≈ 0.49.
    it.each(CHAOTIC_CONJUGATE)(
      '%s: disjoint mirrored bounding boxes (conjugate pair)',
      (name) => {
        const params = preset(name);
        const dual = calculateDuffingDualAttractors(params, 4000);
        logProbe(name, dual);

        expect(dual.seeds).toHaveLength(2);
        expect(dual.orbits).toHaveLength(2);

        const b0 = orbitBBox(dual.orbits[0]);
        const b1 = orbitBBox(dual.orbits[1]);
        const c0 = orbitCentroid(dual.orbits[0]);
        const c1 = orbitCentroid(dual.orbits[1]);
        logBbox(name, b0, b1, c0, c1, 0);

        // Axis-aligned boxes do not overlap (two separate clouds).
        const overlapX = b0.minX <= b1.maxX && b1.minX <= b0.maxX;
        const overlapY = b0.minY <= b1.maxY && b1.minY <= b0.maxY;
        expect(overlapX && overlapY).toBe(false);

        // Centroids are mirrors through the origin (odd symmetry).
        const mirrorErr = Math.hypot(c0.x + c1.x, c0.y + c1.y);
        expect(mirrorErr).toBeLessThan(0.15);
        // Each cloud sits off-origin near the measured ±(1.09, 1.10).
        expect(Math.hypot(c0.x, c0.y)).toBeGreaterThan(0.8);
        expect(Math.hypot(c1.x, c1.y)).toBeGreaterThan(0.8);

        expect(dual.sameSet).toBe(false);
      }
    );
  });

  it('returns a single orbit when there are fewer than two nonzero fixed points', () => {
    // a - b - 1 <= 0 → only the origin fixed point.
    const dual = calculateDuffingDualAttractors({ a: 0.5, b: 0.2 }, 500);
    expect(dual.seeds).toHaveLength(1);
    expect(dual.orbits).toHaveLength(1);
    expect(dual.sameSet).toBe(true);
  });
});
