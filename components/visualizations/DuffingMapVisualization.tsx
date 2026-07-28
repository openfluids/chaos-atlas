"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useHydrated } from '@/hooks/useHydrated';
import {
  calculateDuffingAttractor,
  calculateDuffingPotential,
  calculateDuffingBifurcation,
  calculateDuffingBasins,
  calculateDuffingLyapunovExponents,
  calculateDuffingFixedPoints,
  calculateDuffingEnergyTrajectories,
  getInterestingDuffingParameters
} from '@/lib/maps/duffing';
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
} from './chartHelpers';
import { renderDensityCanvas } from './densityCanvas';

const DuffingMapVisualization: React.FC = () => {
  const [selectedParams, setSelectedParams] = useState(1);
  const [iterations, setIterations] = useState(2000);
  // Separate from `iterations`: that slider also drives the bifurcation and
  // energy-trajectories views, which stay in the 500-5000 range that keeps
  // their SVG point/line counts reasonable. The (now canvas-based)
  // attractor and phase-space-density views have no per-point DOM cost, so
  // they get their own, much higher default and ceiling.
  const [attractorIterations, setAttractorIterations] = useState(200_000);
  const [visualizationType, setVisualizationType] = useState('attractor');
  const [bifurcationParam, setBifurcationParam] = useState<'a' | 'b'>('a');
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
  const parameters = useMemo(() => getInterestingDuffingParameters(), []);
  const currentParams = parameters[selectedParams];

  // Both are pure functions of currentParams, so they are derived during
  // render instead of being pushed into state by an effect. State here would
  // cost an extra render pass and briefly show values for the old parameters.
  const lyapunovExponents = useMemo(
    () => calculateDuffingLyapunovExponents(currentParams.params, 2000),
    [currentParams]
  );
  const fixedPoints = useMemo(
    () => calculateDuffingFixedPoints(currentParams.params),
    [currentParams]
  );

  // On a chaotic attractor, successive iterates jump all over the set, so
  // the previous per-iterate/per-point color coding on both the 'attractor'
  // view (`interpolatePlasma` over point order) and the 'phase' view (a
  // hand-rolled linear-normalised density, `Math.max(...array)` and all --
  // a stack-overflow risk on a large binned array, and linear normalisation
  // buries a heavy-tailed occupancy near zero) was noise dressed up as
  // information. Both views now share the canvas density renderer used by
  // Hénon, Ikeda and Tinkerbell; see `renderAttractorOverlay` and the
  // 'attractor'/'phase' branches below.
  useEffect(() => {
    const renderAttractorOverlay = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
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

    const renderPotential = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                            innerWidth: number, innerHeight: number) => {
      const potentialData = calculateDuffingPotential(currentParams.params.a, { min: -2, max: 2 }, 100);

      const xScale = d3.scaleLinear()
        .domain([-2, 2])
        .range([0, innerWidth]);

      const yScale = d3.scaleLinear()
        .domain([d3.min(potentialData, d => d.potential) || 0,
                 d3.max(potentialData, d => d.potential) || 2])
        .range([innerHeight, 0]);

      const potentialLine = d3.line<{x: number; potential: number}>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.potential))
        .curve(d3.curveMonotoneX);

      upsertMark<SVGPathElement>(g, 'path', 'potential-curve')
        .datum(potentialData)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-cyan)')
        .attr('stroke-width', 3)
        .attr('d', potentialLine);

      const area = d3.area<{x: number; potential: number}>()
        .x(d => xScale(d.x))
        .y0(innerHeight)
        .y1(d => yScale(d.potential))
        .curve(d3.curveMonotoneX);

      upsertMark<SVGPathElement>(g, 'path', 'potential-area')
        .datum(potentialData)
        .attr('fill', 'var(--accent-cyan)')
        .attr('opacity', 0.2)
        .attr('d', area);

      const wells = [-Math.sqrt(currentParams.params.a), Math.sqrt(currentParams.params.a)]
        .filter((x) => Math.abs(x) <= 2);
      joinByIndex<number, SVGLineElement>(
        g, 'line.well-mark', 'line', wells, 'well-mark',
        (sel) => {
          sel.attr('x1', (x) => xScale(x)).attr('y1', 0)
            .attr('x2', (x) => xScale(x)).attr('y2', innerHeight)
            .attr('stroke', 'var(--accent-orange)').attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5').attr('opacity', 0.6);
        }
      );
      joinByIndex<number, SVGTextElement>(
        g, 'text.well-label', 'text', wells, 'well-label',
        (sel) => {
          sel.attr('x', (x) => xScale(x)).attr('y', 20)
            .style('text-anchor', 'middle').style('fill', 'var(--accent-orange)')
            .style('font-size', '12px')
            .each(function () {
              if (this.firstChild && this.firstChild.nodeType === Node.TEXT_NODE) {
                if (this.firstChild.nodeValue !== 'Well') this.firstChild.nodeValue = 'Well';
              } else { this.textContent = 'Well'; }
            });
        }
      );

      return { xScale, yScale, xLabel: 'Position x', yLabel: 'Potential V(x)' };
    };

    const renderBasins = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                         plotWidth: number, plotHeight: number,
                         offsetX: number, offsetY: number) => {
      const basinData = calculateDuffingBasins(currentParams.params, 60);
      // Basins are computed over a square [-2,2]^2 grid; cells are square,
      // not stretched to a 520x300 box.
      const cellWidth = plotWidth / 60;
      const cellHeight = plotHeight / 60;

      const cells: { x: number; y: number; value: number }[] = [];
      basinData.forEach((row, y) => {
        row.forEach((value, x) => cells.push({ x, y, value }));
      });
      joinByIndex<typeof cells[number], SVGRectElement>(
        g, 'rect.basin-cell', 'rect', cells, 'basin-cell',
        (sel) => {
          sel.attr('x', (d) => offsetX + d.x * cellWidth)
            .attr('y', (d) => offsetY + d.y * cellHeight)
            .attr('width', cellWidth).attr('height', cellHeight)
            .attr('fill', (d) =>
              d.value === -1 ? 'var(--accent-red)' :
              d.value === 1 ? 'var(--accent-cyan)' :
              d.value === 2 ? 'var(--accent-orange)' :
              'rgba(50, 50, 50, 0.5)')
            .attr('opacity', 0.8).attr('stroke', 'none');
        }
      );

      const legendData = [
        { color: 'var(--accent-cyan)', label: 'Left well' },
        { color: 'var(--accent-orange)', label: 'Right well' },
        { color: 'rgba(50, 50, 50, 0.5)', label: 'Center' },
        { color: 'var(--accent-red)', label: 'Escapes' }
      ];
      joinByIndex<typeof legendData[number], SVGRectElement>(
        g, 'rect.legend-swatch', 'rect', legendData, 'legend-swatch',
        (sel) => {
          sel.attr('x', 10).attr('y', (_d, i) => 10 + i * 20)
            .attr('width', 15).attr('height', 15).attr('fill', (d) => d.color);
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
        min: bifurcationParam === 'a' ? 0.3 : 0.0,
        max: bifurcationParam === 'a' ? 1.5 : 0.6,
        step: 0.01
      };

      const fixedParams = { ...currentParams.params };
      delete (fixedParams as any)[bifurcationParam];

      const data = calculateDuffingBifurcation(bifurcationParam, paramRange, fixedParams, 1000);

      const xScale = d3.scaleLinear()
        .domain([paramRange.min, paramRange.max])
        .range([0, innerWidth]);

      const yScale = d3.scaleLinear()
        .domain([-2.5, 2.5])
        .range([innerHeight, 0]);

      joinByIndex<typeof data[number], SVGCircleElement>(
        g, 'circle.bif-point', 'circle', data, 'bif-point',
        (sel) => {
          sel.attr('cx', (d) => xScale(d.paramValue)).attr('cy', (d) => yScale(d.x))
            .attr('r', 0.5).attr('fill', 'var(--accent-magenta)').attr('opacity', 0.6);
        }
      );

      return {
        xScale,
        yScale,
        xLabel: `Parameter ${bifurcationParam}`,
        yLabel: 'x',
      };
    };

    const renderEnergyTrajectories = (g: d3.Selection<SVGGElement, unknown, null, undefined>,
                                     innerWidth: number, innerHeight: number) => {
      const initialConditions = [
        { x: -1.5, y: 0 }, { x: -1, y: 0 }, { x: -0.5, y: 0 },
        { x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1.5, y: 0 }
      ];

      const trajectories = calculateDuffingEnergyTrajectories(currentParams.params, initialConditions, 300);

      const xScale = d3.scaleLinear()
        .domain([0, 300])
        .range([0, innerWidth]);

      const yScale = d3.scaleLinear()
        .domain([-1, 2])
        .range([innerHeight, 0]);

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
      const line = d3.line<{x: number; y: number}>()
        .x((_d, i) => xScale(i))
        .y((d) => yScale(d.x))
        .curve(d3.curveLinear);

      joinByIndex<typeof trajectories[number], SVGPathElement>(
        g, 'path.energy-traj', 'path', trajectories, 'energy-traj',
        (sel) => {
          sel
            .attr('fill', 'none')
            .attr('stroke', (_d, i) => colorScale(String(i)) as string)
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.8)
            .attr('d', (d) => line(d.trajectory));
        }
      );
      joinByIndex<typeof trajectories[number], SVGTextElement>(
        g, 'text.energy-label', 'text', trajectories, 'energy-label',
        (sel) => {
          sel.attr('x', 10).attr('y', (_d, i) => 20 + i * 15)
            .style('fill', (_d, i) => colorScale(String(i)) as string)
            .style('font-size', '12px')
            .each(function (d) {
              const label = `${d.well} well`;
              if (this.firstChild && this.firstChild.nodeType === Node.TEXT_NODE) {
                if (this.firstChild.nodeValue !== label) this.firstChild.nodeValue = label;
              } else { this.textContent = label; }
            });
        }
      );

      return { xScale, yScale, xLabel: 'Time', yLabel: 'Position x' };
    };

    const getVisualizationTitle = () => {
      switch (visualizationType) {
        case 'attractor': return 'Duffing Attractor';
        case 'potential': return 'Double-Well Potential';
        case 'basins': return 'Basins of Attraction';
        case 'bifurcation': return 'Bifurcation Diagram';
        case 'energy': return 'Energy Trajectories';
        case 'phase': return 'Phase Space Density';
        default: return 'Duffing Map Visualization';
      }
    };

    const chart = initChartBase(svgRef, width, height, { background: 'rgba(0, 0, 0, 0.1)' });
    if (!chart) return;
    const { svg, g, innerWidth, innerHeight } = chart;

    // Attractor, basins and phase-space-density all plot x and y on the
    // same [-2.5, 2.5] (or [-2, 2] for basins) domain; equalAspectScales
    // keeps them undistorted instead of fitting each axis independently to
    // the 520x300 box. Potential, bifurcation and energy-trajectories keep
    // the wide box: position-vs-potential, parameter-vs-x and
    // time-vs-position are genuinely incommensurate axes.
    const densityDomain: [number, number] = [-2.5, 2.5];
    const squareViews = visualizationType === 'attractor' || visualizationType === 'phase' ||
      visualizationType === 'basins';
    const layout = squareViews
      ? equalAspectScales(
          visualizationType === 'basins' ? [-2, 2] : densityDomain,
          visualizationType === 'basins' ? [-2, 2] : densityDomain,
          innerWidth,
          innerHeight
        )
      : null;

    const usesDensityCanvas = visualizationType === 'attractor' || visualizationType === 'phase';
    if (usesDensityCanvas && canvasRef.current && layout) {
      // The 'attractor' and 'phase space density' views previously differed
      // only in which per-point coloring scheme they used (iteration order
      // vs. a hand-rolled linear density bucket) -- both are now the same
      // shared density field, so they render identically. Higher iteration
      // counts (attractorIterations) resolve finer structure in the folds.
      const data = calculateDuffingAttractor(currentParams.params, attractorIterations);
      renderDensityCanvas(
        canvasRef.current,
        data,
        densityDomain,
        densityDomain,
        width,
        height,
        {
          x: CHART_MARGIN.left + layout.offsetX,
          y: CHART_MARGIN.top + layout.offsetY,
          width: layout.plotWidth,
          height: layout.plotHeight,
        },
        d3.interpolateViridis
      );
    } else if (canvasRef.current) {
      // Clear any density paint left over from a previous render in the
      // 'attractor'/'phase' views -- `renderDensityCanvas` clears its
      // backing store before painting, so calling it with no points is
      // enough.
      renderDensityCanvas(canvasRef.current, [], densityDomain, densityDomain, width, height, {
        x: 0, y: 0, width, height,
      });
    }

    const dataGroup = createClippedDataGroup(
      svg,
      g,
      squareViews && layout
        ? { x: layout.offsetX, y: layout.offsetY, width: layout.plotWidth, height: layout.plotHeight }
        : { x: 0, y: 0, width: innerWidth, height: innerHeight },
      'duffing-plot-clip',
      visualizationType
    );

    // Render based on visualization type; non-square views return their axes scales.
    type AxisSpec = {
      xScale: d3.ScaleLinear<number, number>;
      yScale: d3.ScaleLinear<number, number>;
      xLabel: string;
      yLabel: string;
      offsetX?: number;
      offsetY?: number;
    };
    let axisSpec: AxisSpec | null = null;

    if ((visualizationType === 'attractor' || visualizationType === 'phase') && layout) {
      renderAttractorOverlay(dataGroup, layout.xScale, layout.yScale);
      axisSpec = {
        xScale: layout.xScale,
        yScale: layout.yScale,
        xLabel: 'x',
        yLabel: 'y',
        offsetX: layout.offsetX,
        offsetY: layout.offsetY,
      };
    } else if (visualizationType === 'potential') {
      axisSpec = renderPotential(dataGroup, innerWidth, innerHeight);
    } else if (visualizationType === 'basins' && layout) {
      renderBasins(dataGroup, layout.plotWidth, layout.plotHeight, layout.offsetX, layout.offsetY);
      axisSpec = {
        xScale: layout.xScale,
        yScale: layout.yScale,
        xLabel: 'x',
        yLabel: 'y',
        offsetX: layout.offsetX,
        offsetY: layout.offsetY,
      };
    } else if (visualizationType === 'bifurcation') {
      axisSpec = renderBifurcation(dataGroup, innerWidth, innerHeight);
    } else if (visualizationType === 'energy') {
      axisSpec = renderEnergyTrajectories(dataGroup, innerWidth, innerHeight);
    }

    if (axisSpec) {
      renderChartAxes(
        g,
        axisSpec.xScale,
        axisSpec.yScale,
        innerHeight,
        axisSpec.offsetX ?? 0,
        axisSpec.offsetY ?? 0
      );
      renderAxisLabelsRotated(
        g,
        innerWidth,
        innerHeight,
        CHART_MARGIN.left,
        axisSpec.xLabel,
        axisSpec.yLabel
      );
    }

    // Add title
    renderChartTitle(g, innerWidth, getVisualizationTitle());

  }, [currentParams, iterations, attractorIterations, visualizationType, bifurcationParam, fixedPoints]);

  return (
    <div className="p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Duffing Map Visualization</h3>

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

          {(visualizationType === 'attractor' || visualizationType === 'phase') ? (
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
              { value: 'attractor', label: 'Phase Space Attractor' },
              { value: 'potential', label: 'Double-Well Potential' },
              { value: 'basins', label: 'Basins of Attraction' },
              { value: 'bifurcation', label: 'Bifurcation Diagram' },
              { value: 'energy', label: 'Energy Trajectories' },
              { value: 'phase', label: 'Phase Space Density' },
            ]}
          />

          {visualizationType === 'bifurcation' && (
            <ViewModeSelect
              label="Bifurcation Parameter"
              value={bifurcationParam}
              onChange={(v) => setBifurcationParam(v as 'a' | 'b')}
              options={[
                { value: 'a', label: 'Parameter a (Well depth)' },
                { value: 'b', label: 'Parameter b (Damping)' },
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
              a = {currentParams.params.a.toFixed(2)} (Well depth)
            </p>
            <p className="text-xs text-gray-300 font-mono">
              b = {currentParams.params.b.toFixed(2)} (Damping)
            </p>
          </div>

          {/* Equations Display */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">Equations:</p>
            <p className="text-xs text-gray-300 font-mono">
              x&apos; = y
            </p>
            <p className="text-xs text-gray-300 font-mono">
              y&apos; = -b·y + a·x - x³
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Potential: V(x) = -0.5·a·x² + 0.25·x⁴
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

export default DuffingMapVisualization;