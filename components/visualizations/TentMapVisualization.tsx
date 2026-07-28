"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useHydrated } from '@/hooks/useHydrated';
import {
  calculateTentMap,
  calculateTentCobweb,
  calculateTentBifurcation,
  calculateTentLyapunovExponent,
  calculateTentSymbolicDynamics,
  calculateTentInvariantDensity
} from '@/lib/maps/tent';
import { ParamSlider } from '@/components/ui/ParamSlider';
import { ViewModeSelect } from '@/components/ui/ViewModeSelect';
import {
  initChartBase,
  ensureChartDataGroup,
  renderChartAxes,
  renderAxisLabelsRotated,
  renderChartTitle,
  upsertMark,
  joinByIndex,
} from './chartHelpers';

const TentMapVisualization: React.FC = () => {
  const [alpha, setAlpha] = useState(1.8);
  const [x0, setX0] = useState(0.4);
  const [iterations, setIterations] = useState(50);
  const [visualizationType, setVisualizationType] = useState('cobweb');
  // Derived from alpha and x0, so it is computed during render rather than
  // pushed into state from an effect. Storing it would add a second render pass
  // and leave one frame showing a stale exponent for the new parameters.
  const lyapunovExponent = useMemo(
    () => calculateTentLyapunovExponent(alpha, x0, 1000),
    [alpha, x0]
  );
  const svgRef = useRef<SVGSVGElement>(null);
  // Lyapunov exponents come from a chaotic iteration whose result can differ
  // in the last ULP between the build-time and browser JS engines, so they are
  // rendered only after hydration. See hooks/useHydrated.
  const hydrated = useHydrated();

  const width = 600;
  const height = 400;

  useEffect(() => {
    const chart = initChartBase(svgRef, width, height, { background: 'rgba(0, 0, 0, 0.1)' });
    if (!chart) return;
    const { g, margin, innerWidth, innerHeight } = chart;
    const dataG = ensureChartDataGroup(g, visualizationType);

    let xScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, innerWidth]);

    let yScale = d3.scaleLinear()
      .domain([0, 1])
      .range([innerHeight, 0]);

    if (visualizationType === 'cobweb') {
      renderCobweb(dataG, xScale, yScale);
    } else if (visualizationType === 'time') {
      const timeScale = d3.scaleLinear()
        .domain([0, iterations])
        .range([0, innerWidth]);
      renderTimeSeries(dataG, timeScale, yScale);
      xScale = timeScale;
    } else if (visualizationType === 'bifurcation') {
      const alphaScale = d3.scaleLinear()
        .domain([0.5, 2.0])
        .range([0, innerWidth]);
      renderBifurcation(dataG, alphaScale, yScale);
      xScale = alphaScale;
    } else if (visualizationType === 'density') {
      renderInvariantDensity(dataG, innerHeight, xScale, yScale);
    } else if (visualizationType === 'symbolic') {
      renderSymbolicDynamics(dataG, innerHeight, xScale);
    }

    if (visualizationType !== 'symbolic') {
      renderChartAxes(g, xScale, yScale, innerHeight);
    }

    const xLabel = visualizationType === 'time' ? 'Iteration' :
                   visualizationType === 'bifurcation' ? 'Parameter α' : 'x';
    const yLabel = visualizationType === 'density' ? 'Density' : 'y';

    renderAxisLabelsRotated(
      g,
      innerWidth,
      innerHeight,
      margin.left,
      xLabel,
      visualizationType !== 'symbolic' ? yLabel : undefined
    );

    renderChartTitle(g, innerWidth, getVisualizationTitle());

    function getVisualizationTitle() {
      switch (visualizationType) {
        case 'cobweb': return 'Tent Map Cobweb Plot';
        case 'time': return 'Tent Map Time Series';
        case 'bifurcation': return 'Tent Map Bifurcation Diagram';
        case 'density': return 'Invariant Density';
        case 'symbolic': return 'Symbolic Dynamics';
        default: return 'Tent Map Visualization';
      }
    }

    function renderCobweb(
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      xs: d3.ScaleLinear<number, number>,
      ys: d3.ScaleLinear<number, number>
    ) {
      const tentData: { x: number; y: number }[] = [];
      for (let x = 0; x <= 1; x += 0.01) {
        tentData.push({
          x,
          y: x < 0.5 ? alpha * x : alpha * (1 - x),
        });
      }

      const line = d3.line<{ x: number; y: number }>()
        .x((d) => xs(d.x))
        .y((d) => ys(d.y))
        .curve(d3.curveLinear);

      upsertMark<SVGPathElement>(parent, 'path', 'tent-fn')
        .datum(tentData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 2)
        .attr('d', line);

      upsertMark<SVGLineElement>(parent, 'line', 'diagonal')
        .attr('x1', xs(0))
        .attr('y1', ys(0))
        .attr('x2', xs(1))
        .attr('y2', ys(1))
        .attr('stroke', 'var(--text-secondary)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5');

      const cobwebData = calculateTentCobweb(alpha, x0, iterations);
      upsertMark<SVGPathElement>(parent, 'path', 'cobweb')
        .datum(cobwebData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 1.5)
        .attr('d', line);
    }

    function renderTimeSeries(
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      xs: d3.ScaleLinear<number, number>,
      ys: d3.ScaleLinear<number, number>
    ) {
      const data = calculateTentMap(alpha, x0, iterations);

      const line = d3.line<number>()
        .x((_d, i) => xs(i))
        .y((d) => ys(d))
        .curve(d3.curveLinear);

      upsertMark<SVGPathElement>(parent, 'path', 'time-series')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 2)
        .attr('d', line);

      joinByIndex<number, SVGCircleElement>(
        parent,
        'circle.time-point',
        'circle',
        data,
        'time-point',
        (sel) => {
          sel
            .attr('cx', (_d, i) => xs(i))
            .attr('cy', (d) => ys(d))
            .attr('r', 2)
            .attr('fill', 'var(--accent-cyan)');
        }
      );
    }

    function renderBifurcation(
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      xs: d3.ScaleLinear<number, number>,
      ys: d3.ScaleLinear<number, number>
    ) {
      const data = calculateTentBifurcation(
        { min: 0.5, max: 2.0 },
        0.01,
        0.4,
        500,
        50
      );

      joinByIndex<{ x: number; y: number }, SVGCircleElement>(
        parent,
        'circle.bif-point',
        'circle',
        data,
        'bif-point',
        (sel) => {
          sel
            .attr('cx', (d) => xs(d.x))
            .attr('cy', (d) => ys(d.y))
            .attr('r', 0.5)
            .attr('fill', 'var(--accent-cyan)')
            .attr('opacity', 0.6);
        }
      );
    }

    function renderInvariantDensity(
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      h: number,
      xs: d3.ScaleLinear<number, number>,
      ys: d3.ScaleLinear<number, number>
    ) {
      const data = calculateTentInvariantDensity(alpha, 100, 10000);

      const line = d3.line<{ x: number; density: number }>()
        .x((d) => xs(d.x))
        .y((d) => ys(d.density))
        .curve(d3.curveLinear);

      upsertMark<SVGPathElement>(parent, 'path', 'density-line')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 2)
        .attr('d', line);

      const area = d3.area<{ x: number; density: number }>()
        .x((d) => xs(d.x))
        .y0(h)
        .y1((d) => ys(d.density))
        .curve(d3.curveLinear);

      upsertMark<SVGPathElement>(parent, 'path', 'density-area')
        .datum(data)
        .attr('fill', 'var(--accent-cyan)')
        .attr('opacity', 0.3)
        .attr('d', area);
    }

    function renderSymbolicDynamics(
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      h: number,
      xs: d3.ScaleLinear<number, number>
    ) {
      const symbols = calculateTentSymbolicDynamics(alpha, x0, iterations);
      const symbolWidth = innerWidth / iterations;

      joinByIndex<string, SVGRectElement>(
        parent,
        'rect.symbol',
        'rect',
        symbols,
        'symbol',
        (sel) => {
          sel
            .attr('x', (_d, i) => xs(i / iterations))
            .attr('y', h / 3)
            .attr('width', symbolWidth * 0.8)
            .attr('height', h / 3)
            .attr('fill', (d) => (d === 'L' ? 'var(--accent-cyan)' : 'var(--accent-orange)'))
            .attr('opacity', 0.8);
        }
      );

      const textSymbols = symbols.slice(0, Math.min(50, symbols.length));
      joinByIndex<string, SVGTextElement>(
        parent,
        'text.symbol-label',
        'text',
        textSymbols,
        'symbol-label',
        (sel) => {
          sel
            .attr('x', (_d, i) => xs(i / iterations) + symbolWidth / 2)
            .attr('y', h / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('fill', 'var(--text-primary)')
            .style('font-size', '10px')
            .text((d) => d);
        }
      );
    }

  }, [alpha, x0, iterations, visualizationType]);

  return (
    <div className="tent-map-visualization p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Tent Map Visualization</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <ParamSlider
            label={<>Parameter α: {alpha.toFixed(2)}</>}
            min={0.1}
            max={2.0}
            step={0.01}
            value={alpha}
            onChange={setAlpha}
          />

          <ParamSlider
            label={<>Initial x₀: {x0.toFixed(2)}</>}
            min={0.01}
            max={0.99}
            step={0.01}
            value={x0}
            onChange={setX0}
          />

          <ParamSlider
            label={<>Iterations: {iterations}</>}
            min={10}
            max={200}
            step={5}
            value={iterations}
            onChange={setIterations}
            parse={parseInt}
          />

          <ViewModeSelect
            label="Visualization Type"
            value={visualizationType}
            onChange={setVisualizationType}
            options={[
              { value: 'cobweb', label: 'Cobweb Plot' },
              { value: 'time', label: 'Time Series' },
              { value: 'bifurcation', label: 'Bifurcation Diagram' },
              { value: 'density', label: 'Invariant Density' },
              { value: 'symbolic', label: 'Symbolic Dynamics' },
            ]}
          />

          {/* Lyapunov Exponent Display */}
          {hydrated && lyapunovExponent !== null && (
            <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
              <p className="text-sm text-gray-300">
                <span className="font-medium text-cyan-400">Lyapunov Exponent:</span> {lyapunovExponent.toFixed(4)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {lyapunovExponent > 0 ? 'Chaotic behavior' : 'Periodic behavior'}
              </p>
            </div>
          )}

          {/* Equation Display */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">Equation:</p>
            <p className="text-xs text-gray-300 font-mono">
              xₙ₊₁ = min(α·xₙ, α·(1-xₙ))
            </p>
          </div>
        </div>

        {/* Visualization */}
        <div className="flex justify-center">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full border border-cyan-500/20 rounded-lg bg-black/50"
            style={{ maxWidth: width, aspectRatio: `${width}/${height}` }}
          />
        </div>
      </div>
    </div>
  );
};

export default TentMapVisualization;
