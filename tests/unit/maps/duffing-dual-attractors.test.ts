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
  // Exact form required by the cycle-27 gate.
  console.log(
    `PROBE ${name} seeds=${seeds} tailMeans=${means} sameSet=${result.sameSet}`
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
    it.each(CHAOTIC_SAME_SET)('%s: sameSet=true', (name) => {
      const params = preset(name);
      const dual = calculateDuffingDualAttractors(params, 4000);
      logProbe(name, dual);

      expect(dual.seeds).toHaveLength(2);
      expect(dual.orbits).toHaveLength(2);
      expect(dual.sameSet).toBe(true);
    });
  });

  describe('conjugate strange attractors (odd pair, two sets)', () => {
    // a=2.5, b=0.1: the map is odd, so if A is an attractor so is −A. Here
    // A and −A are disjoint clouds — both basins are populated, same as the
    // fixed-point bistable case, so sameSet stays false.
    it.each(CHAOTIC_CONJUGATE)('%s: sameSet=false (conjugate pair)', (name) => {
      const params = preset(name);
      const dual = calculateDuffingDualAttractors(params, 4000);
      logProbe(name, dual);

      expect(dual.seeds).toHaveLength(2);
      expect(dual.orbits).toHaveLength(2);
      expect(dual.sameSet).toBe(false);
    });
  });

  it('returns a single orbit when there are fewer than two nonzero fixed points', () => {
    // a - b - 1 <= 0 → only the origin fixed point.
    const dual = calculateDuffingDualAttractors({ a: 0.5, b: 0.2 }, 500);
    expect(dual.seeds).toHaveLength(1);
    expect(dual.orbits).toHaveLength(1);
    expect(dual.sameSet).toBe(true);
  });
});
