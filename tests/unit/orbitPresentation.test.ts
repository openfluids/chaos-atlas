/**
 * Orbit presentation helpers (classify / fit / captions) and regression
 * coverage for the known-blank Ikeda / Tinkerbell / Duffing presets.
 *
 * chartHelpers pulls in d3 (ESM-only); jest does not transform node_modules,
 * so stub d3 before the import (same constraint as unionOrbitDomain tests).
 */
jest.mock('d3', () => ({}));

import {
  ATTRACTOR_DOMAIN_REF_ITERATIONS,
  classifyOrbit,
  countDistinctOrbitPoints,
  findVerifiedPeriod,
  fitAttractorDomainFromReference,
  fitOrbitDomain,
  formatOrbitSettledCaption,
  formatOrbitSparseCaption,
  formatPresetOrbitEscapeCaption,
  padDomain,
} from '@/components/visualizations/chartHelpers';
import { SPARSE_OCCUPIED_BIN_THRESHOLD } from '@/components/visualizations/densityField';
import {
  calculateIkedaAttractor,
  getInterestingIkedaParameters,
} from '@/lib/maps/ikeda';
import {
  calculateTinkerbellAttractor,
  getInterestingTinkerbellParameters,
} from '@/lib/maps/tinkerbell';
import {
  calculateDuffingAttractor,
  getInterestingDuffingParameters,
} from '@/lib/maps/duffing';

const IKEDA_FALLBACK = {
  x: [-2, 2] as [number, number],
  y: [-2, 2] as [number, number],
};
const DUFFING_FALLBACK = {
  x: [-2.5, 2.5] as [number, number],
  y: [-2.5, 2.5] as [number, number],
};

function presetByName<T extends { name: string }>(
  list: T[],
  name: string
): T {
  const found = list.find((p) => p.name === name);
  if (!found) throw new Error(`preset not found: ${name}`);
  return found;
}

