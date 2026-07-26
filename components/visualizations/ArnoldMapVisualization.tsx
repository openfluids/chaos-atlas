"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  calculateArnoldMap,
  calculateArnoldGridTransform,
  calculateArnoldImageScrambling,
  calculateArnoldPeriodicOrbits,
  calculateArnoldEigenvalues,
  calculateArnoldLyapunov,
  calculateArnoldMatrixProperties,
  calculateArnoldFibonacciRelation,
  calculateArnoldIteration
} from '@/lib/maps/arnold';
import { ParamSlider } from '@/components/ui/ParamSlider';
import { ViewModeSelect } from '@/components/ui/ViewModeSelect';
import { useSteppedAnimation } from '@/hooks/useSteppedAnimation';
import {
  initChartBase,
  equalAspectScales,
  createClippedDataGroup,
  renderChartAxes,
  renderAxisLabelsRotated,
  renderChartTitle,
} from './chartHelpers';

const ArnoldMapVisualization: React.FC = () => {
  const [initialX, setInitialX] = useState(0.3);
  const [initialY, setInitialY] = useState(0.3);
  const [iterations, setIterations] = useState(50);
  const [gridSize, setGridSize] = useState(16);
  const [gridIterations, setGridIterations] = useState(1);
  const [visualizationType, setVisualizationType] = useState('trajectory');
  const [isAnimating, setIsAnimating] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 600;
  const height = 400;

  const animationPlaying =
    isAnimating &&
    (visualizationType === 'scrambling' || visualizationType === 'grid');

  const { step: animationStep, reset: resetAnimation } = useSteppedAnimation({
    playing: animationPlaying,
    periodMs: 800,
    modulus: 12,
  });

  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
    if (!isAnimating) resetAnimation();
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
                                plotWidth: number, plotHeight: number,
                                offsetX: number, offsetY: number) => {
      const data = calculateArnoldGridTransform(gridSize, isAnimating ? animationStep + 1 : gridIterations);
      // The cat map's grid is a discretized unit square: square cells,
      // not cells stretched to a 520x300 box.
      const cellWidth = plotWidth / gridSize;
      const cellHeight = plotHeight / gridSize;

      // Create color scale
      const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, gridSize * gridSize]);

      data.forEach((row, y) => {
        row.forEach((value, x) => {
          g.append('rect')
            .attr('x', offsetX + x * cellWidth)
            .attr('y', offsetY + y * cellHeight)
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
                                 xScale: d3.ScaleLinear<number, number>,
                                 yScale: d3.ScaleLinear<number, number>,
                                 plotWidth: number, plotHeight: number) => {
      const frames = calculateArnoldImageScrambling(24, 24, 12);
      const currentFrame = frames[animationStep];

      currentFrame.forEach(row => {
        row.forEach(point => {
          g.append('rect')
            .attr('x', xScale(point.x) - plotWidth / 48)
            .attr('y', yScale(point.y) - plotHeight / 48)
            .attr('width', plotWidth / 24)
            .attr('height', plotHeight / 24)
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
                                    _xScale: d3.ScaleLinear<number, number>,
                                    _yScale: d3.ScaleLinear<number, number>) => {
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
        { label: 'λ₁ = φ²', value: lambda1.toFixed(6) },
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

    const chart = initChartBase(svgRef, width, height, { background: 'rgba(0, 0, 0, 0.1)' });
    if (!chart) return;
    const { svg, g, margin, innerWidth, innerHeight } = chart;

    // The Arnold cat map is *defined* by area preservation on the unit
    // torus [0,1]^2 -- drawing it at the chart's native 520x300 aspect
    // visibly shears its eigendirections. equalAspectScales letterboxes to
    // a square plot rect instead of fitting x and y independently.
    const { xScale, yScale, plotWidth, plotHeight, offsetX, offsetY } =
      equalAspectScales([0, 1], [0, 1], innerWidth, innerHeight);

    const squareViews = visualizationType === 'trajectory' || visualizationType === 'grid' ||
      visualizationType === 'scrambling' || visualizationType === 'periodic';
    const dataGroup = squareViews
      ? createClippedDataGroup(
          svg,
          g,
          { x: offsetX, y: offsetY, width: plotWidth, height: plotHeight },
          'arnold-plot-clip'
        )
      : g;

    // Render based on visualization type
    if (visualizationType === 'trajectory') {
      renderTrajectory(dataGroup, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'grid') {
      renderGridTransform(dataGroup, plotWidth, plotHeight, offsetX, offsetY);
    } else if (visualizationType === 'scrambling') {
      renderImageScrambling(dataGroup, xScale, yScale, plotWidth, plotHeight);
    } else if (visualizationType === 'periodic') {
      renderPeriodicOrbits(dataGroup, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'fibonacci') {
      renderFibonacciRelation(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'properties') {
      renderMatrixProperties(g, innerWidth, innerHeight);
    }

    // Add axes for appropriate visualizations
    if (visualizationType !== 'properties' && visualizationType !== 'fibonacci') {
      renderChartAxes(g, xScale, yScale, innerHeight, offsetX, offsetY);
      renderAxisLabelsRotated(g, innerWidth, innerHeight, margin.left, 'x', 'y');
    }

    // Add title
    renderChartTitle(g, innerWidth, getVisualizationTitle());

  }, [initialX, initialY, iterations, visualizationType, gridSize, gridIterations, animationStep, isAnimating]);

  return (
    <div className="p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Arnold Cat Map Visualization</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <ParamSlider
            label={<>Initial x₀: {initialX.toFixed(2)}</>}
            min={0.01}
            max={0.99}
            step={0.01}
            value={initialX}
            onChange={setInitialX}
          />

          <ParamSlider
            label={<>Initial y₀: {initialY.toFixed(2)}</>}
            min={0.01}
            max={0.99}
            step={0.01}
            value={initialY}
            onChange={setInitialY}
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

          {visualizationType === 'grid' && (
            <>
              <ParamSlider
                label={<>Grid Size: {gridSize}×{gridSize}</>}
                min={8}
                max={32}
                step={4}
                value={gridSize}
                onChange={setGridSize}
                parse={parseInt}
              />
              <ParamSlider
                label={<>Grid Iterations: {isAnimating ? animationStep + 1 : gridIterations}</>}
                min={1}
                max={12}
                step={1}
                value={isAnimating ? animationStep + 1 : gridIterations}
                onChange={setGridIterations}
                parse={parseInt}
                disabled={isAnimating}
              />
            </>
          )}

          <ViewModeSelect
            label="Visualization Type"
            value={visualizationType}
            onChange={setVisualizationType}
            options={[
              { value: 'trajectory', label: 'Trajectory' },
              { value: 'grid', label: 'Grid Transformation' },
              { value: 'scrambling', label: 'Image Scrambling' },
              { value: 'periodic', label: 'Periodic Orbits' },
              { value: 'fibonacci', label: 'Fibonacci Relation' },
              { value: 'properties', label: 'Matrix Properties' },
            ]}
          />

          {(visualizationType === 'scrambling' || visualizationType === 'grid') && (
            <button
              onClick={toggleAnimation}
              data-testid="animation-step"
              data-step={animationStep}
              className="w-full p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              {isAnimating ? 'Stop Animation' : 'Start Animation'}
            </button>
          )}

          {/* Eigenvalues Display */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">Eigenvalues:</p>
            <p className="text-xs text-gray-300 font-mono">
              λ₁ = {calculateArnoldEigenvalues().lambda1.toFixed(4)} = φ²
            </p>
            <p className="text-xs text-gray-300 font-mono">
              λ₂ = {calculateArnoldEigenvalues().lambda2.toFixed(4)}
            </p>
            <p className="text-xs text-gray-300 font-mono">
              λ_max = ln λ₁ = {calculateArnoldLyapunov().toFixed(6)}
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