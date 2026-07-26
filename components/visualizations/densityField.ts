/**
 * Pure density-field math shared by the attractor views (Hénon, Ikeda,
 * Tinkerbell, Duffing). No d3/DOM dependency on purpose: d3 ships ESM-only
 * and this project's jest config (deliberately -- see its
 * `collectCoverageFrom` comment) does not transform `node_modules`, so this
 * module stays importable from a plain unit test. The d3-dependent color
 * ramp and canvas glue live in `densityCanvas.ts`.
 */

export interface DensityFieldOptions {
  xDomain: [number, number];
  yDomain: [number, number];
  /** Backing-store (device) pixel dimensions of the field to bin into. */
  pixelWidth: number;
  pixelHeight: number;
}

/**
 * Optional scratch buffers for `computeDensityField`. When length matches
 * `pixelWidth * pixelHeight`, they are zero-filled and reused instead of
 * allocating new `Float32Array`s every call (playback / animation path).
 */
export interface DensityFieldScratch {
  counts?: Float32Array;
  normalized?: Float32Array;
}

/**
 * Occupied-bin count at or below this → discrete markers, not a density field.
 *
 * A period-2 orbit lights 2 bins of ~460k; a period-86 cycle lights 86. Both
 * are invisible as single-pixel density. The period-doubling cascade runs
 * through periods 2…256… before chaos; 512 covers that cascade. A strange
 * attractor at default resolution fills thousands of bins, so it stays on the
 * unchanged density path.
 */
export const SPARSE_OCCUPIED_BIN_THRESHOLD = 512;

/**
 * Absolute coordinate (or axis span) above which a still-finite orbit is
 * treated as diverging.
 *
 * Classical planar attractors on this site live well inside |x|,|y| ≲ 10
 * (Hénon ≈ ±1.5×±0.4; Ikeda/Tinkerbell a few units). Slow escape
 * (e.g. Hénon a=1.4375) can reach ~1e267 while still IEEE-finite, collapsing
 * the domain to one pixel with no notice. 1e6 sits ~5 orders above any
 * attractor we plot and many orders below float overflow — catch numerical
 * blow-up without mistaking a genuine large-but-bounded set (none of ours).
 */
export const MAX_SANE_ORBIT_COORD = 1e6;

/**
 * True when every point is non-finite, or any finite coordinate / axis span
 * exceeds {@link MAX_SANE_ORBIT_COORD}. Empty input is escaped (nothing to plot).
 */
export function isOrbitEscaped(
  points: readonly { x: number; y: number }[]
): boolean {
  let anyFinite = false;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    anyFinite = true;
    if (
      Math.abs(p.x) > MAX_SANE_ORBIT_COORD ||
      Math.abs(p.y) > MAX_SANE_ORBIT_COORD
    ) {
      return true;
    }
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!anyFinite) return true;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  return spanX > MAX_SANE_ORBIT_COORD || spanY > MAX_SANE_ORBIT_COORD;
}

export interface DensityFieldResult {
  /** Normalised log1p field in [0, 1], row-major, y downward. */
  field: Float32Array;
  /** Number of bins with count > 0. */
  distinctOccupied: number;
  /**
   * Pixel centres of occupied bins. Only populated when
   * `0 < distinctOccupied ≤ SPARSE_OCCUPIED_BIN_THRESHOLD` (sparse path).
   */
  occupiedPixels: readonly { px: number; py: number }[];
}

/**
 * Bins `points` into a `pixelWidth`×`pixelHeight` occupancy grid and
 * normalises it with `log1p(count) / log1p(maxCount)`.
 *
 * Attractor occupancy is heavy-tailed -- a handful of bins near the folds
 * can be orders of magnitude denser than the rest of the set -- so a linear
 * `count / maxCount` normalisation puts almost every non-empty bin near 0
 * and only the single densest bin near 1. `log1p` compresses that dynamic
 * range so the structure in the tails stays visible.
 *
 * Returns a `Float32Array` of values in `[0, 1]`, row-major (`y * pixelWidth
 * + x`), y increasing downward (screen convention) to match `ImageData`.
 * Pass `scratch` with same-sized arrays to avoid per-call allocation.
 */
export function computeDensityField(
  points: readonly { x: number; y: number }[],
  options: DensityFieldOptions,
  scratch?: DensityFieldScratch
): Float32Array {
  return computeDensityFieldDetailed(points, options, scratch).field;
}

/**
 * Same binning as {@link computeDensityField}, plus occupied-bin metadata for
 * the shared sparse-marker path in `densityCanvas.ts`.
 */