describe('orbit presentation helpers', () => {
  it('escape caption stays in the formatOrbitEscapeCaption wording family', () => {
    expect(formatPresetOrbitEscapeCaption('Complex Multi-loop')).toBe(
      'no bounded attractor at preset "Complex Multi-loop" (orbit escapes)'
    );
  });

  it('settled captions name fixed points and short cycles', () => {
    expect(formatOrbitSettledCaption(1)).toBe('settled to a fixed point');
    expect(formatOrbitSettledCaption(2)).toBe('settled to a period-2 cycle');
    expect(formatOrbitSettledCaption(4)).toBe('settled to a period-4 cycle');
  });

  it('sparse captions name a distinct count without claiming a period', () => {
    expect(formatOrbitSparseCaption(1)).toBe('1 distinct point');
    expect(formatOrbitSparseCaption(17)).toBe('17 distinct points');
  });

  it('classifies all-non-finite points as escaped with a caption', () => {
    const q = classifyOrbit(
      [
        { x: NaN, y: NaN },
        { x: Infinity, y: 0 },
      ],
      { presetName: 'Bad' }
    );
    expect(q.kind).toBe('escaped');
    expect(q.caption).toMatch(/orbit escapes/);
    expect(q.caption).toContain('Bad');
  });

  it('findVerifiedPeriod accepts a pure short cycle and rejects non-periodic samples', () => {
    const period2 = [
      { x: 1.0, y: 2.0 },
      { x: 3.0, y: 4.0 },
      { x: 1.0, y: 2.0 },
      { x: 3.0, y: 4.0 },
      { x: 1.0, y: 2.0 },
      { x: 3.0, y: 4.0 },
    ];
    expect(findVerifiedPeriod(period2, 512)).toBe(2);

    // Low variety (many repeated keys) but never a pure cycle: slow drift of
    // unique points under the short-cycle ceiling.
    const drift = Array.from({ length: 40 }, (_, i) => ({
      x: i * 0.1,
      y: i * 0.1,
    }));
    expect(countDistinctOrbitPoints(drift)).toBe(40);
    expect(findVerifiedPeriod(drift, 512)).toBeNull();
  });

  it('rejects a stutter: few distinct points, visited in no fixed order', () => {
    // This is the case the old distinct-count path got WRONG in the way that
    // mattered. The existing reject tests use a 40-point open drift, which is
    // high-variety — the old code mislabelled it "period-40", obviously bogus.
    // A stutter is the dangerous one: it looks exactly like a short cycle
    // (2 distinct points) and the old code would have called it "period-2",
    // a claim a reader would believe. It is not periodic at any lag.
    const A = { x: 1.0, y: 2.0 };
    const B = { x: 3.0, y: 4.0 };
    const stutter = [A, B, A, B, A, A, B, A, B, B, A, B, A, A, A, B];

    expect(countDistinctOrbitPoints(stutter)).toBe(2);
    expect(findVerifiedPeriod(stutter, SPARSE_OCCUPIED_BIN_THRESHOLD)).toBeNull();

    const q = classifyOrbit(stutter, { presetName: 'Stutter' });
    expect(q.kind).toBe('degenerate');
    if (q.kind === 'degenerate') {
      expect(q.periodic).toBe(false);
      expect(q.caption).not.toMatch(/period-\d+/);
      expect(q.caption).toBe(formatOrbitSparseCaption(2));
    }
  });

  it('classifies a verified short cycle only when period is confirmed', () => {
    const points = [
      { x: 1.0, y: 2.0 },
      { x: 3.0, y: 4.0 },
      { x: 1.0, y: 2.0 },
      { x: 3.0, y: 4.0 },
      { x: 1.0, y: 2.0 },
      { x: 3.0, y: 4.0 },
    ];
    expect(countDistinctOrbitPoints(points)).toBe(2);
    const q = classifyOrbit(points, { presetName: 'P2' });
    expect(q.kind).toBe('degenerate');
    if (q.kind === 'degenerate') {
      expect(q.periodic).toBe(true);
      expect(q.period).toBe(2);
      expect(q.caption).toBe('settled to a period-2 cycle');
    }
    // Threshold is the shared ceiling value; it is not a period bound.
    expect(SPARSE_OCCUPIED_BIN_THRESHOLD).toBe(512);
  });

  it('rejects a non-periodic low-variety orbit (no period-N claim)', () => {
    // Constructed: 40 distinct points on a slow drift — under the short-cycle
    // ceiling, so the old distinct-count path would have claimed period-40.
    const drift = Array.from({ length: 40 }, (_, i) => ({
      x: i * 0.1,
      y: Math.sin(i) * 0.01,
    }));
    expect(countDistinctOrbitPoints(drift)).toBeLessThanOrEqual(
      SPARSE_OCCUPIED_BIN_THRESHOLD
    );
    expect(findVerifiedPeriod(drift, SPARSE_OCCUPIED_BIN_THRESHOLD)).toBeNull();

    const q = classifyOrbit(drift, { presetName: 'Drift' });
    expect(q.kind).toBe('degenerate');
    if (q.kind === 'degenerate') {
      expect(q.periodic).toBe(false);
      expect(q.period).toBeUndefined();
      expect(q.caption).toBe(formatOrbitSparseCaption(q.distinct));
      expect(q.caption).toMatch(/distinct points?$/);
      expect(q.caption).not.toMatch(/period-\d+/);
      expect(q.caption).not.toMatch(/settled to/);
    }
  });

  it('classifies a dense bounded orbit as healthy (no caption)', () => {
    const points = Array.from({ length: SPARSE_OCCUPIED_BIN_THRESHOLD + 10 }, (_, i) => ({
      x: Math.sin(i * 0.7),
      y: Math.cos(i * 0.5),
    }));
    const q = classifyOrbit(points, { presetName: 'Chaos' });
    expect(q.kind).toBe('healthy');
    expect(q.caption).toBeNull();
    expect(q.distinct).toBeGreaterThan(SPARSE_OCCUPIED_BIN_THRESHOLD);
  });

  it('fitOrbitDomain pads finite extents and falls back when escaped', () => {
    const fitted = fitOrbitDomain(
      [
        { x: 0, y: 0 },
        { x: 1, y: 2 },
      ],
      IKEDA_FALLBACK
    );
    expect(fitted.fitted).toBe(true);
    expect(fitted.xDomain).toEqual(padDomain([0, 1]));
    expect(fitted.yDomain).toEqual(padDomain([0, 2]));

    const escaped = fitOrbitDomain(
      [
        { x: NaN, y: NaN },
        { x: Infinity, y: Infinity },
      ],
      IKEDA_FALLBACK
    );
    expect(escaped.fitted).toBe(false);
    expect(escaped.xDomain).toEqual(IKEDA_FALLBACK.x);
    expect(escaped.yDomain).toEqual(IKEDA_FALLBACK.y);
  });

  it('fitted domain does not change when the rendered iteration count changes', () => {
    // Contract under test: domain is always sampled at the FIXED reference
    // count. The live paint iteration count is not an input, so sweeping the
    // attractor-iterations slider cannot move the axes.
    const params = presetByName(getInterestingIkedaParameters(), 'Optical Chaos')
      .params;
    const fallback = IKEDA_FALLBACK;
    const sample = (n: number) => calculateIkedaAttractor(params, n);

    const atRef = fitAttractorDomainFromReference(
      sample,
      fallback,
      ATTRACTOR_DOMAIN_REF_ITERATIONS
    );

    // "Render" at two different slider values — domain helper is never told.
    const paintLow = 10_000;
    const paintHigh = 200_000;
    void paintLow;
    void paintHigh;

    const again = fitAttractorDomainFromReference(
      sample,
      fallback,
      ATTRACTOR_DOMAIN_REF_ITERATIONS
    );
    expect(again).toEqual(atRef);

    // Reference count is what was sampled (not a paint count).
    let sampledAt: number | null = null;
    fitAttractorDomainFromReference(
      (n) => {
        sampledAt = n;
        return sample(n);
      },
      fallback,
      ATTRACTOR_DOMAIN_REF_ITERATIONS
    );
    expect(sampledAt).toBe(ATTRACTOR_DOMAIN_REF_ITERATIONS);
  });
});

