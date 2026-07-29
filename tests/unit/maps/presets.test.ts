/**
 * Pin that every advertised Ikeda / Tinkerbell / Duffing preset actually
 * matches its classification claim: bounded, non-origin, and lambda1 in the
 * band that classification demands. Table-driven over getInteresting* so a
 * future added preset is measured automatically.
 */
import {
  calculateIkedaLyapunovExponents,
  calculateIkedaMap,
  getInterestingIkedaParameters,
} from '@/lib/maps/ikeda';
import {
  calculateTinkerbellLyapunovExponents,
  calculateTinkerbellMap,
  getInterestingTinkerbellParameters,
} from '@/lib/maps/tinkerbell';
import {
  calculateDuffingLyapunovExponents,
  calculateDuffingMap,
  getInterestingDuffingParameters,
} from '@/lib/maps/duffing';

const TRANSIENT = 2000;
const ORBIT_LEN = 4000;
const BOUND = 1e3;
const ORIGIN_FLOOR = 1e-6;
const GRID = 1e-6;
const LYA_ITERS = 5000;

type Classification = 'chaotic' | 'periodic' | 'quasiperiodic' | 'fixed-point';

type Point = { x: number; y: number };

function distinctCount(points: Point[], grid: number = GRID): number {
  const seen = new Set<string>();
  for (const p of points) {
    const kx = Math.round(p.x / grid);
    const ky = Math.round(p.y / grid);
    seen.add(`${kx},${ky}`);
  }
  return seen.size;
}

function orbitStats(points: Point[]): {
  allFinite: boolean;
  maxAbs: number;
  maxAbsX: number;
  distinct: number;
} {
  let maxAbs = 0;
  let maxAbsX = 0;
  let allFinite = true;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      allFinite = false;
      continue;
    }
    maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.y));
    maxAbsX = Math.max(maxAbsX, Math.abs(p.x));
  }
  return { allFinite, maxAbs, maxAbsX, distinct: distinctCount(points) };
}

function assertClassification(
  classification: Classification,
  lambda1: number,
  distinct: number
): void {
  switch (classification) {
    case 'chaotic':
      expect(lambda1).toBeGreaterThan(0.05);
      expect(distinct).toBeGreaterThanOrEqual(500);
      break;
    case 'fixed-point':
      // A fixed point is period-1: the orbit must collapse to ONE grid cell.
      // Without this, 'fixed-point' and 'periodic' share a branch and a
      // period-8 cycle mislabelled 'fixed-point' passes on lambda1 alone.
      expect(lambda1).toBeLessThan(-0.001);
      expect(distinct).toBe(1);
      break;
    case 'periodic':
      // A genuine cycle: more than one point, but far short of the density
      // that would make it chaotic or quasiperiodic.
      expect(lambda1).toBeLessThan(-0.001);
      expect(distinct).toBeGreaterThan(1);
      expect(distinct).toBeLessThan(500);
      break;
    case 'quasiperiodic':
      expect(Math.abs(lambda1)).toBeLessThan(0.01);
      expect(distinct).toBeGreaterThanOrEqual(500);
      break;
    default:
      throw new Error(`unknown classification: ${classification as string}`);
  }
}

const VALID: Classification[] = [
  'chaotic',
  'periodic',
  'quasiperiodic',
  'fixed-point',
];

