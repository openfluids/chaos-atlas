/**
 * Dual-orbit attractor presentation for the Duffing component.
 *
 * Pins: single-attractor caption when both seeds share one set; no caption
 * (two clouds) for bistable; fitted domain covers both basin orbit means;
 * one diverging dual orbit does not blank the surviving cloud.
 */
jest.mock('d3', () => require('./mockVizDeps').d3Mock);
jest.mock(
  '@/components/visualizations/chartHelpers',
  () => require('./mockVizDeps').chartHelpersMock,
);
jest.mock('@/components/visualizations/densityCanvas', () => ({
  renderDensityCanvas: jest.fn(() => ({ mode: 'empty', distinctOccupied: 0 })),
  buildColorLut: () => new Uint8ClampedArray(256 * 3),
}));
jest.mock('@/hooks/useHydrated', () => require('./mockVizDeps').useHydratedMock);
jest.mock('@/lib/maps/duffing', () => {
  const actual = jest.requireActual(
    '@/lib/maps/duffing'
  ) as typeof import('@/lib/maps/duffing');
  return {
    ...actual,
    calculateDuffingDualAttractors: jest.fn(
      (
        params: { a: number; b: number },
        iterations?: number
      ) => actual.calculateDuffingDualAttractors(params, iterations)
    ),
  };
});

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import DuffingMapVisualization from '@/components/visualizations/DuffingMapVisualization';
import {
  calculateDuffingDualAttractors,
  getInterestingDuffingParameters,
} from '@/lib/maps/duffing';
import {
  ATTRACTOR_DOMAIN_REF_ITERATIONS,
  fitOrbitDomain,
} from '@/components/visualizations/chartHelpers';
import { renderDensityCanvas } from '@/components/visualizations/densityCanvas';
import { MAX_SANE_ORBIT_COORD } from '@/components/visualizations/densityField';

const renderDensityCanvasMock = renderDensityCanvas as jest.MockedFunction<
  typeof renderDensityCanvas
>;
const dualAttractorsMock = calculateDuffingDualAttractors as jest.MockedFunction<
  typeof calculateDuffingDualAttractors
>;
const actualDual = (
  jest.requireActual('@/lib/maps/duffing') as typeof import('@/lib/maps/duffing')
).calculateDuffingDualAttractors;

function parameterSetSelect(): HTMLSelectElement {
  const label = screen.getByText(/^Parameter Set$/);
  const select = label.parentElement?.querySelector('select');
  if (!select) throw new Error('Parameter Set <select> not found');
  return select as HTMLSelectElement;
}

describe('DuffingMapVisualization dual attractors', () => {
  beforeEach(() => {
    renderDensityCanvasMock.mockClear();
    dualAttractorsMock.mockImplementation(actualDual);
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      putImageData: jest.fn(),
      clearRect: jest.fn(),
      drawImage: jest.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('shows the single-attractor caption for Chaotic Regime (shared set)', () => {
    act(() => {
      render(<DuffingMapVisualization />);
    });
    // Default selectedParams is index 1 = Chaotic Regime.
    expect(screen.getByTestId('single-attractor-notice')).toHaveTextContent(
      /single attractor/i
    );
  });

  it('hides the single-attractor caption on Classic Bistable (two sets)', () => {
    act(() => {
      render(<DuffingMapVisualization />);
    });
    const parameters = getInterestingDuffingParameters();
    const classicIdx = parameters.findIndex((p) => p.name === 'Classic Bistable');
    const control = parameterSetSelect();
    act(() => {
      fireEvent.change(control, { target: { value: String(classicIdx) } });
    });
    expect(screen.queryByTestId('single-attractor-notice')).toBeNull();
  });

  it('fits a domain that covers both bistable orbits', () => {
    const params = getInterestingDuffingParameters().find(
      (p) => p.name === 'Classic Bistable'
    )!.params;
    const dual = actualDual(params, ATTRACTOR_DOMAIN_REF_ITERATIONS);
    expect(dual.sameSet).toBe(false);
    const combined = dual.orbits.flat();
    const domain = fitOrbitDomain(combined, {
      x: [-2.5, 2.5],
      y: [-2.5, 2.5],
    });
    for (const mean of dual.tailMeans) {
      expect(mean.x).toBeGreaterThanOrEqual(domain.xDomain[0]);
      expect(mean.x).toBeLessThanOrEqual(domain.xDomain[1]);
      expect(mean.y).toBeGreaterThanOrEqual(domain.yDomain[0]);
      expect(mean.y).toBeLessThanOrEqual(domain.yDomain[1]);
    }
  });

  it('paints the surviving orbit when the other dual orbit has escaped', () => {
    // One seed diverges past MAX_SANE_ORBIT_COORD; the other sits on a
    // fixed point. Union-flattening would blank the whole plot; per-orbit
    // filtering must keep the survivor on the density canvas.
    const survivor = [
      { x: -1.0, y: -1.0 },
      { x: -1.01, y: -0.99 },
      { x: -0.99, y: -1.01 },
    ];
    const escapedOrbit = [
      { x: MAX_SANE_ORBIT_COORD * 10, y: 0 },
      { x: MAX_SANE_ORBIT_COORD * 20, y: 1 },
    ];
    dualAttractorsMock.mockReturnValue({
      seeds: [
        { x: -1, y: -1 },
        { x: 1, y: 1 },
      ],
      orbits: [survivor, escapedOrbit],
      tailMeans: [
        { x: -1, y: -1 },
        { x: MAX_SANE_ORBIT_COORD * 15, y: 0.5 },
      ],
      sameSet: false,
    });

    act(() => {
      render(<DuffingMapVisualization />);
    });
    // Escape notice is for all-orbits-escaped only; one survivor → no caption.
    expect(screen.queryByTestId('orbit-escape-notice')).toBeNull();

    // Density paint must receive the survivor points (non-empty), never an
    // empty blank from a union-escape check.
    const nonEmptyCalls = renderDensityCanvasMock.mock.calls.filter(
      (args) => Array.isArray(args[1]) && (args[1] as unknown[]).length > 0
    );
    expect(nonEmptyCalls.length).toBeGreaterThan(0);
    const painted = nonEmptyCalls[nonEmptyCalls.length - 1][1] as {
      x: number;
      y: number;
    }[];
    expect(painted).toEqual(survivor);
    // Survivor coords only — no escaped point may leak into paint.
    for (const p of painted) {
      expect(Math.abs(p.x)).toBeLessThan(MAX_SANE_ORBIT_COORD);
      expect(Math.abs(p.y)).toBeLessThan(MAX_SANE_ORBIT_COORD);
    }
  });
});
