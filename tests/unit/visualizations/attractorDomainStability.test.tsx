/**
 * The attractor axes must not move when the iterations slider is swept.
 *
 * Cycles 15 and 19 exist because a ruler that moves under a sweep is
 * unreadable. Cycle 21 reintroduced the risk by fitting axes to data, and
 * guarded it with a fixed reference sample count.
 *
 * This test exists because the pure-helper test of that property could not
 * fail for the right reason: `fitAttractorDomainFromReference` called twice
 * with the same arguments returns the same thing whatever the components do.
 * Wiring the live slider straight into a component's presentation memo — the
 * exact regression — left that test green. The property lives in the three
 * `useMemo` bodies, so it has to be asserted through a rendered component.
 *
 * The assertion is on the SIZE of the orbit handed to the domain fit: it must
 * stay at the fixed reference count no matter where the slider sits.
 */
const mockFitSampleSizes: number[] = [];

jest.mock('d3', () => require('./mockVizDeps').d3Mock);
jest.mock('@/components/visualizations/chartHelpers', () => {
  const base = require('./mockVizDeps').chartHelpersMock;
  const actual = jest.requireActual(
    '@/components/visualizations/chartHelpers',
  ) as typeof import('@/components/visualizations/chartHelpers');
  return {
    ...base,
    fitOrbitDomain: (
      points: Parameters<typeof actual.fitOrbitDomain>[0],
      fallback: Parameters<typeof actual.fitOrbitDomain>[1],
      padFraction?: number,
    ) => {
      mockFitSampleSizes.push(points.length);
      return actual.fitOrbitDomain(points, fallback, padFraction);
    },
  };
});
jest.mock(
  '@/components/visualizations/densityCanvas',
  () => require('./mockVizDeps').densityCanvasMock,
);
jest.mock('@/hooks/useHydrated', () => require('./mockVizDeps').useHydratedMock);

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import IkedaMapVisualization from '@/components/visualizations/IkedaMapVisualization';
import TinkerbellMapVisualization from '@/components/visualizations/TinkerbellMapVisualization';
import DuffingMapVisualization from '@/components/visualizations/DuffingMapVisualization';
import { ATTRACTOR_DOMAIN_REF_ITERATIONS } from '@/components/visualizations/chartHelpers';

/** The "Attractor Iterations" range input rendered by ParamSlider. */
function attractorIterationsSlider(): HTMLInputElement {
  const label = screen.getByText(/Attractor Iterations:/i);
  const input = label.parentElement?.querySelector('input[type="range"]');
  if (!input) {
    throw new Error('no range input beside the "Attractor Iterations" label');
  }
  return input as HTMLInputElement;
}

const CASES: [string, React.FC][] = [
  ['Ikeda', IkedaMapVisualization],
  ['Tinkerbell', TinkerbellMapVisualization],
  ['Duffing', DuffingMapVisualization],
];

describe.each(CASES)(
  '%s attractor: the fitted domain ignores the iterations slider',
  (_name, Component) => {
    beforeEach(() => {
      mockFitSampleSizes.length = 0;
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

    it('samples the reference count at every slider position', () => {
      act(() => {
        render(<Component />);
      });

      const slider = attractorIterationsSlider();
      const low = Number(slider.min);
      const high = Number(slider.max);
      expect(low).toBeGreaterThan(0);
      expect(high).toBeGreaterThan(low);

      // Sweep to both ends; neither may change the sample the domain is fit to.
      for (const value of [low, high, Math.round((low + high) / 2)]) {
        act(() => {
          fireEvent.change(slider, { target: { value: String(value) } });
        });
      }

      expect(mockFitSampleSizes.length).toBeGreaterThan(0);
      // Under the regression (live slider wired into the presentation memo)
      // these sizes track the slider instead of holding at the reference.
      const distinctSizes = Array.from(new Set(mockFitSampleSizes));
      expect(distinctSizes).toEqual([ATTRACTOR_DOMAIN_REF_ITERATIONS]);
    });
  },
);
