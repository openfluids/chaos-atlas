/**
 * Deterministic frame clock matching tests/unit/playback/useAnimationLoop.test.ts.
 * Shared so visualization cadence tests do not invent a second rAF idiom.
 */
type TimeoutEntry = { id: number; fireAt: number; cb: () => void };

export function installFrameClock() {
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
    advanceWork(ms: number) {
      now += ms;
    },
    advance(ms: number) {
      now += ms;
    },
    /** Fire due setTimeouts only — does not run a pending rAF. */
    fireDueTimeouts() {
      const due = [...timeouts.values()]
        .filter((t) => t.fireAt <= now)
        .sort((a, b) => a.fireAt - b.fireAt);
      for (const t of due) {
        timeouts.delete(t.id);
        now = Math.max(now, t.fireAt);
        t.cb();
      }
    },
    pump(displayDeltaMs = 16.67) {
      // Fire due timeouts first (may schedule the next rAF via pacing).
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

export type FrameClock = ReturnType<typeof installFrameClock>;

/**
 * Advance the animation by `ms` of onFrame delta time using cheap frames
 * (≤16 ms, under one vsync + 1). That keeps useAnimationLoop off its
 * expensive-frame setTimeout path, so each pump's display delta is exactly
 * the deltaSeconds the accumulator sees.
 * Call after a seed `clock.pump(0)` that establishes lastTimestamp.
 */
export function advanceByMs(clock: FrameClock, ms: number) {
  // Stay under EXPENSIVE_COST_MS (= 1000/60 + 1 ≈ 17.67) in the hook.
  const FRAME_MS = 16;
  let left = ms;
  let guard = 0;
  while (left > 1e-9 && guard++ < 100_000) {
    if (!clock.hasRaf && clock.timeoutDelays.length > 0) {
      // Should be rare with cheap frames; drain without double-counting.
      const wait = Math.max(0, Math.min(...clock.timeoutDelays));
      clock.advance(wait);
      clock.fireDueTimeouts();
    }
    const step = Math.min(left, FRAME_MS);
    const { ranFrame } = clock.pump(step);
    if (ranFrame) left -= step;
    else break;
  }
}
