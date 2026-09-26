/**
 * @jest-environment node
 *
 * Post-processing + vendored wasm versus dynachaos Python fixtures.
 * initSync loads the vendored .wasm bytes; no network.
 *
 * Tolerances: kernel counts are integers, so C(r) matches exactly when the
 * r grid matches. The remaining error is the log-log fit (numpy.gradient +
 * linregress) and the FFT 0-1 kernel. 1e-6 is tighter than the gap between
 * median and mean K on these series (~1e-3) and far tighter than dropping
 * PE normalisation (raw H is log(d!) times larger, about 4.8 at d=5).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  correlation_counts,
  initSync,
  ordinal_distribution,
  zero_one_k,
} from '../../public/vendor/dynachaos-wasm/dynachaos_wasm.js';
import {
  DEFAULT_C_VALUES,
  N_R,
  ORDINAL_D,
  ORDINAL_TAU,
  THEILER_WINDOW,
  correlationDimensionFromCounts,
  correlationRadii,
  defaultNCut,
  medianKFromZeroOne,
  permutationEntropyFromOrdinal,
} from '@/lib/diagnostics';
import { diagnosticsWorkerUrl } from '@/lib/diagnostics/workerUrl';

const ROOT = join(__dirname, '../..');
const FIXTURE_DIR = join(ROOT, 'tests/fixtures/dynachaos-diagnostics');
const WASM_PATH = join(ROOT, 'public/vendor/dynachaos-wasm/dynachaos_wasm_bg.wasm');

const ABS_TOL = 1e-6;

interface Fixture {
  id: string;
  series: number[];
  d2: number;
  pe: number;
  pe_raw: number;
  k: number;
  k_mean: number;
  k_values: number[];
  c_values: number[];
  n_cut: number;
  r_values: number[];
  scaling_mask: boolean[];
  n_r: number;
  theiler_window: number;
  ordinal_d: number;
  ordinal_tau: number;
}

function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8')) as Fixture);
}

beforeAll(() => {
  const bytes = readFileSync(WASM_PATH);
  initSync({ module: bytes });
});

describe('diagnosticsWorkerUrl', () => {
  it('prefixes the worker script when a basePath is set', () => {
    expect(diagnosticsWorkerUrl('/chaos-atlas')).toBe(
      '/chaos-atlas/dynachaos-diagnostics.worker.js',
    );
    expect(diagnosticsWorkerUrl('/chaos-atlas/')).toBe(
      '/chaos-atlas/dynachaos-diagnostics.worker.js',
    );
  });

  it('omits the prefix when basePath is empty', () => {
    expect(diagnosticsWorkerUrl('')).toBe('/dynachaos-diagnostics.worker.js');
    expect(diagnosticsWorkerUrl('/')).toBe('/dynachaos-diagnostics.worker.js');
  });
});

describe('dynachaos fixture parity', () => {
  const fixtures = loadFixtures();

  it('covers logistic r=4, logistic r=3.2, and a 2-D map component', () => {
    expect(fixtures.map((f) => f.id).sort()).toEqual(['henon-x', 'logistic-r3.2', 'logistic-r4']);
  });

  it('uses the same default c values as numpy default_rng(42)', () => {
    expect(DEFAULT_C_VALUES).toEqual(fixtures[0].c_values);
    for (const fixture of fixtures) {
      expect(fixture.c_values).toEqual(fixtures[0].c_values);
    }
  });

  it.each(fixtures)('$id matches the Python scaling-region D2 fit', (fixture) => {
    const radii = correlationRadii(fixture.series, N_R);
    expect(radii).toHaveLength(fixture.r_values.length);
    radii.forEach((r, i) => {
      expect(Math.abs(r - fixture.r_values[i])).toBeLessThan(1e-9 * Math.max(1, Math.abs(fixture.r_values[i])));
    });
    // Pair counts flip when a radius moves by 1 ulp across a pair distance.
    // The fit itself is checked on the fixture grid (numpy logspace), which
    // is the grid correlation_dimension used to produce scaling_mask and D2.
    const raw = correlation_counts(
      new Float64Array(fixture.series),
      1,
      new Float64Array(fixture.r_values),
      THEILER_WINDOW,
      true,
    );
    const fit = correlationDimensionFromCounts(raw);
    expect(fit.scalingMask).toEqual(fixture.scaling_mask);
    expect(Math.abs(fit.d2 - fixture.d2)).toBeLessThan(ABS_TOL);
  });

  it.each(fixtures)('$id matches normalised permutation entropy, not the raw Shannon value', (fixture) => {
    expect(fixture.ordinal_d).toBe(ORDINAL_D);
    expect(fixture.ordinal_tau).toBe(ORDINAL_TAU);
    const raw = ordinal_distribution(
      new Float64Array(fixture.series),
      ORDINAL_D,
      ORDINAL_TAU,
    );
    const pe = permutationEntropyFromOrdinal(raw, true);
    expect(Math.abs(pe - fixture.pe)).toBeLessThan(ABS_TOL);
    expect(Math.abs(fixture.pe_raw - fixture.pe)).toBeGreaterThan(0.5);
    expect(Math.abs(pe - fixture.pe_raw)).toBeGreaterThan(0.5);
  });

  it.each(fixtures)('$id K is the median over c, not the mean', (fixture) => {
    expect(defaultNCut(fixture.series.length)).toBe(fixture.n_cut);
    const raw = zero_one_k(
      new Float64Array(fixture.series),
      new Float64Array(DEFAULT_C_VALUES),
      fixture.n_cut,
    );
    const k = medianKFromZeroOne(raw);
    expect(Math.abs(k - fixture.k)).toBeLessThan(ABS_TOL);
    expect(Math.abs(fixture.k - fixture.k_mean)).toBeGreaterThan(1e-3);
    expect(Math.abs(k - fixture.k_mean)).toBeGreaterThan(1e-3);
  });
});
