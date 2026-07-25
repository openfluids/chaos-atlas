"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  calculateArnoldMap,
  calculateArnoldGridTransform,
  calculateArnoldImageScrambling,
  calculateArnoldPeriodicOrbits,
  calculateArnoldEigenvalues,
  calculateArnoldMatrixProperties,
  calculateArnoldFibonacciRelation,
  calculateArnoldAreaPreservation,
  calculateArnoldIteration
} from '@/lib/maps/arnold';

const ArnoldMapVisualization: React.FC = () => {
  const [initialX, setInitialX] = useState(0.3);
  const [initialY, setInitialY] = useState(0.3);
  const [iterations, setIterations] = useState(50);
  const [gridSize, setGridSize] = useState(16);
  const [gridIterations, setGridIterations] = useState(1);
  const [visualizationType, setVisualizationType] = useState('trajectory');
  const [animationStep, setAnimationStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  const width = 600;
  const height = 400;

  // Animation control
  useEffect(() => {
    if (isAnimating && (visualizationType === 'scrambling' || visualizationType === 'grid')) {
      animationRef.current = setInterval(() => {
        setAnimationStep(prev => (prev + 1) % 12);
      }, 800);
    } else {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isAnimating, visualizationType]);

  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
    if (!isAnimating) {
      setAnimationStep(0);
    }
  };

  useEffect(() => {
    const renderTrajectory = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                             innerWidth: number, innerHeight: number,
                             xScale: d3.ScaleLinear<number, number>,
                             yScale: d3.ScaleLinear<number, number>) => {
      const data = calculateArnoldMap({ x: initialX, y: initialY }, iterations);

      // Draw trajectory line
      const line = d3.line<{x: number, y: number}>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.8)
        .attr('d', line);

      // Draw points
      g.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 2)
        .attr('fill', 'var(--accent-cyan)')
        .attr('opacity', (d, i) => 0.3 + (0.7 * i / data.length));
    };

    const renderGridTransform = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                innerWidth: number, innerHeight: number,
                                xScale: d3.ScaleLinear<number, number>,
                                yScale: d3.ScaleLinear<number, number>) => {
      const data = calculateArnoldGridTransform(gridSize, isAnimating ? animationStep + 1 : gridIterations);
      const cellWidth = innerWidth / gridSize;
      const cellHeight = innerHeight / gridSize;

      // Create color scale
      const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, gridSize * gridSize]);

      data.forEach((row, y) => {
        row.forEach((value, x) => {
          g.append('rect')
            .attr('x', x * cellWidth)
            .attr('y', y * cellHeight)
            .attr('width', cellWidth)
            .attr('height', cellHeight)
            .attr('fill', colorScale(value))
            .attr('stroke', 'var(--text-secondary)')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.9);
        });
      });
    };

    const renderImageScrambling = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                 innerWidth: number, innerHeight: number,
                                 xScale: d3.ScaleLinear<number, number>,
                                 yScale: d3.ScaleLinear<number, number>) => {
      const frames = calculateArnoldImageScrambling(24, 24, 12);
      const currentFrame = frames[animationStep];

      currentFrame.forEach(row => {
        row.forEach(point => {
          g.append('rect')
            .attr('x', xScale(point.x) - innerWidth / 48)
            .attr('y', yScale(point.y) - innerHeight / 48)
            .attr('width', innerWidth / 24)
            .attr('height', innerHeight / 24)
            .attr('fill', `rgb(${point.color.r}, ${point.color.g}, ${point.color.b})`)
            .attr('stroke', 'none')
            .attr('opacity', 0.9);
        });
      });
    };

    const renderPeriodicOrbits = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                 innerWidth: number, innerHeight: number,
                                 xScale: d3.ScaleLinear<number, number>,
                                 yScale: d3.ScaleLinear<number, number>) => {
      const orbits = calculateArnoldPeriodicOrbits(5);
      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

      orbits.forEach((orbit, orbitIndex) => {
        const line = d3.line<{x: number, y: number}>()
          .x(d => xScale(d.x))
          .y(d => yScale(d.y))
          .curve(d3.curveLinear);

        g.append('path')
          .datum(orbit.orbit)
          .attr('fill', 'none')
          .attr('stroke', colorScale(orbitIndex.toString()) as string)
          .attr('stroke-width', 2)
          .attr('opacity', 0.8)
          .attr('d', line);

        // Add points
        g.selectAll(`circle.orbit-${orbitIndex}`)
          .data(orbit.orbit)
          .enter()
          .append('circle')
          .attr('class', `orbit-${orbitIndex}`)
          .attr('cx', d => xScale(d.x))
          .attr('cy', d => yScale(d.y))
          .attr('r', 3)
          .attr('fill', colorScale(orbitIndex.toString()) as string);

        // Add period label
        if (orbit.orbit.length > 0) {
          g.append('text')
            .attr('x', xScale(orbit.orbit[0].x))
            .attr('y', yScale(orbit.orbit[0].y) - 10)
            .attr('text-anchor', 'middle')
            .style('fill', 'var(--text-primary)')
            .style('font-size', '10px')
            .text(`P=${orbit.period}`);
        }
      });
    };

    const renderFibonacciRelation = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                    innerWidth: number, innerHeight: number,
                                    xScale: d3.ScaleLinear<number, number>,
                                    yScale: d3.ScaleLinear<number, number>) => {
      const data = calculateArnoldFibonacciRelation(15);
      const { lambda1 } = calculateArnoldEigenvalues();

      const xScaleFib = d3.scaleLinear()
        .domain([0, data.length])
        .range([0, innerWidth]);

      const yScaleFib = d3.scaleLinear()
        .domain([0, Math.max(...data.map(d => d.fibonacci))])
        .range([innerHeight, 0]);

      // Draw eigenvalue line
      g.append('line')
        .attr('x1', 0)
        .attr('y1', yScaleFib(lambda1))
        .attr('x2', innerWidth)
        .attr('y2', yScaleFib(lambda1))
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

      // Draw Fibonacci ratios
      const line = d3.line<{n: number, ratio: number}>()
        .x(d => xScaleFib(d.n))
        .y(d => yScaleFib(d.ratio))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data.filter(d => d.ratio > 0))
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 2)
        .attr('d', line);

      // Add points
      g.selectAll('circle')
        .data(data.filter(d => d.ratio > 0))
        .enter()
        .append('circle')
        .attr('cx', d => xScaleFib(d.n))
        .attr('cy', d => yScaleFib(d.ratio))
        .attr('r', 3)
        .attr('fill', 'var(--accent-orange)');

      // Add eigenvalue label
      g.append('text')
        .attr('x', innerWidth - 50)
        .attr('y', yScaleFib(lambda1) - 10)
        .style('fill', 'var(--text-primary)')
        .style('font-size', '12px')
        .text(`λ₁ = ${lambda1.toFixed(3)}`);
    };

    const renderMatrixProperties = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                   innerWidth: number, innerHeight: number) => {
      const { trace, determinant } = calculateArnoldMatrixProperties();
      const { lambda1, lambda2 } = calculateArnoldEigenvalues();

      const properties = [
        { label: 'Matrix', value: '[[1, 1], [1, 2]]' },
        { label: 'Trace', value: trace.toString() },
        { label: 'Determinant', value: determinant.toString() },
        { label: 'λ₁ (Golden Ratio)', value: lambda1.toFixed(6) },
        { label: 'λ₂', value: lambda2.toFixed(6) },
        { label: 'Area Preserving', value: 'Yes (det = 1)' }
      ];

      properties.forEach((prop, i) => {
        g.append('text')
          .attr('x', 20)
          .attr('y', 40 + i * 35)
          .style('fill', 'var(--text-primary)')
          .style('font-size', '16px')
          .style('font-weight', 'bold')
          .text(`${prop.label}:`);

        g.append('text')
          .attr('x', 200)
          .attr('y', 40 + i * 35)
          .style('fill', 'var(--accent-cyan)')
          .style('font-size', '16px')
          .text(prop.value);
      });

      // Draw unit square
      const squareSize = Math.min(innerWidth, innerHeight) * 0.3;
      const squareX = (innerWidth - squareSize) / 2;
      const squareY = innerHeight - squareSize - 50;

      g.append('rect')
        .attr('x', squareX)
        .attr('y', squareY)
        .attr('width', squareSize)
        .attr('height', squareSize)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 2);

      // Draw transformed square corners
      const corners = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ];

      const transformedCorners = corners.map(c => calculateArnoldIteration(c));

      const transformLine = d3.line<{x: number, y: number}>()
        .x(d => squareX + d.x * squareSize)
        .y(d => squareY + (1 - d.y) * squareSize)
        .curve(d3.curveLinearClosed);

      g.append('path')
        .datum(transformedCorners)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 2)
        .attr('d', transformLine);
    };

    const getVisualizationTitle = () => {
      switch (visualizationType) {
        case 'trajectory': return 'Arnold Cat Map Trajectory';
        case 'grid': return 'Grid Transformation';
        case 'scrambling': return 'Image Scrambling';
        case 'periodic': return 'Periodic Orbits';
        case 'fibonacci': return 'Fibonacci Relation';
        case 'properties': return 'Matrix Properties';
        default: return 'Arnold Cat Map Visualization';
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
    const xScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, 1])
      .range([innerHeight, 0]);

    // Render based on visualization type
    if (visualizationType === 'trajectory') {
      renderTrajectory(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'grid') {
      renderGridTransform(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'scrambling') {
      renderImageScrambling(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'periodic') {
      renderPeriodicOrbits(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'fibonacci') {
      renderFibonacciRelation(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'properties') {
      renderMatrixProperties(g, innerWidth, innerHeight);
    }

    // Add axes for appropriate visualizations
    if (visualizationType !== 'properties' && visualizationType !== 'fibonacci') {
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
      g.append('text')
        .attr('transform', `translate(${innerWidth/2}, ${innerHeight + 40})`)
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .text('x');

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (innerHeight / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .text('y');
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

  }, [initialX, initialY, iterations, visualizationType, gridSize, gridIterations, animationStep, isAnimating]);

  return (
    <div className="p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Arnold Cat Map Visualization</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Initial x₀: {initialX.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.01"
              max="0.99"
              step="0.01"
              value={initialX}
              onChange={(e) => setInitialX(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Initial y₀: {initialY.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.01"
              max="0.99"
              step="0.01"
              value={initialY}
              onChange={(e) => setInitialY(parseFloat(e.target.value))}
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

          {visualizationType === 'grid' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Grid Size: {gridSize}×{gridSize}
                </label>
                <input
                  type="range"
                  min="8"
                  max="32"
                  step="4"
                  value={gridSize}
                  onChange={(e) => setGridSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Grid Iterations: {isAnimating ? animationStep + 1 : gridIterations}
                </label>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={isAnimating ? animationStep + 1 : gridIterations}
                  onChange={(e) => setGridIterations(parseInt(e.target.value))}
                  disabled={isAnimating}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Visualization Type
            </label>
            <select
              value={visualizationType}
              onChange={(e) => setVisualizationType(e.target.value)}
              className="w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40"
            >
              <option value="trajectory">Trajectory</option>
              <option value="grid">Grid Transformation</option>
              <option value="scrambling">Image Scrambling</option>
              <option value="periodic">Periodic Orbits</option>
              <option value="fibonacci">Fibonacci Relation</option>
              <option value="properties">Matrix Properties</option>
            </select>
          </div>

          {(visualizationType === 'scrambling' || visualizationType === 'grid') && (
            <button
              onClick={toggleAnimation}
              className="w-full p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              {isAnimating ? 'Stop Animation' : 'Start Animation'}
            </button>
          )}

          {/* Eigenvalues Display */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">Eigenvalues:</p>
            <p className="text-xs text-gray-300 font-mono">
              λ₁ = {calculateArnoldEigenvalues().lambda1.toFixed(4)} (Golden Ratio)
            </p>
            <p className="text-xs text-gray-300 font-mono">
              λ₂ = {calculateArnoldEigenvalues().lambda2.toFixed(4)}
            </p>
          </div>

          {/* Equation Display */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">Equations:</p>
            <p className="text-xs text-gray-300 font-mono">
              xₙ₊₁ = (xₙ + yₙ) mod 1
            </p>
            <p className="text-xs text-gray-300 font-mono">
              yₙ₊₁ = (xₙ + 2·yₙ) mod 1
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

export default ArnoldMapVisualization;