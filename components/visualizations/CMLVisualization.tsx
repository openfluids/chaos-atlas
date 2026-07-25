"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const CMLVisualization: React.FC = () => {
  const [epsilon, setEpsilon] = useState(0.3);
  const [r, setR] = useState(3.8);
  const [latticeSize, setLatticeSize] = useState(50);
  const [timeSteps, setTimeSteps] = useState(100);
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
    
    // Initialize lattice with random values
    let lattice = Array.from({ length: latticeSize }, () => Math.random());
    
    // CML function (logistic map)
    const logistic = (x: number) => r * x * (1 - x);
    
    // Calculate CML evolution
    const history = [lattice.slice()];
    
    for (let t = 0; t < timeSteps; t++) {
      const newLattice = new Array(latticeSize);
      
      for (let i = 0; i < latticeSize; i++) {
        const left = lattice[(i - 1 + latticeSize) % latticeSize];
        const right = lattice[(i + 1) % latticeSize];
        const current = lattice[i];
        
        // Diffusive coupling
        const localValue = logistic(current);
        const coupledValue = (epsilon / 2) * (logistic(left) + logistic(right));
        
        newLattice[i] = (1 - epsilon) * localValue + coupledValue;
      }
      
      lattice = newLattice;
      history.push(lattice.slice());
    }
    
    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, latticeSize - 1])
      .range([0, innerWidth]);
    
    const yScale = d3.scaleLinear()
      .domain([0, timeSteps])
      .range([0, innerHeight]);
    
    const colorScale = d3.scaleSequential(d3.interpolateViridis)
      .domain([0, 1]);
    
    // Create heat map
    const cellWidth = innerWidth / latticeSize;
    const cellHeight = innerHeight / timeSteps;
    
    for (let t = 0; t < history.length; t++) {
      for (let i = 0; i < latticeSize; i++) {
        g.append('rect')
          .attr('x', i * cellWidth)
          .attr('y', t * cellHeight)
          .attr('width', cellWidth)
          .attr('height', cellHeight)
          .attr('fill', colorScale(history[t][i]))
          .attr('stroke', 'none');
      }
    }
    
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
    
    // Add axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--text-secondary)')
      .text('Lattice Site');
    
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--text-secondary)')
      .text('Time Step');
    
    // Add title
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--text-accent)')
      .style('font-weight', 'bold')
      .text(`CML (ε = ${epsilon.toFixed(2)}, r = ${r.toFixed(2)})`);
    
  }, [epsilon, r, latticeSize, timeSteps]);
  
  return (
    <div className="cml-visualization p-6">
      {/* Controls */}
      <div className="controls mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Coupling ε: {epsilon.toFixed(3)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={epsilon}
            onChange={(e) => setEpsilon(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Parameter r: {r.toFixed(3)}
          </label>
          <input
            type="range"
            min="2.5"
            max="4"
            step="0.01"
            value={r}
            onChange={(e) => setR(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Lattice Size: {latticeSize}
          </label>
          <input
            type="range"
            min="20"
            max="100"
            step="5"
            value={latticeSize}
            onChange={(e) => setLatticeSize(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Time Steps: {timeSteps}
          </label>
          <input
            type="range"
            min="50"
            max="200"
            step="10"
            value={timeSteps}
            onChange={(e) => setTimeSteps(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
      
      {/* Visualization */}
      <div className="visualization-wrapper flex justify-center">
        <svg 
          ref={svgRef} 
          width={width} 
          height={height} 
          className="border rounded-lg"
          style={{ borderColor: 'var(--border-primary)' }}
        />
      </div>
      
      {/* Info */}
      <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>This heat map shows the spatiotemporal evolution of a coupled map lattice.</p>
        <p>Bright colors indicate higher values, dark colors indicate lower values.</p>
      </div>
    </div>
  );
};

export default CMLVisualization;