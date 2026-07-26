import * as d3 from 'd3';
import { computeDensityField, paintDensityField } from './densityField';

/** Number of discrete steps precomputed in a color ramp lookup table. */
const LUT_STEPS = 256;

/**
 * Per-canvas scratch for density paint. Playback re-renders every frame;
 * reallocating ImageData (~1.8 MB at DPR 2) + field buffers each call is
 * enough GC traffic to freeze the main thread. Reuse when dimensions match.
 */
type DensityCanvasScratch = {
  rectPixelWidth: number;
  rectPixelHeight: number;
  imageData: ImageData;
  counts: Float32Array;
  field: Float32Array;
};

const scratchByCanvas = new WeakMap<HTMLCanvasElement, DensityCanvasScratch>();

function getDensityScratch(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  rectPixelWidth: number,
  rectPixelHeight: number
): DensityCanvasScratch {
  const size = Math.max(1, rectPixelWidth * rectPixelHeight);
  const existing = scratchByCanvas.get(canvas);
  if (
    existing &&
    existing.rectPixelWidth === rectPixelWidth &&
    existing.rectPixelHeight === rectPixelHeight &&
    existing.counts.length === size &&
    existing.field.length === size
  ) {
    return existing;
  }
  const next: DensityCanvasScratch = {
    rectPixelWidth,
    rectPixelHeight,
    imageData: ctx.createImageData(rectPixelWidth, rectPixelHeight),
    counts: new Float32Array(size),
    field: new Float32Array(size),
  };
  scratchByCanvas.set(canvas, next);
  return next;
}

/**
 * Precomputes an RGB lookup table for a `d3.interpolateXxx`-style function
 * so the per-pixel paint loop in `paintDensityField` does integer table
 * lookups instead of parsing a CSS color string (`d3.rgb(...)`) at every one
 * of the few hundred thousand device pixels in the field.
 */
export function buildColorLut(colorScale: (t: number) => string): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(LUT_STEPS * 3);
  for (let i = 0; i < LUT_STEPS; i++) {
    const rgb = d3.rgb(colorScale(i / (LUT_STEPS - 1)));
    lut[i * 3] = rgb.r;
    lut[i * 3 + 1] = rgb.g;
    lut[i * 3 + 2] = rgb.b;
  }
  return lut;
}

export interface DensityCanvasRect {
  /** CSS-pixel offset of the plot rectangle within the canvas element. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Renders a density field of `points` onto `canvas`, scaling the backing
 * store by `devicePixelRatio` (see `hooks/useHydrated.ts` for why this must
 * only run client-side) and drawing only within `plotRect` -- the CSS-pixel
 * rectangle that must line up with the SVG axis layer drawn on top, which
 * may itself be letterboxed by `equalAspectScales` in `chartHelpers.ts`.
 *
 * `window` is only read here, inside a browser-only render call, never
 * during render/SSR.
 */
export function renderDensityCanvas(
  canvas: HTMLCanvasElement,
  points: readonly { x: number; y: number }[],
  xDomain: [number, number],
  yDomain: [number, number],
  canvasCssWidth: number,
  canvasCssHeight: number,
  plotRect: DensityCanvasRect,
  colorScale: (t: number) => string = d3.interpolateInferno
): void {
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(canvasCssWidth * dpr);
  const pixelHeight = Math.round(canvasCssHeight * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, pixelWidth, pixelHeight);

  // Divergent maps can yield NaN domains → NaN plotRect sizes. Math.max(1,
  // Math.round(NaN)) is NaN, and createImageData(NaN, NaN) throws
  // TypeError: Value is not of type 'long', which unmounts the React tree.
  // Never let non-finite or non-positive sizes reach ImageData allocation.
  const rawW = Math.round(plotRect.width * dpr);
  const rawH = Math.round(plotRect.height * dpr);
  if (
    !Number.isFinite(rawW) ||
    !Number.isFinite(rawH) ||
    rawW < 1 ||
    rawH < 1 ||
    !Number.isFinite(plotRect.x) ||
    !Number.isFinite(plotRect.y)
  ) {
    return;
  }
  const rectPixelWidth = Math.max(1, rawW);
  const rectPixelHeight = Math.max(1, rawH);

  const scratch = getDensityScratch(canvas, ctx, rectPixelWidth, rectPixelHeight);

  const field = computeDensityField(
    points,
    {
      xDomain,
      yDomain,
      pixelWidth: rectPixelWidth,
      pixelHeight: rectPixelHeight,
    },
    { counts: scratch.counts, normalized: scratch.field }
  );

  const lut = buildColorLut(colorScale);
  // Reuse ImageData pixels; paintDensityField overwrites every entry it needs.
  paintDensityField(scratch.imageData.data, field, lut);
  ctx.putImageData(
    scratch.imageData,
    Math.round(plotRect.x * dpr),
    Math.round(plotRect.y * dpr)
  );
}
