import { act, renderHook } from '@testing-library/react';
import { useSteppedAnimation } from '@/hooks/useSteppedAnimation';
import {
  advanceByMs,
  installFrameClock,
} from '@/tests/unit/visualizations/frameClock';

describe('useSteppedAnimation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not advance for a fractional period (half period → step stays 0)', () => {
    const clock = installFrameClock();
    const { result } = renderHook(() =>
      useSteppedAnimation({ playing: true, periodMs: 100, modulus: 10 }),
    );

    act(() => {
      clock.pump(0);
    });
    act(() => {
      advanceByMs(clock, 50);
    });
    expect(result.current.step).toBe(0);

    act(() => {
      advanceByMs(clock, 50);
    });
    expect(result.current.step).toBe(1);

    clock.restore();
  });

  it('a long frame crossing two periods advances step by two', () => {
    const clock = installFrameClock();
    const { result } = renderHook(() =>
      useSteppedAnimation({ playing: true, periodMs: 100, modulus: 10 }),
    );

    act(() => {
      // Seed lastTimestamp, then one frame carrying 250 ms of wall time
      // → 2 full periods + 50 residual (while-loop, not one-per-frame).
      clock.pump(0);
      clock.pump(250);
    });
    expect(result.current.step).toBe(2);

    clock.restore();
  });

  it('wraps at a modulus that changes mid-play', () => {
    const clock = installFrameClock();
    const { result, rerender } = renderHook(
      ({ modulus }: { modulus: number }) =>
        useSteppedAnimation({ playing: true, periodMs: 100, modulus }),
      { initialProps: { modulus: 2000 } },
    );

    act(() => {
      clock.pump(0);
    });
    // 5 periods → step 5.
    act(() => {
      advanceByMs(clock, 500);
    });
    expect(result.current.step).toBe(5);

    // Shrink modulus under current step; next tick uses live modulus.
    rerender({ modulus: 5 });
    act(() => {
      advanceByMs(clock, 100);
    });
    // (5 + 1) % 5 = 1. Stale modulus 2000 would yield 6.
    expect(result.current.step).toBe(1);

    clock.restore();
  });

  it('reset zeroes step and clears residual accumulator', () => {
    const clock = installFrameClock();
    const { result } = renderHook(() =>
      useSteppedAnimation({ playing: true, periodMs: 100, modulus: 10 }),
    );

    act(() => {
      clock.pump(0);
    });
    act(() => {
      advanceByMs(clock, 150); // step 1, residual 50
    });
    expect(result.current.step).toBe(1);

    act(() => {
      result.current.reset();
    });
    expect(result.current.step).toBe(0);

    // Residual was cleared: half a period alone must not advance.
    act(() => {
      advanceByMs(clock, 50);
    });
    expect(result.current.step).toBe(0);

    act(() => {
      advanceByMs(clock, 50);
    });
    expect(result.current.step).toBe(1);

    clock.restore();
  });

  it('clears residual when playing goes false (resume waits a full period)', () => {
    const clock = installFrameClock();
    const { result, rerender } = renderHook(
      ({ playing }: { playing: boolean }) =>
        useSteppedAnimation({ playing, periodMs: 100, modulus: 10 }),
      { initialProps: { playing: true } },
    );

    act(() => {
      clock.pump(0);
    });
    act(() => {
      advanceByMs(clock, 50); // residual only
    });
    expect(result.current.step).toBe(0);

    rerender({ playing: false });
    rerender({ playing: true });

    // New loop needs a fresh seed; residual from before stop is gone.
    act(() => {
      clock.pump(0);
    });
    act(() => {
      advanceByMs(clock, 50);
    });
    expect(result.current.step).toBe(0);

    act(() => {
      advanceByMs(clock, 50);
    });
    expect(result.current.step).toBe(1);

    clock.restore();
  });
});
