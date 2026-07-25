import type { RefObject } from 'react';
import * as d3 from 'd3';

/**
 * Shared inner-margin used by every map visualization's SVG chart. All ten
 * components previously repeated this exact object; it is pulled out as a
 * constant (with an optional override) rather than a required parameter,
 * since every call site used the same value.
 */
export const CHART_MARGIN = { top: 40, right: 20, bottom: 60, left: 60 };

export interface ChartBase {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  margin: typeof CHART_MARGIN;
  innerWidth: number;
  innerHeight: number;
}

export interface InitChartBaseOptions {
  /** Override the default margin. All current call sites use the default. */
  margin?: typeof CHART_MARGIN;
  /** Fill color for the translucent background rect. Omit to skip the rect. */
  background?: string;
}

/**
 * Clears the SVG, creates the translated `<g>` group and (optionally) the
 * background rect that every map visualization sets up identically at the
 * start of its render effect.
 *
 * Returns `null` when the svg ref isn't attached yet, mirroring the
 * `if (!svgRef.current) return;` guard every component used inline.
 */
export function initChartBase(
  svgRef: RefObject<SVGSVGElement | null>,
  width: number,
  height: number,
  options: InitChartBaseOptions = {}
): ChartBase | null {
  if (!svgRef.current) return null;

  d3.select(svgRef.current).selectAll('*').remove();

  const svg = d3.select(svgRef.current);
  const margin = options.margin ?? CHART_MARGIN;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  if (options.background) {
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', options.background)
      .attr('rx', 5);
  }

  return { svg, g, margin, innerWidth, innerHeight };
}

/**
 * The `axisBottom`/`axisLeft` pair with `var(--text-secondary)` styling,
 * repeated verbatim (modulo scale) across several components.
 *
 * `axisOffsetX`/`axisOffsetY` default to 0 (the previous, always-correct
 * behavior for a scale that fills the whole inner box). When `xScale`/
 * `yScale` come from `equalAspectScales` and the box isn't already square,
 * the letterboxed plot rect sits inset from the inner box's origin/bottom
 * by `offsetX`/`offsetY` -- pass those through so the axis lines meet the
 * plot rather than the (padded) inner box edge.
 */
export function renderChartAxes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  innerHeight: number,
  axisOffsetX = 0,
  axisOffsetY = 0
): void {
  g.append('g')
    .attr('transform', `translate(0,${innerHeight - axisOffsetY})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text, line, path')
    .style('color', 'var(--text-secondary)');

  g.append('g')
    .attr('transform', `translate(${axisOffsetX},0)`)
    .call(d3.axisLeft(yScale))
    .selectAll('text, line, path')
    .style('color', 'var(--text-secondary)');
}

/**
 * Axis labels using the `transform`/rotate(-90) pattern shared by Arnold,
 * Baker's, Tent, Ikeda and Tinkerbell. `yLabel` is optional so call sites
 * that conditionally omit the y-label (e.g. symbolic-dynamics views) can
 * simply not pass it.
 */
export function renderAxisLabelsRotated(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  innerWidth: number,
  innerHeight: number,
  marginLeft: number,
  xLabel: string,
  yLabel?: string
): void {
  g.append('text')
    .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + 40})`)
    .style('text-anchor', 'middle')
    .style('fill', 'var(--text-primary)')
    .style('font-size', '14px')
    .text(xLabel);

  if (yLabel !== undefined) {
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - marginLeft)
      .attr('x', 0 - (innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('fill', 'var(--text-primary)')
      .style('font-size', '14px')
      .text(yLabel);
  }
}

/**
 * Axis labels using the plain x/y attribute pattern shared by Hénon,
 * Standard Map and CML (no rotate-transform on the x-label, `text-secondary`
 * fill, no explicit font-size).
 */
export function renderAxisLabelsPlain(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  innerWidth: number,
  innerHeight: number,
  xLabel: string,
  yLabel: string
): void {
  g.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 45)
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--text-secondary)')
    .text(xLabel);

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--text-secondary)')
    .text(yLabel);
}

