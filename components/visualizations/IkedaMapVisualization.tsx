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
import { useSteppedAnimation } from '@/hooks/useSteppedAnimation';
import {
  initChartBase,
  equalAspectScales,
  createClippedDataGroup,
  renderChartAxes,
  renderAxisLabelsRotated,
  renderChartTitle,
  upsertMark,
  joinByIndex,
  CHART_MARGIN,
  ATTRACTOR_DOMAIN_REF_ITERATIONS,
  classifyOrbit,
  fitOrbitDomain,
} from './chartHelpers';
import { renderDensityCanvas } from './densityCanvas';
import { isOrbitEscaped } from './densityField';

/** Hardcoded attractor window — fallback when there is nothing sane to fit. */
const ATTRACTOR_FALLBACK: [number, number] = [-2, 2];

const IkedaMapVisualization: React.FC = () => {
  const [selectedParams, setSelectedParams] = useState(0);
  const [iterations, setIterations] = useState(2000);
  // Separate from `iterations` above: that slider also drives the time
  // evolution / bifurcation views, where a 500-5000 range keeps their SVG
  // line/point counts reasonable. The attractor view now paints a canvas
  // density field with no per-point DOM cost, so it gets its own, much
  // higher default and ceiling.
  const [attractorIterations, setAttractorIterations] = useState(200_000);
  const [visualizationType, setVisualizationType] = useState('attractor');
  const [bifurcationParam, setBifurcationParam] = useState<'a' | 'b' | 'c' | 'd'>('b');
  const [isAnimating, setIsAnimating] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Lyapunov exponents come from a chaotic iteration whose result can differ
  // in the last ULP between the build-time and browser JS engines, so they are
  // rendered only after hydration. See hooks/useHydrated.
  const hydrated = useHydrated();

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

  // Domain + caption from a FIXED reference iteration count so the axes do
  // not move when the attractor-iterations slider is swept.
  const attractorPresentation = useMemo(() => {
    const refPoints = calculateIkedaAttractor(
      currentParams.params,
      ATTRACTOR_DOMAIN_REF_ITERATIONS
    );
    const quality = classifyOrbit(refPoints, { presetName: currentParams.name });
    const domain = fitOrbitDomain(refPoints, {
      x: ATTRACTOR_FALLBACK,
      y: ATTRACTOR_FALLBACK,
    });
    return { quality, xDomain: domain.xDomain, yDomain: domain.yDomain };
  }, [currentParams]);

  const animationPlaying = isAnimating && visualizationType === 'time';

  const { step: animationStep, reset: resetAnimation } = useSteppedAnimation({
    playing: animationPlaying,
    periodMs: 50,
    modulus: iterations,
  });

  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
    if (!isAnimating) resetAnimation();
  };

  // On a chaotic attractor, successive iterates jump all over the set, so
  // the previous per-iterate color/radius coding (`interpolatePlasma` over
  // `[0, iterations]`, radius growing with i) was uniform noise dressed up
  // as information -- it told you nothing about the set's structure and
  // actively obscured it. The attractor view below instead paints a canvas
  // density field (see `renderDensityCanvas`), colored by the
  // log-compressed visit density, which is what makes the Ikeda
  // attractor's spiral folds visible at all.
  useEffect(() => {
    const renderTimeEvolution = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                               innerWidth: number, innerHeight: number) => {
      const data = calculateIkedaTimeEvolution(currentParams.params, iterations);
      // Never pass non-finite coordinates to d3 scales (diverging presets).
      const finiteData = data.filter(
        (d) => Number.isFinite(d.x) && Number.isFinite(d.y) && Number.isFinite(d.time)
      );
      const escaped =
        attractorPresentation.quality.kind === 'escaped' ||
        isOrbitEscaped(finiteData);
      const safeData = escaped ? [] : finiteData;
      const displayData = isAnimating ? safeData.slice(0, animationStep) : safeData;

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

      upsertMark<SVGPathElement>(g, 'path', 'x-evol')
        .datum(displayData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 1.5)
        .attr('d', displayData.length ? xLine(displayData) : null);

      // Y coordinate evolution
      const yLine = d3.line<{time: number; x: number; y: number}>()
        .x(d => xScale(d.time))
        .y(d => yScale(d.y))
        .curve(d3.curveLinear);

      upsertMark<SVGPathElement>(g, 'path', 'y-evol')
        .datum(displayData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 1.5)
        .attr('d', displayData.length ? yLine(displayData) : null);

      // Current-point indicators: always join 0 or 1 element so nodes exit cleanly.
      const cur = (isAnimating && displayData.length > 0)
        ? [displayData[displayData.length - 1]]
        : [];
      joinByIndex<typeof displayData[number], SVGCircleElement>(
        g, 'circle.cur-x', 'circle', cur, 'cur-x',
        (sel) => {
          sel.attr('cx', d => xScale(d.time)).attr('cy', d => yScale(d.x))
            .attr('r', 4).attr('fill', 'var(--accent-cyan)');
        }
      );
      joinByIndex<typeof displayData[number], SVGCircleElement>(
        g, 'circle.cur-y', 'circle', cur, 'cur-y',
        (sel) => {
          sel.attr('cx', d => xScale(d.time)).attr('cy', d => yScale(d.y))
            .attr('r', 4).attr('fill', 'var(--accent-orange)');
        }
      );
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

      joinByIndex<typeof data[number], SVGCircleElement>(
        g, 'circle.bif-point', 'circle', data, 'bif-point',
        (sel) => {
          sel.attr('cx', d => xScale(d.paramValue)).attr('cy', d => yScale(d.x))
            .attr('r', 0.5).attr('fill', 'var(--accent-cyan)').attr('opacity', 0.6);
        }
      );
    };

    const renderPhasePortrait = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                xScale: d3.ScaleLinear<number, number>,
                                yScale: d3.ScaleLinear<number, number>) => {
      const data = calculateIkedaTimeEvolution(currentParams.params, Math.min(iterations, 1000));
      // Never pass non-finite coordinates to d3 scales (diverging presets).
      const finiteData = data.filter(
        (d) => Number.isFinite(d.x) && Number.isFinite(d.y)
      );
      const escaped =
        attractorPresentation.quality.kind === 'escaped' ||
        isOrbitEscaped(finiteData);
      const safeData = escaped ? [] : finiteData;

      // Create phase portrait with trajectory
      const line = d3.line<{time: number; x: number; y: number}>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveLinear);

      upsertMark<SVGPathElement>(g, 'path', 'phase-line')
        .datum(safeData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 1)
        .attr('opacity', 0.8)
        .attr('d', safeData.length ? line(safeData) : null);

      const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, Math.max(safeData.length, 1)]);
      const sampled = safeData.filter((_d, i) => i % 10 === 0);

      joinByIndex<typeof safeData[number], SVGCircleElement>(
        g, 'circle.phase-point', 'circle', sampled, 'phase-point',
        (sel) => {
          sel.attr('cx', d => xScale(d.x)).attr('cy', d => yScale(d.y))
            .attr('r', 2).attr('fill', (_d, i) => colorScale(i * 10));
        }
      );
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

      upsertMark<SVGPathElement>(g, 'path', 'spec-x')
        .datum(spectrum)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 2)
        .attr('d', xLine);

      const yLine = d3.line<{frequency: number; powerX: number; powerY: number}>()
        .x(d => xScale(d.frequency))
        .y(d => yScale(d.powerY))
        .curve(d3.curveMonotoneX);

      upsertMark<SVGPathElement>(g, 'path', 'spec-y')
        .datum(spectrum)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 2)
        .attr('d', yLine);
    };

    const renderReturnMap = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                            xScale: d3.ScaleLinear<number, number>,
                            yScale: d3.ScaleLinear<number, number>,
                            offsetY: number, plotHeight: number) => {
      const trajectory = calculateIkedaAttractor(currentParams.params, iterations);
      const returnPoints = calculateIkedaReturnMap(trajectory, 0);

      joinByIndex<typeof returnPoints[number], SVGCircleElement>(
        g, 'circle.return-point', 'circle', returnPoints, 'return-point',
        (sel) => {
          sel.attr('cx', d => xScale(d.x)).attr('cy', d => yScale(d.y))
            .attr('r', 3).attr('fill', 'var(--accent-magenta)').attr('opacity', 0.8);
        }
      );

      upsertMark<SVGLineElement>(g, 'line', 'section-line')
        .attr('x1', xScale(0))
        .attr('y1', offsetY)
        .attr('x2', xScale(0))
        .attr('y2', offsetY + plotHeight)
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
    const { svg, g, margin, innerWidth, innerHeight } = chart;

    // The attractor, phase portrait and return map all plot x and y on equal
    // aspect scales. Phase / return keep the hardcoded ±2 window; the
    // attractor view uses a fitted domain from the fixed reference sample
    // (see attractorPresentation) so orbits outside that window stay visible.
    // Time evolution, bifurcation and the power spectrum keep the wide box:
    // their axes are genuinely incommensurate.
    const squareViews = visualizationType === 'attractor' ||
      visualizationType === 'phase' || visualizationType === 'return';
    const attractorX = attractorPresentation.xDomain;
    const attractorY = attractorPresentation.yDomain;
    const layout = squareViews
      ? equalAspectScales(
          visualizationType === 'attractor' ? attractorX : ATTRACTOR_FALLBACK,
          visualizationType === 'attractor' ? attractorY : ATTRACTOR_FALLBACK,
          innerWidth,
          innerHeight
        )
      : null;

    if (visualizationType === 'attractor' && canvasRef.current && layout) {
      const data = calculateIkedaAttractor(currentParams.params, attractorIterations);
      // Never feed non-finite coordinates to the density path / d3 scales.
      const finitePoints = data.filter(
        (p) => Number.isFinite(p.x) && Number.isFinite(p.y)
      );
      const escaped =
        attractorPresentation.quality.kind === 'escaped' ||
        isOrbitEscaped(finitePoints);
      renderDensityCanvas(
        canvasRef.current,
        escaped ? [] : finitePoints,
        attractorX,
        attractorY,
        width,
        height,
        {
          x: CHART_MARGIN.left + layout.offsetX,
          y: CHART_MARGIN.top + layout.offsetY,
          width: layout.plotWidth,
          height: layout.plotHeight,
        },
        d3.interpolatePlasma
      );
    } else if (canvasRef.current) {
      // Clear any density paint left over from a previous render in the
      // 'attractor' view -- `renderDensityCanvas` clears its backing store
      // before painting, so calling it with no points is enough.
      renderDensityCanvas(canvasRef.current, [], ATTRACTOR_FALLBACK, ATTRACTOR_FALLBACK, width, height, {
        x: 0, y: 0, width, height,
      });
    }

    const dataGroup = createClippedDataGroup(
      svg,
      g,
      squareViews && layout
        ? { x: layout.offsetX, y: layout.offsetY, width: layout.plotWidth, height: layout.plotHeight }
        : { x: 0, y: 0, width: innerWidth, height: innerHeight },
      'ikeda-plot-clip',
      visualizationType
    );

    // Render based on visualization type
    if (visualizationType === 'time') {
      renderTimeEvolution(dataGroup, innerWidth, innerHeight);
    } else if (visualizationType === 'bifurcation') {
      renderBifurcation(dataGroup, innerWidth, innerHeight);
    } else if (visualizationType === 'phase' && layout) {
      renderPhasePortrait(dataGroup, layout.xScale, layout.yScale);
    } else if (visualizationType === 'spectrum') {
      renderPowerSpectrum(dataGroup, innerWidth, innerHeight);
    } else if (visualizationType === 'return' && layout) {
      renderReturnMap(dataGroup, layout.xScale, layout.yScale, layout.offsetY, layout.plotHeight);
    }

    // Axes (idempotent structural ticks)
    if (visualizationType !== 'spectrum') {
      const axisXScale = layout?.xScale ?? d3.scaleLinear().domain(ATTRACTOR_FALLBACK).range([0, innerWidth]);
      const axisYScale = layout?.yScale ?? d3.scaleLinear().domain(ATTRACTOR_FALLBACK).range([innerHeight, 0]);
      const axisOffsetX = layout?.offsetX ?? 0;
      const axisOffsetY = layout?.offsetY ?? 0;

      renderChartAxes(g, axisXScale, axisYScale, innerHeight, axisOffsetX, axisOffsetY);

      const xLabel = visualizationType === 'time' ? 'Time' :
                     visualizationType === 'bifurcation' ? 'Parameter Value' :
                     visualizationType === 'spectrum' ? 'Frequency' : 'x';
      const yLabel = visualizationType === 'time' ? 'Value' :
                     visualizationType === 'spectrum' ? 'Power' : 'y';

      renderAxisLabelsRotated(g, innerWidth, innerHeight, margin.left, xLabel, yLabel);
    }

    // Add title
    renderChartTitle(g, innerWidth, getVisualizationTitle());

  }, [selectedParams, iterations, attractorIterations, visualizationType, bifurcationParam, animationStep, currentParams.params, isAnimating, attractorPresentation]);

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
              data-testid="animation-step"
              data-step={animationStep}
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
            {(visualizationType === 'attractor' ||
              visualizationType === 'time' ||
              visualizationType === 'phase') &&
              attractorPresentation.quality.kind === 'escaped' &&
              attractorPresentation.quality.caption && (
                <p
                  className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm pointer-events-none"
                  style={{ color: 'var(--text-secondary)' }}
                  data-testid="orbit-escape-notice"
                >
                  {attractorPresentation.quality.caption}
                </p>
              )}
          </div>
        </div>
      </div>

      {(visualizationType === 'attractor' ||
        visualizationType === 'time' ||
        visualizationType === 'phase') &&
        attractorPresentation.quality.kind === 'degenerate' &&
        attractorPresentation.quality.caption && (
          <p
            className="mt-2 text-sm text-center"
            style={{ color: 'var(--text-secondary)' }}
            data-testid="orbit-settled-notice"
          >
            {attractorPresentation.quality.caption}
          </p>
        )}
    </div>
  );
};

export default IkedaMapVisualization;