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
 */
export function renderChartAxes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  innerHeight: number
): void {
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text, line, path')
    .style('color', 'var(--text-secondary)');

  g.append('g')
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
