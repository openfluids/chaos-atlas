import type { RefObject } from 'react';
import * as d3 from 'd3';
import { isOrbitEscaped, SPARSE_OCCUPIED_BIN_THRESHOLD } from './densityField';

/**
 * Shared inner-margin used by every map visualization's SVG chart. All ten
 * components previously repeated this exact object; it is pulled out as a
 * constant (with an optional override) rather than a required parameter,
 * since every call site used the same value.
 */
export const CHART_MARGIN = { top: 40, right: 20, bottom: 60, left: 60 };

/** CSS class marking SVG nodes that survive across animation frames. */
export const CHART_STRUCTURAL_CLASS = 'chart-structural';

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
 * Drop direct children of the chart root that are not marked structural.
 * Components that still append ephemeral data marks (heat cells, orbits)
 * onto `g` each effect keep working without accumulating; axes/labels/clip
 * marked structural are preserved.
 */
function clearEphemeralChildren(
  g: d3.Selection<SVGGElement, unknown, null, undefined>
): void {
  const node = g.node();
  if (!node) return;
  Array.from(node.children).forEach((child) => {
    if (!child.classList.contains(CHART_STRUCTURAL_CLASS)) {
      child.remove();
    }
  });
}

/**
 * Select-or-append a structural group under `parent` with the given class.
 */
function selectOrAppendStructuralG(
  parent: d3.Selection<SVGGElement | SVGSVGElement, unknown, null, undefined>,
  className: string
): d3.Selection<SVGGElement, unknown, null, undefined> {
  let sel = parent.select<SVGGElement>(`g.${className}`);
  if (sel.empty()) {
    sel = parent
      .append('g')
      .attr('class', `${className} ${CHART_STRUCTURAL_CLASS}`);
  }
  return sel;
}

/**
 * Select-or-append a structural text node under `parent` with the given class.
 */
function selectOrAppendStructuralText(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  className: string
): d3.Selection<SVGTextElement, unknown, null, undefined> {
  let sel = parent.select<SVGTextElement>(`text.${className}`);
  if (sel.empty()) {
    sel = parent
      .append('text')
      .attr('class', `${className} ${CHART_STRUCTURAL_CLASS}`);
  }
  return sel;
}

/**
 * Idempotent chart bootstrap. On a re-run with the same svg ref and dimensions
 * it REUSES `g.chart-root` instead of wiping the SVG. A dimension change still
 * rebuilds from scratch. Ephemeral (non-structural) children are cleared so
 * call sites that append data marks each effect do not accumulate.
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

  const svg = d3.select(svgRef.current);
  const margin = options.margin ?? CHART_MARGIN;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const prevW = svg.attr('data-chart-width');
  const prevH = svg.attr('data-chart-height');
  if (prevW !== String(width) || prevH !== String(height)) {
    svg.selectAll('*').remove();
    svg.attr('data-chart-width', String(width));
    svg.attr('data-chart-height', String(height));
  }

  let g = svg.select<SVGGElement>('g.chart-root');
  if (g.empty()) {
    g = svg
      .append('g')
      .attr('class', `chart-root ${CHART_STRUCTURAL_CLASS}`);
  }
  g.attr('transform', `translate(${margin.left},${margin.top})`);

  clearEphemeralChildren(g);

  if (options.background) {
    let bg = g.select<SVGRectElement>('rect.chart-background');
    if (bg.empty()) {
      bg = g
        .append('rect')
        .attr('class', `chart-background ${CHART_STRUCTURAL_CLASS}`);
    }
    bg.attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', options.background)
      .attr('rx', 5);
  }

  return { svg, g, margin, innerWidth, innerHeight };
}

/** Fixed tick count so the data-join key can be the index (no exit churn). */
const AXIS_TICK_COUNT = 6;

/**
 * Format a tick like d3's default (trim trailing zeros / scientific).
 * Kept local so we do not re-`call` d3.axis (which keys ticks by value and
 * exits/enters nodes whenever the domain moves during playback).
 */
function formatTick(value: number): string {
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e4 || abs < 1e-3)) {
    return value.toExponential(1);
  }
  // Match typical d3-axis precision for map domains in [-10, 10].
  const s = d3.format('~g')(value);
  return s;
}

/**
 * Update text without the childList teardown that `textContent =` causes
 * (d3's `.text()` removes the old #text node and inserts a new one every
 * call — that alone was ~600 "removals" over 3 s of Hénon playback). Mutating
 * `nodeValue` is a characterData change, which is fine; structural nodes stay.
 */
