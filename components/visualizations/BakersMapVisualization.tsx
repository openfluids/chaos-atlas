"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  calculateBakersMap,
  calculateBakersMixing,
  calculateBakersSymbolicDynamics,
  calculateBakersImageScrambling,
  calculateBakersInvariantMeasure,
  calculateBakersTopologicalEntropy,
  calculateBakersPhaseSpacePartition
} from '@/lib/maps/bakers';
import { ParamSlider } from '@/components/ui/ParamSlider';
import { ViewModeSelect } from '@/components/ui/ViewModeSelect';
import {
  initChartBase,
  renderChartAxes,
  renderAxisLabelsRotated,
  renderChartTitle,
} from './chartHelpers';

const BakersMapVisualization: React.FC = () => {
  const [initialX, setInitialX] = useState(0.3);
  const [initialY, setInitialY] = useState(0.3);
  const [iterations, setIterations] = useState(50);
  const [visualizationType, setVisualizationType] = useState('trajectory');
  const [mixingPoints, setMixingPoints] = useState(20);
  const [animationStep, setAnimationStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  const width = 600;
  const height = 400;

  // Animation control
  useEffect(() => {
    if (isAnimating && visualizationType === 'scrambling') {
      animationRef.current = setInterval(() => {
        setAnimationStep(prev => (prev + 1) % 10);
      }, 500);
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
      const data = calculateBakersMap({ x: initialX, y: initialY }, iterations);

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
        .attr('opacity', (d, i) => 0.3 + (0.7 * i / data.length)); // Fade in
    };

    const renderMixing = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                         innerWidth: number, innerHeight: number,
                         xScale: d3.ScaleLinear<number, number>,
                         yScale: d3.ScaleLinear<number, number>) => {
      const trajectories = calculateBakersMixing(mixingPoints, iterations);

      // Color scale for different trajectories
      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

      trajectories.forEach((trajectory, trajIndex) => {
        const line = d3.line<{x: number, y: number}>()
          .x(d => xScale(d.x))
          .y(d => yScale(d.y))
          .curve(d3.curveLinear);

        g.append('path')
          .datum(trajectory)
          .attr('fill', 'none')
          .attr('stroke', colorScale(trajIndex.toString()) as string)
          .attr('stroke-width', 1)
          .attr('opacity', 0.6)
          .attr('d', line);

        // Add initial points
        if (trajectory.length > 0) {
          g.append('circle')
            .attr('cx', xScale(trajectory[0].x))
            .attr('cy', yScale(trajectory[0].y))
            .attr('r', 3)
            .attr('fill', colorScale(trajIndex.toString()) as string);
        }
      });
    };

    const renderImageScrambling = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                 innerWidth: number, innerHeight: number,
                                 xScale: d3.ScaleLinear<number, number>,
                                 yScale: d3.ScaleLinear<number, number>) => {
      const frames = calculateBakersImageScrambling(16, 16, 10);
      const currentFrame = frames[animationStep];

      currentFrame.forEach(row => {
        row.forEach(point => {
          g.append('rect')
            .attr('x', xScale(point.x) - innerWidth / 32)
            .attr('y', yScale(point.y) - innerHeight / 32)
            .attr('width', innerWidth / 16)
            .attr('height', innerHeight / 16)
            .attr('fill', `rgb(${point.color.r}, ${point.color.g}, ${point.color.b})`)
            .attr('stroke', 'none')
            .attr('opacity', 0.8);
        });
      });
    };

    const renderInvariantMeasure = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                   innerWidth: number, innerHeight: number,
                                   _xScale: d3.ScaleLinear<number, number>,
                                   _yScale: d3.ScaleLinear<number, number>) => {
      const data = calculateBakersInvariantMeasure(5000, 20);
      const binWidth = innerWidth / 20;
      const binHeight = innerHeight / 20;

      data.forEach((row, y) => {
        row.forEach((value, x) => {
          g.append('rect')
            .attr('x', x * binWidth)
            .attr('y', y * binHeight)
            .attr('width', binWidth)
            .attr('height', binHeight)
            .attr('fill', 'var(--accent-cyan)')
            .attr('opacity', value)
            .attr('stroke', 'var(--text-secondary)')
            .attr('stroke-width', 0.5);
        });
      });
    };

    const renderPhaseSpacePartition = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                      innerWidth: number, innerHeight: number,
                                      xScale: d3.ScaleLinear<number, number>,
                                      _yScale: d3.ScaleLinear<number, number>) => {
      const { grid } = calculateBakersPhaseSpacePartition(16);
      const binWidth = innerWidth / 16;
      const binHeight = innerHeight / 16;

      grid.forEach((row, y) => {
        row.forEach((value, x) => {
          g.append('rect')
            .attr('x', x * binWidth)
            .attr('y', y * binHeight)
            .attr('width', binWidth)
            .attr('height', binHeight)
            .attr('fill', value === 0 ? 'var(--accent-cyan)' : 'var(--accent-orange)')
            .attr('opacity', 0.6)
            .attr('stroke', 'var(--text-secondary)')
            .attr('stroke-width', 0.5);
        });
      });

      // Add partition boundary
      g.append('line')
        .attr('x1', xScale(0.5))
        .attr('y1', 0)
        .attr('x2', xScale(0.5))
        .attr('y2', innerHeight)
        .attr('stroke', 'var(--text-primary)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
    };

    const renderSymbolicDynamics = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                   innerWidth: number, innerHeight: number,
                                   xScale: d3.ScaleLinear<number, number>,
                                   yScale: d3.ScaleLinear<number, number>) => {
      const symbols = calculateBakersSymbolicDynamics({ x: initialX, y: initialY }, 50);
      const data = calculateBakersMap({ x: initialX, y: initialY }, 50);

      // Draw trajectory
      const line = d3.line<{x: number, y: number}>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.5)
        .attr('d', line);

      // Add symbols at points
      g.selectAll('text')
        .data(data.slice(0, Math.min(20, data.length))) // Limit text display
        .enter()
        .append('text')
        .attr('x', d => xScale(d.x))
        .attr('y', d => yScale(d.y))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .text((d, i) => symbols[i]);
    };

    const getVisualizationTitle = () => {
      switch (visualizationType) {
        case 'trajectory': return "Baker's Map Trajectory";
        case 'mixing': return 'Mixing Behavior';
        case 'scrambling': return 'Image Scrambling';
        case 'invariant': return 'Invariant Measure';
        case 'partition': return 'Phase Space Partition';
        case 'symbolic': return 'Symbolic Dynamics';
        default: return "Baker's Map Visualization";
      }
    };

    const chart = initChartBase(svgRef, width, height, { background: 'rgba(0, 0, 0, 0.1)' });
    if (!chart) return;
    const { g, margin, innerWidth, innerHeight } = chart;

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
    } else if (visualizationType === 'mixing') {
      renderMixing(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'scrambling') {
      renderImageScrambling(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'invariant') {
      renderInvariantMeasure(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'partition') {
      renderPhaseSpacePartition(g, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'symbolic') {
      renderSymbolicDynamics(g, innerWidth, innerHeight, xScale, yScale);
    }

    // Add axes
    renderChartAxes(g, xScale, yScale, innerHeight);

    // Add axis labels
    renderAxisLabelsRotated(g, innerWidth, innerHeight, margin.left, 'x', 'y');

    // Add title
    renderChartTitle(g, innerWidth, getVisualizationTitle());

  }, [initialX, initialY, iterations, visualizationType, mixingPoints, animationStep]);

  return (
    <div className="p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Baker&apos;s Map Visualization</h3>

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

          {visualizationType === 'mixing' && (
            <ParamSlider
              label={<>Mixing Points: {mixingPoints}</>}
              min={5}
              max={50}
              step={5}
              value={mixingPoints}
              onChange={setMixingPoints}
              parse={parseInt}
            />
          )}

          <ViewModeSelect
            label="Visualization Type"
            value={visualizationType}
            onChange={setVisualizationType}
            options={[
              { value: 'trajectory', label: 'Single Trajectory' },
              { value: 'mixing', label: 'Mixing Behavior' },
              { value: 'scrambling', label: 'Image Scrambling' },
              { value: 'invariant', label: 'Invariant Measure' },
              { value: 'partition', label: 'Phase Space Partition' },
              { value: 'symbolic', label: 'Symbolic Dynamics' },
            ]}
          />

          {visualizationType === 'scrambling' && (
            <button
              onClick={toggleAnimation}
              className="w-full p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              {isAnimating ? 'Stop Animation' : 'Start Animation'}
            </button>
          )}

          {/* Topological Entropy Display */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm text-gray-300">
              <span className="font-medium text-cyan-400">Topological Entropy:</span> {calculateBakersTopologicalEntropy().toFixed(4)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Exact value: ln(2) - represents exponential mixing rate
            </p>
          </div>

          {/* Equation Display */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">Equations:</p>
            <p className="text-xs text-gray-300 font-mono">
              xₙ₊₁ = 2·xₙ (mod 1)
            </p>
            <p className="text-xs text-gray-300 font-mono">
              yₙ₊₁ = {initialX < 0.5 ? 'yₙ/2' : '(yₙ + 1)/2'}
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

export default BakersMapVisualization;