describe('audited presets: verified orbit quality (real kernels)', () => {
  // Preset params were re-measured so each advertised showcase is bounded and
  // non-origin. Assertions below pin the *new* verified behaviour and are
  // strictly stronger than the previous escape / origin-fixed pins.

  it('Ikeda Tight/Broken Spiral → healthy bounded chaotic attractors', () => {
    const presets = getInterestingIkedaParameters();
    for (const name of ['Tight Spiral', 'Broken Spiral'] as const) {
      const preset = presetByName(presets, name);
      expect(preset.classification).toBe('chaotic');
      const points = calculateIkedaAttractor(
        preset.params,
        ATTRACTOR_DOMAIN_REF_ITERATIONS
      );
      const q = classifyOrbit(points, { presetName: preset.name });
      expect(q.kind).toBe('healthy');
      expect(q.distinct).toBeGreaterThanOrEqual(500);
      const domain = fitOrbitDomain(points, IKEDA_FALLBACK);
      expect(domain.fitted).toBe(true);
      expect(domain.xDomain.every(Number.isFinite)).toBe(true);
      expect(domain.yDomain.every(Number.isFinite)).toBe(true);
      const maxAbsX = Math.max(...points.map((p) => Math.abs(p.x)));
      expect(maxAbsX).toBeGreaterThan(1e-6);
    }
  });

  it('Tinkerbell Complex Multi-loop and Chaotic Regime → healthy bounded chaos', () => {
    const presets = getInterestingTinkerbellParameters();
    for (const name of ['Complex Multi-loop', 'Chaotic Regime'] as const) {
      const preset = presetByName(presets, name);
      expect(preset.classification).toBe('chaotic');
      const points = calculateTinkerbellAttractor(
        preset.params,
        ATTRACTOR_DOMAIN_REF_ITERATIONS
      );
      const q = classifyOrbit(points, { presetName: preset.name });
      expect(q.kind).toBe('healthy');
      expect(q.distinct).toBeGreaterThanOrEqual(500);
      const domain = fitOrbitDomain(points, IKEDA_FALLBACK);
      expect(domain.fitted).toBe(true);
      expect(domain.xDomain.every(Number.isFinite)).toBe(true);
      expect(domain.yDomain.every(Number.isFinite)).toBe(true);
      expect(Math.max(...points.map((p) => Math.abs(p.x)))).toBeGreaterThan(1e-6);
    }
  });

  it('Tinkerbell Stable Single Loop → bounded non-origin period cycle', () => {
    const preset = presetByName(
      getInterestingTinkerbellParameters(),
      'Stable Single Loop'
    );
    expect(preset.classification).toBe('periodic');
    const points = calculateTinkerbellAttractor(
      preset.params,
      ATTRACTOR_DOMAIN_REF_ITERATIONS
    );
    const q = classifyOrbit(points, { presetName: preset.name });
    // Period-8 is sparse → degenerate, but pin the EXACT period and its
    // caption. `period > 1` would be weaker than the fixed-point pin it
    // replaced, and would not catch the cycle length drifting.
    expect(q.kind).toBe('degenerate');
    if (q.kind === 'degenerate') {
      expect(q.periodic).toBe(true);
      expect(q.period).toBe(8);
      expect(q.caption).toBe('settled to a period-8 cycle');
    }
    expect(Math.max(...points.map((p) => Math.abs(p.x)))).toBeGreaterThan(1e-6);
    const domain = fitOrbitDomain(points, IKEDA_FALLBACK);
    expect(domain.fitted).toBe(true);
  });

  it('Duffing Classic Bistable and Single Well Dominance → fixed point off origin', () => {
    const presets = getInterestingDuffingParameters();
    for (const name of ['Classic Bistable', 'Single Well Dominance'] as const) {
      const preset = presetByName(presets, name);
      expect(preset.classification).toBe('fixed-point');
      const points = calculateDuffingAttractor(
        preset.params,
        ATTRACTOR_DOMAIN_REF_ITERATIONS
      );
      const q = classifyOrbit(points, { presetName: preset.name });
      expect(q.kind).toBe('degenerate');
      if (q.kind === 'degenerate') {
        expect(q.periodic).toBe(true);
        expect(q.period).toBe(1);
        expect(q.caption).toBe('settled to a fixed point');
      }
      // Stronger than the previous pin: fixed point is away from the origin.
      expect(Math.max(...points.map((p) => Math.abs(p.x)))).toBeGreaterThan(1e-6);
      const domain = fitOrbitDomain(points, DUFFING_FALLBACK);
      expect(domain.xDomain.every(Number.isFinite)).toBe(true);
      expect(domain.yDomain.every(Number.isFinite)).toBe(true);
    }
  });
});
