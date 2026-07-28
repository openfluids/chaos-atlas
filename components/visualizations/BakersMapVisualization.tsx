"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  calculateBakersMap,
  calculateBakersMixing,
  calculateBakersSymbolicDynamics,
  calculateBakersImageScrambling,
  calculateBakersInvariantMeasure,
  calculateBakersTopologicalEntropy,
  calculateBakersKSEntropy,
  calculateBakersPhaseSpacePartition
} from '@/lib/maps/bakers';
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
} from './chartHelpers';

type Pt = { x: number; y: number };

const BakersMapVisualization: React.FC = () => {
  const [initialX, setInitialX] = useState(0.3);
  const [initialY, setInitialY] = useState(0.3);
  const [iterations, setIterations] = useState(50);
  const [visualizationType, setVisualizationType] = useState('trajectory');
  const [mixingPoints, setMixingPoints] = useState(20);
  const [isAnimating, setIsAnimating] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 600;
  const height = 400;

  const animationPlaying =
    isAnimating && visualizationType === 'scrambling';

  const { step: animationStep, reset: resetAnimation } = useSteppedAnimation({
    playing: animationPlaying,
    periodMs: 500,
    modulus: 10,
  });

  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
    if (!isAnimating) resetAnimation();
  };

  useEffect(() => {
    const renderTrajectory = (
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      xScale: d3.ScaleLinear<number, number>,
      yScale: d3.ScaleLinear<number, number>
    ) => {
      const data = calculateBakersMap({ x: initialX, y: initialY }, iterations);

      const line = d3.line<Pt>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y))
        .curve(d3.curveLinear);

      upsertMark<SVGPathElement>(parent, 'path', 'traj-line')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.8)
        .attr('d', line);

      joinByIndex<Pt, SVGCircleElement>(
        parent,
        'circle.traj-point',
        'circle',
        data,
        'traj-point',
        (sel) => {
          sel
            .attr('cx', (d) => xScale(d.x))
            .attr('cy', (d) => yScale(d.y))
            .attr('r', 2)
            .attr('fill', 'var(--accent-cyan)')
            .attr('opacity', (_d, i) => 0.3 + (0.7 * i) / Math.max(data.length, 1));
        }
      );
    };

    const renderMixing = (
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      xScale: d3.ScaleLinear<number, number>,
      yScale: d3.ScaleLinear<number, number>
    ) => {
      const trajectories = calculateBakersMixing(mixingPoints, iterations);
      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
      const line = d3.line<Pt>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y))
        .curve(d3.curveLinear);

      joinByIndex<Pt[], SVGPathElement>(
        parent,
        'path.mix-traj',
        'path',
        trajectories,
        'mix-traj',
        (sel) => {
          sel
            .attr('fill', 'none')
            .attr('stroke', (_d, i) => colorScale(String(i)) as string)
            .attr('stroke-width', 1)
            .attr('opacity', 0.6)
            .attr('d', (d) => line(d));
        }
      );

      const starts = trajectories
        .map((t, i) => (t.length > 0 ? { ...t[0], i } : null))
        .filter((p): p is Pt & { i: number } => p != null);

      joinByIndex<Pt & { i: number }, SVGCircleElement>(
        parent,
        'circle.mix-start',
        'circle',
        starts,
        'mix-start',
        (sel) => {
          sel
            .attr('cx', (d) => xScale(d.x))
            .attr('cy', (d) => yScale(d.y))
            .attr('r', 3)
            .attr('fill', (d) => colorScale(String(d.i)) as string);
        }
      );
    };

    const renderImageScrambling = (
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      xScale: d3.ScaleLinear<number, number>,
      yScale: d3.ScaleLinear<number, number>,
      plotWidth: number,
      plotHeight: number
    ) => {
      const frames = calculateBakersImageScrambling(16, 16, 10);
      const currentFrame = frames[animationStep];
      const cells: {
        x: number;
        y: number;
        r: number;
        g: number;
        b: number;
      }[] = [];
      currentFrame.forEach((row) => {
        row.forEach((point) => {
          cells.push({
            x: point.x,
            y: point.y,
            r: point.color.r,
            g: point.color.g,
            b: point.color.b,
          });
        });
      });

      joinByIndex<typeof cells[number], SVGRectElement>(
        parent,
        'rect.scramble-cell',
        'rect',
        cells,
        'scramble-cell',
        (sel) => {
          sel
            .attr('x', (d) => xScale(d.x) - plotWidth / 32)
            .attr('y', (d) => yScale(d.y) - plotHeight / 32)
            .attr('width', plotWidth / 16)
            .attr('height', plotHeight / 16)
            .attr('fill', (d) => `rgb(${d.r}, ${d.g}, ${d.b})`)
            .attr('stroke', 'none')
            .attr('opacity', 0.8);
        }
      );
    };

    const renderInvariantMeasure = (
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      plotWidth: number,
      plotHeight: number,
      offsetX: number,
      offsetY: number
    ) => {
      const data = calculateBakersInvariantMeasure(5000, 20);
      const binWidth = plotWidth / 20;
      const binHeight = plotHeight / 20;
      const cells: { x: number; y: number; value: number }[] = [];
      data.forEach((row, y) => {
        row.forEach((value, x) => {
          cells.push({ x, y, value });
        });
      });

      joinByIndex<typeof cells[number], SVGRectElement>(
        parent,
        'rect.measure-cell',
        'rect',
        cells,
        'measure-cell',
        (sel) => {
          sel
            .attr('x', (d) => offsetX + d.x * binWidth)
            .attr('y', (d) => offsetY + d.y * binHeight)
            .attr('width', binWidth)
            .attr('height', binHeight)
            .attr('fill', 'var(--accent-cyan)')
            .attr('opacity', (d) => d.value)
            .attr('stroke', 'var(--text-secondary)')
            .attr('stroke-width', 0.5);
        }
      );
    };

    const renderPhaseSpacePartition = (
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      xScale: d3.ScaleLinear<number, number>,
      plotWidth: number,
      plotHeight: number,
      offsetX: number,
      offsetY: number
    ) => {
      const { grid } = calculateBakersPhaseSpacePartition(16);
      const binWidth = plotWidth / 16;
      const binHeight = plotHeight / 16;
      const cells: { x: number; y: number; value: number }[] = [];
      grid.forEach((row, y) => {
        row.forEach((value, x) => {
          cells.push({ x, y, value });
        });
      });

      joinByIndex<typeof cells[number], SVGRectElement>(
        parent,
        'rect.partition-cell',
        'rect',
        cells,
        'partition-cell',
        (sel) => {
          sel
            .attr('x', (d) => offsetX + d.x * binWidth)
            .attr('y', (d) => offsetY + d.y * binHeight)
            .attr('width', binWidth)
            .attr('height', binHeight)
            .attr('fill', (d) =>
              d.value === 0 ? 'var(--accent-cyan)' : 'var(--accent-orange)'
            )
            .attr('opacity', 0.6)
            .attr('stroke', 'var(--text-secondary)')
            .attr('stroke-width', 0.5);
        }
      );

      upsertMark<SVGLineElement>(parent, 'line', 'partition-boundary')
        .attr('x1', xScale(0.5))
        .attr('y1', offsetY)
        .attr('x2', xScale(0.5))
        .attr('y2', offsetY + plotHeight)
        .attr('stroke', 'var(--text-primary)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
    };

    const renderSymbolicDynamics = (
      parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      xScale: d3.ScaleLinear<number, number>,
      yScale: d3.ScaleLinear<number, number>
    ) => {
      const symbols = calculateBakersSymbolicDynamics({ x: initialX, y: initialY }, 50);
      const data = calculateBakersMap({ x: initialX, y: initialY }, 50);

      const line = d3.line<Pt>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y))
        .curve(d3.curveLinear);

      upsertMark<SVGPathElement>(parent, 'path', 'traj-line')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.5)
        .attr('d', line);

      const labeled = data.slice(0, Math.min(20, data.length)).map((p, i) => ({
        ...p,
        symbol: symbols[i],
      }));

      joinByIndex<typeof labeled[number], SVGTextElement>(
        parent,
        'text.symbol-label',
        'text',
        labeled,
        'symbol-label',
        (sel) => {
          sel
            .attr('x', (d) => xScale(d.x))
            .attr('y', (d) => yScale(d.y))
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('fill', 'var(--text-primary)')
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .each(function (d) {
              if (this.firstChild && this.firstChild.nodeType === Node.TEXT_NODE) {
                if (this.firstChild.nodeValue !== d.symbol) {
                  this.firstChild.nodeValue = d.symbol;
                }
              } else {
                this.textContent = d.symbol;
              }
            });
        }
      );
    };

    const getVisualizationTitle = () => {
      switch (visualizationType) {
        case 'trajectory': return "Baker's Map Trajectory";
        case 'mixing': return 'Mixing Behavior';
        case 'scrambling': return 'Image Scrambling';
        case 'invariant': return 'Invariant Measure';
        case 'partition': return 'Phase Space Partition';
        case 'symbolic': return 'Symbolic Dynamics';
        default: return "Baker's Map Visualization";
      }
    };

    const chart = initChartBase(svgRef, width, height, { background: 'rgba(0, 0, 0, 0.1)' });
    if (!chart) return;
    const { svg, g, margin, innerWidth, innerHeight } = chart;

    const { xScale, yScale, plotWidth, plotHeight, offsetX, offsetY } =
      equalAspectScales([0, 1], [0, 1], innerWidth, innerHeight);

    const dataGroup = createClippedDataGroup(
      svg,
      g,
      { x: offsetX, y: offsetY, width: plotWidth, height: plotHeight },
      'bakers-plot-clip',
      visualizationType
    );

    if (visualizationType === 'trajectory') {
      renderTrajectory(dataGroup, xScale, yScale);
    } else if (visualizationType === 'mixing') {
      renderMixing(dataGroup, xScale, yScale);
    } else if (visualizationType === 'scrambling') {
      renderImageScrambling(dataGroup, xScale, yScale, plotWidth, plotHeight);
    } else if (visualizationType === 'invariant') {
      renderInvariantMeasure(dataGroup, plotWidth, plotHeight, offsetX, offsetY);
    } else if (visualizationType === 'partition') {
      renderPhaseSpacePartition(dataGroup, xScale, plotWidth, plotHeight, offsetX, offsetY);
    } else if (visualizationType === 'symbolic') {
      renderSymbolicDynamics(dataGroup, xScale, yScale);
    }

    renderChartAxes(g, xScale, yScale, innerHeight, offsetX, offsetY);
    renderAxisLabelsRotated(g, innerWidth, innerHeight, margin.left, 'x', 'y');
    renderChartTitle(g, innerWidth, getVisualizationTitle());

  }, [initialX, initialY, iterations, visualizationType, mixingPoints, animationStep]);

  return (
    <div className="bakers-map-visualization p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Baker&apos;s Map Visualization</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <ParamSlider
            label={<>Initial x₀: {initialX.toFixed(2)}</>}
            min={0.01}
            max={0.99}
            step={0.01}
            value={initialX}
            onChange={setInitialX}
          />

          <ParamSlider
            label={<>Initial y₀: {initialY.toFixed(2)}</>}
            min={0.01}
            max={0.99}
            step={0.01}
            value={initialY}
            onChange={setInitialY}
          />

          <ParamSlider
            label={<>Iterations: {iterations}</>}
            min={10}
            max={200}
            step={5}
            value={iterations}
            onChange={setIterations}
            parse={parseInt}
          />

          {visualizationType === 'mixing' && (
            <ParamSlider
              label={<>Mixing Points: {mixingPoints}</>}
              min={5}
              max={50}
              step={5}
              value={mixingPoints}
              onChange={setMixingPoints}
              parse={parseInt}
            />
          )}

          <ViewModeSelect
            label="Visualization Type"
            value={visualizationType}
            onChange={setVisualizationType}
            options={[
              { value: 'trajectory', label: 'Single Trajectory' },
              { value: 'mixing', label: 'Mixing Behavior' },
              { value: 'scrambling', label: 'Image Scrambling' },
              { value: 'invariant', label: 'Invariant Measure' },
              { value: 'partition', label: 'Phase Space Partition' },
              { value: 'symbolic', label: 'Symbolic Dynamics' },
            ]}
          />

          {visualizationType === 'scrambling' && (
            <button
              onClick={toggleAnimation}
              data-testid="animation-step"
              data-step={animationStep}
              className="w-full p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              {isAnimating ? 'Stop Animation' : 'Start Animation'}
            </button>
          )}

          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">Lyapunov Exponents:</p>
            <p className="text-xs text-gray-300 font-mono">
              λ₁ = +{calculateBakersKSEntropy().toFixed(6)}
            </p>
            <p className="text-xs text-gray-300 font-mono">
              λ₂ = -{calculateBakersKSEntropy().toFixed(6)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Analytic, not measured: the map stretches x by 2 and contracts y by
              1/2 at every point, so λ = ±ln 2 everywhere. They sum to zero
              because the map preserves area.
            </p>
          </div>

          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm text-gray-300">
              <span className="font-medium text-cyan-400">Topological Entropy:</span> {calculateBakersTopologicalEntropy().toFixed(4)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Exact value: ln(2) - represents exponential mixing rate
            </p>
          </div>

          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">Equations:</p>
            <p className="text-xs text-gray-300 font-mono">
              xₙ₊₁ = 2·xₙ (mod 1)
            </p>
            <p className="text-xs text-gray-300 font-mono">
              yₙ₊₁ = {initialX < 0.5 ? 'yₙ/2' : '(yₙ + 1)/2'}
            </p>
          </div>
        </div>

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

export default BakersMapVisualization;
