/**
 * Grassberger–Procaccia scaling-region fit.
 *
 * Port of dynachaos.diagnostics.correlation._find_scaling_region and
 * fit_power_law_loglog / the regression half of correlation_dimension.
 * Counts come from the wasm kernel; this file only post-processes them.
 *
 * numpy.gradient on the log-r grid (logspace → arithmetic in log r, so the
 * spacing is treated as uniform when successive steps agree to 1e-12, matching
 * numpy's "one unique diff" path) uses centered differences in the interior
 * and first-order edges. np.std is population (ddof=0). The slope is
 * scipy.stats.linregress over the detected window.
 */

export interface ScalingFit {
  /** Slope of log C vs log r over the detected window. NaN if undefined. */
  slope: number;
  /** True where the scaling window was used. Same length as the valid (C>0) logs. */
  localMask: boolean[];
  /** Local slopes on the valid log grid. */
  localSlopes: number[];
}

function mean(xs: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return s / xs.length;
}

function populationStd(xs: ArrayLike<number>): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  let acc = 0;
  for (let i = 0; i < xs.length; i++) {
    const d = xs[i] - m;
    acc += d * d;
  }
  return Math.sqrt(acc / xs.length);
}

function median(xs: ArrayLike<number>): number {
  const copy = Array.from(xs).sort((a, b) => a - b);
  const n = copy.length;
  if (n === 0) return Number.NaN;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return copy[mid];
  return (copy[mid - 1] + copy[mid]) / 2;
}

/** numpy.gradient(f, x) for a 1-D coordinate vector. edge_order=1. */
export function gradient(f: ArrayLike<number>, x: ArrayLike<number>): number[] {
  const n = f.length;
  const out = new Array<number>(n);
  if (n === 0) return out;
  if (n === 1) {
    out[0] = 0;
    return out;
  }
  const dx: number[] = [];
  let uniform = true;
  const first = x[1] - x[0];
  for (let i = 0; i < n - 1; i++) {
    const step = x[i + 1] - x[i];
    dx.push(step);
    // numpy reduces to the scalar case only when every step is bitwise equal.
    if (step !== first) uniform = false;
  }
  if (uniform) {
    const h = first;
    out[0] = (f[1] - f[0]) / h;
    out[n - 1] = (f[n - 1] - f[n - 2]) / h;
    for (let i = 1; i < n - 1; i++) out[i] = (f[i + 1] - f[i - 1]) / (2 * h);
    return out;
  }
  out[0] = (f[1] - f[0]) / dx[0];
  out[n - 1] = (f[n - 1] - f[n - 2]) / dx[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const h1 = dx[i - 1];
    const h2 = dx[i];
    const a = -h2 / (h1 * (h1 + h2));
    const b = (h2 - h1) / (h1 * h2);
    const c = h1 / (h2 * (h1 + h2));
    out[i] = a * f[i - 1] + b * f[i] + c * f[i + 1];
  }
  return out;
}

/**
 * Longest stable local-slope window. Port of _find_scaling_region.
 * min_points defaults to 5; correlation_dimension calls the fitter with 3.
 */
export function findScalingRegion(
  logR: ArrayLike<number>,
  logC: ArrayLike<number>,
  minPoints = 5,
): { mask: boolean[]; slopes: number[] } {
  const n = logR.length;
  const slopes = gradient(logC, logR);
  if (n < minPoints) {
    return { mask: Array.from({ length: n }, () => true), slopes };
  }
  const logSpacing = n > 1 ? (logR[n - 1] - logR[0]) / (n - 1) : 0;
  const usableIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    if (slopes[i] >= logSpacing) usableIdx.push(i);
  }
  const idx = usableIdx.length < minPoints ? Array.from({ length: n }, (_, i) => i) : usableIdx;
  const nU = idx.length;
  const uSlopes = idx.map((i) => slopes[i]);
  const win = Math.max(minPoints, Math.floor(nU / 4));
  const mask = new Array<boolean>(n).fill(false);
  if (win > nU) {
    for (const i of idx) mask[i] = true;
    return { mask, slopes };
  }
  let bestStd = Infinity;
  let bestStart = 0;
  for (let start = 0; start <= nU - win; start++) {
    const std = populationStd(uSlopes.slice(start, start + win));
    if (std < bestStd) {
      bestStd = std;
      bestStart = start;
    }
  }
  const centerMedian = median(uSlopes.slice(bestStart, bestStart + win));
  const threshold = Math.max(3 * bestStd, logSpacing);
  let lo = bestStart;
  let hi = bestStart + win;
  while (lo > 0 && Math.abs(uSlopes[lo - 1] - centerMedian) < threshold) lo -= 1;
  while (hi < nU && Math.abs(uSlopes[hi] - centerMedian) < threshold) hi += 1;
  for (let k = lo; k < hi; k++) mask[idx[k]] = true;
  return { mask, slopes };
}

/** Ordinary least squares, matching scipy.stats.linregress slope. */
export function linregressSlope(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const n = x.length;
  if (n < 2) return Number.NaN;
  const xMean = mean(x);
  const yMean = mean(y);
  let ssxm = 0;
  let ssxym = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    ssxm += dx * dx;
    ssxym += dx * (y[i] - yMean);
  }
  if (ssxm === 0) return Number.NaN;
  return ssxym / ssxm;
}

/**
 * Fit y ~ x**slope over the data-driven scaling window.
 * minPoints is 3 when called from correlation_dimension.
 */
export function fitPowerLawLogLog(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  minPoints = 5,
): ScalingFit {
  const valid: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const xv = x[i];
    const yv = y[i];
    if (xv > 0 && yv > 0 && Number.isFinite(xv) && Number.isFinite(yv)) valid.push(i);
  }
  if (valid.length < minPoints) {
    return { slope: Number.NaN, localMask: [], localSlopes: [] };
  }
  const logX = valid.map((i) => Math.log(x[i]));
  const logY = valid.map((i) => Math.log(y[i]));
  const { mask, slopes } = findScalingRegion(logX, logY, minPoints);
  const fitX: number[] = [];
  const fitY: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    fitX.push(logX[i]);
    fitY.push(logY[i]);
  }
  if (fitX.length < minPoints) {
    return { slope: Number.NaN, localMask: mask, localSlopes: slopes };
  }
  return { slope: linregressSlope(fitX, fitY), localMask: mask, localSlopes: slopes };
}
