'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type UseAnimationLoopOptions = {
  /** When true the loop runs; when false it cancels any pending frame. */
  playing: boolean;
  /**
   * Called once per frame with elapsed time since the previous frame in
   * seconds. Drive animation from this, not a frame counter — a 120 Hz
   * display must not advance the animation twice as fast as a 60 Hz one.
   */
  onFrame: (deltaSeconds: number) => void;
};

export type UseAnimationLoopResult = {
  /**
   * Achieved frames per second (EMA of 1 / inter-frame interval). Zero when
   * the loop is stopped. Display this so adaptive pacing is visible rather
   * than mysterious. Published at most ~4 times per second so a HUD host
   * does not re-render at display rate.
   */
  frameRate: number;
};

/** One typical display refresh. */
const VSYNC_MS = 1000 / 60;

/**
 * Cost must clearly exceed one vsync before we pace. A bare `> VSYNC_MS`
 * falsely flags ordinary 16.67 ms rAF deltas (1000/60 ≈ 16.666…), which
 * would throttle logistic down from display rate.
 */
const EXPENSIVE_COST_MS = VSYNC_MS + 1;

/**
 * Floor on inter-frame period when a frame is expensive (cost > one vsync).
 * ~10 fps max under load — measured enough headroom for Hénon density paint
 * so the main thread stays responsive to input/DOM reads during playback.
 * Cheap frames (cost ≤ one vsync) never hit this path and stay at display rate.
 */
export const MIN_EXPENSIVE_FRAME_PERIOD_MS = 100;

/** How often `frameRate` is written into React state (~4 Hz). */
const FRAME_RATE_PUBLISH_MS = 250;

/**
 * A `requestAnimationFrame` loop with adaptive pacing.
 *
 * Pacing is driven by the **observed inter-frame interval** (rAF timestamp
 * delta), not by the synchronous duration of `onFrame`. That matters when
 * `onFrame` only schedules React state updates: the expensive render runs
 * *after* the callback returns, so timing the callback always looks free
 * while the main thread is still saturated. The next rAF timestamp includes
 * that render cost; we use that.
 *
 * Intentional idle time from a previous `setTimeout` is subtracted from the
 * raw interval so a one-off hitch does not lock the loop into the expensive
 * branch forever (logistic must stay near display rate).
 *
 * Expensive cost ( > one vsync) leaves the main thread idle long enough that
 * (1) duty cycle stays near ≤50% (`wait ≥ costMs`) and (2) inter-frame period
 * is at least `MIN_EXPENSIVE_FRAME_PERIOD_MS`.
 *
 * Reduced-motion is intentionally not consulted here: autoplay suppression
 * is a policy decision for the caller, not a hard stop inside the loop.
 */
export function useAnimationLoop({
  playing,
  onFrame,
}: UseAnimationLoopOptions): UseAnimationLoopResult {
  const [frameRate, setFrameRate] = useState(0);
  const onFrameRef = useRef(onFrame);

  // Keep the latest callback without listing it as an effect dependency (that
  // would tear down and restart the rAF loop every render).
  useLayoutEffect(() => {
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    if (!playing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFrameRate(0);
      return;
    }

    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastTimestamp: number | null = null;
    /** Idle we inserted before the next tick; excluded from cost. */
    let lastWaitMs = 0;
    let cancelled = false;
    // EMA lives off React state so the loop can run at full rate while
    // `frameRate` is only published ~4×/s (see FRAME_RATE_PUBLISH_MS).
    let ema = 0;
    let lastPublishAt = 0;

    const clearTimers = () => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const requestTick = () => {
      if (cancelled) return;
      rafId = requestAnimationFrame(tick);
    };

    /**
     * Schedule the next frame from the observed frame cost.
     * Cheap cost → immediate rAF (display refresh). Expensive cost → idle
     * so duty ≤50% and inter-frame period ≥ MIN_EXPENSIVE_FRAME_PERIOD_MS.
     */
    const scheduleNext = (costMs: number) => {
      if (cancelled) return;

      if (costMs > EXPENSIVE_COST_MS) {
        // Inter-frame ≈ costMs + waitMs (when cost ≈ busy time). Enforce:
        //   waitMs ≥ costMs              → ≤50% duty
        //   costMs + waitMs ≥ MIN_PERIOD → floor ~10 fps under load
        const waitMs = Math.max(
          costMs,
          MIN_EXPENSIVE_FRAME_PERIOD_MS - costMs,
        );
        lastWaitMs = waitMs;
        timeoutId = setTimeout(() => {
          timeoutId = null;
          requestTick();
        }, waitMs);
      } else {
        lastWaitMs = 0;
        requestTick();
      }
    };

    const tick = (timestamp: number) => {
      if (cancelled) return;
      rafId = 0;

      // Raw rAF interval includes our intentional idle + real busy time.
      // Cost is busy time only — that is what drives pacing.
      const rawIntervalMs =
        lastTimestamp === null
          ? 0
          : Math.max(0, timestamp - lastTimestamp);
      const costMs =
        lastTimestamp === null
          ? 0
          : Math.max(0, rawIntervalMs - lastWaitMs);
      lastTimestamp = timestamp;
      // Consume the wait accounting for this interval (scheduleNext may set a new one).
      lastWaitMs = 0;

      const deltaSeconds = rawIntervalMs / 1000;

      if (deltaSeconds > 0) {
        const instant = 1 / deltaSeconds;
        ema = ema === 0 ? instant : ema * 0.8 + instant * 0.2;
        // Throttle the published number only — the rAF loop keeps full rate.
        if (timestamp - lastPublishAt >= FRAME_RATE_PUBLISH_MS) {
          lastPublishAt = timestamp;
          setFrameRate(ema);
        }
      }

      // Callback may be free (setState) while the following render is heavy;
      // we still call it, but pacing uses costMs from the observed interval.
      onFrameRef.current(deltaSeconds);

      scheduleNext(costMs);
    };

    requestTick();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [playing]);

  return { frameRate };
}