/**
 * Chart title style shared by Arnold, Baker's, Tent, Duffing, Ikeda and
 * Tinkerbell (`y = -10`, `text-primary`, 18px bold).
 */
export function renderChartTitle(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  innerWidth: number,
  title: string
): void {
  g.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', 0 - 10)
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--text-primary)')
    .style('font-size', '18px')
    .style('font-weight', 'bold')
    .text(title);
}

/**
 * Chart title style shared by Standard Map, CML and Hénon (`y = -15`,
 * `text-accent`, bold, no explicit font-size).
 */
export function renderChartTitleAccent(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  innerWidth: number,
  title: string
): void {
  g.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', -15)
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--text-accent)')
    .style('font-weight', 'bold')
    .text(title);
}

export interface EqualAspectResult {
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  /** Width in px of the (letterboxed) square-aspect plot area. */
  plotWidth: number;
  /** Height in px of the (letterboxed) square-aspect plot area. */
  plotHeight: number;
  /** Offset of the plot area from the left edge of the inner chart box. */
  offsetX: number;
  /** Offset of the plot area from the top edge of the inner chart box. */
  offsetY: number;
  /** Pixels per data unit, identical in x and y by construction -- this is
   *  the number that must match for the geometry to be undistorted. */
  pixelsPerUnit: number;
}

/**
 * Builds x/y scales that preserve the aspect ratio of `xDomain`/`yDomain`
 * inside an `innerWidth`×`innerHeight` box, letterboxing (centering with
 * padding on the shorter axis) rather than stretching either domain
 * independently to fill the box.
 *
 * Several map visualizations have domains that are geometrically meaningful
 * squares (the Arnold cat map and Baker's map are measure-preserving on
 * [0,1]², the Standard map's (θ, p) both live on [0, 2π)) or otherwise
 * commensurate axes (Hénon, Ikeda, Tinkerbell, Duffing phase portraits).
 * Fitting those independently to a 520×300 box shears the picture; this
 * keeps one scale factor for both axes.
 */
export function equalAspectScales(
  xDomain: [number, number],
  yDomain: [number, number],
  innerWidth: number,
  innerHeight: number
): EqualAspectResult {
  const xSpan = xDomain[1] - xDomain[0];
  const ySpan = yDomain[1] - yDomain[0];
  const pixelsPerUnit = Math.min(innerWidth / xSpan, innerHeight / ySpan);

  const plotWidth = xSpan * pixelsPerUnit;
  const plotHeight = ySpan * pixelsPerUnit;
  const offsetX = (innerWidth - plotWidth) / 2;
  const offsetY = (innerHeight - plotHeight) / 2;

  const xScale = d3.scaleLinear()
    .domain(xDomain)
    .range([offsetX, offsetX + plotWidth]);

  const yScale = d3.scaleLinear()
    .domain(yDomain)
    .range([offsetY + plotHeight, offsetY]);

  return { xScale, yScale, plotWidth, plotHeight, offsetX, offsetY, pixelsPerUnit };
}

/**
 * Appends a `<clipPath>` to the chart's `<defs>` and returns a `<g>` clipped
 * to the inner chart rectangle (or, for phase portraits, the letterboxed
 * square plot rectangle within it). Data marks go in the returned group so
 * out-of-range points cannot paint over the axes/frame -- previously no
 * chart in this codebase clipped its data layer at all.
 *
 * `svg` (not just `g`) is needed because `<clipPath>` must live in `<defs>`
 * at the svg root, not nested under the translated chart group.
 */
export function createClippedDataGroup(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  rect: { x?: number; y?: number; width: number; height: number },
  clipId: string
): d3.Selection<SVGGElement, unknown, null, undefined> {
  svg.append('defs')
    .append('clipPath')
    .attr('id', clipId)
    .append('rect')
    .attr('x', rect.x ?? 0)
    .attr('y', rect.y ?? 0)
    .attr('width', rect.width)
    .attr('height', rect.height);

  return g.append('g').attr('clip-path', `url(#${clipId})`);
}
