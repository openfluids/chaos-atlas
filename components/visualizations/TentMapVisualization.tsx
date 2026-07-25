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
    const renderCobweb = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                         innerWidth: number, innerHeight: number,
                         xScale: d3.ScaleLinear<number, number>,
                         yScale: d3.ScaleLinear<number, number>) => {
      // Draw the tent map function
      const tentData = [];
      for (let x = 0; x <= 1; x += 0.01) {
        tentData.push({
          x: x,
          y: x < 0.5 ? alpha * x : alpha * (1 - x)
        });
      }

      // Draw tent map
      const line = d3.line<{x: number, y: number}>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(tentData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 2)
        .attr('d', line);

      // Draw diagonal line
      g.append('line')
        .attr('x1', xScale(0))
        .attr('y1', yScale(0))
        .attr('x2', xScale(1))
        .attr('y2', yScale(1))
        .attr('stroke', 'var(--text-secondary)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5');

      // Draw cobweb
      const cobwebData = calculateTentCobweb(alpha, x0, iterations);

      g.append('path')
        .datum(cobwebData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 1.5)
        .attr('d', line);
    };

    const renderTimeSeries = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                             innerWidth: number, innerHeight: number,
                             xScale: d3.ScaleLinear<number, number>,
                             yScale: d3.ScaleLinear<number, number>) => {
      const data = calculateTentMap(alpha, x0, iterations);

      const line = d3.line<number>()
        .x((d, i) => xScale(i))
        .y(d => yScale(d))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 2)
        .attr('d', line);

      // Add points
      g.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', (d, i) => xScale(i))
        .attr('cy', d => yScale(d))
        .attr('r', 2)
        .attr('fill', 'var(--accent-cyan)');
    };

    const renderBifurcation = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                              innerWidth: number, innerHeight: number,
                              xScale: d3.ScaleLinear<number, number>,
                              yScale: d3.ScaleLinear<number, number>) => {
      const data = calculateTentBifurcation(
        { min: 0.5, max: 2.0 },
        0.01,
        0.4,
        500,
        50
      );

      g.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 0.5)
        .attr('fill', 'var(--accent-cyan)')
        .attr('opacity', 0.6);
    };

    const renderInvariantDensity = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                   innerWidth: number, innerHeight: number,
                                   xScale: d3.ScaleLinear<number, number>,
                                   yScale: d3.ScaleLinear<number, number>) => {
      const data = calculateTentInvariantDensity(alpha, 100, 10000);

      const line = d3.line<{x: number, density: number}>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.density))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 2)
        .attr('d', line);

      // Add area under curve
      const area = d3.area<{x: number, density: number}>()
        .x(d => xScale(d.x))
        .y0(innerHeight)
        .y1(d => yScale(d.density))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(data)
        .attr('fill', 'var(--accent-cyan)')
        .attr('opacity', 0.3)
        .attr('d', area);
    };

    const renderSymbolicDynamics = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                   innerWidth: number, innerHeight: number,
                                   xScale: d3.ScaleLinear<number, number>) => {
      const symbols = calculateTentSymbolicDynamics(alpha, x0, iterations);
      const symbolWidth = innerWidth / iterations;

      g.selectAll('rect')
        .data(symbols)
        .enter()
        .append('rect')
        .attr('x', (d, i) => xScale(i / iterations))
        .attr('y', innerHeight / 3)
        .attr('width', symbolWidth * 0.8)
        .attr('height', innerHeight / 3)
        .attr('fill', d => d === 'L' ? 'var(--accent-cyan)' : 'var(--accent-orange)')
        .attr('opacity', 0.8);

      // Add symbols text
      g.selectAll('text')
        .data(symbols.slice(0, Math.min(50, symbols.length))) // Limit text display
        .enter()
        .append('text')
        .attr('x', (d, i) => xScale(i / iterations) + symbolWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '10px')
        .text(d => d);
    };

    const getVisualizationTitle = () => {
      switch (visualizationType) {
        case 'cobweb': return 'Tent Map Cobweb Plot';
        case 'time': return 'Tent Map Time Series';
        case 'bifurcation': return 'Tent Map Bifurcation Diagram';
        case 'density': return 'Invariant Density';
        case 'symbolic': return 'Symbolic Dynamics';
        default: return 'Tent Map Visualization';
      }
    };

    if (!svgRef.current) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);

    // Set margins
    const margin = { top: 40, right: 20, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create a group element for the visualization
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add background
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'rgba(0, 0, 0, 0.1)')
      .attr('rx', 5);

    // Create scales
    let xScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, innerWidth]);

    let yScale = d3.scaleLinear()
      .domain([0, 1])
      .range([innerHeight, 0]);

    // Render based on visualization type
    if (visualizationType === 'cobweb') {
      renderCobweb(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'time') {
      const timeScale = d3.scaleLinear()
        .domain([0, iterations])
        .range([0, innerWidth]);
      renderTimeSeries(g, innerWidth, innerHeight, timeScale, yScale);
    } else if (visualizationType === 'bifurcation') {
      const alphaScale = d3.scaleLinear()
        .domain([0.5, 2.0])
        .range([0, innerWidth]);
      renderBifurcation(g, innerWidth, innerHeight, alphaScale, yScale);
      xScale = alphaScale; // Update for axis
    } else if (visualizationType === 'density') {
      renderInvariantDensity(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'symbolic') {
      renderSymbolicDynamics(g, innerWidth, innerHeight, xScale);
    }

    // Add axes
    if (visualizationType !== 'symbolic') {
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');

      g.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');
    }

    // Add axis labels
    const xLabel = visualizationType === 'time' ? 'Iteration' :
                   visualizationType === 'bifurcation' ? 'Parameter α' : 'x';
    const yLabel = visualizationType === 'density' ? 'Density' : 'y';

    g.append('text')
      .attr('transform', `translate(${innerWidth/2}, ${innerHeight + 40})`)
      .style('text-anchor', 'middle')
      .style('fill', 'var(--text-primary)')
      .style('font-size', '14px')
      .text(xLabel);

    if (visualizationType !== 'symbolic') {
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (innerHeight / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .text(yLabel);
    }

    // Add title
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', 0 - 10)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--text-primary)')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text(getVisualizationTitle());

  }, [alpha, x0, iterations, visualizationType]);

  return (
    <div className="p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Tent Map Visualization</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Parameter α: {alpha.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.01"
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Initial x₀: {x0.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.01"
              max="0.99"
              step="0.01"
              value={x0}
              onChange={(e) => setX0(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Iterations: {iterations}
            </label>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={iterations}
              onChange={(e) => setIterations(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Visualization Type
            </label>
            <select
              value={visualizationType}
              onChange={(e) => setVisualizationType(e.target.value)}
              className="w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40"
            >
              <option value="cobweb">Cobweb Plot</option>
              <option value="time">Time Series</option>
              <option value="bifurcation">Bifurcation Diagram</option>
              <option value="density">Invariant Density</option>
              <option value="symbolic">Symbolic Dynamics</option>
            </select>
          </div>

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