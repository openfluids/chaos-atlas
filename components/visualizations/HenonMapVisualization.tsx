"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useHydrated } from '@/hooks/useHydrated';
import { ParamSlider } from '@/components/ui/ParamSlider';
import {
  initChartBase,
  equalAspectScales,
  createClippedDataGroup,
  renderChartAxes,
  renderAxisLabelsPlain,
  renderChartTitleAccent,
  padDomain,
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

  useEffect(() => {
    if (!hydrated) return;

    const chart = initChartBase(svgRef, width, height);
    if (!chart) return;
    const { svg, g, innerWidth, innerHeight } = chart;

    // Calculate Henon map
    const points: { x: number; y: number }[] = [];
    let x = x0;
    let y = y0;

    // Skip transients
    for (let i = 0; i < 100; i++) {
      const xNext = 1 - a * x * x + y;
      const yNext = b * x;
      x = xNext;
      y = yNext;
    }

    // Collect attractor points
    for (let i = 0; i < iterations; i++) {
      points.push({ x, y });
      const xNext = 1 - a * x * x + y;
      const yNext = b * x;
      x = xNext;
      y = yNext;
    }

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

    // Fallback domain keeps axes drawable when nothing is finite; density
    // paint is skipped below so the canvas stays cleared.
    const fallbackDomain: [number, number] = [-1, 1];
    // Pad 4 % per side BEFORE equalAspectScales so extremes sit inside the
    // spines (raw data max ~0.385 was past the outermost ±0.3 tick).
    const xExtent = escaped
      ? fallbackDomain
      : padDomain(d3.extent(finitePoints, (d) => d.x) as [number, number]);
    const yExtent = escaped
      ? fallbackDomain
      : padDomain(d3.extent(finitePoints, (d) => d.y) as [number, number]);

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

  }, [a, b, x0, y0, iterations, hydrated]);

  return (
    <div className="henon-map-visualization p-6">
      {/* Controls */}
      <div className="controls mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <ParamSlider
          label={<>Parameter a: {a.toFixed(3)}</>}
          min={0.5}
          max={2.0}
          step={0.01}
          value={a}
          onChange={setA}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          label={<>Parameter b: {b.toFixed(3)}</>}
          min={0.1}
          max={0.5}
          step={0.01}
          value={b}
          onChange={setB}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
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

      {/* Divergence notice — same caption idiom as the info block below */}
      {orbitEscaped && (
        <p
          className="mt-2 text-sm text-center"
          style={{ color: 'var(--text-secondary)' }}
          data-testid="orbit-escape-notice"
        >
          Orbit escapes to infinity for these parameters.
        </p>
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
