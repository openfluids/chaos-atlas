import { act, renderHook } from '@testing-library/react';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';

type TimeoutEntry = { id: number; fireAt: number; cb: () => void };

/**
 * Deterministic frame clock: rAF callbacks and setTimeout pacing delays are
 * driven by an explicit virtual `now`.
 */
function installFrameClock() {
  let now = 0;
  let nextRafId = 1;
  let nextTimeoutId = 1;
  let pendingRaf: { id: number; cb: FrameRequestCallback } | null = null;
  const timeouts = new Map<number, TimeoutEntry>();
  const setTimeoutSpy = jest.fn();

  jest.spyOn(performance, 'now').mockImplementation(() => now);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    const id = nextRafId++;
    pendingRaf = { id, cb };
    return id;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    if (pendingRaf?.id === id) pendingRaf = null;
  });
  jest.spyOn(global, 'setTimeout').mockImplementation(((
    handler: TimerHandler,
    ms?: number,
  ) => {
    const id = nextTimeoutId++;
    const delay = ms ?? 0;
    setTimeoutSpy(delay);
    if (typeof handler === 'function') {
      timeouts.set(id, {
        id,
        fireAt: now + delay,
        cb: handler as () => void,
      });
    }
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout);
  jest.spyOn(global, 'clearTimeout').mockImplementation(((id?: number) => {
    if (id !== undefined) timeouts.delete(id as number);
  }) as unknown as typeof clearTimeout);

  return {
    get now() {
      return now;
    },
    get hasRaf() {
      return pendingRaf !== null;
    },
    get timeoutDelays() {
      return [...timeouts.values()].map((t) => t.fireAt - now);
    },
    get setTimeoutCalls() {
      return setTimeoutSpy.mock.calls.map((c) => c[0] as number);
    },
    /** Advance performance.now during onFrame work measurement. */
    advanceWork(ms: number) {
      now += ms;
    },
    /**
     * Fire due timeouts, then run one pending rAF with a display-time step.
     */
    pump(displayDeltaMs = 16.67) {
      const due = [...timeouts.values()]
        .filter((t) => t.fireAt <= now)
        .sort((a, b) => a.fireAt - b.fireAt);
      for (const t of due) {
        timeouts.delete(t.id);
        now = Math.max(now, t.fireAt);
        t.cb();
      }
      if (!pendingRaf) return { ranFrame: false };
      const { cb } = pendingRaf;
      pendingRaf = null;
      now += displayDeltaMs;
      cb(now);
      return { ranFrame: true };
    },
    restore() {
      jest.restoreAllMocks();
    },
  };
}

describe('useAnimationLoop', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls onFrame with elapsed seconds (not a frame counter)', () => {
    const clock = installFrameClock();
    const deltas: number[] = [];
    const onFrame = jest.fn((dt: number) => {
      deltas.push(dt);
    });

    renderHook(() => useAnimationLoop({ playing: true, onFrame }));

    act(() => {
      clock.pump(0);
    });
    act(() => {
      clock.pump(16.67);
    });
    act(() => {
      clock.pump(16.67);
    });

    expect(onFrame).toHaveBeenCalled();
    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBeCloseTo(0.01667, 4);
    expect(deltas[2]).toBeCloseTo(0.01667, 4);

    // Doubled display interval → doubled delta (time-based, not frame count).
    act(() => {
      clock.pump(33.34);
    });
    expect(deltas[3]).toBeCloseTo(0.03334, 4);

    clock.restore();
  });

  it('stops the loop on unmount and does not call onFrame afterwards', () => {
    const clock = installFrameClock();
    const onFrame = jest.fn();

    const { unmount } = renderHook(() =>
      useAnimationLoop({ playing: true, onFrame }),
    );

    act(() => {
      clock.pump(16);
    });
    expect(onFrame).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      clock.pump(16);
      clock.pump(16);
    });
    expect(onFrame).toHaveBeenCalledTimes(1);

    clock.restore();
  });

  it('stops the loop when playing goes false', () => {
    const clock = installFrameClock();
    const onFrame = jest.fn();

    const { rerender } = renderHook(
      ({ playing }: { playing: boolean }) =>
        useAnimationLoop({ playing, onFrame }),
      { initialProps: { playing: true } },
    );

    act(() => {
      clock.pump(16);
    });
    expect(onFrame).toHaveBeenCalledTimes(1);

    rerender({ playing: false });

    act(() => {
      clock.pump(16);
      clock.pump(16);
    });
    expect(onFrame).toHaveBeenCalledTimes(1);

    clock.restore();
  });

  it('schedules a setTimeout idle of ~workMs when onFrame exceeds one vsync', () => {
    // Assert the scheduled delay directly — do not measure inter-frame gaps
    // on a clock that onFrame itself advances (that passes even with pacing
    // deleted). With the pacing branch disabled this test MUST fail.
    const clock = installFrameClock();
    const workMs = 50;

    const onFrame = jest.fn(() => {
      clock.advanceWork(workMs);
    });

    renderHook(() => useAnimationLoop({ playing: true, onFrame }));

    // Expensive frame: work 50ms > VSYNC (~16.67ms) → schedule setTimeout(50).
    act(() => {
      clock.pump(16.67);
    });

    expect(clock.setTimeoutCalls.length).toBeGreaterThan(0);
    const lastDelay = clock.setTimeoutCalls[clock.setTimeoutCalls.length - 1];
    // ~50% duty cycle: idle for the measured work duration.
    expect(lastDelay).toBeGreaterThanOrEqual(workMs);
    // Pending timeout still visible on the clock.
    expect(clock.timeoutDelays.some((d) => d >= workMs)).toBe(true);

    clock.restore();
  });

  it('does not schedule a pacing timeout for cheap onFrame work', () => {
    const clock = installFrameClock();
    const onFrame = jest.fn(() => {
      clock.advanceWork(2);
    });

    renderHook(() => useAnimationLoop({ playing: true, onFrame }));

    act(() => {
      clock.pump(16.67);
      clock.pump(16.67);
    });

    expect(clock.setTimeoutCalls).toEqual([]);
    expect(clock.timeoutDelays).toEqual([]);
    expect(clock.hasRaf).toBe(true);

    clock.restore();
  });
});
