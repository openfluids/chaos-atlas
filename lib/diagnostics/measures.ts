/**
 * Post-processing for D2, permutation entropy, and the 0-1 test.
 *
 * Counts and per-c K values come from the wasm kernels. This module only
 * applies the Python defaults: scaling-range fit (min_points=3, Poisson
 * floor 1/sqrt(n_valid)), PE /= log(d!), K = median over c, n_cut = max(2, N//10).
 * c values are the numpy default_rng(42) draw in default-c.json.
 */

import { fitPowerLawLogLog } from './scaling';
import defaultC from './default-c.json';

export const ORDINAL_D = 5;
export const ORDINAL_TAU = 1;
export const N_C = 100;
export const N_R = 50;
export const THEILER_WINDOW = 0;

const ORDINAL_HEADER = 4;
const ZERO_ONE_HEADER = 3;
const CORRELATION_HEADER = 5;

export const DEFAULT_C_VALUES: readonly number[] = defaultC.c_values;

export function defaultNCut(n: number): number {
  return Math.max(2, Math.floor(n / 10));
}

export function factorial(d: number): number {
  let f = 1;
  for (let i = 2; i <= d; i++) f *= i;
  return f;
}

/** Shannon entropy of a Lehmer-count histogram, optionally divided by log(d!). */
export function permutationEntropyFromCounts(
  counts: ArrayLike<number>,
  nWindows: number,
  d: number,
  normalise = true,
): number {
  if (!(nWindows > 0) || !(d >= 2)) return Number.NaN;
  let h = 0;
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i];
    if (!(c > 0)) continue;
    const p = c / nWindows;
    h -= p * Math.log(p);
  }
  if (!normalise) return h;
  const hMax = Math.log(factorial(d));
  if (!(hMax > 0)) return h;
  return h / hMax;
}

/** ordinal_distribution layout: [N, d, tau, n_windows, counts...]. */
export function permutationEntropyFromOrdinal(
  raw: ArrayLike<number>,
  normalise = true,
): number {
  if (raw.length < ORDINAL_HEADER + 1) return Number.NaN;
  const d = raw[1];
  const nWindows = raw[3];
  const counts: number[] = [];
  for (let i = ORDINAL_HEADER; i < raw.length; i++) counts.push(raw[i]);
  return permutationEntropyFromCounts(counts, nWindows, d, normalise);
}

/** numpy.median: average of the two central values when the length is even. */
export function median(values: ArrayLike<number>): number {
  const xs: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isFinite(v)) xs.push(v);
  }
  if (xs.length === 0) return Number.NaN;
  xs.sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  if (xs.length % 2 === 1) return xs[mid];
  return (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * K as the median over c. `raw` is the zero_one_k layout
 * [N, n_c, n_cut, K_0, ...].
 */
export function medianKFromZeroOne(raw: ArrayLike<number>): number {
  if (raw.length <= ZERO_ONE_HEADER) return Number.NaN;
  const ks: number[] = [];
  for (let i = ZERO_ONE_HEADER; i < raw.length; i++) ks.push(raw[i]);
  return median(ks);
}

export function validPairCount(nPts: number, theilerWindow: number): number {
  const nEff = Math.max(0, nPts - theilerWindow - 1);
  return (nEff * (nEff + 1)) / 2;
}

/** r grid used by correlation_dimension when r_range is None. */
export function correlationRadii(series: ArrayLike<number>, nR = N_R): number[] {
  let lo = Infinity;
  let hi = -Infinity;
  let n = 0;
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
    n += 1;
  }
  const diameter = hi - lo;
  if (!(n >= 2) || !(diameter > 0)) return [];
  const rMin = diameter / n;
  const rMax = diameter;
  const logMin = Math.log10(rMin);
  const logMax = Math.log10(rMax);
  const radii: number[] = [];
  if (nR === 1) {
    radii.push(rMin);
    return radii;
  }
  for (let i = 0; i < nR; i++) {
    const t = i / (nR - 1);
    radii.push(10 ** (logMin + t * (logMax - logMin)));
  }
  return radii;
}

export interface CorrelationLayout {
  nPts: number;
  nR: number;
  theiler: number;
  radii: number[];
  counts: number[];
}

export function parseCorrelationCounts(raw: ArrayLike<number>): CorrelationLayout | null {
  if (raw.length < CORRELATION_HEADER) return null;
  const nPts = raw[0];
  const nR = raw[2];
  const theiler = raw[3];
  if (!Number.isFinite(nR) || nR < 1) return null;
  const header = CORRELATION_HEADER;
  const radii: number[] = [];
  const counts: number[] = [];
  for (let i = 0; i < nR; i++) radii.push(raw[header + i]);
  for (let i = 0; i < nR; i++) counts.push(raw[header + nR + i]);
  if (counts.length !== nR || radii.some((r) => !Number.isFinite(r))) return null;
  return { nPts, nR, theiler, radii, counts };
}

/**
 * C(r) = counts / n_valid, then the scaling fit with min_points=3.
 * Points with C <= 1/sqrt(n_valid) are dropped (Poisson floor).
 */
export function correlationDimensionFromCounts(raw: ArrayLike<number>): {
  d2: number;
  radii: number[];
  cValues: number[];
  scalingMask: boolean[];
} {
  const parsed = parseCorrelationCounts(raw);
  if (!parsed) {
    return { d2: Number.NaN, radii: [], cValues: [], scalingMask: [] };
  }
  const nValid = validPairCount(parsed.nPts, parsed.theiler);
  const cFloor = nValid > 0 ? 1 / Math.sqrt(nValid) : 1e-5;
  const cValues = parsed.counts.map((c) => (nValid > 0 ? c / nValid : 0));
  const fitY = cValues.map((c) => (c > cFloor ? c : Number.NaN));
  const fit = fitPowerLawLogLog(parsed.radii, fitY, 3);
  const scalingMask = new Array<boolean>(parsed.radii.length).fill(false);
  let validCursor = 0;
  for (let i = 0; i < parsed.radii.length; i++) {
    const y = fitY[i];
    const x = parsed.radii[i];
    const valid = x > 0 && y > 0 && Number.isFinite(x) && Number.isFinite(y);
    if (!valid) continue;
    scalingMask[i] = fit.localMask[validCursor] === true;
    validCursor += 1;
  }
  return { d2: fit.slope, radii: parsed.radii, cValues, scalingMask };
}
