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
  // Simple theme system
  const themes = {
    matplotlib: { primary: '#1f77b4', secondary: '#ff7f0e', tertiary: '#2ca02c', background: '#ffffff', grid: '#e0e0e0', text: '#333333', axis: '#666666' },
    seaborn: { primary: '#4c72b0', secondary: '#dd8452', tertiary: '#55a868', background: '#fafafa', grid: '#e8e8e8', text: '#2c2c2c', axis: '#7f7f7f' },
    neon: { primary: '#00ffff', secondary: '#ff00ff', tertiary: '#ffff00', background: '#0a0a0a', grid: '#1a1a1a', text: '#ffffff', axis: '#666666' },
    scientific: { primary: '#0d47a1', secondary: '#c62828', tertiary: '#2e7d32', background: '#ffffff', grid: '#f5f5f5', text: '#212121', axis: '#616161' }
  };

  const [currentTheme, setCurrentTheme] = useState('matplotlib');
  const theme = themes[currentTheme as keyof typeof themes];

  useEffect(() => {
    const chart = initChartBase(svgRef, width, height, { background: theme.background });
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
          .attr('stroke', theme.grid)
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
          .attr('stroke', theme.grid)
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,2');
      }
    );

    // Axes (idempotent structural ticks)
    renderChartAxes(g, xScale, yScale, innerHeight);
    g.selectAll('g.x-axis text, g.x-axis line, g.x-axis path, g.y-axis text, g.y-axis line, g.y-axis path')
      .style('color', theme.axis);

    const xLabel = visualizationType === 'time' ? 'Iteration' :
                   visualizationType === 'bifurcation' ? 'Parameter r' : 'x';
    const yLabel = visualizationType === 'bifurcation' ? 'x' : 'f(x)';
    renderAxisLabelsPlain(g, innerWidth, innerHeight, xLabel, yLabel);
    g.selectAll('text.x-axis-label, text.y-axis-label').style('fill', theme.text);
    renderChartTitleAccent(g, innerWidth, `Logistic Map (r = ${r.toFixed(2)})`);
    g.select('text.chart-title')
      .style('fill', theme.primary)
      .style('font-size', '18px');

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
        .attr('stroke', theme.primary)
        .attr('stroke-width', 2)
        .attr('d', curve);

      upsertMark<SVGLineElement>(parent, 'line', 'diagonal')
        .attr('x1', xs(0))
        .attr('y1', ys(0))
        .attr('x2', xs(1))
        .attr('y2', ys(1))
        .attr('stroke', theme.secondary)
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
            .attr('stroke', theme.tertiary)
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
        .attr('stroke', theme.primary)
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
            .attr('fill', theme.primary);
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
            .attr('fill', theme.primary)
            .attr('opacity', 0.7);
        }
      );

      upsertMark<SVGLineElement>(parent, 'line', 'current-r')
        .attr('x1', xs(r))
        .attr('y1', 0)
        .attr('x2', xs(r))
        .attr('y2', chartHeight)
        .attr('stroke', theme.secondary)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
    }

  }, [r, x0, iterations, visualizationType, currentTheme]);

  return (
    <div className="logistic-map-visualization min-h-screen bg-linear-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Theme Switcher */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold neon-text-cyan">Logistic Map Visualization</h1>
          <div className="flex items-center gap-4">
            <select
              value={currentTheme}
              onChange={(e) => setCurrentTheme(e.target.value)}
              className="bg-black/70 border border-cyan-500/30 rounded-sm px-4 py-2 text-white"
            >
              <option value="matplotlib">Matplotlib</option>
              <option value="seaborn">Seaborn</option>
              <option value="neon">Neon</option>
              <option value="scientific">Scientific</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1">
            <div className="bg-black/40 border border-cyan-500/20 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-bold neon-text-cyan">Parameters</h2>

              <ParamSlider
                label={<>Parameter r: {r.toFixed(3)}</>}
                min={2.5}
                max={4}
                step={0.01}
                value={r}
                onChange={setR}
                className="w-full accent-cyan-500"
                labelClassName="block text-sm font-medium mb-2 text-cyan-400"
              />

              <ParamSlider
                label={<>Initial Value x₀: {x0.toFixed(3)}</>}
                min={0.01}
                max={0.99}
                step={0.01}
                value={x0}
                onChange={setX0}
                className="w-full accent-cyan-500"
                labelClassName="block text-sm font-medium mb-2 text-cyan-400"
              />

              <ParamSlider
                label={<>Iterations: {iterations}</>}
                min={10}
                max={200}
                step={5}
                value={iterations}
                onChange={setIterations}
                parse={parseInt}
                className="w-full accent-cyan-500"
                labelClassName="block text-sm font-medium mb-2 text-cyan-400"
              />

              <div>
                <label className="block text-sm font-medium mb-2 text-cyan-400">
                  Visualization Type
                </label>
                <select
                  value={visualizationType}
                  onChange={(e) => setVisualizationType(e.target.value)}
                  className="w-full bg-black/50 border border-cyan-500/30 rounded-sm px-3 py-2 text-white"
                >
                  <option value="cobweb">Cobweb Plot</option>
                  <option value="time">Time Series</option>
                  <option value="bifurcation">Bifurcation Diagram</option>
                </select>
              </div>

            </div>
          </div>

          {/* Visualization */}
          <div className="lg:col-span-3">
            <div className="bg-black/40 border border-cyan-500/20 rounded-lg p-6">
              <div className="flex justify-center">
                <div className="border border-cyan-500/20 rounded-sm">
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full"
                    style={{ maxWidth: width, aspectRatio: `${width}/${height}` }}
                  />
                </div>
              </div>

              {/* Visualization Info */}
              <div className="mt-4 text-center text-sm text-gray-400">
                <p>Interactive Controls: Adjust parameters using controls panel • Themes change colors</p>
                <p className="mt-1">Current Theme: {currentTheme}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticMapVisualization;
