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
  joinByIndex,
  upsertMark,
  CHART_MARGIN,
  ATTRACTOR_DOMAIN_REF_ITERATIONS,
  classifyOrbit,
  fitOrbitDomain,
} from './chartHelpers';
import { renderDensityCanvas } from './densityCanvas';
import { isOrbitEscaped } from './densityField';

/** Hardcoded attractor window — fallback when there is nothing sane to fit. */
const ATTRACTOR_FALLBACK: [number, number] = [-2, 2];

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

  // Domain + caption from a FIXED reference iteration count so the axes do
  // not move when the attractor-iterations slider is swept.
  const attractorPresentation = useMemo(() => {
    const refPoints = calculateTinkerbellAttractor(
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
      joinByIndex<typeof fixedPoints[number], SVGCircleElement>(
        g, 'circle.fp-marker', 'circle', fixedPoints, 'fp-marker',
        (sel) => {
          sel.attr('cx', d => xScale(d.x)).attr('cy', d => yScale(d.y))
            .attr('r', 4).attr('fill', 'var(--accent-cyan)')
            .attr('stroke', 'white').attr('stroke-width', 1);
        }
      );
    };

    const renderBasinOfAttraction = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                    plotWidth: number, plotHeight: number,
                                    offsetX: number, offsetY: number) => {
      const basinData = calculateTinkerbellBasinOfAttraction(currentParams.params, 80);
      // Basin is computed over a square [-2,2]^2 grid; cells are square, not
      // stretched to a 520x300 box.
      const cellWidth = plotWidth / 80;
      const cellHeight = plotHeight / 80;

      const cells: { x: number; y: number; value: number }[] = [];
      basinData.forEach((row, y) => {
        row.forEach((value, x) => cells.push({ x, y, value }));
      });
      joinByIndex<typeof cells[number], SVGRectElement>(
        g, 'rect.basin-cell', 'rect', cells, 'basin-cell',
        (sel) => {
          sel.attr('x', d => offsetX + d.x * cellWidth)
            .attr('y', d => offsetY + d.y * cellHeight)
            .attr('width', cellWidth).attr('height', cellHeight)
            .attr('fill', d => d.value === -1 ? 'var(--accent-red)' :
                              d.value === 0 ? 'rgba(50, 50, 50, 0.5)' :
                              'var(--accent-cyan)')
            .attr('opacity', 0.8).attr('stroke', 'none');
        }
      );

      const legendData = [
        { color: 'var(--accent-cyan)', label: 'Attracts to origin' },
        { color: 'rgba(50, 50, 50, 0.5)', label: 'Other attractor' },
        { color: 'var(--accent-red)', label: 'Escapes to infinity' }
      ];
      joinByIndex<typeof legendData[number], SVGRectElement>(
        g, 'rect.legend-swatch', 'rect', legendData, 'legend-swatch',
        (sel) => {
          sel.attr('x', 10).attr('y', (_d, i) => 10 + i * 20)
            .attr('width', 15).attr('height', 15).attr('fill', d => d.color);
        }
      );
      joinByIndex<typeof legendData[number], SVGTextElement>(
        g, 'text.legend-label', 'text', legendData, 'legend-label',
        (sel) => {
          sel.attr('x', 30).attr('y', (_d, i) => 22 + i * 20)
            .style('fill', 'var(--text-primary)').style('font-size', '12px')
            .each(function (d) {
              if (this.firstChild && this.firstChild.nodeType === Node.TEXT_NODE) {
                if (this.firstChild.nodeValue !== d.label) this.firstChild.nodeValue = d.label;
              } else { this.textContent = d.label; }
            });
        }
      );
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

      joinByIndex<typeof data[number], SVGCircleElement>(
        g, 'circle.bif-point', 'circle', data, 'bif-point',
        (sel) => {
          sel.attr('cx', d => xScale(d.paramValue)).attr('cy', d => yScale(d.x))
            .attr('r', 0.5).attr('fill', 'var(--accent-magenta)').attr('opacity', 0.6);
        }
      );
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

      const sizeLine = d3.line<{paramValue: number; attractorSize: number; lyapunov: number}>()
        .x(d => xScale(d.paramValue))
        .y(d => yScale1(d.attractorSize))
        .curve(d3.curveMonotoneX);

      upsertMark<SVGPathElement>(g, 'path', 'crisis-size')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 2)
        .attr('d', sizeLine);

      const lyapunovLine = d3.line<{paramValue: number; attractorSize: number; lyapunov: number}>()
        .x(d => xScale(d.paramValue))
        .y(d => yScale2(d.lyapunov))
        .curve(d3.curveMonotoneX);

      upsertMark<SVGPathElement>(g, 'path', 'crisis-lyap')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 2)
        .attr('d', lyapunovLine);

      upsertMark<SVGLineElement>(g, 'line', 'lyap-zero')
        .attr('x1', 0)
        .attr('y1', yScale2(0))
        .attr('x2', innerWidth)
        .attr('y2', yScale2(0))
        .attr('stroke', 'var(--text-secondary)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5');

      const legend = [
        { y: 20, color: 'var(--accent-cyan)', label: 'Attractor Size' },
        { y: 40, color: 'var(--accent-orange)', label: 'Lyapunov Sum' },
      ];
      joinByIndex<typeof legend[number], SVGTextElement>(
        g, 'text.crisis-legend', 'text', legend, 'crisis-legend',
        (sel) => {
          sel.attr('x', 10).attr('y', (d) => d.y)
            .style('fill', (d) => d.color).style('font-size', '12px')
            .each(function (d) {
              if (this.firstChild && this.firstChild.nodeType === Node.TEXT_NODE) {
                if (this.firstChild.nodeValue !== d.label) this.firstChild.nodeValue = d.label;
              } else { this.textContent = d.label; }
            });
        }
      );

      return {
        xScale,
        yScale: yScale2,
        xLabel: `Parameter ${bifurcationParam}`,
      };
    };

    const renderReturnMap = (
      g: d3.Selection<SVGGElement, unknown, null, undefined>,
      xScale: d3.ScaleLinear<number, number>,
      yScale: d3.ScaleLinear<number, number>
    ) => {
      const trajectory = calculateTinkerbellAttractor(currentParams.params, 1000);
      const returnData = calculateTinkerbellReturnMap(trajectory, 'x', 1);

      joinByIndex<typeof returnData[number], SVGCircleElement>(
        g, 'circle.return-point', 'circle', returnData, 'return-point',
        (sel) => {
          sel.attr('cx', (d) => xScale(d.current)).attr('cy', (d) => yScale(d.next))
            .attr('r', 1).attr('fill', 'var(--accent-magenta)').attr('opacity', 0.6);
        }
      );

      upsertMark<SVGLineElement>(g, 'line', 'return-diag')
        .attr('x1', xScale(-2))
        .attr('y1', yScale(-2))
        .attr('x2', xScale(2))
        .attr('y2', yScale(2))
        .attr('stroke', 'var(--text-secondary)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5');
    };

    const renderFixedPoints = (
      g: d3.Selection<SVGGElement, unknown, null, undefined>,
      xScale: d3.ScaleLinear<number, number>,
      yScale: d3.ScaleLinear<number, number>
    ) => {
      const attractorData = calculateTinkerbellAttractor(currentParams.params, 1000);

      upsertMark<SVGPathElement>(g, 'path', 'fp-attractor')
        .datum(attractorData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.3)
        .attr('d', d3.line<{x: number; y: number}>()
          .x(d => xScale(d.x))
          .y(d => yScale(d.y))
          .curve(d3.curveLinear));

      joinByIndex<typeof fixedPoints[number], SVGCircleElement>(
        g, 'circle.fp-hl', 'circle', fixedPoints, 'fp-hl',
        (sel) => {
          sel.attr('cx', (d) => xScale(d.x)).attr('cy', (d) => yScale(d.y))
            .attr('r', 6).attr('fill', 'var(--accent-cyan)')
            .attr('stroke', 'white').attr('stroke-width', 2);
        }
      );
      joinByIndex<typeof fixedPoints[number], SVGTextElement>(
        g, 'text.fp-name', 'text', fixedPoints, 'fp-name',
        (sel) => {
          sel.attr('x', (d) => xScale(d.x) + 10).attr('y', (d) => yScale(d.y) - 10)
            .style('fill', 'var(--text-primary)').style('font-size', '12px')
            .style('font-weight', 'bold')
            .each(function (_d, i) {
              const label = `FP${i + 1}`;
              if (this.firstChild && this.firstChild.nodeType === Node.TEXT_NODE) {
                if (this.firstChild.nodeValue !== label) this.firstChild.nodeValue = label;
              } else { this.textContent = label; }
            });
        }
      );
      joinByIndex<typeof fixedPoints[number], SVGTextElement>(
        g, 'text.fp-coord', 'text', fixedPoints, 'fp-coord',
        (sel) => {
          sel.attr('x', (d) => xScale(d.x) + 10).attr('y', (d) => yScale(d.y) + 5)
            .style('fill', 'var(--text-secondary)').style('font-size', '10px')
            .each(function (d) {
              const label = `(${d.x.toFixed(3)}, ${d.y.toFixed(3)})`;
              if (this.firstChild && this.firstChild.nodeType === Node.TEXT_NODE) {
                if (this.firstChild.nodeValue !== label) this.firstChild.nodeValue = label;
              } else { this.textContent = label; }
            });
        }
      );
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

    // Attractor, basin, return map and fixed points use equal-aspect scales.
    // Non-attractor square views keep the hardcoded ±2 window; the attractor
    // view uses a fitted domain from the fixed reference sample so orbits
    // outside that window (or collapsed inside it) stay legible. Bifurcation
    // and crisis-behavior keep the wide box: parameter-vs-x and
    // parameter-vs-(size, Lyapunov) are genuinely incommensurate axes.
    const squareViews = visualizationType === 'attractor' || visualizationType === 'basin' ||
      visualizationType === 'return' || visualizationType === 'fixed';
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
      const data = calculateTinkerbellAttractor(currentParams.params, attractorIterations);
      // Never feed non-finite coordinates to the density path / d3 scales
      // (several Tinkerbell presets diverge to NaN).
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
        d3.interpolateMagma
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
      'tinkerbell-plot-clip',
      visualizationType
    );

    // Render based on visualization type
    let crisisAxes: {
      xScale: d3.ScaleLinear<number, number>;
      yScale: d3.ScaleLinear<number, number>;
      xLabel: string;
    } | null = null;

    if (visualizationType === 'attractor' && layout) {
      renderFixedPointMarkers(dataGroup, layout.xScale, layout.yScale);
    } else if (visualizationType === 'basin' && layout) {
      renderBasinOfAttraction(dataGroup, layout.plotWidth, layout.plotHeight, layout.offsetX, layout.offsetY);
    } else if (visualizationType === 'bifurcation') {
      renderBifurcation(dataGroup, innerWidth, innerHeight);
    } else if (visualizationType === 'crisis') {
      crisisAxes = renderCrisisBehavior(dataGroup, innerWidth, innerHeight);
    } else if (visualizationType === 'return' && layout) {
      renderReturnMap(dataGroup, layout.xScale, layout.yScale);
    } else if (visualizationType === 'fixed' && layout) {
      renderFixedPoints(dataGroup, layout.xScale, layout.yScale);
    }

    // Idempotent axes on the chart root (not inside the clipped data group).
    if (crisisAxes) {
      renderChartAxes(g, crisisAxes.xScale, crisisAxes.yScale, innerHeight);
      renderAxisLabelsRotated(
        g, innerWidth, innerHeight, margin.left, crisisAxes.xLabel, undefined
      );
    } else {
      const xDomain: [number, number] = visualizationType === 'bifurcation' ?
        [bifurcationParam === 'a' ? 0.3 : bifurcationParam === 'b' ? -1.0 : 1.5,
         bifurcationParam === 'a' ? 1.3 : bifurcationParam === 'b' ? -0.3 : 2.5] : ATTRACTOR_FALLBACK;
      const yDomain: [number, number] = ATTRACTOR_FALLBACK;

      const xScale = layout?.xScale ?? d3.scaleLinear().domain(xDomain).range([0, innerWidth]);
      const yScale = layout?.yScale ?? d3.scaleLinear().domain(yDomain).range([innerHeight, 0]);
      const axisOffsetX = layout?.offsetX ?? 0;
      const axisOffsetY = layout?.offsetY ?? 0;

      renderChartAxes(g, xScale, yScale, innerHeight, axisOffsetX, axisOffsetY);

      const xLabel = visualizationType === 'bifurcation' ? `Parameter ${bifurcationParam}`
        : visualizationType === 'return' ? 'xₙ' : 'x';
      const yLabel = visualizationType === 'return' ? 'xₙ₊₁' : 'y';

      renderAxisLabelsRotated(g, innerWidth, innerHeight, margin.left, xLabel, yLabel);
    }

    // Add title
    renderChartTitle(g, innerWidth, getVisualizationTitle());

  }, [currentParams, iterations, attractorIterations, visualizationType, bifurcationParam, fixedPoints, attractorPresentation]);

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
            {visualizationType === 'attractor' &&
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

      {visualizationType === 'attractor' &&
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

export default TinkerbellMapVisualization;