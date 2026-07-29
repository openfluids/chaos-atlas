/**
 * Unit tests for Henon held-domain selection wiring.
 *
 * Pins: matchHenonSweptKey identity map, and that selecting henon-b drives
 * computeUnionOrbitDomain over b's slider range while sampling b (not a).
 * Paint stack is stubbed; assertions land on the domain-call args only.
 */
jest.mock('d3', () => require('./mockVizDeps').d3Mock);
jest.mock('@/components/visualizations/chartHelpers', () => {
  const base = require('./mockVizDeps').chartHelpersMock;
  return {
    ...base,
    computeUnionOrbitDomain: jest.fn(() => ({
      xDomain: [-1.5, 1.5] as [number, number],
      yDomain: [-0.5, 0.5] as [number, number],
      allEscaped: false,
      contributed: 1,
    })),
  };
});
jest.mock('@/components/visualizations/densityCanvas', () => ({
  renderDensityCanvas: () => ({ mode: 'empty', distinctOccupied: 0 }),
}));
jest.mock('@/hooks/useHydrated', () => require('./mockVizDeps').useHydratedMock);

import React, { useEffect } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import HenonMapVisualization, {
  matchHenonSweptKey,
} from '@/components/visualizations/HenonMapVisualization';
import { computeUnionOrbitDomain } from '@/components/visualizations/chartHelpers';
import {
  PlaybackProvider,
  usePlaybackRegistry,
  usePlaybackSelection,
} from '@/components/ui/PlaybackContext';

const computeUnionMock = computeUnionOrbitDomain as jest.MockedFunction<
  typeof computeUnionOrbitDomain
>;

/** Same map step + transient as the component's private henonOrbit. */
function referenceOrbit(
  aParam: number,
  bParam: number,
  xStart: number,
  yStart: number,
  count: number,
): { x: number; y: number }[] {
  const TRANSIENT = 100;
  let x = xStart;
  let y = yStart;
  for (let i = 0; i < TRANSIENT; i++) {
    const xNext = 1 - aParam * x * x + y;
    const yNext = bParam * x;
    x = xNext;
    y = yNext;
  }
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    points.push({ x, y });
    const xNext = 1 - aParam * x * x + y;
    const yNext = bParam * x;
    x = xNext;
    y = yNext;
  }
  return points;
}

function SelectByName({ name }: { name: string }) {
  const registry = usePlaybackRegistry();
  const { setSelectedIndex } = usePlaybackSelection();
  useEffect(() => {
    const params = registry.getParams();
    const idx = params.findIndex((p) => p.name === name);
    if (idx >= 0) setSelectedIndex(idx);
  }, [registry, registry.version, name, setSelectedIndex]);
  return null;
}

function renderHenonWithSelection(selectedName: string) {
  return render(
    <PlaybackProvider>
      <HenonMapVisualization />
      <SelectByName name={selectedName} />
    </PlaybackProvider>,
  );
}

function lastDomainOpts() {
  expect(computeUnionMock).toHaveBeenCalled();
  const calls = computeUnionMock.mock.calls;
  const last = calls[calls.length - 1]?.[0];
  if (!last) throw new Error('computeUnionOrbitDomain was never called');
  return last;
}

describe('matchHenonSweptKey', () => {
  it('maps each HENON_PARAM registry name to its key', () => {
    expect(matchHenonSweptKey('henon-a')).toBe('a');
    expect(matchHenonSweptKey('henon-b')).toBe('b');
    expect(matchHenonSweptKey('henon-x0')).toBe('x0');
    expect(matchHenonSweptKey('henon-y0')).toBe('y0');
    expect(matchHenonSweptKey('henon-iterations')).toBe('iterations');
  });

  it('maps unknown names and undefined to null', () => {
    expect(matchHenonSweptKey('unknown-param')).toBeNull();
    expect(matchHenonSweptKey('')).toBeNull();
    expect(matchHenonSweptKey(undefined)).toBeNull();
  });
});

describe('Henon held domain follows the selected playback param', () => {
  beforeEach(() => {
    computeUnionMock.mockClear();
    // Canvas path is unused under the density mock, but some paint code may
    // still ask for a 2d context during effects.
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      putImageData: jest.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('with henon-b selected, union uses b range and samples b not a', async () => {
    // b slider range in the component: [0.1, 0.5]; a is [0.5, 2.0].
    // Defaults: a=1.4, b=0.3, x0=0, y0=0.
    act(() => {
      renderHenonWithSelection('henon-b');
    });

    expect(screen.getByText(/Hénon map exhibits/i)).toBeInTheDocument();

    // Wait until selection-driven recompute lands with b's range
    // (first paint may still hold a's default [0.5, 2.0]).
    await waitFor(() => {
      const opts = lastDomainOpts();
      expect(opts.min).toBeCloseTo(0.1, 10);
      expect(opts.max).toBeCloseTo(0.5, 10);
    });

    const opts = lastDomainOpts();

    // Varying the sample must change b in the orbit, with a held at 1.4.
    // If the component still swept a (regression), sampleOrbit(s) would equal
    // referenceOrbit(s, 0.3, ...) instead of referenceOrbit(1.4, s, ...).
    const sampleLow = 0.15;
    const sampleHigh = 0.45;
    const orbitLow = opts.sampleOrbit(sampleLow);
    const orbitHigh = opts.sampleOrbit(sampleHigh);

    // Cheap prefix check — full 200k-point equality is unnecessary.
    const PREFIX = 8;
    const expectedLow = referenceOrbit(1.4, sampleLow, 0, 0, PREFIX);
    const expectedHigh = referenceOrbit(1.4, sampleHigh, 0, 0, PREFIX);
    const wrongLow = referenceOrbit(sampleLow, 0.3, 0, 0, PREFIX);

    for (let i = 0; i < PREFIX; i++) {
      expect(orbitLow[i].x).toBeCloseTo(expectedLow[i].x, 10);
      expect(orbitLow[i].y).toBeCloseTo(expectedLow[i].y, 10);
      expect(orbitHigh[i].x).toBeCloseTo(expectedHigh[i].x, 10);
      expect(orbitHigh[i].y).toBeCloseTo(expectedHigh[i].y, 10);
    }
    // Distinct from the "still sweeping a over b's numeric range" path.
    expect(orbitLow[PREFIX - 1].x).not.toBeCloseTo(wrongLow[PREFIX - 1].x, 5);
  });
});