function setTextContent(el: Element, value: string): void {
  const first = el.firstChild;
  if (first && first.nodeType === Node.TEXT_NODE) {
    if (first.nodeValue !== value) {
      first.nodeValue = value;
    }
    // Drop any extra children left over from prior content.
    while (first.nextSibling) {
      el.removeChild(first.nextSibling);
    }
    return;
  }
  el.textContent = value;
}

function setSelectionText<GElement extends Element>(
  sel: d3.Selection<GElement, unknown, null, undefined> | d3.Selection<GElement, number, SVGGElement, unknown>,
  value: string | ((d: number) => string)
): void {
  sel.each(function (d) {
    const v = typeof value === 'function' ? value(d as number) : value;
    setTextContent(this, v);
  });
}

/**
 * Evenly spaced tick values across `scale.domain()`, always `count` long so
 * the join key can be the index and nodes update in place as the domain moves.
 */
function fixedCountTicks(
  scale: d3.ScaleLinear<number, number>,
  count: number
): number[] {
  const [lo, hi] = scale.domain() as [number, number];
  if (!(count > 1) || !Number.isFinite(lo) || !Number.isFinite(hi)) {
    return [lo];
  }
  if (lo === hi) {
    return Array.from({ length: count }, () => lo);
  }
  return Array.from(
    { length: count },
    (_, i) => lo + (i / (count - 1)) * (hi - lo)
  );
}

/**
 * The `axisBottom`/`axisLeft` pair with `var(--text-secondary)` styling,
 * repeated verbatim (modulo scale) across several components.
 *
 * Idempotent: select-or-append `g.x-axis` / `g.y-axis` and update ticks in
 * place (index-keyed). Tick *text* may change as the domain moves; tick
 * *nodes* are not torn down each frame.
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
  const xRange = xScale.range() as [number, number];
  const yRange = yScale.range() as [number, number];
  // Plot edge length along each axis (letterboxed scales may not start at 0).
  const xLength = Math.abs(xRange[1] - xRange[0]);
  const yLength = Math.abs(yRange[1] - yRange[0]);
  // Domain path is drawn in axis-local coords starting at the scale's range
  // origin; offset the path by translating the axis group, then draw from 0.
  // For letterboxed scales the range is [offset, offset+len]; the axis group
  // sits at the plot edge so ticks use scale(d) which already includes offset.
  // Domain spine must span the full scale range, not [0, length].
  const xDomainStart = Math.min(xRange[0], xRange[1]);
  const yDomainStart = Math.min(yRange[0], yRange[1]);

  const xAxis = selectOrAppendStructuralG(g, 'x-axis');
  xAxis.attr('transform', `translate(0,${innerHeight - axisOffsetY})`);
  upsertLinearAxisBottom(xAxis, xScale, xDomainStart, xLength);

  const yAxis = selectOrAppendStructuralG(g, 'y-axis');
  yAxis.attr('transform', `translate(${axisOffsetX},0)`);
  upsertLinearAxisLeft(yAxis, yScale, yDomainStart, yLength);
}

function upsertLinearAxisBottom(
  axisG: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleLinear<number, number>,
  rangeStart: number,
  rangeLength: number
): void {
  const values = fixedCountTicks(scale, AXIS_TICK_COUNT);
  const tickSize = 6;

  let domainPath = axisG.select<SVGPathElement>('path.domain');
  if (domainPath.empty()) {
    domainPath = axisG.append('path').attr('class', 'domain');
  }
  domainPath.attr(
    'd',
    `M${rangeStart + 0.5},${tickSize}V0.5H${rangeStart + rangeLength - 0.5}V${tickSize}`
  );

  const ticks = axisG
    .selectAll<SVGGElement, number>('g.tick')
    .data(values, (_d, i) => String(i));

  const ticksEnter = ticks.enter().append('g').attr('class', 'tick');
  ticksEnter.append('line');
  ticksEnter.append('text');
  ticks.exit().remove();

  const merged = ticksEnter.merge(ticks);
  merged.attr('transform', (d) => `translate(${scale(d)},0)`);
  merged.select('line').attr('y2', tickSize).attr('x2', 0);
  const xLabels = merged
    .select('text')
    .attr('y', tickSize + 3)
    .attr('x', 0)
    .attr('dy', '0.71em')
    .attr('text-anchor', 'middle');
  setSelectionText(xLabels as d3.Selection<Element, number, SVGGElement, unknown>, formatTick);

  axisG.selectAll('text, line, path').style('color', 'var(--text-secondary)');
}

function upsertLinearAxisLeft(
  axisG: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleLinear<number, number>,
  rangeStart: number,
  rangeLength: number
): void {
  const values = fixedCountTicks(scale, AXIS_TICK_COUNT);
  const tickSize = 6;

  let domainPath = axisG.select<SVGPathElement>('path.domain');
  if (domainPath.empty()) {
    domainPath = axisG.append('path').attr('class', 'domain');
  }
  // y scale range is [bottom, top] (inverted); spine spans the plot height.
  domainPath.attr(
    'd',
    `M${-tickSize},${rangeStart + 0.5}H0.5V${rangeStart + rangeLength - 0.5}H${-tickSize}`
  );

  const ticks = axisG
    .selectAll<SVGGElement, number>('g.tick')
    .data(values, (_d, i) => String(i));

  const ticksEnter = ticks.enter().append('g').attr('class', 'tick');
  ticksEnter.append('line');
  ticksEnter.append('text');
  ticks.exit().remove();

  const merged = ticksEnter.merge(ticks);
  merged.attr('transform', (d) => `translate(0,${scale(d)})`);
  merged.select('line').attr('x2', -tickSize).attr('y2', 0);
  const yLabels = merged
    .select('text')
    .attr('x', -(tickSize + 3))
    .attr('y', 0)
    .attr('dy', '0.32em')
    .attr('text-anchor', 'end');
  setSelectionText(yLabels as d3.Selection<Element, number, SVGGElement, unknown>, formatTick);

  axisG.selectAll('text, line, path').style('color', 'var(--text-secondary)');
}

/**
 * Axis labels using the `transform`/rotate(-90) pattern shared by Arnold,
 * Baker's, Tent, Ikeda and Tinkerbell. `yLabel` is optional so call sites
 * that conditionally omit the y-label (e.g. symbolic-dynamics views) can
 * simply not pass it.
 *
 * Idempotent: select-or-append `text.x-axis-label` / `text.y-axis-label`.
 */
