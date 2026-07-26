jest.mock('d3', () => require('./mockVizDeps').d3Mock);
jest.mock(
  '@/components/visualizations/chartHelpers',
  () => require('./mockVizDeps').chartHelpersMock,
);

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ArnoldMapVisualization from '@/components/visualizations/ArnoldMapVisualization';
import { advanceByMs, installFrameClock } from './frameClock';

/** Matches ARNOLD_STEP_PERIOD_S in the component (800 ms). */
const PERIOD_MS = 800;

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

describe('ArnoldMapVisualization animation cadence', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('advances exactly one step per period (none for half a period)', () => {
    // Sabotage check: if onFrame advances once per frame instead of per
    // period, half-period advance yields step >> 1 and this fails.
    const clock = installFrameClock();
    render(<ArnoldMapVisualization />);

    // Prefer grid over scrambling: scrambling paints a dense image grid that
    // is out of scope for the cadence unit tests.
    act(() => {
      selectView('grid');
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

  it('stops advancing when leaving the animating view mode', () => {
    const clock = installFrameClock();
    render(<ArnoldMapVisualization />);

    act(() => {
      selectView('grid');
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
      selectView('trajectory');
    });
    expect(screen.queryByTestId('animation-step')).toBeNull();

    act(() => {
      advanceByMs(clock, PERIOD_MS * 3);
    });

    act(() => {
      selectView('grid');
    });
    expect(getStep()).toBe(1);

    clock.restore();
  });

  it('cancels the loop on unmount', () => {
    const clock = installFrameClock();
    const { unmount } = render(<ArnoldMapVisualization />);

    act(() => {
      selectView('grid');
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
