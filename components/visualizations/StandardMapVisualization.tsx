"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const StandardMapVisualization: React.FC = () => {
  const [K, setK] = useState(1.2);
  const [p0, setP0] = useState(1.0);
  const [theta0, setTheta0] = useState(0.5);
  const [iterations, setIterations] = useState(1000);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const width = 600;
  const height = 400;
  
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
    
    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, 2 * Math.PI])
      .range([0, innerWidth]);
    
    const yScale = d3.scaleLinear()
      .domain([0, 2 * Math.PI])
      .range([innerHeight, 0]);
    
    // Add points
    g.selectAll('.standard-point')
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
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--text-secondary)')
      .text('θ');
    
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--text-secondary)')
      .text('p');
    
    // Add title
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--text-accent)')
      .style('font-weight', 'bold')
      .text(`Standard Map (K = ${K.toFixed(2)})`);
    
  }, [K, p0, theta0, iterations]);
  
  return (
    <div className="standard-map-visualization p-6">
      {/* Controls */}
      <div className="controls mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Parameter K: {K.toFixed(3)}
          </label>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={K}
            onChange={(e) => setK(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Initial p₀: {p0.toFixed(3)}
          </label>
          <input
            type="range"
            min="0"
            max={2 * Math.PI}
            step="0.1"
            value={p0}
            onChange={(e) => setP0(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Initial θ₀: {theta0.toFixed(3)}
          </label>
          <input
            type="range"
            min="0"
            max={2 * Math.PI}
            step="0.1"
            value={theta0}
            onChange={(e) => setTheta0(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Iterations: {iterations}
          </label>
          <input
            type="range"
            min="100"
            max="2000"
            step="50"
            value={iterations}
            onChange={(e) => setIterations(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
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