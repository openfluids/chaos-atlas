"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useHydrated } from '@/hooks/useHydrated';
import {
  calculateDuffingMap,
  calculateDuffingAttractor,
  calculateDuffingPotential,
  calculateDuffingBifurcation,
  calculateDuffingBasins,
  calculateDuffingLyapunovExponents,
  calculateDuffingFixedPoints,
  calculateDuffingEnergyTrajectories,
  getInterestingDuffingParameters
} from '@/lib/maps/duffing';

const DuffingMapVisualization: React.FC = () => {
  const [selectedParams, setSelectedParams] = useState(1);
  const [iterations, setIterations] = useState(2000);
  const [visualizationType, setVisualizationType] = useState('attractor');
  const [bifurcationParam, setBifurcationParam] = useState<'a' | 'b'>('a');
  const svgRef = useRef<SVGSVGElement>(null);
  // Lyapunov exponents come from a chaotic iteration whose result can differ
  // in the last ULP between the build-time and browser JS engines, so they are
  // rendered only after hydration. See hooks/useHydrated.
  const hydrated = useHydrated();

  const width = 600;
  const height = 400;

  // Memoized so currentParams keeps a stable identity across renders; a fresh
  // call each render would give the useMemo deps below a new object every
  // time and defeat them.
  const parameters = useMemo(() => getInterestingDuffingParameters(), []);
  const currentParams = parameters[selectedParams];

  // Both are pure functions of currentParams, so they are derived during
  // render instead of being pushed into state by an effect. State here would
  // cost an extra render pass and briefly show values for the old parameters.
  const lyapunovExponents = useMemo(
    () => calculateDuffingLyapunovExponents(currentParams.params, 2000),
    [currentParams]
  );
  const fixedPoints = useMemo(
    () => calculateDuffingFixedPoints(currentParams.params),
    [currentParams]
  );

  useEffect(() => {
    const renderAttractor = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                            innerWidth: number, innerHeight: number) => {
      const data = calculateDuffingAttractor(currentParams.params, iterations);

      const xScale = d3.scaleLinear().domain([-2.5, 2.5]).range([0, innerWidth]);
      const yScale = d3.scaleLinear().domain([-2.5, 2.5]).range([innerHeight, 0]);

      // Create color gradient based on velocity
      const colorScale = d3.scaleSequential(d3.interpolatePlasma)
        .domain([0, data.length]);

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
        .attr('opacity', 0.4)
        .attr('d', line);

      // Draw points with velocity-based coloring
      g.selectAll('circle')
        .data(data.filter((d, i) => i % 3 === 0))
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 1)
        .attr('fill', (d, i) => colorScale(i * 3))
        .attr('opacity', 0.8);

      // Draw fixed points
      fixedPoints.forEach((fp, i) => {
        g.append('circle')
          .attr('cx', xScale(fp.x))
          .attr('cy', yScale(fp.y))
          .attr('r', 4)
          .attr('fill', 'var(--accent-cyan)')
          .attr('stroke', 'white')
          .attr('stroke-width', 1);
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

    const renderPotential = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                            innerWidth: number, innerHeight: number) => {
      const potentialData = calculateDuffingPotential(currentParams.params.a, { min: -2, max: 2 }, 100);

      const xScale = d3.scaleLinear()
        .domain([-2, 2])
        .range([0, innerWidth]);

      const yScale = d3.scaleLinear()
        .domain([d3.min(potentialData, d => d.potential) || 0,
                 d3.max(potentialData, d => d.potential) || 2])
        .range([innerHeight, 0]);

      // Draw potential curve
      const potentialLine = d3.line<{x: number; potential: number}>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.potential))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(potentialData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 3)
        .attr('d', potentialLine);

      // Fill area under curve
      const area = d3.area<{x: number; potential: number}>()
        .x(d => xScale(d.x))
        .y0(innerHeight)
        .y1(d => yScale(d.potential))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(potentialData)
        .attr('fill', 'var(--accent-cyan)')
        .attr('opacity', 0.2)
        .attr('d', area);

      // Mark well positions
      const wellPositions = [-Math.sqrt(currentParams.params.a), Math.sqrt(currentParams.params.a)];
      wellPositions.forEach(x => {
        if (Math.abs(x) <= 2) {
          g.append('line')
            .attr('x1', xScale(x))
            .attr('y1', 0)
            .attr('x2', xScale(x))
            .attr('y2', innerHeight)
            .attr('stroke', 'var(--accent-orange)')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .attr('opacity', 0.6);

          g.append('text')
            .attr('x', xScale(x))
            .attr('y', 20)
            .style('text-anchor', 'middle')
            .style('fill', 'var(--accent-orange)')
            .style('font-size', '12px')
            .text('Well');
        }
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
        .text('Position x');

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - 40)
        .attr('x', 0 - (innerHeight / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .text('Potential V(x)');
    };

    const renderBasins = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                         innerWidth: number, innerHeight: number) => {
      const basinData = calculateDuffingBasins(currentParams.params, 60);
      const cellWidth = innerWidth / 60;
      const cellHeight = innerHeight / 60;

      basinData.forEach((row, y) => {
        row.forEach((value, x) => {
          const color = value === -1 ? 'var(--accent-red)' :
                       value === 1 ? 'var(--accent-cyan)' :
                       value === 2 ? 'var(--accent-orange)' :
                       'rgba(50, 50, 50, 0.5)';

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
        { color: 'var(--accent-cyan)', label: 'Left well' },
        { color: 'var(--accent-orange)', label: 'Right well' },
        { color: 'rgba(50, 50, 50, 0.5)', label: 'Center' },
        { color: 'var(--accent-red)', label: 'Escapes' }
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
        min: bifurcationParam === 'a' ? 0.3 : 0.0,
        max: bifurcationParam === 'a' ? 1.5 : 0.6,
        step: 0.01
      };

      const fixedParams = { ...currentParams.params };
      delete (fixedParams as any)[bifurcationParam];

      const data = calculateDuffingBifurcation(bifurcationParam, paramRange, fixedParams, 1000);

      const xScale = d3.scaleLinear()
        .domain([paramRange.min, paramRange.max])
        .range([0, innerWidth]);

      const yScale = d3.scaleLinear()
        .domain([-2.5, 2.5])
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
        .text(`Parameter ${bifurcationParam}`);

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - 40)
        .attr('x', 0 - (innerHeight / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .text('x');
    };

    const renderEnergyTrajectories = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                     innerWidth: number, innerHeight: number) => {
      const initialConditions = [
        { x: -1.5, y: 0 }, { x: -1, y: 0 }, { x: -0.5, y: 0 },
        { x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1.5, y: 0 }
      ];

      const trajectories = calculateDuffingEnergyTrajectories(currentParams.params, initialConditions, 300);

      const xScale = d3.scaleLinear()
        .domain([0, 300])
        .range([0, innerWidth]);

      const yScale = d3.scaleLinear()
        .domain([-1, 2])
        .range([innerHeight, 0]);

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

      trajectories.forEach((traj, trajIndex) => {
        // Draw trajectory
        const line = d3.line<{x: number; y: number}>()
          .x((d, i) => xScale(i))
          .y(d => yScale(d.x))
          .curve(d3.curveLinear);

        g.append('path')
          .datum(traj.trajectory)
          .attr('fill', 'none')
          .attr('stroke', colorScale(trajIndex.toString()) as string)
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.8)
          .attr('d', line);

        // Add label
        g.append('text')
          .attr('x', 10)
          .attr('y', 20 + trajIndex * 15)
          .style('fill', colorScale(trajIndex.toString()) as string)
          .style('font-size', '12px')
          .text(`${traj.well} well`);
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
        .text('Time');

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - 40)
        .attr('x', 0 - (innerHeight / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .text('Position x');
    };

    const renderPhaseSpace = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                             innerWidth: number, innerHeight: number) => {
      const data = calculateDuffingAttractor(currentParams.params, Math.min(iterations, 1000));

      const xScale = d3.scaleLinear().domain([-2.5, 2.5]).range([0, innerWidth]);
      const yScale = d3.scaleLinear().domain([-2.5, 2.5]).range([innerHeight, 0]);

      // Create density-based coloring
      const densityMap = new Map<string, number>();
      const binSize = 0.1;

      data.forEach(point => {
        const xBin = Math.floor(point.x / binSize);
        const yBin = Math.floor(point.y / binSize);
        const key = `${xBin},${yBin}`;
        densityMap.set(key, (densityMap.get(key) || 0) + 1);
      });

      const maxDensity = Math.max(...Array.from(densityMap.values()));
      const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, maxDensity]);

      g.selectAll('circle')
        .data(data.filter((d, i) => i % 2 === 0))
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 2)
        .attr('fill', d => {
          const xBin = Math.floor(d.x / binSize);
          const yBin = Math.floor(d.y / binSize);
          const key = `${xBin},${yBin}`;
          return colorScale(densityMap.get(key) || 0);
        })
        .attr('opacity', 0.7);

      // Add fixed points
      fixedPoints.forEach(fp => {
        g.append('circle')
          .attr('cx', xScale(fp.x))
          .attr('cy', yScale(fp.y))
          .attr('r', 4)
          .attr('fill', 'var(--accent-cyan)')
          .attr('stroke', 'white')
          .attr('stroke-width', 1);
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
        case 'attractor': return 'Duffing Attractor';
        case 'potential': return 'Double-Well Potential';
        case 'basins': return 'Basins of Attraction';
        case 'bifurcation': return 'Bifurcation Diagram';
        case 'energy': return 'Energy Trajectories';
        case 'phase': return 'Phase Space Density';
        default: return 'Duffing Map Visualization';
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

    // Render based on visualization type
    if (visualizationType === 'attractor') {
      renderAttractor(g, innerWidth, innerHeight);
    } else if (visualizationType === 'potential') {
      renderPotential(g, innerWidth, innerHeight);
    } else if (visualizationType === 'basins') {
      renderBasins(g, innerWidth, innerHeight);
    } else if (visualizationType === 'bifurcation') {
      renderBifurcation(g, innerWidth, innerHeight);
    } else if (visualizationType === 'energy') {
      renderEnergyTrajectories(g, innerWidth, innerHeight);
    } else if (visualizationType === 'phase') {
      renderPhaseSpace(g, innerWidth, innerHeight);
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

  return (
    <div className="p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Duffing Map Visualization</h3>

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
              <option value="attractor">Phase Space Attractor</option>
              <option value="potential">Double-Well Potential</option>
              <option value="basins">Basins of Attraction</option>
              <option value="bifurcation">Bifurcation Diagram</option>
              <option value="energy">Energy Trajectories</option>
              <option value="phase">Phase Space Density</option>
            </select>
          </div>

          {visualizationType === 'bifurcation' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bifurcation Parameter
              </label>
              <select
                value={bifurcationParam}
                onChange={(e) => setBifurcationParam(e.target.value as 'a' | 'b')}
                className="w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40"
              >
                <option value="a">Parameter a (Well depth)</option>
                <option value="b">Parameter b (Damping)</option>
              </select>
            </div>
          )}

          {/* Lyapunov Exponents Display */}
          {hydrated && lyapunovExponents && (
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
              a = {currentParams.params.a.toFixed(2)} (Well depth)
            </p>
            <p className="text-xs text-gray-300 font-mono">
              b = {currentParams.params.b.toFixed(2)} (Damping)
            </p>
          </div>

          {/* Equations Display */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">Equations:</p>
            <p className="text-xs text-gray-300 font-mono">
              x&apos; = y
            </p>
            <p className="text-xs text-gray-300 font-mono">
              y&apos; = -b·y + a·x - x³
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Potential: V(x) = -0.5·a·x² + 0.25·x⁴
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

export default DuffingMapVisualization;