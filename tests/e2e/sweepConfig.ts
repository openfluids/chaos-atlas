/**
 * Single source of truth for the param-sweep envelope.
 * Imported by the sweep spec (what runs) and by globalTeardown (what is asserted).
 */

export const MAP_PAGES = [
  '/maps/arnold',
  '/maps/bakers',
  '/maps/complex',
  '/maps/duffing',
  '/maps/henon',
  '/maps/ikeda',
  '/maps/logistic',
  '/maps/standard',
  '/maps/tent',
  '/maps/tinkerbell',
  '/cml/diffusive',
] as const;

/** Inclusive samples from min→max. 9 covers extremes + interior without CI bloat. */
export const SAMPLE_COUNT = 9;

/** Settle time after each scrub so density re-renders finish (ms). */
export const SETTLE_MS = 450;

/** Run-scoped expectation written by the sweep spec at module load. */
export const EXPECTED_PATH = 'tests/e2e/param-sweep-expected.json';

/** Durable row stream (one JSON object per line). */
export const MATRIX_JSONL_PATH = 'tests/e2e/param-sweep-matrix.jsonl';

/** Folded matrix summary written by globalTeardown when the sweep participated. */
export const MATRIX_JSON_PATH = 'tests/e2e/param-sweep-matrix.json';

export type SweepExpectation = {
  pages: readonly string[];
  sampleCount: number;
  settleMs: number;
};
