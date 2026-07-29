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
  fitAttractorDomainFromReference,
  fitOrbitDomain,
  formatOrbitSettledCaption,
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

  it('classifies a short cycle via distinct-point count (sparse threshold)', () => {
    const points = [
      { x: 1.0, y: 2.0 },
      { x: 3.0, y: 4.0 },
      { x: 1.0, y: 2.0 },
      { x: 3.0, y: 4.0 },
    ];
    expect(countDistinctOrbitPoints(points)).toBe(2);
    const q = classifyOrbit(points, { presetName: 'P2' });
    expect(q.kind).toBe('degenerate');
    if (q.kind === 'degenerate') {
      expect(q.period).toBe(2);
      expect(q.caption).toBe('settled to a period-2 cycle');
    }
    // Threshold is the shared sparse ceiling, not a second invented cutoff.
    expect(SPARSE_OCCUPIED_BIN_THRESHOLD).toBe(512);
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

describe('known-blank presets produce captions (real kernels)', () => {
  // Measured against the same kernels the components call. Captions — not
  // empty plots — are the presentation contract for this cycle.

  it('Ikeda "Tight Spiral" and "Broken Spiral" settle (period-2 outside window)', () => {
    const presets = getInterestingIkedaParameters();
    for (const name of ['Tight Spiral', 'Broken Spiral'] as const) {
      const preset = presetByName(presets, name);
      const points = calculateIkedaAttractor(
        preset.params,
        ATTRACTOR_DOMAIN_REF_ITERATIONS
      );
      const q = classifyOrbit(points, { presetName: preset.name });
      expect(q.kind).toBe('degenerate');
      expect(q.caption).toMatch(/settled to a period-2 cycle/);
      // Points sit outside ±2; fitted domain must still be finite for axes.
      const domain = fitOrbitDomain(points, IKEDA_FALLBACK);
      expect(domain.fitted).toBe(true);
      expect(domain.xDomain.every(Number.isFinite)).toBe(true);
      expect(domain.yDomain.every(Number.isFinite)).toBe(true);
    }
  });

  it('Tinkerbell "Complex Multi-loop" and "Chaotic Regime" escape to non-finite', () => {
    const presets = getInterestingTinkerbellParameters();
    for (const name of ['Complex Multi-loop', 'Chaotic Regime'] as const) {
      const preset = presetByName(presets, name);
      const points = calculateTinkerbellAttractor(
        preset.params,
        ATTRACTOR_DOMAIN_REF_ITERATIONS
      );
      const q = classifyOrbit(points, { presetName: preset.name });
      expect(q.kind).toBe('escaped');
      expect(q.caption).toBe(formatPresetOrbitEscapeCaption(preset.name));
      // No non-finite domain reaches a scale — fallback window only.
      const domain = fitOrbitDomain(points, IKEDA_FALLBACK);
      expect(domain.fitted).toBe(false);
      expect(domain.xDomain).toEqual(IKEDA_FALLBACK.x);
    }
  });

  it('Tinkerbell "Stable Single Loop" settles to a short cycle', () => {
    const preset = presetByName(
      getInterestingTinkerbellParameters(),
      'Stable Single Loop'
    );
    const points = calculateTinkerbellAttractor(
      preset.params,
      ATTRACTOR_DOMAIN_REF_ITERATIONS
    );
    const q = classifyOrbit(points, { presetName: preset.name });
    expect(q.kind).toBe('degenerate');
    expect(q.caption).toMatch(/settled to a (fixed point|period-\d+ cycle)/);
  });

  it('Duffing "Classic Bistable" and "Single Well Dominance" settle at origin', () => {
    const presets = getInterestingDuffingParameters();
    for (const name of ['Classic Bistable', 'Single Well Dominance'] as const) {
      const preset = presetByName(presets, name);
      const points = calculateDuffingAttractor(
        preset.params,
        ATTRACTOR_DOMAIN_REF_ITERATIONS
      );
      const q = classifyOrbit(points, { presetName: preset.name });
      expect(q.kind).toBe('degenerate');
      expect(q.caption).toMatch(/settled to a (fixed point|period-\d+ cycle)/);
      const domain = fitOrbitDomain(points, DUFFING_FALLBACK);
      expect(domain.xDomain.every(Number.isFinite)).toBe(true);
      expect(domain.yDomain.every(Number.isFinite)).toBe(true);
    }
  });
});
