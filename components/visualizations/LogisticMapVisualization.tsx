"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const LogisticMapVisualization: React.FC = () => {
  const [r, setR] = useState(3.5);
  const [x0, setX0] = useState(0.5);
  const [iterations, setIterations] = useState(50);
  const [visualizationType, setVisualizationType] = useState('cobweb');
  const [zoomLevel, setZoomLevel] = useState(1);

  const svgRef = useRef<SVGSVGElement>(null);

  const width = 800;
  const height = 600;
  // Simple theme system
  const themes = {
    matplotlib: { primary: '#1f77b4', secondary: '#ff7f0e', tertiary: '#2ca02c', background: '#ffffff', grid: '#e0e0e0', text: '#333333', axis: '#666666' },
    seaborn: { primary: '#4c72b0', secondary: '#dd8452', tertiary: '#55a868', background: '#fafafa', grid: '#e8e8e8', text: '#2c2c2c', axis: '#7f7f7f' },
    neon: { primary: '#00ffff', secondary: '#ff00ff', tertiary: '#ffff00', background: '#0a0a0a', grid: '#1a1a1a', text: '#ffffff', axis: '#666666' },
    scientific: { primary: '#0d47a1', secondary: '#c62828', tertiary: '#2e7d32', background: '#ffffff', grid: '#f5f5f5', text: '#212121', axis: '#616161' }
  };

  const [currentTheme, setCurrentTheme] = useState('matplotlib');
  const theme = themes[currentTheme as keyof typeof themes];

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);

    // Set margins
    const margin = { top: 40, right: 20, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create main group for the visualization
    const mainGroup = svg.append('g')
      .attr('data-data', 'true')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add background
    mainGroup.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', theme.background)
      .attr('rx', 5)
      .attr('data-background', 'true');
    
    // Create scales
    let xScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, innerWidth]);
    
    let yScale = d3.scaleLinear()
      .domain([0, 1])
      .range([innerHeight, 0]);
    
    // Render based on visualization type
    if (visualizationType === 'cobweb') {
      renderCobweb(mainGroup, innerWidth, innerHeight, xScale, yScale);
    } else if (visualizationType === 'time') {
      const timeScale = d3.scaleLinear()
        .domain([0, iterations])
        .range([0, innerWidth]);
      renderTimeSeries(mainGroup, innerWidth, innerHeight, timeScale, yScale);
      xScale = timeScale;
    } else if (visualizationType === 'bifurcation') {
      const rScale = d3.scaleLinear()
        .domain([2.5, 4.0])
        .range([0, innerWidth]);
      renderBifurcation(mainGroup, innerWidth, innerHeight, rScale, yScale);
      xScale = rScale; // Update for axis
    }
    
    // Add grid
    mainGroup.append('g')
      .attr('class', 'grid')
      .selectAll('grid-line-x')
      .data(xScale.ticks(10))
      .enter()
      .append('line')
      .attr('data-grid', 'true')
      .attr('x1', d => xScale(d))
      .attr('y1', 0)
      .attr('x2', d => xScale(d))
      .attr('y2', innerHeight)
      .attr('stroke', theme.grid)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');

    mainGroup.append('g')
      .attr('class', 'grid')
      .selectAll('grid-line-y')
      .data(yScale.ticks(10))
      .enter()
      .append('line')
      .attr('data-grid', 'true')
      .attr('x1', 0)
      .attr('y1', d => yScale(d))
      .attr('x2', innerWidth)
      .attr('y2', d => yScale(d))
      .attr('stroke', theme.grid)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');

    // Add axes
    mainGroup.append('g')
      .attr('data-axis', 'x')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text, line, path')
      .style('color', theme.axis);

    mainGroup.append('g')
      .attr('data-axis', 'y')
      .call(d3.axisLeft(yScale))
      .selectAll('text, line, path')
      .style('color', theme.axis);
    
    // Add axis labels
    const xLabel = visualizationType === 'time' ? 'Iteration' :
                   visualizationType === 'bifurcation' ? 'Parameter r' : 'x';

    mainGroup.append('text')
      .attr('data-label', 'x-axis')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .style('fill', theme.text)
      .style('font-size', '14px')
      .text(xLabel);

    mainGroup.append('text')
      .attr('data-label', 'y-axis')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .style('fill', theme.text)
      .style('font-size', '14px')
      .text(visualizationType === 'bifurcation' ? 'x' : 'f(x)');

    // Add title
    mainGroup.append('text')
      .attr('data-label', 'title')
      .attr('x', innerWidth / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .style('fill', theme.primary)
      .style('font-weight', 'bold')
      .style('font-size', '18px')
      .text(`Logistic Map (r = ${r.toFixed(2)})`);
    
    function renderCobweb(
      g: d3.Selection<SVGGElement, unknown, null, undefined>, 
      width: number, 
      height: number,
      xScale: d3.ScaleLinear<number, number>,
      yScale: d3.ScaleLinear<number, number>
    ) {
      // Logistic function
      const logistic = (x: number) => r * x * (1 - x);
      
      // Draw the logistic curve
      const curve = d3.line<number>()
        .x(d => xScale(d))
        .y(d => yScale(logistic(d)));
      
      const points = d3.range(0, 1.001, 0.01);
      
      g.append('path')
        .datum(points)
        .attr('fill', 'none')
        .attr('stroke', theme.primary)
        .attr('stroke-width', 2)
        .attr('d', curve);

      // Draw the diagonal line (y = x)
      g.append('line')
        .attr('x1', xScale(0))
        .attr('y1', yScale(0))
        .attr('x2', xScale(1))
        .attr('y2', yScale(1))
        .attr('stroke', theme.secondary)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5');
      
      // Calculate and draw the cobweb
      const cobwebPoints = [];
      let x = x0;
      
      for (let i = 0; i < Math.min(iterations, 20); i++) {
        const y = logistic(x);
        cobwebPoints.push({ x, y });
        x = y;
      }
      
      // Draw cobweb lines
      for (let i = 0; i < cobwebPoints.length - 1; i++) {
        // Vertical line
        g.append('line')
          .attr('x1', xScale(cobwebPoints[i].x))
          .attr('y1', yScale(cobwebPoints[i].y))
          .attr('x2', xScale(cobwebPoints[i].y))
          .attr('y2', yScale(cobwebPoints[i].y))
          .attr('stroke', theme.tertiary)
          .attr('stroke-width', 1.5);

        // Horizontal line
        if (i < cobwebPoints.length - 1) {
          g.append('line')
            .attr('x1', xScale(cobwebPoints[i].y))
            .attr('y1', yScale(cobwebPoints[i].y))
            .attr('x2', xScale(cobwebPoints[i].y))
            .attr('y2', yScale(cobwebPoints[i + 1] ? logistic(cobwebPoints[i].y) : cobwebPoints[i].y))
            .attr('stroke', theme.tertiary)
            .attr('stroke-width', 1.5);
        }
      }
    }
    
    function renderTimeSeries(
      g: d3.Selection<SVGGElement, unknown, null, undefined>, 
      width: number, 
      height: number,
      xScale: d3.ScaleLinear<number, number>,
      yScale: d3.ScaleLinear<number, number>
    ) {
      // Logistic function
      const logistic = (x: number) => r * x * (1 - x);
      
      // Calculate time series
      const timeSeriesPoints = [];
      let x = x0;
      
      for (let i = 0; i < iterations; i++) {
        timeSeriesPoints.push({ i, x });
        x = logistic(x);
      }
      
      // Create line generator
      const line = d3.line<{ i: number; x: number }>()
        .x(d => xScale(d.i))
        .y(d => yScale(d.x));
      
      // Add the line path
      g.append('path')
        .datum(timeSeriesPoints)
        .attr('fill', 'none')
        .attr('stroke', theme.primary)
        .attr('stroke-width', 2)
        .attr('d', line);

      // Add points
      g.selectAll('.time-point')
        .data(timeSeriesPoints)
        .enter()
        .append('circle')
        .attr('class', 'time-point')
        .attr('cx', d => xScale(d.i))
        .attr('cy', d => yScale(d.x))
        .attr('r', 2)
        .attr('fill', theme.primary);
    }
    
    function renderBifurcation(
      g: d3.Selection<SVGGElement, unknown, null, undefined>, 
      width: number, 
      height: number,
      xScale: d3.ScaleLinear<number, number>,
      yScale: d3.ScaleLinear<number, number>
    ) {
      // For each r value, calculate the attractor
      const rValues = d3.range(2.5, 4.001, 0.01);
      const bifurcationPoints = [];
      
      for (const rVal of rValues) {
        // Logistic function for this r value
        const logistic = (x: number) => rVal * x * (1 - x);
        
        // Calculate the attractor
        let x = 0.5;
        
        // Discard transient
        for (let i = 0; i < 100; i++) {
          x = logistic(x);
        }
        
        // Collect attractor points
        for (let i = 0; i < 20; i++) {
          x = logistic(x);
          bifurcationPoints.push({ r: rVal, x });
        }
      }
      
      // Add points
      g.selectAll('.bifurcation-point')
        .data(bifurcationPoints)
        .enter()
        .append('circle')
        .attr('class', 'bifurcation-point')
        .attr('cx', d => xScale(d.r))
        .attr('cy', d => yScale(d.x))
        .attr('r', 0.5)
        .attr('fill', theme.primary)
        .attr('opacity', 0.7);

      // Add current r value line
      g.append('line')
        .attr('x1', xScale(r))
        .attr('y1', 0)
        .attr('x2', xScale(r))
        .attr('y2', height)
        .attr('stroke', theme.secondary)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
    }
    
  }, [r, x0, iterations, visualizationType, theme]);

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Theme Switcher */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold neon-text-cyan">Logistic Map Visualization</h1>
          <div className="flex items-center gap-4">
            <select
              value={currentTheme}
              onChange={(e) => setCurrentTheme(e.target.value)}
              className="bg-black/70 border border-cyan-500/30 rounded-sm px-4 py-2 text-white"
            >
              <option value="matplotlib">Matplotlib</option>
              <option value="seaborn">Seaborn</option>
              <option value="neon">Neon</option>
              <option value="scientific">Scientific</option>
            </select>
            <button
              onClick={() => alert('Export functionality coming soon!')}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1">
            <div className="bg-black/40 border border-cyan-500/20 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-bold neon-text-cyan">Parameters</h2>

              <div>
                <label className="block text-sm font-medium mb-2 text-cyan-400">
                  Parameter r: {r.toFixed(3)}
                </label>
                <input
                  type="range"
                  min="2.5"
                  max="4"
                  step="0.01"
                  value={r}
                  onChange={(e) => setR(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-cyan-400">
                  Initial Value x₀: {x0.toFixed(3)}
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="0.99"
                  step="0.01"
                  value={x0}
                  onChange={(e) => setX0(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-cyan-400">
                  Iterations: {iterations}
                </label>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="5"
                  value={iterations}
                  onChange={(e) => setIterations(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-cyan-400">
                  Visualization Type
                </label>
                <select
                  value={visualizationType}
                  onChange={(e) => setVisualizationType(e.target.value)}
                  className="w-full bg-black/50 border border-cyan-500/30 rounded-sm px-3 py-2 text-white"
                >
                  <option value="cobweb">Cobweb Plot</option>
                  <option value="time">Time Series</option>
                  <option value="bifurcation">Bifurcation Diagram</option>
                </select>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => setZoomLevel(1)}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-sm transition-colors text-sm"
                >
                  Reset View
                </button>
                <button
                  onClick={() => alert('Pan and zoom coming soon!')}
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-sm transition-colors text-sm"
                >
                  Pan & Zoom
                </button>
              </div>
            </div>
          </div>

          {/* Visualization */}
          <div className="lg:col-span-3">
            <div className="bg-black/40 border border-cyan-500/20 rounded-lg p-6">
              <div className="flex justify-center">
                <div className="border border-cyan-500/20 rounded-sm">
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full"
                    style={{ maxWidth: width * zoomLevel, aspectRatio: `${width}/${height}` }}
                  />
                </div>
              </div>

              {/* Visualization Info */}
              <div className="mt-4 text-center text-sm text-gray-400">
                <p>Interactive Controls: Adjust parameters using controls panel • Themes change colors</p>
                <p className="mt-1">Current Theme: {currentTheme} • Zoom: {Math.round(zoomLevel * 100)}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticMapVisualization;