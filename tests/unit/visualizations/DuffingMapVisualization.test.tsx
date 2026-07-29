/**
 * Dual-orbit attractor presentation for the Duffing component.
 *
 * Pins: single-attractor caption when both seeds share one set; no caption
 * (two clouds) for bistable; fitted domain covers both basin orbit means.
 */
jest.mock('d3', () => require('./mockVizDeps').d3Mock);
jest.mock(
  '@/components/visualizations/chartHelpers',
  () => require('./mockVizDeps').chartHelpersMock,
);
jest.mock(
  '@/components/visualizations/densityCanvas',
  () => require('./mockVizDeps').densityCanvasMock,
);
jest.mock('@/hooks/useHydrated', () => require('./mockVizDeps').useHydratedMock);

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

function parameterSetSelect(): HTMLSelectElement {
  const label = screen.getByText(/^Parameter Set$/);
  const select = label.parentElement?.querySelector('select');
  if (!select) throw new Error('Parameter Set <select> not found');
  return select as HTMLSelectElement;
}

describe('DuffingMapVisualization dual attractors', () => {
  beforeEach(() => {
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
    const dual = calculateDuffingDualAttractors(
      params,
      ATTRACTOR_DOMAIN_REF_ITERATIONS
    );
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
});
