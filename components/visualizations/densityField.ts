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
 */
export function computeDensityField(
  points: readonly { x: number; y: number }[],
  { xDomain, yDomain, pixelWidth, pixelHeight }: DensityFieldOptions
): Float32Array {
  const counts = new Float32Array(Math.max(1, pixelWidth * pixelHeight));
  const xSpan = xDomain[1] - xDomain[0];
  const ySpan = yDomain[1] - yDomain[0];
  const xToPixel = pixelWidth / xSpan;
  const yToPixel = pixelHeight / ySpan;

  for (const p of points) {
    const px = Math.floor((p.x - xDomain[0]) * xToPixel);
    // y is flipped: data y increases upward, pixel rows increase downward.
    const py = Math.floor((yDomain[1] - p.y) * yToPixel);
    if (px < 0 || px >= pixelWidth || py < 0 || py >= pixelHeight) continue;
    counts[py * pixelWidth + px] += 1;
  }

  // Find the max with a loop, not `Math.max(...counts)` -- spreading a
  // large typed array into a function call blows the engine's argument
  // stack (this binned array can be >500k entries at device resolution).
  let maxCount = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > maxCount) maxCount = counts[i];
  }

  const normalized = new Float32Array(counts.length);
  if (maxCount <= 0) return normalized;
  const logMax = Math.log1p(maxCount);
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) normalized[i] = Math.log1p(counts[i]) / logMax;
  }
  return normalized;
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
