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
    /** Advance performance.now during onFrame (callback-duration only). */
    advanceWork(ms: number) {
      now += ms;
    },
    /** Advance virtual wall clock (e.g. past a pacing setTimeout fireAt). */
    advance(ms: number) {
      now += ms;
    },
    /**
     * Fire due timeouts, then run one pending rAF with a display-time step.
     * `displayDeltaMs` is the observed inter-frame interval (rAF timestamp
     * delta) — use this to simulate a slow React render between ticks.
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

  it('paces when the observed rAF interval is expensive (slow render, free callback)', () => {
    // Hénon root cause: onFrame only setStates (~0 ms) while the React render
    // after the callback costs ~33 ms. That cost shows up in the *next* rAF
    // timestamp delta, not in performance.now() around onFrame.
    // Sabotage: if scheduleNext used only callback duration, this FAILS.
    const clock = installFrameClock();
    const onFrame = jest.fn(() => {
      // Intentionally do NOT advanceWork — callback is free.
    });

    renderHook(() => useAnimationLoop({ playing: true, onFrame }));

    // First tick: no prior interval → cost 0 → no pacing timeout.
    act(() => {
      clock.pump(0);
    });
    expect(clock.setTimeoutCalls).toEqual([]);

    // Second tick arrives 50 ms later (slow render between frames).
    act(() => {
      clock.pump(50);
    });

    expect(clock.setTimeoutCalls.length).toBeGreaterThan(0);
    const lastDelay = clock.setTimeoutCalls[clock.setTimeoutCalls.length - 1];
    // 50% duty: wait ≥ observed cost (50 ms).
    expect(lastDelay).toBeGreaterThanOrEqual(50);
    expect(clock.timeoutDelays.some((d) => d >= 50)).toBe(true);

    clock.restore();
  });

  it('enforces MIN_EXPENSIVE_FRAME_PERIOD_MS from observed interval just over one vsync', () => {
    const clock = installFrameClock();
    // 30 ms observed cost + 30 ms idle (old 50% only) → 60 < 100 floor.
    // Policy: waitMs = max(cost, MIN_PERIOD - cost) = max(30, 70) = 70.
    const onFrame = jest.fn();

    renderHook(() => useAnimationLoop({ playing: true, onFrame }));

    act(() => {
      clock.pump(0);
    });
    act(() => {
      clock.pump(30);
    });

    expect(clock.setTimeoutCalls.length).toBeGreaterThan(0);
    const lastDelay = clock.setTimeoutCalls[clock.setTimeoutCalls.length - 1];
    const period = 30 + lastDelay;
    expect(period).toBeGreaterThanOrEqual(100);
    expect(lastDelay).toBeGreaterThanOrEqual(30);

    clock.restore();
  });

  it('does not schedule a pacing timeout for cheap observed intervals', () => {
    const clock = installFrameClock();
    // Free callback + ~1 vsync rAF deltas (logistic / display rate).
    const onFrame = jest.fn();

    renderHook(() => useAnimationLoop({ playing: true, onFrame }));

    act(() => {
      clock.pump(16.67);
      clock.pump(16.67);
      clock.pump(16.67);
    });

    expect(clock.setTimeoutCalls).toEqual([]);
    expect(clock.timeoutDelays).toEqual([]);
    expect(clock.hasRaf).toBe(true);

    clock.restore();
  });

  it('does not lock into expensive pacing after a one-off hitch (excludes idle)', () => {
    // After a hitch we insert waitMs; the next raw interval includes that wait.
    // Cost must exclude lastWaitMs so logistic recovers to display rate.
    const clock = installFrameClock();
    const onFrame = jest.fn();

    renderHook(() => useAnimationLoop({ playing: true, onFrame }));

    act(() => {
      clock.pump(0);
    });
    // Hitch: 40 ms cost → wait = max(40, 60) = 60.
    act(() => {
      clock.pump(40);
    });
    expect(clock.setTimeoutCalls.length).toBe(1);
    const hitchWait = clock.setTimeoutCalls[0];
    expect(hitchWait).toBeGreaterThanOrEqual(40);

    // Advance past the hitch wait so the pacing timeout is due, then a
    // normal cheap vsync frame. pump fires due timeouts first.
    act(() => {
      clock.advance(hitchWait);
      clock.pump(16.67);
    });

    // That frame's cost ≈ 16.67 (raw includes wait but wait is subtracted)
    // → must NOT schedule another expensive timeout.
    expect(clock.setTimeoutCalls.length).toBe(1);

    act(() => {
      clock.pump(16.67);
    });
    expect(clock.setTimeoutCalls.length).toBe(1);
    expect(clock.hasRaf).toBe(true);

    clock.restore();
  });
});