export function renderAxisLabelsRotated(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  innerWidth: number,
  innerHeight: number,
  marginLeft: number,
  xLabel: string,
  yLabel?: string
): void {
  {
    const t = selectOrAppendStructuralText(g, 'x-axis-label')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + 40})`)
      .style('text-anchor', 'middle')
      .style('fill', 'var(--text-primary)')
      .style('font-size', '14px');
    setSelectionText(t, xLabel);
  }

  if (yLabel !== undefined) {
    const t = selectOrAppendStructuralText(g, 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - marginLeft)
      .attr('x', 0 - (innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('fill', 'var(--text-primary)')
      .style('font-size', '14px');
    setSelectionText(t, yLabel);
  }
}

/**
 * Axis labels using the plain x/y attribute pattern shared by Hénon,
 * Standard Map and CML (no rotate-transform on the x-label, `text-secondary`
 * fill, no explicit font-size).
 *
 * Idempotent: select-or-append `text.x-axis-label` / `text.y-axis-label`.
 * Optional `offsetY` shifts the x-label with a letterboxed plot (Hénon).
 */
export function renderAxisLabelsPlain(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  innerWidth: number,
  innerHeight: number,
  xLabel: string,
  yLabel: string,
  offsetY = 0
): void {
  {
    const t = selectOrAppendStructuralText(g, 'x-axis-label')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight - offsetY + 45)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--text-secondary)');
    setSelectionText(t, xLabel);
  }

  {
    const t = selectOrAppendStructuralText(g, 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--text-secondary)');
    setSelectionText(t, yLabel);
  }
}

/**
 * Chart title style shared by Arnold, Baker's, Tent, Duffing, Ikeda and
 * Tinkerbell (`y = -10`, `text-primary`, 18px bold).
 *
 * Idempotent: select-or-append `text.chart-title`.
 */
export function renderChartTitle(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  innerWidth: number,
  title: string
): void {
  {
    const t = selectOrAppendStructuralText(g, 'chart-title')
      .attr('x', innerWidth / 2)
      .attr('y', 0 - 10)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--text-primary)')
      .style('font-size', '18px')
      .style('font-weight', 'bold');
    setSelectionText(t, title);
  }
}

/**
 * Chart title style shared by Standard Map, CML and Hénon (`y = -15`,
 * `text-accent`, bold, no explicit font-size).
 *
 * Idempotent: select-or-append `text.chart-title`.
 */
export function renderChartTitleAccent(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  innerWidth: number,
  title: string
): void {
  {
    const t = selectOrAppendStructuralText(g, 'chart-title')
      .attr('x', innerWidth / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--text-accent)')
      .style('font-weight', 'bold');
    setSelectionText(t, title);
  }
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
 * Pad a data extent by `fraction` of its span on each side (default 4 %).
 * The padded domain is what must reach `equalAspectScales` so extremes do
 * not sit on the axis spines. Zero/degenerate spans get a small absolute pad.
 */
export function padDomain(
  domain: [number, number],
  fraction = 0.04
): [number, number] {
  const [lo, hi] = domain;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return domain;
  }
  const span = hi - lo;
  if (!(span > 0)) {
    const base = Math.abs(lo) || 1;
    const pad = base * fraction;
    return [lo - pad, hi + pad];
  }
  const pad = span * fraction;
  return [lo - pad, hi + pad];
}

/** Default number of parameter samples used by {@link computeUnionOrbitDomain}. */
export const UNION_ORBIT_DOMAIN_SAMPLES = 20;

/**
 * In-plot / under-plot caption when the current orbit has no bounded attractor.
 * Shared so every map with an `isOrbitEscaped` path shows the same wording and
 * includes the live parameter value (escape must not read as a blank/broken plot).
 */
export function formatOrbitEscapeCaption(
  paramName: string,
  value: number,
  digits = 2
): string {
  return `no bounded attractor at ${paramName} = ${value.toFixed(digits)} (orbit escapes)`;
}

/**
 * Preset-driven escape caption (same wording family as
 * {@link formatOrbitEscapeCaption}; these attractor views are preset-driven
 * rather than single-parameter sliders).
 */
export function formatPresetOrbitEscapeCaption(presetName: string): string {
  return `no bounded attractor at preset "${presetName}" (orbit escapes)`;
}

/**
 * Caption when a bounded orbit has collapsed to a fixed point or short cycle.
 * Period is the count of distinct finite points (see {@link countDistinctOrbitPoints}).
 */
export function formatOrbitSettledCaption(period: number): string {
  if (period <= 1) return 'settled to a fixed point';
  return `settled to a period-${period} cycle`;
}

export type OrbitPoint = { x: number; y: number };

/**
 * Fixed iteration count used when fitting attractor axes. Must not track the
 * live "Attractor Iterations" slider — a moving ruler under that sweep is
 * unreadable (cycles 15 / 19). Components sample the orbit once at this
 * count for domain + classification, then paint at the slider value.
 */
export const ATTRACTOR_DOMAIN_REF_ITERATIONS = 50_000;

/**
 * Distinct finite (x, y) at `decimals` places. Matches the preset audit's
 * 9-decimal quantization so period-n lines up with measured periods.
 */
export function countDistinctOrbitPoints(
  points: readonly OrbitPoint[],
  decimals = 9
): number {
  const seen = new Set<string>();
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    seen.add(`${p.x.toFixed(decimals)},${p.y.toFixed(decimals)}`);
  }
  return seen.size;
}

export type OrbitQuality =
  | { kind: 'escaped'; caption: string; distinct: number }
  | { kind: 'degenerate'; caption: string; period: number; distinct: number }
  | { kind: 'healthy'; caption: null; distinct: number };

/**
 * Classify a sampled orbit for attractor presentation: escaped, short cycle,
 * or healthy. Degeneracy uses the same short-cycle ceiling as the density
 * sparse path ({@link SPARSE_OCCUPIED_BIN_THRESHOLD}): the period-doubling
 * cascade runs through periods 2…256… before chaos; 512 covers that cascade.
 * Do not invent a second threshold without updating that comment.
 */
export function classifyOrbit(
  points: readonly OrbitPoint[],
  options: { presetName: string; shortCycleMax?: number }
): OrbitQuality {
  // Same threshold the density sparse path uses for "too few bins to paint
  // as a field" — short cycles and the period-doubling cascade land here.
  const shortCycleMax = options.shortCycleMax ?? SPARSE_OCCUPIED_BIN_THRESHOLD;
  const distinct = countDistinctOrbitPoints(points);

  if (isOrbitEscaped(points) || distinct === 0) {
    return {
      kind: 'escaped',
      caption: formatPresetOrbitEscapeCaption(options.presetName),
      distinct,
    };
  }

  if (distinct <= shortCycleMax) {
    return {
      kind: 'degenerate',
      period: distinct,
      caption: formatOrbitSettledCaption(distinct),
      distinct,
    };
  }

  return { kind: 'healthy', caption: null, distinct };
}

/**
 * Fit x/y domains to a reference orbit via {@link padDomain}. Escaped or
 * empty orbits keep `fallback` (the component's hardcoded window).
 *
 * Pass an orbit sampled at a FIXED reference iteration count (see
 * {@link ATTRACTOR_DOMAIN_REF_ITERATIONS}), never the live render count.
 */
export function fitOrbitDomain(
  points: readonly OrbitPoint[],
  fallback: { x: [number, number]; y: [number, number] },
  padFraction = 0.04
): { xDomain: [number, number]; yDomain: [number, number]; fitted: boolean } {
  if (isOrbitEscaped(points)) {
    return { xDomain: fallback.x, yDomain: fallback.y, fitted: false };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY)
  ) {
    return { xDomain: fallback.x, yDomain: fallback.y, fitted: false };
  }

  return {
    xDomain: padDomain([minX, maxX], padFraction),
    yDomain: padDomain([minY, maxY], padFraction),
    fitted: true,
  };
}

/**
 * Domain fit that always samples at `referenceIterations` (default
 * {@link ATTRACTOR_DOMAIN_REF_ITERATIONS}). The live paint iteration count
 * is intentionally not an argument — changing it must not move the axes.
 */
export function fitAttractorDomainFromReference(
  sampleOrbit: (iterations: number) => readonly OrbitPoint[],
  fallback: { x: [number, number]; y: [number, number] },
  referenceIterations: number = ATTRACTOR_DOMAIN_REF_ITERATIONS,
  padFraction = 0.04
): { xDomain: [number, number]; yDomain: [number, number]; fitted: boolean } {
  return fitOrbitDomain(
    sampleOrbit(referenceIterations),
    fallback,
    padFraction
  );
}

export type UnionOrbitDomainOptions = {
  /**
   * Produce one orbit at a single sample of the swept parameter. Other
   * parameters must be closed over at their current (held) values.
   */
  sampleOrbit: (paramValue: number) => readonly OrbitPoint[];
  /** Inclusive lower end of the swept parameter's slider range. */
  min: number;
  /** Inclusive upper end of the swept parameter's slider range. */
  max: number;
  /** Samples across [min, max], inclusive of both ends. Default 20. */
  sampleCount?: number;
  /** Padding fraction applied once to the final union. Default 0.04. */
  padFraction?: number;
  /**
   * Returned as the domains when every sample is escaped / non-finite, so the
   * caller can fall back to per-frame behaviour.
   */
  fallback: { x: [number, number]; y: [number, number] };
};

export type UnionOrbitDomain = {
  xDomain: [number, number];
  yDomain: [number, number];
  /** True when no sample contributed a bounded extent. */
  allEscaped: boolean;
  /** How many samples entered the union (not escaped). */
  contributed: number;
};

/**
 * Compute a single x/y domain as the UNION of orbit extents over a cheap
 * parameter sweep. Use this for axes and canvas mapping during playback so
 * the ruler does not move under the animation.
 *
 * Escaped / divergent samples (via {@link isOrbitEscaped}) are skipped and
 * do not poison the union. If every sample escapes, returns `fallback` with
 * `allEscaped: true` — the caller should keep its existing per-frame path.
 *
 * Padding is applied once to the final union (not per sample).
 */
export function computeUnionOrbitDomain(
  options: UnionOrbitDomainOptions
): UnionOrbitDomain {
  const {
    sampleOrbit,
    min,
    max,
    sampleCount = UNION_ORBIT_DOMAIN_SAMPLES,
    padFraction = 0.04,
    fallback,
  } = options;

  const n = Math.max(2, Math.floor(sampleCount));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let contributed = 0;

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const paramValue = min + t * (max - min);
    const points = sampleOrbit(paramValue);
    if (isOrbitEscaped(points)) continue;

    let any = false;
    for (const p of points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      any = true;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    if (any) contributed += 1;
  }

  if (
    contributed === 0 ||
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY)
  ) {
    return {
      xDomain: fallback.x,
      yDomain: fallback.y,
      allEscaped: true,
      contributed: 0,
    };
  }

  return {
    xDomain: padDomain([minX, maxX], padFraction),
    yDomain: padDomain([minY, maxY], padFraction),
    allEscaped: false,
    contributed,
  };
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
 * When `mode` is set and differs from the group's last mode, wipe its
 * children once. Same-mode re-renders keep marks so keyed joins can update
 * them in place. Mode is the visualization type (or any caller-chosen
 * string that changes when the mark set identity changes).
 */
function applyDataGroupMode(
  dataG: d3.Selection<SVGGElement, unknown, null, undefined>,
  mode?: string
): void {
  if (mode === undefined) return;
  const prev = dataG.attr('data-mode');
  if (prev !== mode) {
    dataG.selectAll('*').remove();
    dataG.attr('data-mode', mode);
  }
}

/**
 * Structural `g.chart-data` without a clip path. Survives `clearEphemeralChildren`
 * on the chart root; callers put keyed-joined data marks inside.
 */
export function ensureChartDataGroup(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  mode?: string
): d3.Selection<SVGGElement, unknown, null, undefined> {
  let dataG = g.select<SVGGElement>('g.chart-data');
  if (dataG.empty()) {
    dataG = g
      .append('g')
      .attr('class', `chart-data ${CHART_STRUCTURAL_CLASS}`);
  }
  applyDataGroupMode(dataG, mode);
  return dataG;
}

/**
 * Appends (or reuses) a `<clipPath>` in the chart's `<defs>` and returns a
 * structural `g.chart-data` clipped to the given rectangle. Idempotent: the
 * same `clipId` and group are updated in place.
 *
 * Data marks are NOT cleared every call — use keyed `.data(..., key).join`
 * (or `joinByIndex` / `upsertMark`) so marks update in place. Pass `mode`
 * (e.g. visualization type) to wipe once when the mark identity set changes.
 *
 * `svg` (not just `g`) is needed because `<clipPath>` must live in `<defs>`
 * at the svg root, not nested under the translated chart group.
 */
export function createClippedDataGroup(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  rect: { x?: number; y?: number; width: number; height: number },
  clipId: string,
  mode?: string
): d3.Selection<SVGGElement, unknown, null, undefined> {
  let defs = svg.select<SVGDefsElement>('defs');
  if (defs.empty()) {
    defs = svg.append('defs');
  }

  let clipPath = defs.select<SVGClipPathElement>(`clipPath#${clipId}`);
  if (clipPath.empty()) {
    clipPath = defs.append('clipPath').attr('id', clipId);
  }

  let clipRect = clipPath.select<SVGRectElement>('rect');
  if (clipRect.empty()) {
    clipRect = clipPath.append('rect');
  }
  clipRect
    .attr('x', rect.x ?? 0)
    .attr('y', rect.y ?? 0)
    .attr('width', rect.width)
    .attr('height', rect.height);

  let dataG = g.select<SVGGElement>('g.chart-data');
  if (dataG.empty()) {
    dataG = g
      .append('g')
      .attr('class', `chart-data ${CHART_STRUCTURAL_CLASS}`)
      .attr('clip-path', `url(#${clipId})`);
  } else {
    dataG.attr('clip-path', `url(#${clipId})`);
  }
  applyDataGroupMode(dataG, mode);

  return dataG;
}