describe('Ikeda presets', () => {
  const presets = getInterestingIkedaParameters();

  it('keeps six named entries with a verified classification claim', () => {
    expect(presets).toHaveLength(6);
    const names = presets.map((p) => p.name);
    expect(names).toEqual([
      'Classic Spiral',
      'Diffuse Spiral',
      'Tight Spiral',
      'Broken Spiral',
      'Optical Chaos',
      'Period-4 Window',
    ]);
    for (const p of presets) {
      expect(VALID).toContain(p.classification);
      expect(typeof p.description).toBe('string');
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it.each(presets.map((p) => [p.name, p] as const))(
    '%s: bounded, non-origin, classification matches lambda1',
    (_name, preset) => {
      const orbit = calculateIkedaMap(
        { x: 0.1, y: 0.1 },
        preset.params,
        ORBIT_LEN,
        TRANSIENT
      );
      const stats = orbitStats(orbit);
      expect(stats.allFinite).toBe(true);
      expect(stats.maxAbs).toBeLessThan(BOUND);
      expect(stats.maxAbsX).toBeGreaterThan(ORIGIN_FLOOR);

      const { lambda1 } = calculateIkedaLyapunovExponents(
        preset.params,
        LYA_ITERS
      );
      expect(Number.isFinite(lambda1)).toBe(true);
      assertClassification(preset.classification, lambda1, stats.distinct);

      // Description quotes measured lambda1 to two decimals (sign-aware).
      const quoted = lambda1.toFixed(2);
      expect(preset.description).toContain(quoted);
    }
  );
});

describe('Tinkerbell presets', () => {
  const presets = getInterestingTinkerbellParameters();

  it('keeps six named entries with a verified classification claim', () => {
    expect(presets).toHaveLength(6);
    const names = presets.map((p) => p.name);
    expect(names).toEqual([
      'Classic Multi-loop',
      'Quasiperiodic Ring',
      'Complex Multi-loop',
      'Period-7 Cycle',
      'Period-8 Cycle',
      'Chaotic Regime',
    ]);
    for (const p of presets) {
      expect(VALID).toContain(p.classification);
      expect(typeof p.description).toBe('string');
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it.each(presets.map((p) => [p.name, p] as const))(
    '%s: bounded, non-origin, classification matches lambda1',
    (_name, preset) => {
      const orbit = calculateTinkerbellMap(
        { x: 0.1, y: -0.1 },
        preset.params,
        ORBIT_LEN,
        TRANSIENT
      );
      const stats = orbitStats(orbit);
      expect(stats.allFinite).toBe(true);
      expect(stats.maxAbs).toBeLessThan(BOUND);
      expect(stats.maxAbsX).toBeGreaterThan(ORIGIN_FLOOR);

      const { lambda1 } = calculateTinkerbellLyapunovExponents(
        preset.params,
        LYA_ITERS
      );
      expect(Number.isFinite(lambda1)).toBe(true);
      assertClassification(preset.classification, lambda1, stats.distinct);

      const quoted = lambda1.toFixed(2);
      expect(preset.description).toContain(quoted);
    }
  );
});

describe('Duffing presets', () => {
  const presets = getInterestingDuffingParameters();

  it('keeps six named entries with a verified classification claim', () => {
    expect(presets).toHaveLength(6);
    const names = presets.map((p) => p.name);
    expect(names).toEqual([
      'Classic Bistable',
      'Chaotic Regime',
      'Low Barrier',
      'Deep Wells',
      'High Damping',
      'Weak Damping Chaos',
    ]);
    for (const p of presets) {
      expect(VALID).toContain(p.classification);
      expect(typeof p.description).toBe('string');
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it.each(presets.map((p) => [p.name, p] as const))(
    '%s: bounded, non-origin, classification matches lambda1',
    (_name, preset) => {
      const orbit = calculateDuffingMap(
        { x: 0.1, y: 0.1 },
        preset.params,
        ORBIT_LEN,
        TRANSIENT
      );
      const stats = orbitStats(orbit);
      expect(stats.allFinite).toBe(true);
      expect(stats.maxAbs).toBeLessThan(BOUND);
      expect(stats.maxAbsX).toBeGreaterThan(ORIGIN_FLOOR);

      const { lambda1 } = calculateDuffingLyapunovExponents(
        preset.params,
        LYA_ITERS
      );
      expect(Number.isFinite(lambda1)).toBe(true);
      assertClassification(preset.classification, lambda1, stats.distinct);

      const quoted = lambda1.toFixed(2);
      expect(preset.description).toContain(quoted);
    }
  );
});
