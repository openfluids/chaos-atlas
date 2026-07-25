"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ParamSlider } from '@/components/ui/ParamSlider';
import {
  initChartBase,
  renderChartAxes,
  renderAxisLabelsPlain,
  renderChartTitleAccent,
} from './chartHelpers';

const HenonMapVisualization: React.FC = () => {
  const [a, setA] = useState(1.4);
  const [b, setB] = useState(0.3);
  const [x0, setX0] = useState(0);
  const [y0, setY0] = useState(0);
  const [iterations, setIterations] = useState(1000);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const width = 600;
  const height = 400;
  
  useEffect(() => {
    const chart = initChartBase(svgRef, width, height);
    if (!chart) return;
    const { g, innerWidth, innerHeight } = chart;

    // Calculate Henon map
    const points = [];
    let x = x0;
    let y = y0;
    
    // Skip transients
    for (let i = 0; i < 100; i++) {
      const xNext = 1 - a * x * x + y;
      const yNext = b * x;
      x = xNext;
      y = yNext;
    }
    
    // Collect attractor points
    for (let i = 0; i < iterations; i++) {
      points.push({ x, y });
      const xNext = 1 - a * x * x + y;
      const yNext = b * x;
      x = xNext;
      y = yNext;
    }
    
    // Find data bounds
    const xExtent = d3.extent(points, d => d.x) as [number, number];
    const yExtent = d3.extent(points, d => d.y) as [number, number];
    
    // Create scales
    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([0, innerWidth]);
    
    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([innerHeight, 0]);
    
    // Add points
    g.selectAll('.henon-point')
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'henon-point')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', 1)
      .attr('fill', 'var(--viz-primary)')
      .attr('opacity', 0.6);
    
    // Add axes
    renderChartAxes(g, xScale, yScale, innerHeight);

    // Add axis labels
    renderAxisLabelsPlain(g, innerWidth, innerHeight, 'x', 'y');

    // Add title
    renderChartTitleAccent(g, innerWidth, `Hénon Map (a = ${a.toFixed(2)}, b = ${b.toFixed(2)})`);

  }, [a, b, x0, y0, iterations]);
  
  return (
    <div className="henon-map-visualization p-6">
      {/* Controls */}
      <div className="controls mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <ParamSlider
          label={<>Parameter a: {a.toFixed(3)}</>}
          min={0.5}
          max={2.0}
          step={0.01}
          value={a}
          onChange={setA}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          label={<>Parameter b: {b.toFixed(3)}</>}
          min={0.1}
          max={0.5}
          step={0.01}
          value={b}
          onChange={setB}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          label={<>Initial x₀: {x0.toFixed(3)}</>}
          min={-1}
          max={1}
          step={0.01}
          value={x0}
          onChange={setX0}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          label={<>Initial y₀: {y0.toFixed(3)}</>}
          min={-1}
          max={1}
          step={0.01}
          value={y0}
          onChange={setY0}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          label={<>Iterations: {iterations}</>}
          min={500}
          max={5000}
          step={100}
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
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full border rounded-lg"
          style={{ borderColor: 'var(--border-primary)', maxWidth: width, aspectRatio: `${width}/${height}` }}
        />
      </div>
      
      {/* Info */}
      <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>The Hénon map exhibits a strange attractor for the classic values a=1.4, b=0.3.</p>
        <p>Each point represents one iteration of the map in phase space.</p>
      </div>
    </div>
  );
};

export default HenonMapVisualization;