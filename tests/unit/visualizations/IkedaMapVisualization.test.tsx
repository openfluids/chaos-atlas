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
import IkedaMapVisualization from '@/components/visualizations/IkedaMapVisualization';
import { advanceByMs, installFrameClock } from './frameClock';

/** Matches IKEDA_STEP_PERIOD_S in the component (50 ms). */
const PERIOD_MS = 50;

function getStep(): number {
  return Number(screen.getByTestId('animation-step').getAttribute('data-step'));
}

function selectView(value: string) {
  const label = screen.getByText('Visualization Type');
  const select = label.parentElement!.querySelector('select')!;
  fireEvent.change(select, { target: { value } });
}

function startAnimation() {
  fireEvent.click(screen.getByRole('button', { name: 'Start Animation' }));
}

function setIterations(value: number) {
  const slider = screen.getByRole('slider');
  fireEvent.change(slider, { target: { value: String(value) } });
}

describe('IkedaMapVisualization animation cadence', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('advances exactly one step per period (none for half a period)', () => {
    const clock = installFrameClock();
    render(<IkedaMapVisualization />);

    act(() => {
      selectView('time');
    });
    act(() => {
      startAnimation();
    });

    expect(getStep()).toBe(0);

    act(() => {
      clock.pump(0);
    });
    expect(getStep()).toBe(0);

    act(() => {
      advanceByMs(clock, PERIOD_MS / 2);
    });
    expect(getStep()).toBe(0);

    act(() => {
      advanceByMs(clock, PERIOD_MS / 2);
    });
    expect(getStep()).toBe(1);

    act(() => {
      advanceByMs(clock, PERIOD_MS);
    });
    expect(getStep()).toBe(2);

    clock.restore();
  });

  it('wraps at the live iterations modulus when it changes mid-play', () => {
    // Pins the stale-modulus bug: the old setInterval closed over iterations
    // without always seeing updates. Driving via useAnimationLoop must wrap
    // at the NEW value.
    const clock = installFrameClock();
    render(<IkedaMapVisualization />);

    act(() => {
      selectView('time');
    });
    act(() => {
      startAnimation();
    });
    act(() => {
      clock.pump(0);
    });

    // Default iterations = 2000. Advance 500 periods → step 500.
    act(() => {
      advanceByMs(clock, PERIOD_MS * 500);
    });
    expect(getStep()).toBe(500);

    // New modulus 500: next tick is (500 + 1) % 500 = 1.
    // Stale modulus 2000 would yield 501.
    act(() => {
      setIterations(500);
    });
    act(() => {
      advanceByMs(clock, PERIOD_MS);
    });
    expect(getStep()).toBe(1);

    clock.restore();
  });

  it('stops advancing when leaving the animating view mode', () => {
    const clock = installFrameClock();
    render(<IkedaMapVisualization />);

    act(() => {
      selectView('time');
    });
    act(() => {
      startAnimation();
    });
    act(() => {
      clock.pump(0);
      advanceByMs(clock, PERIOD_MS);
    });
    expect(getStep()).toBe(1);

    act(() => {
      selectView('attractor');
    });
    expect(screen.queryByTestId('animation-step')).toBeNull();

    act(() => {
      advanceByMs(clock, PERIOD_MS * 2);
    });

    act(() => {
      selectView('time');
    });
    expect(getStep()).toBe(1);

    clock.restore();
  });

  it('cancels the loop on unmount', () => {
    const clock = installFrameClock();
    const { unmount } = render(<IkedaMapVisualization />);

    act(() => {
      selectView('time');
    });
    act(() => {
      startAnimation();
    });
    act(() => {
      clock.pump(0);
    });

    unmount();

    act(() => {
      advanceByMs(clock, PERIOD_MS * 2);
    });
    expect(clock.hasRaf).toBe(false);

    clock.restore();
  });
});
