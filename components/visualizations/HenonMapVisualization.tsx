"use client";

import React, { useState, useEffect, useRef } from 'react';
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
  CHART_MARGIN,
} from './chartHelpers';
import { renderDensityCanvas } from './densityCanvas';

// Density views are cheap per-point (no DOM node per iterate), so the
// ceiling is raised well past the old 5,000-point DOM limit. 200k iterations
// renders in well under 100ms on a typical laptop and already shows the
// attractor's fine banded structure; higher still (up to ~1M) sharpens the
// thinnest filaments further but costs re-render latency while dragging a
// or b, so 200k is the default and the slider tops out at 1M for anyone who
// wants to hold still and look closer.
const DEFAULT_ITERATIONS = 200_000;
const MAX_ITERATIONS = 1_000_000;

const HenonMapVisualization: React.FC = () => {
  const [a, setA] = useState(1.4);
  const [b, setB] = useState(0.3);
  const [x0, setX0] = useState(0);
  const [y0, setY0] = useState(0);
  const [iterations, setIterations] = useState(DEFAULT_ITERATIONS);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Iterating the map is a chaotic computation: build-time (Node) and
  // browser JS engines can disagree in the last ULP, which React reports as
  // hydration error #418 if the result reaches the first server-rendered
  // paint. See hooks/useHydrated.
  const hydrated = useHydrated();

  const width = 600;
  const height = 400;

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

    // Find data bounds. The Hénon attractor's x-extent (~3.0) is roughly 7x
    // its y-extent (~0.4); fitting each independently to the box (the
    // previous behavior) stretched y by that same factor and destroyed the
    // recognisable silhouette, with the stretch changing every time a/b
    // moved the extents. equalAspectScales keeps one scale factor for both
    // axes instead, so the shape only changes because the attractor itself
    // did.
    const xExtent = d3.extent(points, d => d.x) as [number, number];
    const yExtent = d3.extent(points, d => d.y) as [number, number];
    const { xScale, yScale, plotWidth, plotHeight, offsetX, offsetY } =
      equalAspectScales(xExtent, yExtent, innerWidth, innerHeight);

    // Density canvas sits under the SVG axis layer, aligned to the same
    // letterboxed plot rectangle so the two line up exactly. Its CSS box is
    // the full chart (margins included); only the inner rect is painted.
    if (canvasRef.current) {
      renderDensityCanvas(
        canvasRef.current,
        points,
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

    // Add axes
    renderChartAxes(g, xScale, yScale, innerHeight);

    // Add axis labels
    renderAxisLabelsPlain(g, innerWidth, innerHeight, 'x', 'y');

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

      {/* Info */}
      <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>The Hénon map exhibits a strange attractor for the classic values a=1.4, b=0.3.</p>
        <p>Color encodes the (log-compressed) density of visits per pixel, not iteration order.</p>
      </div>
    </div>
  );
};

export default HenonMapVisualization;
