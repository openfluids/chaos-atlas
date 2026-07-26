jest.mock('d3', () => require('./mockVizDeps').d3Mock);
jest.mock(
  '@/components/visualizations/chartHelpers',
  () => require('./mockVizDeps').chartHelpersMock,
);

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import BakersMapVisualization from '@/components/visualizations/BakersMapVisualization';
import { advanceByMs, installFrameClock } from './frameClock';

/** Matches BAKERS_STEP_PERIOD_S in the component (500 ms). */
const PERIOD_MS = 500;

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

describe('BakersMapVisualization animation cadence', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('advances exactly one step per period (none for half a period)', () => {
    const clock = installFrameClock();
    render(<BakersMapVisualization />);

    act(() => {
      selectView('scrambling');
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
    render(<BakersMapVisualization />);

    act(() => {
      selectView('scrambling');
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
      advanceByMs(clock, PERIOD_MS * 2);
    });

    act(() => {
      selectView('scrambling');
    });
    expect(getStep()).toBe(1);

    clock.restore();
  });

  it('cancels the loop on unmount', () => {
    const clock = installFrameClock();
    const { unmount } = render(<BakersMapVisualization />);

    act(() => {
      selectView('scrambling');
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
