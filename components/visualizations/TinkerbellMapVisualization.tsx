"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useHydrated } from '@/hooks/useHydrated';
import {
  calculateTinkerbellAttractor,
  calculateTinkerbellBasinOfAttraction,
  calculateTinkerbellBifurcation,
  calculateTinkerbellLyapunovExponents,
  calculateTinkerbellFixedPoints,
  calculateTinkerbellCrisisBehavior,
  getInterestingTinkerbellParameters,
  calculateTinkerbellReturnMap
} from '@/lib/maps/tinkerbell';
import { ParamSlider } from '@/components/ui/ParamSlider';
import { ViewModeSelect } from '@/components/ui/ViewModeSelect';
import {
  initChartBase,
  equalAspectScales,
  createClippedDataGroup,
  renderChartAxes,
  renderAxisLabelsRotated,
  renderChartTitle,
  CHART_MARGIN,
} from './chartHelpers';
import { renderDensityCanvas } from './densityCanvas';

const TinkerbellMapVisualization: React.FC = () => {
  const [selectedParams, setSelectedParams] = useState(0);
  const [iterations, setIterations] = useState(2000);
  // Separate from `iterations`: that slider also drives the bifurcation and
  // crisis-behavior views, which stay in the 500-5000 range that keeps
  // their SVG point counts reasonable. The (now canvas-based) multi-loop
  // attractor view has no per-point DOM cost, so it gets its own, much
  // higher default and ceiling.
  const [attractorIterations, setAttractorIterations] = useState(200_000);
  const [visualizationType, setVisualizationType] = useState('attractor');
  const [bifurcationParam, setBifurcationParam] = useState<'a' | 'b' | 'c' | 'd'>('a');
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Lyapunov exponents come from a chaotic iteration whose result can differ
  // in the last ULP between the build-time and browser JS engines, so they are
  // rendered only after hydration. See hooks/useHydrated.
  const hydrated = useHydrated();

  const width = 600;
  const height = 400;

  // Memoized so currentParams keeps a stable identity across renders; a fresh
  // call each render would give the useMemo deps below a new object every
  // time and defeat them.
  const parameters = useMemo(() => getInterestingTinkerbellParameters(), []);
  const currentParams = parameters[selectedParams];

  // Both are pure functions of currentParams, so they are derived during
  // render instead of being pushed into state by an effect. State here would
  // cost an extra render pass and briefly show values for the old parameters.
  const lyapunovExponents = useMemo(
    () => calculateTinkerbellLyapunovExponents(currentParams.params, 2000),
    [currentParams]
  );
  const fixedPoints = useMemo(
    () => calculateTinkerbellFixedPoints(currentParams.params),
    [currentParams]
  );

  // On a chaotic attractor, successive iterates jump all over the set, so
  // the previous per-iterate color coding (`interpolateSpectral` -- a
  // *diverging* scale, wrong for a sequential quantity even before getting
  // to the iteration-order problem -- over `[0, iterations]`) was uniform
  // noise dressed up as information. The attractor view below instead
  // paints a canvas density field (see `renderDensityCanvas`), colored by
  // the log-compressed visit density, which is what makes Tinkerbell's
  // multi-loop structure visible at all.
  useEffect(() => {
    const renderFixedPointMarkers = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                            xScale: d3.ScaleLinear<number, number>,
                            yScale: d3.ScaleLinear<number, number>) => {
      fixedPoints.forEach(fp => {
        g.append('circle')
          .attr('cx', xScale(fp.x))
          .attr('cy', yScale(fp.y))
          .attr('r', 4)
          .attr('fill', 'var(--accent-cyan)')
          .attr('stroke', 'white')
          .attr('stroke-width', 1);
      });
    };

    const renderBasinOfAttraction = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                    plotWidth: number, plotHeight: number,
                                    offsetX: number, offsetY: number) => {
      const basinData = calculateTinkerbellBasinOfAttraction(currentParams.params, 80);
      // Basin is computed over a square [-2,2]^2 grid; cells are square, not
      // stretched to a 520x300 box.
      const cellWidth = plotWidth / 80;
      const cellHeight = plotHeight / 80;

      basinData.forEach((row, y) => {
        row.forEach((value, x) => {
          const color = value === -1 ? 'var(--accent-red)' :
                       value === 0 ? 'rgba(50, 50, 50, 0.5)' :
                       'var(--accent-cyan)';

          g.append('rect')
            .attr('x', offsetX + x * cellWidth)
            .attr('y', offsetY + y * cellHeight)
            .attr('width', cellWidth)
            .attr('height', cellHeight)
            .attr('fill', color)
            .attr('opacity', 0.8)
            .attr('stroke', 'none');
        });
      });

      // Add legend
      const legendData = [
        { color: 'var(--accent-cyan)', label: 'Attracts to origin' },
        { color: 'rgba(50, 50, 50, 0.5)', label: 'Other attractor' },
        { color: 'var(--accent-red)', label: 'Escapes to infinity' }
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
        min: bifurcationParam === 'a' ? 0.3 : bifurcationParam === 'b' ? -1.0 : 1.5,
        max: bifurcationParam === 'a' ? 1.3 : bifurcationParam === 'b' ? -0.3 : 2.5,
        step: 0.01
      };

      const fixedParams = { ...currentParams.params };
      delete (fixedParams as any)[bifurcationParam];

      const data = calculateTinkerbellBifurcation(bifurcationParam, paramRange, fixedParams, 1000);

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
        .attr('fill', 'var(--accent-magenta)')
        .attr('opacity', 0.6);
    };

    const renderCrisisBehavior = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                 innerWidth: number, innerHeight: number) => {
      const paramRange = {
        min: bifurcationParam === 'a' ? 0.5 : 0.2,
        max: bifurcationParam === 'a' ? 1.2 : 1.0,
        step: 0.01
      };

      const fixedParams = { ...currentParams.params };
      delete (fixedParams as any)[bifurcationParam];

      const data = calculateTinkerbellCrisisBehavior(bifurcationParam, paramRange, fixedParams);

      const xScale = d3.scaleLinear()
        .domain([paramRange.min, paramRange.max])
        .range([0, innerWidth]);

      const yScale1 = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.attractorSize) || 2])
        .range([innerHeight * 0.8, innerHeight * 0.2]);

      const yScale2 = d3.scaleLinear()
        .domain([d3.min(data, d => d.lyapunov) || -1, d3.max(data, d => d.lyapunov) || 1])
        .range([innerHeight * 0.8, innerHeight * 0.2]);

      // Attractor size line
      const sizeLine = d3.line<{paramValue: number; attractorSize: number; lyapunov: number}>()
        .x(d => xScale(d.paramValue))
        .y(d => yScale1(d.attractorSize))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 2)
        .attr('d', sizeLine);

      // Lyapunov exponent line
      const lyapunovLine = d3.line<{paramValue: number; attractorSize: number; lyapunov: number}>()
        .x(d => xScale(d.paramValue))
        .y(d => yScale2(d.lyapunov))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 2)
        .attr('d', lyapunovLine);

      // Add zero line for Lyapunov
      g.append('line')
        .attr('x1', 0)
        .attr('y1', yScale2(0))
        .attr('x2', innerWidth)
        .attr('y2', yScale2(0))
        .attr('stroke', 'var(--text-secondary)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5');

      // Add axes
      g.append('g')
        .attr('transform', `translate(0,${innerHeight * 0.9})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');

      // Add labels
      g.append('text')
        .attr('transform', `translate(${innerWidth/2}, ${innerHeight + 40})`)
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .text(`Parameter ${bifurcationParam}`);

      // Legend
      g.append('text')
        .attr('x', 10)
        .attr('y', 20)
        .style('fill', 'var(--accent-cyan)')
        .style('font-size', '12px')
        .text('Attractor Size');

      g.append('text')
        .attr('x', 10)
        .attr('y', 40)
        .style('fill', 'var(--accent-orange)')
        .style('font-size', '12px')
        .text('Lyapunov Sum');
    };

    const renderReturnMap = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                            innerWidth: number, innerHeight: number,
                            xScale: d3.ScaleLinear<number, number>,
                            yScale: d3.ScaleLinear<number, number>,
                            offsetX: number, offsetY: number) => {
      const trajectory = calculateTinkerbellAttractor(currentParams.params, 1000);
      const returnData = calculateTinkerbellReturnMap(trajectory, 'x', 1);

      g.selectAll('circle')
        .data(returnData)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.current))
        .attr('cy', d => yScale(d.next))
        .attr('r', 1)
        .attr('fill', 'var(--accent-magenta)')
        .attr('opacity', 0.6);

      // Add diagonal line
      g.append('line')
        .attr('x1', xScale(-2))
        .attr('y1', yScale(-2))
        .attr('x2', xScale(2))
        .attr('y2', yScale(2))
        .attr('stroke', 'var(--text-secondary)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5');

      // Update axes for return map
      g.append('g')
        .attr('transform', `translate(0,${innerHeight - offsetY})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');

      g.append('g')
        .attr('transform', `translate(${offsetX},0)`)
        .call(d3.axisLeft(yScale))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');

      g.append('text')
        .attr('transform', `translate(${innerWidth/2}, ${innerHeight + 40})`)
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .text('xₙ');

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - 40)
        .attr('x', 0 - (innerHeight / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .text('xₙ₊₁');
    };

    const renderFixedPoints = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                              innerWidth: number, innerHeight: number,
                              xScale: d3.ScaleLinear<number, number>,
                              yScale: d3.ScaleLinear<number, number>,
                              offsetX: number, offsetY: number) => {
      // Draw attractor as background
      const attractorData = calculateTinkerbellAttractor(currentParams.params, 1000);

      g.append('path')
        .datum(attractorData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.3)
        .attr('d', d3.line<{x: number; y: number}>()
          .x(d => xScale(d.x))
          .y(d => yScale(d.y))
          .curve(d3.curveLinear));

      // Highlight fixed points
      fixedPoints.forEach((fp, i) => {
        g.append('circle')
          .attr('cx', xScale(fp.x))
          .attr('cy', yScale(fp.y))
          .attr('r', 6)
          .attr('fill', 'var(--accent-cyan)')
          .attr('stroke', 'white')
          .attr('stroke-width', 2);

        g.append('text')
          .attr('x', xScale(fp.x) + 10)
          .attr('y', yScale(fp.y) - 10)
          .style('fill', 'var(--text-primary)')
          .style('font-size', '12px')
          .style('font-weight', 'bold')
          .text(`FP${i + 1}`);

        g.append('text')
          .attr('x', xScale(fp.x) + 10)
          .attr('y', yScale(fp.y) + 5)
          .style('fill', 'var(--text-secondary)')
          .style('font-size', '10px')
          .text(`(${fp.x.toFixed(3)}, ${fp.y.toFixed(3)})`);
      });

      // Add axes
      g.append('g')
        .attr('transform', `translate(0,${innerHeight - offsetY})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text, line, path')
        .style('color', 'var(--text-secondary)');

      g.append('g')
        .attr('transform', `translate(${offsetX},0)`)
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
        case 'attractor': return 'Tinkerbell Attractor';
        case 'basin': return 'Basin of Attraction';
        case 'bifurcation': return 'Bifurcation Diagram';
        case 'crisis': return 'Crisis Behavior';
        case 'return': return 'Return Map';
        case 'fixed': return 'Fixed Points';
        default: return 'Tinkerbell Map Visualization';
      }
    };

    const chart = initChartBase(svgRef, width, height, { background: 'rgba(0, 0, 0, 0.1)' });
    if (!chart) return;
    const { svg, g, margin, innerWidth, innerHeight } = chart;

    // Attractor, basin, return map and fixed points all plot x and y on the
    // same [-2, 2] domain; equalAspectScales keeps them undistorted instead
    // of fitting each axis independently to the 520x300 box. Bifurcation and
    // crisis-behavior keep the wide box: parameter-vs-x and
    // parameter-vs-(size, Lyapunov) are genuinely incommensurate axes.
    const squareViews = visualizationType === 'attractor' || visualizationType === 'basin' ||
      visualizationType === 'return' || visualizationType === 'fixed';
    const layout = squareViews
      ? equalAspectScales([-2, 2], [-2, 2], innerWidth, innerHeight)
      : null;

    if (visualizationType === 'attractor' && canvasRef.current) {
      const data = calculateTinkerbellAttractor(currentParams.params, attractorIterations);
      renderDensityCanvas(
        canvasRef.current,
        data,
        [-2, 2],
        [-2, 2],
        width,
        height,
        {
          x: CHART_MARGIN.left + layout!.offsetX,
          y: CHART_MARGIN.top + layout!.offsetY,
          width: layout!.plotWidth,
          height: layout!.plotHeight,
        },
        d3.interpolateMagma
      );
    } else if (canvasRef.current) {
      // Clear any density paint left over from a previous render in the
      // 'attractor' view -- `renderDensityCanvas` clears its backing store
      // before painting, so calling it with no points is enough.
      renderDensityCanvas(canvasRef.current, [], [-2, 2], [-2, 2], width, height, {
        x: 0, y: 0, width, height,
      });
    }

    const dataGroup = squareViews && layout
      ? createClippedDataGroup(
          svg,
          g,
          { x: layout.offsetX, y: layout.offsetY, width: layout.plotWidth, height: layout.plotHeight },
          'tinkerbell-plot-clip'
        )
      : g;

    // Render based on visualization type
    if (visualizationType === 'attractor' && layout) {
      renderFixedPointMarkers(dataGroup, layout.xScale, layout.yScale);
    } else if (visualizationType === 'basin' && layout) {
      renderBasinOfAttraction(dataGroup, layout.plotWidth, layout.plotHeight, layout.offsetX, layout.offsetY);
    } else if (visualizationType === 'bifurcation') {
      renderBifurcation(g, innerWidth, innerHeight);
    } else if (visualizationType === 'crisis') {
      renderCrisisBehavior(g, innerWidth, innerHeight);
    } else if (visualizationType === 'return' && layout) {
      renderReturnMap(dataGroup, innerWidth, innerHeight, layout.xScale, layout.yScale, layout.offsetX, layout.offsetY);
    } else if (visualizationType === 'fixed' && layout) {
      renderFixedPoints(dataGroup, innerWidth, innerHeight, layout.xScale, layout.yScale, layout.offsetX, layout.offsetY);
    }

    // Add axes for appropriate visualizations
    if (visualizationType !== 'crisis') {
      const xDomain: [number, number] = visualizationType === 'bifurcation' ?
        [bifurcationParam === 'a' ? 0.3 : bifurcationParam === 'b' ? -1.0 : 1.5,
         bifurcationParam === 'a' ? 1.3 : bifurcationParam === 'b' ? -0.3 : 2.5] : [-2, 2];
      const yDomain: [number, number] = [-2, 2];

      const xScale = layout?.xScale ?? d3.scaleLinear().domain(xDomain).range([0, innerWidth]);
      const yScale = layout?.yScale ?? d3.scaleLinear().domain(yDomain).range([innerHeight, 0]);
      const axisOffsetX = layout?.offsetX ?? 0;
      const axisOffsetY = layout?.offsetY ?? 0;

      renderChartAxes(g, xScale, yScale, innerHeight, axisOffsetX, axisOffsetY);

      // Add axis labels
      const xLabel = visualizationType === 'bifurcation' ? `Parameter ${bifurcationParam}` : 'x';
      const yLabel = visualizationType === 'bifurcation' ? 'y' : 'y';

      renderAxisLabelsRotated(g, innerWidth, innerHeight, margin.left, xLabel, yLabel);
    }

    // Add title
    renderChartTitle(g, innerWidth, getVisualizationTitle());

  }, [currentParams, iterations, attractorIterations, visualizationType, bifurcationParam, fixedPoints]);

  return (
    <div className="p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Tinkerbell Map Visualization</h3>

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

          {visualizationType === 'attractor' ? (
            <ParamSlider
              label={<>Attractor Iterations: {attractorIterations.toLocaleString()}</>}
              min={10_000}
              max={1_000_000}
              step={10_000}
              value={attractorIterations}
              onChange={setAttractorIterations}
              parse={parseInt}
            />
          ) : (
            <ParamSlider
              label={<>Iterations: {iterations}</>}
              min={500}
              max={5000}
              step={500}
              value={iterations}
              onChange={setIterations}
              parse={parseInt}
            />
          )}

          <ViewModeSelect
            label="Visualization Type"
            value={visualizationType}
            onChange={setVisualizationType}
            options={[
              { value: 'attractor', label: 'Multi-loop Attractor' },
              { value: 'basin', label: 'Basin of Attraction' },
              { value: 'bifurcation', label: 'Bifurcation Diagram' },
              { value: 'crisis', label: 'Crisis Behavior' },
              { value: 'return', label: 'Return Map' },
              { value: 'fixed', label: 'Fixed Points' },
            ]}
          />

          {(visualizationType === 'bifurcation' || visualizationType === 'crisis') && (
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
              x&apos; = x² - y² + a·x + b·y
            </p>
            <p className="text-xs text-gray-300 font-mono">
              y&apos; = 2·x·y + c·x + d·y
            </p>
          </div>
        </div>

        {/* Visualization */}
        <div className="flex justify-center">
          <div
            className="relative w-full border border-cyan-500/20 rounded-lg bg-black/50 overflow-hidden"
            style={{ maxWidth: width, aspectRatio: `${width}/${height}` }}
          >
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="absolute inset-0 w-full h-full"
            />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TinkerbellMapVisualization;