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
  CHART_MARGIN,
} from './chartHelpers';
import { renderDensityCanvas } from './densityCanvas';
import { calculateLyapunovExponent } from '@/lib/maps/standard';

// Density views cost nothing per point beyond a histogram increment, so the
// budget is set by how many device pixels the plot covers, not by DOM nodes.
// The plot is roughly 340x340 CSS px, which is ~460k device pixels at DPR 2 --
// 20,000 points would leave 96% of them empty and the field renders black.
// 400 orbits x 1,000 iterations puts a few hundred thousand samples into the
// square, which is what makes the KAM tori legible against the chaotic sea.
const DEFAULT_ITERATIONS = 1_000;
const NUM_INITIAL_CONDITIONS = 400; // 20x20 grid
const LYAPUNOV_ITERATIONS = 10_000;

// The standard map has MIXED phase space: above Greene's critical
// K ~ 0.9716 a chaotic sea coexists with surviving KAM tori, so lambda is a
// property of the orbit, not of K. Measured at K = 1.2: (0.1, 0.1) gives
// 0.192 while (2.0, 1.0) gives 0.0006 -- both correct, different orbits.
// This seed sits in the chaotic sea and is shown alongside the value so the
// number is never read as "the" exponent of the map.
const LYAPUNOV_SEED: [number, number] = [0.1, 0.1];

// Finite-time exponents on a regular orbit do not land exactly on zero; they
// decay like 1/n. At 10,000 iterations a KAM torus measures ~1e-3 or less,
// so anything below this is regular motion, not weak chaos.
const CHAOS_THRESHOLD = 1e-3;

const StandardMapVisualization: React.FC = () => {
  const [K, setK] = useState(1.2);
  const [iterations, setIterations] = useState(DEFAULT_ITERATIONS);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hydrated = useHydrated();

  const width = 600;
  const height = 400;

  // Memoized so dragging the iterations slider does not re-run the kernel.
  const lyapunovExponent = useMemo(() => {
    if (!hydrated) {
      return 0;
    }
    const [theta0, p0] = LYAPUNOV_SEED;
    return calculateLyapunovExponent(K, theta0, p0, LYAPUNOV_ITERATIONS);
  }, [K, hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const chart = initChartBase(svgRef, width, height);
    if (!chart) return;
    const { svg, g, innerWidth, innerHeight } = chart;

    // Generate ensemble of initial conditions in a grid across phase space
    const points: { x: number; y: number }[] = [];
    const gridSize = Math.sqrt(NUM_INITIAL_CONDITIONS);

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        let theta = (i / gridSize) * 2 * Math.PI;
        let p = (j / gridSize) * 2 * Math.PI;

        // Iterate this initial condition
        for (let iter = 0; iter < iterations; iter++) {
          points.push({ 
            x: theta % (2 * Math.PI), 
            y: p % (2 * Math.PI) 
          });

          // Standard map iteration: p' = p + K sin(theta); theta' = theta + p'
          const pNext = (p + K * Math.sin(theta)) % (2 * Math.PI);
          const thetaNext = (theta + pNext) % (2 * Math.PI);

          p = pNext;
          theta = thetaNext;
        }
      }
    }

    // θ and p both live on [0, 2π): the Chirikov standard map's KAM islands
    // are only recognizably round if that square domain is drawn at 1:1
    // pixels-per-unit rather than fit independently to a wide box.
    const { xScale, yScale, plotWidth, plotHeight, offsetX, offsetY } =
      equalAspectScales([0, 2 * Math.PI], [0, 2 * Math.PI], innerWidth, innerHeight);

    // Density canvas sits under the SVG axis layer
    if (canvasRef.current) {
      renderDensityCanvas(
        canvasRef.current,
        points,
        [0, 2 * Math.PI],
        [0, 2 * Math.PI],
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
    // group to the plot rectangle.
    createClippedDataGroup(
      svg,
      g,
      { x: offsetX, y: offsetY, width: plotWidth, height: plotHeight },
      'standard-plot-clip'
    );

    // Add axes with letterbox offsets
    renderChartAxes(g, xScale, yScale, innerHeight, offsetX, offsetY);

    // Add axis labels
    renderAxisLabelsPlain(g, innerWidth, innerHeight, 'θ', 'p');

    // Add title
    renderChartTitleAccent(g, innerWidth, `Standard Map (K = ${K.toFixed(2)})`);

  }, [K, iterations, hydrated]);

  return (
    <div className="standard-map-visualization p-6">
      {/* Controls */}
      <div className="controls mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <ParamSlider
          label={<>Parameter K: {K.toFixed(3)}</>}
          min={0}
          max={5}
          step={0.1}
          value={K}
          onChange={setK}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          label={<>Iterations per orbit: {iterations}</>}
          min={50}
          max={500}
          step={50}
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

      {/* Lyapunov Exponent */}
      {hydrated && (
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
          <p className="text-sm font-medium text-cyan-400 mb-1">
            Lyapunov Exponent (orbit from θ₀ = {LYAPUNOV_SEED[0]}, p₀ = {LYAPUNOV_SEED[1]}):
          </p>
          <p className="text-xs text-gray-300 font-mono">
            λ₁ = {lyapunovExponent.toFixed(6)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {lyapunovExponent > CHAOS_THRESHOLD
              ? 'Chaotic — this orbit is in the stochastic sea'
              : 'Regular — this orbit lies on a KAM torus'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Phase space is mixed above K ≈ 0.9716, so λ depends on which orbit
            you measure, not on K alone.
          </p>
        </div>
      )}

      {/* Info */}
      <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>The Standard Map is area-preserving and shows the transition from regular to chaotic motion.</p>
        <p>Color encodes the (log-compressed) density of visits: bright regions are frequently visited; dark regions show the KAM tori and other regular structures.</p>
      </div>
    </div>
  );
};

export default StandardMapVisualization;
