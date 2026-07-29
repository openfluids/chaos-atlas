"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useHydrated } from '@/hooks/useHydrated';
import { ParamSlider } from '@/components/ui/ParamSlider';
import { usePlaybackSelectedParam } from '@/components/ui/PlaybackContext';
import {
  initChartBase,
  equalAspectScales,
  createClippedDataGroup,
  renderChartAxes,
  renderAxisLabelsPlain,
  renderChartTitleAccent,
  padDomain,
  computeUnionOrbitDomain,
  formatOrbitEscapeCaption,
  CHART_MARGIN,
} from './chartHelpers';
import { renderDensityCanvas } from './densityCanvas';
import {
  isOrbitEscaped,
  SPARSE_OCCUPIED_BIN_THRESHOLD,
} from './densityField';
import { calculateHenonLyapunovSpectrum } from '@/lib/maps/henon';

// Density views are cheap per-point (no DOM node per iterate), so the
// ceiling is raised well past the old 5,000-point DOM limit. 200k iterations
// renders in well under 100ms on a typical laptop and already shows the
// attractor's fine banded structure; higher still (up to ~1M) sharpens the
// thinnest filaments further but costs re-render latency while dragging a
// or b, so 200k is the default and the slider tops out at 1M for anyone who
// wants to hold still and look closer.
const DEFAULT_ITERATIONS = 200_000;
const MAX_ITERATIONS = 1_000_000;
const LYAPUNOV_ITERATIONS = 10_000; // Fixed count for exponent calculation
// Parameter-a ParamSlider range (first registered = default playback axis).
// When the selected playback param is unknown, the held domain still uses
// this range — same default as cycle 15.
const A_SLIDER_MIN = 0.5;
const A_SLIDER_MAX = 2.0;
const B_SLIDER_MIN = 0.1;
const B_SLIDER_MAX = 0.5;
const TRANSIENT_ITERS = 100;
const FALLBACK_DOMAIN: [number, number] = [-1, 1];

/** Stable registry keys for Henon sliders (held-domain matching). */
const HENON_PARAM = {
  a: 'henon-a',
  b: 'henon-b',
  x0: 'henon-x0',
  y0: 'henon-y0',
  iterations: 'henon-iterations',
} as const;

type HenonSweptKey = keyof typeof HENON_PARAM;

/** Iterate the Hénon map; skip `TRANSIENT_ITERS` then collect `count` points. */
function henonOrbit(
  aParam: number,
  bParam: number,
  xStart: number,
  yStart: number,
  count: number
): { x: number; y: number }[] {
  let x = xStart;
  let y = yStart;
  for (let i = 0; i < TRANSIENT_ITERS; i++) {
    const xNext = 1 - aParam * x * x + y;
    const yNext = bParam * x;
    x = xNext;
    y = yNext;
  }
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    points.push({ x, y });
    const xNext = 1 - aParam * x * x + y;
    const yNext = bParam * x;
    x = xNext;
    y = yNext;
  }
  return points;
}

function matchHenonSweptKey(name: string | undefined): HenonSweptKey | null {
  if (!name) return null;
  for (const key of Object.keys(HENON_PARAM) as HenonSweptKey[]) {
    if (HENON_PARAM[key] === name) return key;
  }
  return null;
}