/**
 * Select-or-append a single mark node (`path`, `line`, `circle`, …) by class
 * under `parent`. Reused across frames so attributes can be updated without
 * a remove+append cycle.
 */
export function upsertMark<GElement extends SVGElement>(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  tagName: string,
  className: string
): d3.Selection<GElement, unknown, null, undefined> {
  let sel = parent.select<GElement>(`${tagName}.${className}`);
  if (sel.empty()) {
    sel = parent
      .append(tagName as keyof SVGElementTagNameMap)
      .attr('class', className) as unknown as d3.Selection<
      GElement,
      unknown,
      null,
      undefined
    >;
  }
  return sel;
}

/**
 * Index-keyed data join: enter/update/exit with a stable key of `String(i)`.
 * Prefer this over enter-only `.data(...).enter().append(...)` so playback
 * re-renders update attributes instead of tearing down nodes.
 */
export function joinByIndex<Datum, GElement extends d3.BaseType>(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  selector: string,
  tagName: string,
  data: Datum[],
  className: string,
  update: (
    sel: d3.Selection<GElement, Datum, SVGGElement, unknown>
  ) => void
): void {
  const joined = parent
    .selectAll<GElement, Datum>(selector)
    .data(data, (_d, i) => String(i));

  const enter = joined
    .enter()
    .append(tagName as keyof SVGElementTagNameMap) as unknown as d3.Selection<
    GElement,
    Datum,
    SVGGElement,
    unknown
  >;
  if (className) {
    enter.attr('class', className);
  }
  joined.exit().remove();
  update(
    enter.merge(joined as unknown as d3.Selection<GElement, Datum, SVGGElement, unknown>)
  );
}
