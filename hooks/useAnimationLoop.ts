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

/** One typical display refresh; work above this is treated as expensive. */
const VSYNC_MS = 1000 / 60;

/** How often `frameRate` is written into React state (~4 Hz). */
const FRAME_RATE_PUBLISH_MS = 250;

/**
 * A `requestAnimationFrame` loop with adaptive pacing.
 *
 * Each `onFrame` is timed. The next frame is scheduled only after the current
 * one finishes (no stacked rAFs). Cheap callbacks fall through to plain rAF
 * and run at display refresh.
 *
 * Expensive callbacks (work longer than one vsync) intentionally leave the
 * main thread idle for about the same duration as the work just measured
 * (~50% duty cycle: work `workMs`, then wait `workMs` via `setTimeout` before
 * the next rAF). `requestAnimationFrame` already caps frame rate on its own;
 * the only thing pacing buys is main-thread headroom so the UI stays
 * responsive under load.
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
     * Schedule the next frame from the measured work duration.
     * Cheap work → immediate rAF (display refresh). Expensive work → idle
     * for ~workMs so main-thread duty cycle stays near 50%.
     */
    const scheduleNext = (workMs: number) => {
      if (cancelled) return;

      if (workMs > VSYNC_MS) {
        // ~50% idle: wait as long as the work just took. Do NOT subtract
        // "elapsed since workStart" — that was measured after the same work,
        // so waitMs would always be ~0 and this branch would be a no-op.
        const waitMs = workMs;
        timeoutId = setTimeout(() => {
          timeoutId = null;
          requestTick();
        }, waitMs);
      } else {
        requestTick();
      }
    };

    const tick = (timestamp: number) => {
      if (cancelled) return;
      rafId = 0;

      const deltaSeconds =
        lastTimestamp === null
          ? 0
          : Math.max(0, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

      if (deltaSeconds > 0) {
        const instant = 1 / deltaSeconds;
        ema = ema === 0 ? instant : ema * 0.8 + instant * 0.2;
        // Throttle the published number only — the rAF loop keeps full rate.
        if (timestamp - lastPublishAt >= FRAME_RATE_PUBLISH_MS) {
          lastPublishAt = timestamp;
          setFrameRate(ema);
        }
      }

      const workT0 = performance.now();
      onFrameRef.current(deltaSeconds);
      const workMs = performance.now() - workT0;

      scheduleNext(workMs);
    };

    requestTick();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [playing]);

  return { frameRate };
}