const HenonMapVisualization: React.FC = () => {
  const [a, setA] = useState(1.4);
  const [b, setB] = useState(0.3);
  const [x0, setX0] = useState(0);
  const [y0, setY0] = useState(0);
  const [iterations, setIterations] = useState(DEFAULT_ITERATIONS);
  // True when the orbit has no finite points, or finite extent is astronomical
  // (slow divergence that has not yet hit IEEE Infinity). Under-plot notice only.
  const [orbitEscaped, setOrbitEscaped] = useState(false);
  // Distinct occupied bins from the last density paint; used for the sparse-orbit caption.
  const [sparseDistinct, setSparseDistinct] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Iterating the map is a chaotic computation: build-time (Node) and
  // browser JS engines can disagree in the last ULP, which React reports as
  // hydration error #418 if the result reaches the first server-rendered
  // paint. See hooks/useHydrated.
  const hydrated = useHydrated();
  // Which param playback is sweeping — drives the held union domain.
  // Outside a provider this throws; map pages always wrap with PlaybackProvider.
  const selectedParam = usePlaybackSelectedParam();
  const matchedKey = matchHenonSweptKey(selectedParam?.name);
  // Falling back to 'a' holds the domain for a parameter playback may not be
  // sweeping — i.e. the drifting axes come back, silently. That only happens if
  // a slider's registry name stops matching HENON_PARAM, so say so out loud in
  // development rather than degrading without a signal.
  if (
    process.env.NODE_ENV !== 'production' &&
    selectedParam &&
    matchedKey === null
  ) {
    console.warn(
      `[henon] playback selected "${selectedParam.name}", which matches no ` +
        `HENON_PARAM entry — holding the domain for 'a' instead. The axes ` +
        `will drift while this parameter sweeps.`
    );
  }
  const sweptKey = matchedKey ?? 'a';

  const width = 600;
  const height = 400;

  // Memoize Lyapunov exponent calculation to avoid recalculating on every
  // render, especially when the on-screen iterations slider changes. The
  // exponent depends only on a and b (not the rendering iterations), so we
  // use a fixed LYAPUNOV_ITERATIONS for responsiveness.
  const lyapunovSpectrum = useMemo(() => {
    if (!hydrated) {
      return { lambda1: 0, lambda2: 0 };
    }
    return calculateHenonLyapunovSpectrum(a, b, 0.1, 0.1, LYAPUNOV_ITERATIONS);
  }, [a, b, hydrated]);

  // Held domain for whichever param playback is sweeping. Recomputed when
  // non-swept params change; NOT when the swept value moves frame-to-frame.
  // Cap domain-pass iterations at DEFAULT so a high iterations ceiling cannot
  // turn a 20-sample pre-pass into a multi-second stall.
  // Unknown / missing selection → same as cycle 15 (hold over a's slider range).
  // A matched selection carries its own range; an unmatched one always lands on
  // 'a' above, so a's range is the only fallback that can be reached.
  const knownSelected = matchedKey !== null ? selectedParam : null;
  const sweepMin = knownSelected?.min ?? A_SLIDER_MIN;
  const sweepMax = knownSelected?.max ?? A_SLIDER_MAX;
  // fixed* are undefined for the swept key so that key drops out of the memo
  // deps — frame-to-frame motion of the playhead must not rebuild the union.
  const fixedA = sweptKey === 'a' ? undefined : a;
  const fixedB = sweptKey === 'b' ? undefined : b;
  const fixedX0 = sweptKey === 'x0' ? undefined : x0;
  const fixedY0 = sweptKey === 'y0' ? undefined : y0;
  const fixedIterations = sweptKey === 'iterations' ? undefined : iterations;

  const heldDomain = useMemo(() => {
    if (!hydrated) return null;
    const domainIters = Math.min(
      fixedIterations ?? DEFAULT_ITERATIONS,
      DEFAULT_ITERATIONS,
    );

    return computeUnionOrbitDomain({
      min: sweepMin,
      max: sweepMax,
      fallback: { x: FALLBACK_DOMAIN, y: FALLBACK_DOMAIN },
      sampleOrbit: (sample) => {
        const aVal = sweptKey === 'a' ? sample : (fixedA as number);
        const bVal = sweptKey === 'b' ? sample : (fixedB as number);
        const xVal = sweptKey === 'x0' ? sample : (fixedX0 as number);
        const yVal = sweptKey === 'y0' ? sample : (fixedY0 as number);
        if (sweptKey === 'iterations') {
          const n = Math.min(
            Math.max(Math.round(sample), 1),
            DEFAULT_ITERATIONS,
          );
          return henonOrbit(aVal, bVal, xVal, yVal, n);
        }
        return henonOrbit(aVal, bVal, xVal, yVal, domainIters);
      },
    });
  }, [
    hydrated,
    sweptKey,
    sweepMin,
    sweepMax,
    fixedA,
    fixedB,
    fixedX0,
    fixedY0,
    fixedIterations,
  ]);

  useEffect(() => {
    if (!hydrated) return;

    const chart = initChartBase(svgRef, width, height);
    if (!chart) return;
    const { svg, g, innerWidth, innerHeight } = chart;

    const points = henonOrbit(a, b, x0, y0, iterations);

    // Find data bounds from finite points only. For a ≳ 1.5 the orbit
    // escapes; d3.extent over ±Infinity/NaN yields [undefined, undefined]
    // → NaN plot sizes → createImageData throws and React unmounts the page.
    // Also treat astronomically large but still-finite extents as escaped
    // (shared isOrbitEscaped — e.g. a=1.4375 spans ~1e267 before overflow).
    const finitePoints = points.filter(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y)
    );
    const escaped = isOrbitEscaped(finitePoints);
    setOrbitEscaped(escaped);

    // Prefer the held union domain so axes/canvas stay fixed while a sweeps —
    // including when THIS frame escaped (do not snap to FALLBACK_DOMAIN).
    // Fallback applies only when no sample in the union is bounded.
    let xExtent: [number, number];
    let yExtent: [number, number];
    if (heldDomain && !heldDomain.allEscaped) {
      xExtent = heldDomain.xDomain;
      yExtent = heldDomain.yDomain;
    } else if (escaped) {
      xExtent = FALLBACK_DOMAIN;
      yExtent = FALLBACK_DOMAIN;
    } else {
      // Pad 4 % per side BEFORE equalAspectScales so extremes sit inside the
      // spines (raw data max ~0.385 was past the outermost ±0.3 tick).
      xExtent = padDomain(d3.extent(finitePoints, (d) => d.x) as [number, number]);
      yExtent = padDomain(d3.extent(finitePoints, (d) => d.y) as [number, number]);
    }

    // The Hénon attractor's x-extent (~3.0) is roughly 7x its y-extent
    // (~0.4); equalAspectScales keeps one scale factor for both axes.
    const { xScale, yScale, plotWidth, plotHeight, offsetX, offsetY } =
      equalAspectScales(xExtent, yExtent, innerWidth, innerHeight);

    // Density canvas sits under the SVG axis layer, aligned to the same
    // letterboxed plot rectangle so the two line up exactly. Its CSS box is
    // the full chart (margins included); only the inner rect is painted.
    // On escape: render empty (cleared) rather than feeding non-finite bins.
    // Sparse orbits (few occupied bins) are drawn as markers in the shared path.
    if (canvasRef.current) {
      const paint = renderDensityCanvas(
        canvasRef.current,
        escaped ? [] : finitePoints,
        xExtent,
        yExtent,
        width,
        height,
        {
          x: CHART_MARGIN.left + offsetX,
          y: CHART_MARGIN.top + offsetY,
          width: plotWidth,
          height: plotHeight,
        },
        d3.interpolateInferno
      );
      setSparseDistinct(
        !escaped && paint.mode === 'sparse' ? paint.distinctOccupied : 0
      );
    } else {
      setSparseDistinct(0);
    }

    // Clip the (empty, kept for future markers such as fixed points) data
    // group to the plot rectangle so nothing can paint outside it and over
    // the axes/frame.
    createClippedDataGroup(
      svg,
      g,
      { x: offsetX, y: offsetY, width: plotWidth, height: plotHeight },
      'henon-plot-clip'
    );

    // Add axes with letterbox offsets so they align with the plot rectangle.
    renderChartAxes(g, xScale, yScale, innerHeight, offsetX, offsetY);

    // Idempotent labels (select-or-append); offsetY keeps the x-label under
    // the letterboxed axis rather than the padded inner-box edge.
    renderAxisLabelsPlain(g, innerWidth, innerHeight, 'x', 'y', offsetY);

    // Add title
    renderChartTitleAccent(g, innerWidth, `Hénon Map (a = ${a.toFixed(2)}, b = ${b.toFixed(2)})`);

  }, [a, b, x0, y0, iterations, hydrated, heldDomain]);

  return (
    <div className="henon-map-visualization p-6">
      {/* Controls */}
      <div className="controls mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <ParamSlider
          name={HENON_PARAM.a}
          label={<>Parameter a: {a.toFixed(3)}</>}
          min={A_SLIDER_MIN}
          max={A_SLIDER_MAX}
          step={0.01}
          value={a}
          onChange={setA}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          name={HENON_PARAM.b}
          label={<>Parameter b: {b.toFixed(3)}</>}
          min={B_SLIDER_MIN}
          max={B_SLIDER_MAX}
          step={0.01}
          value={b}
          onChange={setB}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          name={HENON_PARAM.x0}
          label={<>Initial x₀: {x0.toFixed(3)}</>}
          min={-1}
          max={1}
          step={0.01}
          value={x0}
          onChange={setX0}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          name={HENON_PARAM.y0}
          label={<>Initial y₀: {y0.toFixed(3)}</>}
          min={-1}
          max={1}
          step={0.01}
          value={y0}
          onChange={setY0}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          name={HENON_PARAM.iterations}
          label={<>Iterations: {iterations.toLocaleString()}</>}
          min={10_000}
          max={MAX_ITERATIONS}
          step={10_000}
          value={iterations}
          onChange={setIterations}
          parse={parseInt}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />
      </div>

      {/* Visualization */}
      <div className="visualization-wrapper flex justify-center">
        <div
          className="relative w-full border rounded-lg overflow-hidden"
          style={{ borderColor: 'var(--border-primary)', maxWidth: width, aspectRatio: `${width}/${height}` }}
        >
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute inset-0 w-full h-full"
          />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="absolute inset-0 w-full h-full"
          />
          {/* In-plot escape state: axes + held domain stay; canvas is empty.
              Same orbitEscaped / orbit-escape-notice mechanism as before —
              moved into the plot area so escape does not read as a broken chart. */}
          {orbitEscaped && (
            <p
              className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm pointer-events-none"
              style={{ color: 'var(--text-secondary)' }}
              data-testid="orbit-escape-notice"
            >
              {formatOrbitEscapeCaption('a', a)}
            </p>
          )}
        </div>
      </div>

      {/* Lyapunov Exponents */}
      {hydrated && (
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
          <p className="text-sm font-medium text-cyan-400 mb-1">Lyapunov Spectrum:</p>
          <p className="text-xs text-gray-300 font-mono">
            λ₁ = {lyapunovSpectrum.lambda1.toFixed(6)}
          </p>
          <p className="text-xs text-gray-300 font-mono">
            λ₂ = {lyapunovSpectrum.lambda2.toFixed(6)}
          </p>
          <p className="text-xs text-gray-300 font-mono">
            λ₁ + λ₂ = {(lyapunovSpectrum.lambda1 + lyapunovSpectrum.lambda2).toFixed(6)}
          </p>
          <p className="text-xs text-gray-300 font-mono">
            ln|b| = {Math.log(Math.abs(b)).toFixed(6)}
          </p>
        </div>
      )}

      {/* Sparse-orbit caption from measured bin diversity (not a guessed period). */}
      {!orbitEscaped &&
        sparseDistinct > 0 &&
        sparseDistinct <= SPARSE_OCCUPIED_BIN_THRESHOLD && (
          <p
            className="mt-2 text-sm text-center"
            style={{ color: 'var(--text-secondary)' }}
            data-testid="orbit-sparse-notice"
          >
            Sparse orbit — {sparseDistinct} distinct points
          </p>
        )}

      {/* Info */}
      <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>The Hénon map exhibits a strange attractor for the classic values a=1.4, b=0.3.</p>
        <p>Color encodes the (log-compressed) density of visits per pixel, not iteration order.</p>
      </div>
    </div>
  );
};

export default HenonMapVisualization;