export function computeDensityFieldDetailed(
  points: readonly { x: number; y: number }[],
  { xDomain, yDomain, pixelWidth, pixelHeight }: DensityFieldOptions,
  scratch?: DensityFieldScratch
): DensityFieldResult {
  // Non-finite or non-positive dims must never allocate / index a field —
  // divergent attractors (e.g. Hénon a ≥ 1.5) can feed NaN extents into the
  // caller and produce NaN pixel sizes. Return a trivial zero field instead.
  const dimsOk =
    Number.isFinite(pixelWidth) &&
    Number.isFinite(pixelHeight) &&
    pixelWidth >= 1 &&
    pixelHeight >= 1;
  const safeW = dimsOk ? Math.floor(pixelWidth) : 1;
  const safeH = dimsOk ? Math.floor(pixelHeight) : 1;
  const size = Math.max(1, safeW * safeH);

  const zeroResult = (): DensityFieldResult => {
    const out =
      scratch?.normalized && scratch.normalized.length === size
        ? scratch.normalized
        : new Float32Array(size);
    out.fill(0);
    return { field: out, distinctOccupied: 0, occupiedPixels: [] };
  };

  if (!dimsOk) return zeroResult();

  const counts =
    scratch?.counts && scratch.counts.length === size
      ? scratch.counts
      : new Float32Array(size);
  counts.fill(0);

  const xSpan = xDomain[1] - xDomain[0];
  const ySpan = yDomain[1] - yDomain[0];
  // Degenerate or non-finite domains: leave the zero field (nothing to bin).
  if (
    !Number.isFinite(xSpan) ||
    !Number.isFinite(ySpan) ||
    xSpan === 0 ||
    ySpan === 0 ||
    !Number.isFinite(xDomain[0]) ||
    !Number.isFinite(yDomain[0])
  ) {
    return zeroResult();
  }

  const xToPixel = safeW / xSpan;
  const yToPixel = safeH / ySpan;

  for (const p of points) {
    // Escaped orbits produce ±Infinity / NaN; never index with those.
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const px = Math.floor((p.x - xDomain[0]) * xToPixel);
    // y is flipped: data y increases upward, pixel rows increase downward.
    const py = Math.floor((yDomain[1] - p.y) * yToPixel);
    if (px < 0 || px >= safeW || py < 0 || py >= safeH) continue;
    counts[py * safeW + px] += 1;
  }

  // Find the max with a loop, not `Math.max(...counts)` -- spreading a
  // large typed array into a function call blows the engine's argument
  // stack (this binned array can be >500k entries at device resolution).
  let maxCount = 0;
  let distinctOccupied = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) {
      distinctOccupied += 1;
      if (counts[i] > maxCount) maxCount = counts[i];
    }
  }

  const normalized =
    scratch?.normalized && scratch.normalized.length === size
      ? scratch.normalized
      : new Float32Array(size);
  normalized.fill(0);

  if (maxCount <= 0) {
    return { field: normalized, distinctOccupied: 0, occupiedPixels: [] };
  }
  const logMax = Math.log1p(maxCount);
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) normalized[i] = Math.log1p(counts[i]) / logMax;
  }

  // Collect pixel centres only when the sparse-marker path will use them.
  const occupiedPixels: { px: number; py: number }[] = [];
  if (distinctOccupied <= SPARSE_OCCUPIED_BIN_THRESHOLD) {
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] > 0) {
        occupiedPixels.push({ px: i % safeW, py: Math.floor(i / safeW) });
      }
    }
  }

  return { field: normalized, distinctOccupied, occupiedPixels };
}

/**
 * Paints a normalised density `field` into an `ImageData`-compatible RGBA
 * buffer via a precomputed `[r,g,b] * steps` color lookup table (see
 * `buildColorLut` in `densityCanvas.ts`). Bins with zero density are left
 * fully transparent so the page background (or a chart background rect)
 * shows through instead of a flat "zero" color.
 */
export function paintDensityField(
  data: Uint8ClampedArray,
  field: Float32Array,
  lut: Uint8ClampedArray
): void {
  const steps = lut.length / 3;
  for (let i = 0; i < field.length; i++) {
    const t = field[i];
    const idx = i * 4;
    if (t <= 0) {
      data[idx + 3] = 0;
      continue;
    }
    const lutIndex = Math.round(t * (steps - 1)) * 3;
    data[idx] = lut[lutIndex];
    data[idx + 1] = lut[lutIndex + 1];
    data[idx + 2] = lut[lutIndex + 2];
    data[idx + 3] = 255;
  }
}

/**
 * Paints filled discs at each occupied bin so periodic / sparse orbits are
 * visible (a single lit density pixel on a ~460k field is not). Buffer is
 * cleared first; colour is a single RGB triple (typically the top of the
 * density LUT).
 */
export function paintSparseMarkers(
  data: Uint8ClampedArray,
  occupiedPixels: readonly { px: number; py: number }[],
  pixelWidth: number,
  pixelHeight: number,
  rgb: readonly [number, number, number],
  radiusPx: number
): void {
  data.fill(0);
  const radius = Math.max(1, Math.floor(radiusPx));
  const r2 = radius * radius;
  const [r, g, b] = rgb;
  for (const { px, py } of occupiedPixels) {
    const x0 = Math.max(0, px - radius);
    const x1 = Math.min(pixelWidth - 1, px + radius);
    const y0 = Math.max(0, py - radius);
    const y1 = Math.min(pixelHeight - 1, py + radius);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - px;
        const dy = y - py;
        if (dx * dx + dy * dy > r2) continue;
        const idx = (y * pixelWidth + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  }
}
