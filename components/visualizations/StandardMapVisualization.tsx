"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ParamSlider } from '@/components/ui/ParamSlider';
import {
  initChartBase,
  equalAspectScales,
  createClippedDataGroup,
  renderAxisLabelsPlain,
  renderChartTitleAccent,
} from './chartHelpers';

const StandardMapVisualization: React.FC = () => {
  const [K, setK] = useState(1.2);
  const [p0, setP0] = useState(1.0);
  const [theta0, setTheta0] = useState(0.5);
  const [iterations, setIterations] = useState(1000);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const width = 600;
  const height = 400;
  
  useEffect(() => {
    const chart = initChartBase(svgRef, width, height);
    if (!chart) return;
    const { svg, g, innerWidth, innerHeight } = chart;

    // Calculate Standard map
    const points = [];
    let p = p0;
    let theta = theta0;

    // Collect points
    for (let i = 0; i < iterations; i++) {
      points.push({ theta: theta % (2 * Math.PI), p: p % (2 * Math.PI) });

      // Standard map iteration
      const pNext = (p + K * Math.sin(theta)) % (2 * Math.PI);
      const thetaNext = (theta + pNext) % (2 * Math.PI);

      p = pNext;
      theta = thetaNext;
    }

    // θ and p both live on [0, 2π): the Chirikov standard map's KAM islands
    // are only recognizably round if that square domain is drawn at 1:1
    // pixels-per-unit rather than fit independently to a wide box.
    const { xScale, yScale, plotWidth, plotHeight, offsetX, offsetY } =
      equalAspectScales([0, 2 * Math.PI], [0, 2 * Math.PI], innerWidth, innerHeight);

    const dataGroup = createClippedDataGroup(
      svg,
      g,
      { x: offsetX, y: offsetY, width: plotWidth, height: plotHeight },
      'standard-plot-clip'
    );

    // Add points
    dataGroup.selectAll('.standard-point')
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'standard-point')
      .attr('cx', d => xScale(d.theta))
      .attr('cy', d => yScale(d.p))
      .attr('r', 1.5)
      .attr('fill', 'var(--viz-primary)')
      .attr('opacity', 0.6);

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d => `${(d as number / Math.PI).toFixed(1)}π`))
      .selectAll('text, line, path')
      .style('color', 'var(--text-secondary)');

    g.append('g')
      .call(d3.axisLeft(yScale).tickFormat(d => `${(d as number / Math.PI).toFixed(1)}π`))
      .selectAll('text, line, path')
      .style('color', 'var(--text-secondary)');

    // Add axis labels
    renderAxisLabelsPlain(g, innerWidth, innerHeight, 'θ', 'p');

    // Add title
    renderChartTitleAccent(g, innerWidth, `Standard Map (K = ${K.toFixed(2)})`);

  }, [K, p0, theta0, iterations]);
  
  return (
    <div className="standard-map-visualization p-6">
      {/* Controls */}
      <div className="controls mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <ParamSlider
          label={<>Parameter K: {K.toFixed(3)}</>}
          min={0}
          max={5}
          step={0.1}
          value={K}
          onChange={setK}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          label={<>Initial p₀: {p0.toFixed(3)}</>}
          min={0}
          max={2 * Math.PI}
          step={0.1}
          value={p0}
          onChange={setP0}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          label={<>Initial θ₀: {theta0.toFixed(3)}</>}
          min={0}
          max={2 * Math.PI}
          step={0.1}
          value={theta0}
          onChange={setTheta0}
          className="w-full"
          labelClassName="block text-sm mb-2"
          labelStyle={{ color: 'var(--text-secondary)' }}
        />

        <ParamSlider
          label={<>Iterations: {iterations}</>}
          min={100}
          max={2000}
          step={50}
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
        <p>The Standard Map is area-preserving and shows the transition from regular to chaotic motion.</p>
        <p>For K=0 the motion is regular, for larger K values chaos emerges.</p>
      </div>
    </div>
  );
};

export default StandardMapVisualization;