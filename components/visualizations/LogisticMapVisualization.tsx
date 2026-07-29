"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ParamSlider } from '@/components/ui/ParamSlider';
import {
  initChartBase,
  ensureChartDataGroup,
  renderChartAxes,
  renderAxisLabelsPlain,
  renderChartTitleAccent,
  upsertMark,
  joinByIndex,
} from './chartHelpers';

const LogisticMapVisualization: React.FC = () => {
  const [r, setR] = useState(3.5);
  const [x0, setX0] = useState(0.5);
  const [iterations, setIterations] = useState(50);
  const [visualizationType, setVisualizationType] = useState('cobweb');

  const svgRef = useRef<SVGSVGElement>(null);

  const width = 800;
  const height = 600;

  useEffect(() => {
    // No opaque chart-background rect: match Henon/Standard/CML and let the
    // themed wrapper below (--bg-primary) be the only painted surface, rather
    // than a private hard-coded panel fill.
    const chart = initChartBase(svgRef, width, height);
    if (!chart) return;
    const { g, innerWidth, innerHeight } = chart;

    // Structural data group: survives clearEphemeralChildren; mode wipe on type change.
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
      const rScale = d3.scaleLinear()
        .domain([2.5, 4.0])
        .range([0, innerWidth]);
      renderBifurcation(dataG, rScale, yScale, innerHeight);
      xScale = rScale;
    }

    // Grid (index-keyed so tick count changes exit/enter minimally)
    joinByIndex<number, SVGLineElement>(
      dataG,
      'line.grid-x',
      'line',
      xScale.ticks(10),
      'grid-x',
      (sel) => {
        sel
          .attr('data-grid', 'true')
          .attr('x1', (d) => xScale(d))
          .attr('y1', 0)
          .attr('x2', (d) => xScale(d))
          .attr('y2', innerHeight)
          .attr('stroke', 'var(--viz-grid)')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,2');
      }
    );
    joinByIndex<number, SVGLineElement>(
      dataG,
      'line.grid-y',
      'line',
      yScale.ticks(10),
      'grid-y',
      (sel) => {
        sel
          .attr('data-grid', 'true')
          .attr('x1', 0)
          .attr('y1', (d) => yScale(d))
          .attr('x2', innerWidth)
          .attr('y2', (d) => yScale(d))
          .attr('stroke', 'var(--viz-grid)')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,2');
      }
    );

    // Axes / labels / title: chartHelpers already paint --text-* vars.
    renderChartAxes(g, xScale, yScale, innerHeight);

    const xLabel = visualizationType === 'time' ? 'Iteration' :
                   visualizationType === 'bifurcation' ? 'Parameter r' : 'x';
    const yLabel = visualizationType === 'bifurcation' ? 'x' : 'f(x)';
    renderAxisLabelsPlain(g, innerWidth, innerHeight, xLabel, yLabel);
    renderChartTitleAccent(g, innerWidth, `Logistic Map (r = ${r.toFixed(2)})`);

    function renderCobweb(
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      xs: d3.ScaleLinear<number, number>,
      ys: d3.ScaleLinear<number, number>
    ) {
      const logistic = (x: number) => r * x * (1 - x);
      const curve = d3.line<number>()
        .x((d) => xs(d))
        .y((d) => ys(logistic(d)));
      const points = d3.range(0, 1.001, 0.01);

      upsertMark<SVGPathElement>(parent, 'path', 'logistic-curve')
        .datum(points)
        .attr('fill', 'none')
        .attr('stroke', 'var(--viz-line)')
        .attr('stroke-width', 2)
        .attr('d', curve);

      upsertMark<SVGLineElement>(parent, 'line', 'diagonal')
        .attr('x1', xs(0))
        .attr('y1', ys(0))
        .attr('x2', xs(1))
        .attr('y2', ys(1))
        .attr('stroke', 'var(--viz-point)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5');

      const cobwebPoints: { x: number; y: number }[] = [];
      let x = x0;
      for (let i = 0; i < Math.min(iterations, 20); i++) {
        const y = logistic(x);
        cobwebPoints.push({ x, y });
        x = y;
      }

      // Each cobweb step = vertical then horizontal segment.
      type Seg = { x1: number; y1: number; x2: number; y2: number };
      const segs: Seg[] = [];
      for (let i = 0; i < cobwebPoints.length - 1; i++) {
        const p = cobwebPoints[i];
        const nextY = logistic(p.y);
        segs.push({
          x1: p.x,
          y1: p.y,
          x2: p.y,
          y2: p.y,
        });
        segs.push({
          x1: p.y,
          y1: p.y,
          x2: p.y,
          y2: nextY,
        });
      }

      joinByIndex<Seg, SVGLineElement>(
        parent,
        'line.cobweb-seg',
        'line',
        segs,
        'cobweb-seg',
        (sel) => {
          sel
            .attr('x1', (d) => xs(d.x1))
            .attr('y1', (d) => ys(d.y1))
            .attr('x2', (d) => xs(d.x2))
            .attr('y2', (d) => ys(d.y2))
            .attr('stroke', 'var(--viz-tertiary)')
            .attr('stroke-width', 1.5);
        }
      );
    }

    function renderTimeSeries(
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      xs: d3.ScaleLinear<number, number>,
      ys: d3.ScaleLinear<number, number>
    ) {
      const logistic = (x: number) => r * x * (1 - x);
      const timeSeriesPoints: { i: number; x: number }[] = [];
      let x = x0;
      for (let i = 0; i < iterations; i++) {
        timeSeriesPoints.push({ i, x });
        x = logistic(x);
      }

      const line = d3.line<{ i: number; x: number }>()
        .x((d) => xs(d.i))
        .y((d) => ys(d.x));

      upsertMark<SVGPathElement>(parent, 'path', 'time-series')
        .datum(timeSeriesPoints)
        .attr('fill', 'none')
        .attr('stroke', 'var(--viz-line)')
        .attr('stroke-width', 2)
        .attr('d', line);

      joinByIndex<{ i: number; x: number }, SVGCircleElement>(
        parent,
        'circle.time-point',
        'circle',
        timeSeriesPoints,
        'time-point',
        (sel) => {
          sel
            .attr('cx', (d) => xs(d.i))
            .attr('cy', (d) => ys(d.x))
            .attr('r', 2)
            .attr('fill', 'var(--viz-point)');
        }
      );
    }

    function renderBifurcation(
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      xs: d3.ScaleLinear<number, number>,
      ys: d3.ScaleLinear<number, number>,
      chartHeight: number
    ) {
      const rValues = d3.range(2.5, 4.001, 0.01);
      const bifurcationPoints: { r: number; x: number }[] = [];

      for (const rVal of rValues) {
        const logistic = (x: number) => rVal * x * (1 - x);
        let x = 0.5;
        for (let i = 0; i < 100; i++) {
          x = logistic(x);
        }
        for (let i = 0; i < 20; i++) {
          x = logistic(x);
          bifurcationPoints.push({ r: rVal, x });
        }
      }

      joinByIndex<{ r: number; x: number }, SVGCircleElement>(
        parent,
        'circle.bifurcation-point',
        'circle',
        bifurcationPoints,
        'bifurcation-point',
        (sel) => {
          sel
            .attr('cx', (d) => xs(d.r))
            .attr('cy', (d) => ys(d.x))
            .attr('r', 0.5)
            .attr('fill', 'var(--viz-point)')
            .attr('opacity', 0.7);
        }
      );

      upsertMark<SVGLineElement>(parent, 'line', 'current-r')
        .attr('x1', xs(r))
        .attr('y1', 0)
        .attr('x2', xs(r))
        .attr('y2', chartHeight)
        .attr('stroke', 'var(--viz-line)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
    }

  }, [r, x0, iterations, visualizationType]);

  return (
    <div className="logistic-map-visualization p-6">
      <div className="controls mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <ParamSlider
          label={<>Parameter r: {r.toFixed(3)}</>}
          min={2.5}
          max={4}
          step={0.01}
          value={r}
          onChange={setR}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          label={<>Initial Value x₀: {x0.toFixed(3)}</>}
          min={0.01}
          max={0.99}
          step={0.01}
          value={x0}
          onChange={setX0}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          label={<>Iterations: {iterations}</>}
          min={10}
          max={200}
          step={5}
          value={iterations}
          onChange={setIterations}
          parse={parseInt}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <div>
          <label
            className="block text-sm mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Visualization Type
          </label>
          <select
            value={visualizationType}
            onChange={(e) => setVisualizationType(e.target.value)}
            className="w-full rounded-sm px-3 py-2"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border-primary)',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          >
            <option value="cobweb">Cobweb Plot</option>
            <option value="time">Time Series</option>
            <option value="bifurcation">Bifurcation Diagram</option>
          </select>
        </div>
      </div>

      <div className="visualization-wrapper flex justify-center">
        <div
          className="relative w-full border rounded-lg overflow-hidden"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-primary)',
            maxWidth: width,
            aspectRatio: `${width}/${height}`,
          }}
          data-testid="logistic-plot-surface"
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full"
          />
        </div>
      </div>

      <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Interactive Controls: Adjust parameters using the controls above.</p>
      </div>
    </div>
  );
};

export default LogisticMapVisualization;
