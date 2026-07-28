/**
 * Unit tests for computeUnionOrbitDomain — held axes domain across a
 * parameter sweep (union of sample extents, escaped samples skipped).
 *
 * chartHelpers pulls in d3 (ESM-only); jest does not transform node_modules,
 * so stub d3 before the import (same constraint as densityField being pure).
 */
jest.mock('d3', () => ({}));

import {
  computeUnionOrbitDomain,
  padDomain,
  UNION_ORBIT_DOMAIN_SAMPLES,
} from '@/components/visualizations/chartHelpers';
import { MAX_SANE_ORBIT_COORD } from '@/components/visualizations/densityField';

describe('computeUnionOrbitDomain', () => {
  const fallback = {
    x: [-1, 1] as [number, number],
    y: [-1, 1] as [number, number],
  };

  it('unions extents across the parameter range and pads once', () => {
    // At p=0 extent is [0,1]²; at p=1 extent is [0,2]×[0,3]. Union = [0,2]×[0,3].
    const result = computeUnionOrbitDomain({
      min: 0,
      max: 1,
      sampleCount: 3,
      fallback,
      sampleOrbit: (p) => [
        { x: 0, y: 0 },
        { x: 1 + p, y: 1 + 2 * p },
      ],
    });

    expect(result.allEscaped).toBe(false);
    expect(result.contributed).toBe(3);
    expect(result.xDomain).toEqual(padDomain([0, 2]));
    expect(result.yDomain).toEqual(padDomain([0, 3]));
  });

  it('skips escaped samples so they do not poison the union', () => {
    const result = computeUnionOrbitDomain({
      min: 0,
      max: 1,
      sampleCount: 3,
      fallback,
      sampleOrbit: (p) => {
        if (p > 0.5) {
          return [{ x: MAX_SANE_ORBIT_COORD * 10, y: 0 }];
        }
        return [
          { x: -0.5, y: -0.2 },
          { x: 0.5, y: 0.2 },
        ];
      },
    });

    expect(result.allEscaped).toBe(false);
    expect(result.contributed).toBeGreaterThan(0);
    expect(result.xDomain[0]).toBeLessThan(0);
    expect(result.xDomain[1]).toBeGreaterThan(0);
    // Astronomical sample must not appear in the union.
    expect(Math.abs(result.xDomain[0])).toBeLessThan(10);
    expect(Math.abs(result.xDomain[1])).toBeLessThan(10);
  });

  it('returns fallback with allEscaped when every sample escapes', () => {
    const result = computeUnionOrbitDomain({
      min: 0,
      max: 1,
      sampleCount: 5,
      fallback,
      sampleOrbit: () => [{ x: NaN, y: NaN }],
    });

    expect(result.allEscaped).toBe(true);
    expect(result.contributed).toBe(0);
    expect(result.xDomain).toEqual(fallback.x);
    expect(result.yDomain).toEqual(fallback.y);
  });

  it(`defaults to ${UNION_ORBIT_DOMAIN_SAMPLES} samples`, () => {
    let calls = 0;
    computeUnionOrbitDomain({
      min: 0,
      max: 1,
      fallback,
      sampleOrbit: () => {
        calls += 1;
        return [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ];
      },
    });
    expect(calls).toBe(UNION_ORBIT_DOMAIN_SAMPLES);
  });
});
