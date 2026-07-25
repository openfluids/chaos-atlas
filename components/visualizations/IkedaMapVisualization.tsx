"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useHydrated } from '@/hooks/useHydrated';
import {
  calculateIkedaAttractor,
  calculateIkedaBifurcation,
  calculateIkedaTimeEvolution,
  calculateIkedaLyapunovExponents,
  getInterestingIkedaParameters,
  calculateIkedaPowerSpectrum,
  calculateIkedaReturnMap
} from '@/lib/maps/ikeda';
import { ParamSlider } from '@/components/ui/ParamSlider';
import { ViewModeSelect } from '@/components/ui/ViewModeSelect';
import { initChartBase, renderAxisLabelsRotated, renderChartTitle } from './chartHelpers';

const IkedaMapVisualization: React.FC = () => {
  const [selectedParams, setSelectedParams] = useState(0);
  const [iterations, setIterations] = useState(2000);
  const [visualizationType, setVisualizationType] = useState('attractor');
  const [bifurcationParam, setBifurcationParam] = useState<'a' | 'b' | 'c' | 'd'>('b');
  const [animationStep, setAnimationStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  // Lyapunov exponents come from a chaotic iteration whose result can differ
  // in the last ULP between the build-time and browser JS engines, so they are
  // rendered only after hydration. See hooks/useHydrated.
  const hydrated = useHydrated();
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  const width = 600;
  const height = 400;

  const parameters = useMemo(() => getInterestingIkedaParameters(), []);
  const currentParams = parameters[selectedParams];

  // Pure function of currentParams, so derived during render instead of being
  // written into state by an effect.
  const lyapunovExponents = useMemo(
    () => calculateIkedaLyapunovExponents(currentParams.params, 2000),
    [currentParams]
  );

  // Animation control
  useEffect(() => {
    if (isAnimating && visualizationType === 'time') {
      animationRef.current = setInterval(() => {
        setAnimationStep(prev => (prev + 1) % iterations);
      }, 50);
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
  }, [isAnimating, visualizationType, iterations]);


  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
    if (!isAnimating) {
      setAnimationStep(0);
    }
  };

  useEffect(() => {
    const renderAttractor = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                            innerWidth: number, innerHeight: number) => {
      const data = calculateIkedaAttractor(currentParams.params, iterations);

      // Create color scale based on iteration order
      const colorScale = d3.scaleSequential(d3.interpolatePlasma)
        .domain([0, iterations]);

      // Create radius scale for points
      const radiusScale = d3.scaleLinear()
        .domain([0, iterations])
        .range([0.5, 2]);

      g.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', d => {
          const scale = d3.scaleLinear().domain([-2, 2]).range([0, innerWidth]);
          return scale(d.x);
        })
        .attr('cy', d => {
          const scale = d3.scaleLinear().domain([-2, 2]).range([innerHeight, 0]);
          return scale(d.y);
        })
        .attr('r', (d, i) => radiusScale(i))
        .attr('fill', (d, i) => colorScale(i))
        .attr('opacity', 0.7);
    };

    const renderTimeEvolution = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                               innerWidth: number, innerHeight: number) => {
      const data = calculateIkedaTimeEvolution(currentParams.params, iterations);
      const displayData = isAnimating ? data.slice(0, animationStep) : data;

      const xScale = d3.scaleLinear()
        .domain([0, iterations])
        .range([0, innerWidth]);

      const yScale = d3.scaleLinear()
        .domain([-2, 2])
        .range([innerHeight, 0]);

      // X coordinate evolution
      const xLine = d3.line<{time: number; x: number; y: number}>()
        .x(d => xScale(d.time))
        .y(d => yScale(d.x))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(displayData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 1.5)
        .attr('d', xLine);

      // Y coordinate evolution
      const yLine = d3.line<{time: number; x: number; y: number}>()
        .x(d => xScale(d.time))
        .y(d => yScale(d.y))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(displayData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 1.5)
        .attr('d', yLine);

      // Add current point indicator if animating
      if (isAnimating && displayData.length > 0) {
        const currentPoint = displayData[displayData.length - 1];

        g.append('circle')
          .attr('cx', xScale(currentPoint.time))
          .attr('cy', yScale(currentPoint.x))
          .attr('r', 4)
          .attr('fill', 'var(--accent-cyan)');

        g.append('circle')
          .attr('cx', xScale(currentPoint.time))
          .attr('cy', yScale(currentPoint.y))
          .attr('r', 4)
          .attr('fill', 'var(--accent-orange)');
      }
    };

    const renderBifurcation = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                              innerWidth: number, innerHeight: number) => {
      const paramRange = {
        min: bifurcationParam === 'b' ? 0.5 : 0.1,
        max: bifurcationParam === 'b' ? 1.2 : 1.5,
        step: 0.01
      };

      const fixedParams = { ...currentParams.params };
      delete (fixedParams as any)[bifurcationParam];

      const data = calculateIkedaBifurcation(bifurcationParam, paramRange, fixedParams, 500);

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
        .attr('fill', 'var(--accent-cyan)')
        .attr('opacity', 0.6);
    };

    const renderPhasePortrait = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                innerWidth: number, innerHeight: number) => {
      const data = calculateIkedaTimeEvolution(currentParams.params, Math.min(iterations, 1000));

      // Create phase portrait with trajectory
      const line = d3.line<{time: number; x: number; y: number}>()
        .x(d => {
          const scale = d3.scaleLinear().domain([-2, 2]).range([0, innerWidth]);
          return scale(d.x);
        })
        .y(d => {
          const scale = d3.scaleLinear().domain([-2, 2]).range([innerHeight, 0]);
          return scale(d.y);
        })
        .curve(d3.curveLinear);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 1)
        .attr('opacity', 0.8)
        .attr('d', line);

      // Add phase color coding
      const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, data.length]);

      g.selectAll('circle')
        .data(data.filter((d, i) => i % 10 === 0)) // Sample every 10th point
        .enter()
        .append('circle')
        .attr('cx', d => {
          const scale = d3.scaleLinear().domain([-2, 2]).range([0, innerWidth]);
          return scale(d.x);
        })
        .attr('cy', d => {
          const scale = d3.scaleLinear().domain([-2, 2]).range([innerHeight, 0]);
          return scale(d.y);
        })
        .attr('r', 2)
        .attr('fill', (d, i) => colorScale(i * 10));
    };

    const renderPowerSpectrum = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                innerWidth: number, innerHeight: number) => {
      const timeData = calculateIkedaTimeEvolution(currentParams.params, 1000);
      const spectrum = calculateIkedaPowerSpectrum(timeData);

      const xScale = d3.scaleLinear()
        .domain([0, d3.max(spectrum, d => d.frequency) || 0.5])
        .range([0, innerWidth]);

      const yScale = d3.scaleLinear()
        .domain([0, d3.max(spectrum, d => Math.max(d.powerX, d.powerY)) || 1])
        .range([innerHeight, 0]);

      // X component spectrum
      const xLine = d3.line<{frequency: number; powerX: number; powerY: number}>()
        .x(d => xScale(d.frequency))
        .y(d => yScale(d.powerX))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(spectrum)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 2)
        .attr('d', xLine);

      // Y component spectrum
      const yLine = d3.line<{frequency: number; powerX: number; powerY: number}>()
        .x(d => xScale(d.frequency))
        .y(d => yScale(d.powerY))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(spectrum)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 2)
        .attr('d', yLine);
    };

    const renderReturnMap = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                            innerWidth: number, innerHeight: number) => {
      const trajectory = calculateIkedaAttractor(currentParams.params, iterations);
      const returnPoints = calculateIkedaReturnMap(trajectory, 0);

      const xScale = d3.scaleLinear()
        .domain([-2, 2])
        .range([0, innerWidth]);

      const yScale = d3.scaleLinear()
        .domain([-2, 2])
        .range([innerHeight, 0]);

      g.selectAll('circle')
        .data(returnPoints)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 3)
        .attr('fill', 'var(--accent-magenta)')
        .attr('opacity', 0.8);

      // Add section line
      g.append('line')
        .attr('x1', xScale(0))
        .attr('y1', 0)
        .attr('x2', xScale(0))
        .attr('y2', innerHeight)
        .attr('stroke', 'var(--text-secondary)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5');
    };

    const getVisualizationTitle = () => {
      switch (visualizationType) {
        case 'attractor': return 'Ikeda Attractor';
        case 'time': return 'Time Evolution';
        case 'bifurcation': return 'Bifurcation Diagram';
        case 'phase': return 'Phase Portrait';
        case 'spectrum': return 'Power Spectrum';
        case 'return': return 'Return Map';
        default: return 'Ikeda Map Visualization';
      }
    };

    const chart = initChartBase(svgRef, width, height, { background: 'rgba(0, 0, 0, 0.1)' });
    if (!chart) return;
    const { g, margin, innerWidth, innerHeight } = chart;

    // Render based on visualization type
    if (visualizationType === 'attractor') {
      renderAttractor(g, innerWidth, innerHeight);
    } else if (visualizationType === 'time') {
      renderTimeEvolution(g, innerWidth, innerHeight);
    } else if (visualizationType === 'bifurcation') {
      renderBifurcation(g, innerWidth, innerHeight);
    } else if (visualizationType === 'phase') {
      renderPhasePortrait(g, innerWidth, innerHeight);
    } else if (visualizationType === 'spectrum') {
      renderPowerSpectrum(g, innerWidth, innerHeight);
    } else if (visualizationType === 'return') {
      renderReturnMap(g, innerWidth, innerHeight);
    }

    // Add axes for appropriate visualizations
    if (visualizationType !== 'spectrum') {
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(
          visualizationType === 'spectrum' ?
          d3.scaleLinear().domain([0, 0.5]).range([0, innerWidth]) :
          d3.scaleLinear().domain([-2, 2]).range([0, innerWidth])
        ))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');

      g.append('g')
        .call(d3.axisLeft(
          visualizationType === 'spectrum' ?
          d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]) :
          d3.scaleLinear().domain([-2, 2]).range([innerHeight, 0])
        ))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');

      // Add axis labels
      const xLabel = visualizationType === 'time' ? 'Time' :
                     visualizationType === 'bifurcation' ? 'Parameter Value' :
                     visualizationType === 'spectrum' ? 'Frequency' : 'x';
      const yLabel = visualizationType === 'time' ? 'Value' :
                     visualizationType === 'spectrum' ? 'Power' : 'y';

      renderAxisLabelsRotated(g, innerWidth, innerHeight, margin.left, xLabel, yLabel);
    }

    // Add title
    renderChartTitle(g, innerWidth, getVisualizationTitle());

  }, [selectedParams, iterations, visualizationType, bifurcationParam, animationStep, currentParams.params, isAnimating]);

  return (
    <div className="p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Ikeda Map Visualization</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <ViewModeSelect
            label="Parameter Set"
            value={selectedParams}
            onChange={(v) => setSelectedParams(parseInt(v))}
            options={parameters.map((param, index) => ({ value: index, label: param.name }))}
            description={currentParams.description}
          />

          <ParamSlider
            label={<>Iterations: {iterations}</>}
            min={500}
            max={5000}
            step={500}
            value={iterations}
            onChange={setIterations}
            parse={parseInt}
          />

          <ViewModeSelect
            label="Visualization Type"
            value={visualizationType}
            onChange={setVisualizationType}
            options={[
              { value: 'attractor', label: 'Attractor' },
              { value: 'time', label: 'Time Evolution' },
              { value: 'bifurcation', label: 'Bifurcation Diagram' },
              { value: 'phase', label: 'Phase Portrait' },
              { value: 'spectrum', label: 'Power Spectrum' },
              { value: 'return', label: 'Return Map' },
            ]}
          />

          {visualizationType === 'bifurcation' && (
            <ViewModeSelect
              label="Bifurcation Parameter"
              value={bifurcationParam}
              onChange={(v) => setBifurcationParam(v as 'a' | 'b' | 'c' | 'd')}
              options={[
                { value: 'a', label: 'Parameter a' },
                { value: 'b', label: 'Parameter b' },
                { value: 'c', label: 'Parameter c' },
                { value: 'd', label: 'Parameter d' },
              ]}
            />
          )}

          {visualizationType === 'time' && (
            <button
              onClick={toggleAnimation}
              className="w-full p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              {isAnimating ? 'Stop Animation' : 'Start Animation'}
            </button>
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
              t = c - d/(1 + x² + y²)
            </p>
            <p className="text-xs text-gray-300 font-mono">
              x&apos; = 1 + a·(x·cos(t) - y·sin(t))
            </p>
            <p className="text-xs text-gray-300 font-mono">
              y&apos; = b·(x·sin(t) + y·cos(t))
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

export default IkedaMapVisualization;