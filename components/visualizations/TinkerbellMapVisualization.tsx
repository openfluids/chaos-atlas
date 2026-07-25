"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  calculateTinkerbellMap,
  calculateTinkerbellAttractor,
  calculateTinkerbellBasinOfAttraction,
  calculateTinkerbellBifurcation,
  calculateTinkerbellLyapunovExponents,
  calculateTinkerbellFixedPoints,
  calculateTinkerbellCrisisBehavior,
  getInterestingTinkerbellParameters,
  calculateTinkerbellReturnMap
} from '@/lib/maps/tinkerbell';

const TinkerbellMapVisualization: React.FC = () => {
  const [selectedParams, setSelectedParams] = useState(0);
  const [iterations, setIterations] = useState(2000);
  const [visualizationType, setVisualizationType] = useState('attractor');
  const [bifurcationParam, setBifurcationParam] = useState<'a' | 'b' | 'c' | 'd'>('a');
  const [lyapunovExponents, setLyapunovExponents] = useState<{ lambda1: number; lambda2: number } | null>(null);
  const [fixedPoints, setFixedPoints] = useState<{ x: number; y: number }[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 600;
  const height = 400;

  const parameters = getInterestingTinkerbellParameters();
  const currentParams = parameters[selectedParams];

  // Calculate Lyapunov exponents and fixed points
  useEffect(() => {
    const le = calculateTinkerbellLyapunovExponents(currentParams.params, 2000);
    setLyapunovExponents(le);

    const fp = calculateTinkerbellFixedPoints(currentParams.params);
    setFixedPoints(fp);
  }, [currentParams]);

  useEffect(() => {
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

    // Render based on visualization type
    if (visualizationType === 'attractor') {
      renderAttractor(g, innerWidth, innerHeight);
    } else if (visualizationType === 'basin') {
      renderBasinOfAttraction(g, innerWidth, innerHeight);
    } else if (visualizationType === 'bifurcation') {
      renderBifurcation(g, innerWidth, innerHeight);
    } else if (visualizationType === 'crisis') {
      renderCrisisBehavior(g, innerWidth, innerHeight);
    } else if (visualizationType === 'return') {
      renderReturnMap(g, innerWidth, innerHeight);
    } else if (visualizationType === 'fixed') {
      renderFixedPoints(g, innerWidth, innerHeight);
    }

    // Add axes for appropriate visualizations
    if (visualizationType !== 'crisis') {
      const xDomain = visualizationType === 'bifurcation' ?
        [bifurcationParam === 'a' ? 0.3 : bifurcationParam === 'b' ? -1.0 : 1.5,
         bifurcationParam === 'a' ? 1.3 : bifurcationParam === 'b' ? -0.3 : 2.5] : [-2, 2];
      const yDomain = visualizationType === 'bifurcation' ? [-2, 2] : [-2, 2];

      const xScale = d3.scaleLinear().domain(xDomain).range([0, innerWidth]);
      const yScale = d3.scaleLinear().domain(yDomain).range([innerHeight, 0]);

      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');

      g.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');

      // Add axis labels
      const xLabel = visualizationType === 'bifurcation' ? `Parameter ${bifurcationParam}` : 'x';
      const yLabel = visualizationType === 'bifurcation' ? 'y' : 'y';

      g.append('text')
        .attr('transform', `translate(${innerWidth/2}, ${innerHeight + 40})`)
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .text(xLabel);

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

  }, [currentParams, iterations, visualizationType, bifurcationParam, fixedPoints]);

  const renderAttractor = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                          innerWidth: number, innerHeight: number) => {
    const data = calculateTinkerbellAttractor(currentParams.params, iterations);

    const xScale = d3.scaleLinear().domain([-2, 2]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([-2, 2]).range([innerHeight, 0]);

    // Create color gradient for trajectory
    const colorScale = d3.scaleSequential(d3.interpolateSpectral)
      .domain([0, iterations]);

    // Draw trajectory
    const line = d3.line<{x: number; y: number}>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(d3.curveLinear);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'var(--accent-orange)')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.6)
      .attr('d', line);

    // Draw points with color gradient
    g.selectAll('circle')
      .data(data.filter((d, i) => i % 5 === 0)) // Sample every 5th point
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', 1.5)
      .attr('fill', (d, i) => colorScale(i * 5))
      .attr('opacity', 0.8);

    // Draw fixed points
    fixedPoints.forEach(fp => {
      g.append('circle')
        .attr('cx', xScale(fp.x))
        .attr('cy', yScale(fp.y))
        .attr('r', 4)
        .attr('fill', 'var(--accent-cyan)')
        .attr('stroke', 'white')
        .attr('stroke-width', 1);
    });
  };

  const renderBasinOfAttraction = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                  innerWidth: number, innerHeight: number) => {
    const basinData = calculateTinkerbellBasinOfAttraction(currentParams.params, 80);
    const cellWidth = innerWidth / 80;
    const cellHeight = innerHeight / 80;

    basinData.forEach((row, y) => {
      row.forEach((value, x) => {
        const color = value === -1 ? 'var(--accent-red)' :
                     value === 0 ? 'rgba(50, 50, 50, 0.5)' :
                     'var(--accent-cyan)';

        g.append('rect')
          .attr('x', x * cellWidth)
          .attr('y', y * cellHeight)
          .attr('width', cellWidth)
          .attr('height', cellHeight)
          .attr('fill', color)
          .attr('opacity', 0.8)
          .attr('stroke', 'none');
      });
    });

    // Add legend
    const legendData = [
      { color: 'var(--accent-cyan)', label: 'Attracts to origin' },
      { color: 'rgba(50, 50, 50, 0.5)', label: 'Other attractor' },
      { color: 'var(--accent-red)', label: 'Escapes to infinity' }
    ];

    legendData.forEach((item, i) => {
      g.append('rect')
        .attr('x', 10)
        .attr('y', 10 + i * 20)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', item.color);

      g.append('text')
        .attr('x', 30)
        .attr('y', 22 + i * 20)
        .style('fill', 'var(--text-primary)')
        .style('font-size', '12px')
        .text(item.label);
    });
  };

  const renderBifurcation = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                            innerWidth: number, innerHeight: number) => {
    const paramRange = {
      min: bifurcationParam === 'a' ? 0.3 : bifurcationParam === 'b' ? -1.0 : 1.5,
      max: bifurcationParam === 'a' ? 1.3 : bifurcationParam === 'b' ? -0.3 : 2.5,
      step: 0.01
    };

    const fixedParams = { ...currentParams.params };
    delete (fixedParams as any)[bifurcationParam];

    const data = calculateTinkerbellBifurcation(bifurcationParam, paramRange, fixedParams, 1000);

    const xScale = d3.scaleLinear()
      .domain([paramRange.min, paramRange.max])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([-2, 2])
      .range([innerHeight, 0]);

    g.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.paramValue))
      .attr('cy', d => yScale(d.x))
      .attr('r', 0.5)
      .attr('fill', 'var(--accent-magenta)')
      .attr('opacity', 0.6);
  };

  const renderCrisisBehavior = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                               innerWidth: number, innerHeight: number) => {
    const paramRange = {
      min: bifurcationParam === 'a' ? 0.5 : 0.2,
      max: bifurcationParam === 'a' ? 1.2 : 1.0,
      step: 0.01
    };

    const fixedParams = { ...currentParams.params };
    delete (fixedParams as any)[bifurcationParam];

    const data = calculateTinkerbellCrisisBehavior(bifurcationParam, paramRange, fixedParams);

    const xScale = d3.scaleLinear()
      .domain([paramRange.min, paramRange.max])
      .range([0, innerWidth]);

    const yScale1 = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.attractorSize) || 2])
      .range([innerHeight * 0.8, innerHeight * 0.2]);

    const yScale2 = d3.scaleLinear()
      .domain([d3.min(data, d => d.lyapunov) || -1, d3.max(data, d => d.lyapunov) || 1])
      .range([innerHeight * 0.8, innerHeight * 0.2]);

    // Attractor size line
    const sizeLine = d3.line<{paramValue: number; attractorSize: number; lyapunov: number}>()
      .x(d => xScale(d.paramValue))
      .y(d => yScale1(d.attractorSize))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'var(--accent-cyan)')
      .attr('stroke-width', 2)
      .attr('d', sizeLine);

    // Lyapunov exponent line
    const lyapunovLine = d3.line<{paramValue: number; attractorSize: number; lyapunov: number}>()
      .x(d => xScale(d.paramValue))
      .y(d => yScale2(d.lyapunov))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'var(--accent-orange)')
      .attr('stroke-width', 2)
      .attr('d', lyapunovLine);

    // Add zero line for Lyapunov
    g.append('line')
      .attr('x1', 0)
      .attr('y1', yScale2(0))
      .attr('x2', innerWidth)
      .attr('y2', yScale2(0))
      .attr('stroke', 'var(--text-secondary)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5');

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight * 0.9})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text, line, path')
      .style('color', 'var(--text-secondary)');

    // Add labels
    g.append('text')
      .attr('transform', `translate(${innerWidth/2}, ${innerHeight + 40})`)
      .style('text-anchor', 'middle')
      .style('fill', 'var(--text-primary)')
      .style('font-size', '14px')
      .text(`Parameter ${bifurcationParam}`);

    // Legend
    g.append('text')
      .attr('x', 10)
      .attr('y', 20)
      .style('fill', 'var(--accent-cyan)')
      .style('font-size', '12px')
      .text('Attractor Size');

    g.append('text')
      .attr('x', 10)
      .attr('y', 40)
      .style('fill', 'var(--accent-orange)')
      .style('font-size', '12px')
      .text('Lyapunov Sum');
  };

  const renderReturnMap = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                          innerWidth: number, innerHeight: number) => {
    const trajectory = calculateTinkerbellAttractor(currentParams.params, 1000);
    const returnData = calculateTinkerbellReturnMap(trajectory, 'x', 1);

    const xScale = d3.scaleLinear()
      .domain([-2, 2])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([-2, 2])
      .range([innerHeight, 0]);

    g.selectAll('circle')
      .data(returnData)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.current))
      .attr('cy', d => yScale(d.next))
      .attr('r', 1)
      .attr('fill', 'var(--accent-magenta)')
      .attr('opacity', 0.6);

    // Add diagonal line
    g.append('line')
      .attr('x1', xScale(-2))
      .attr('y1', yScale(-2))
      .attr('x2', xScale(2))
      .attr('y2', yScale(2))
      .attr('stroke', 'var(--text-secondary)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5');

    // Update axes for return map
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text, line, path')
      .style('color', 'var(--text-secondary)');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text, line, path')
      .style('color', 'var(--text-secondary)');

    g.append('text')
      .attr('transform', `translate(${innerWidth/2}, ${innerHeight + 40})`)
      .style('text-anchor', 'middle')
      .style('fill', 'var(--text-primary)')
      .style('font-size', '14px')
      .text('xₙ');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - 40)
      .attr('x', 0 - (innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('fill', 'var(--text-primary)')
      .style('font-size', '14px')
      .text('xₙ₊₁');
  };

  const renderFixedPoints = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                            innerWidth: number, innerHeight: number) => {
    const xScale = d3.scaleLinear().domain([-2, 2]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([-2, 2]).range([innerHeight, 0]);

    // Draw attractor as background
    const attractorData = calculateTinkerbellAttractor(currentParams.params, 1000);

    g.append('path')
      .datum(attractorData)
      .attr('fill', 'none')
      .attr('stroke', 'var(--accent-orange)')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.3)
      .attr('d', d3.line<{x: number; y: number}>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveLinear));

    // Highlight fixed points
    fixedPoints.forEach((fp, i) => {
      g.append('circle')
        .attr('cx', xScale(fp.x))
        .attr('cy', yScale(fp.y))
        .attr('r', 6)
        .attr('fill', 'var(--accent-cyan)')
        .attr('stroke', 'white')
        .attr('stroke-width', 2);

      g.append('text')
        .attr('x', xScale(fp.x) + 10)
        .attr('y', yScale(fp.y) - 10)
        .style('fill', 'var(--text-primary)')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(`FP${i + 1}`);

      g.append('text')
        .attr('x', xScale(fp.x) + 10)
        .attr('y', yScale(fp.y) + 5)
        .style('fill', 'var(--text-secondary)')
        .style('font-size', '10px')
        .text(`(${fp.x.toFixed(3)}, ${fp.y.toFixed(3)})`);
    });

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text, line, path')
      .style('color', 'var(--text-secondary)');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text, line, path')
      .style('color', 'var(--text-secondary)');

    g.append('text')
      .attr('transform', `translate(${innerWidth/2}, ${innerHeight + 40})`)
      .style('text-anchor', 'middle')
      .style('fill', 'var(--text-primary)')
      .style('font-size', '14px')
      .text('x');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - 40)
      .attr('x', 0 - (innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('fill', 'var(--text-primary)')
      .style('font-size', '14px')
      .text('y');
  };

  const getVisualizationTitle = () => {
    switch (visualizationType) {
      case 'attractor': return 'Tinkerbell Attractor';
      case 'basin': return 'Basin of Attraction';
      case 'bifurcation': return 'Bifurcation Diagram';
      case 'crisis': return 'Crisis Behavior';
      case 'return': return 'Return Map';
      case 'fixed': return 'Fixed Points';
      default: return 'Tinkerbell Map Visualization';
    }
  };

  return (
    <div className="p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Tinkerbell Map Visualization</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Parameter Set
            </label>
            <select
              value={selectedParams}
              onChange={(e) => setSelectedParams(parseInt(e.target.value))}
              className="w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40"
            >
              {parameters.map((param, index) => (
                <option key={index} value={index}>
                  {param.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">{currentParams.description}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Iterations: {iterations}
            </label>
            <input
              type="range"
              min="500"
              max="5000"
              step="500"
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
              <option value="attractor">Multi-loop Attractor</option>
              <option value="basin">Basin of Attraction</option>
              <option value="bifurcation">Bifurcation Diagram</option>
              <option value="crisis">Crisis Behavior</option>
              <option value="return">Return Map</option>
              <option value="fixed">Fixed Points</option>
            </select>
          </div>

          {(visualizationType === 'bifurcation' || visualizationType === 'crisis') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bifurcation Parameter
              </label>
              <select
                value={bifurcationParam}
                onChange={(e) => setBifurcationParam(e.target.value as 'a' | 'b' | 'c' | 'd')}
                className="w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40"
              >
                <option value="a">Parameter a</option>
                <option value="b">Parameter b</option>
                <option value="c">Parameter c</option>
                <option value="d">Parameter d</option>
              </select>
            </div>
          )}

          {/* Lyapunov Exponents Display */}
          {lyapunovExponents && (
            <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
              <p className="text-sm font-medium text-cyan-400 mb-1">Lyapunov Exponents:</p>
              <p className="text-xs text-gray-300">
                λ₁ = {lyapunovExponents.lambda1.toFixed(4)}
              </p>
              <p className="text-xs text-gray-300">
                λ₂ = {lyapunovExponents.lambda2.toFixed(4)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {lyapunovExponents.lambda1 > 0 ? 'Chaotic behavior' : 'Regular behavior'}
              </p>
            </div>
          )}

          {/* Fixed Points Display */}
          {fixedPoints.length > 0 && (
            <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
              <p className="text-sm font-medium text-cyan-400 mb-1">
                Fixed Points ({fixedPoints.length}):
              </p>
              {fixedPoints.map((fp, i) => (
                <p key={i} className="text-xs text-gray-300 font-mono">
                  FP{i + 1}: ({fp.x.toFixed(3)}, {fp.y.toFixed(3)})
                </p>
              ))}
            </div>
          )}

          {/* Parameter Display */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">Parameters:</p>
            <p className="text-xs text-gray-300 font-mono">
              a = {currentParams.params.a.toFixed(2)}
            </p>
            <p className="text-xs text-gray-300 font-mono">
              b = {currentParams.params.b.toFixed(2)}
            </p>
            <p className="text-xs text-gray-300 font-mono">
              c = {currentParams.params.c.toFixed(2)}
            </p>
            <p className="text-xs text-gray-300 font-mono">
              d = {currentParams.params.d.toFixed(2)}
            </p>
          </div>

          {/* Equations Display */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">Equations:</p>
            <p className="text-xs text-gray-300 font-mono">
              x&apos; = x² - y² + a·x + b·y
            </p>
            <p className="text-xs text-gray-300 font-mono">
              y&apos; = 2·x·y + c·x + d·y
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

export default TinkerbellMapVisualization;