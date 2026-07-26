'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';

export type UseSteppedAnimationOptions = {
  playing: boolean;
  /** Step period in integer milliseconds (avoids float drift). */
  periodMs: number;
  /**
   * Wrap `step` at this modulus. Read from the latest onFrame closure via
   * useAnimationLoop's ref, so a mid-play change is never stale.
   */
  modulus: number;
};

export type UseSteppedAnimationResult = {
  step: number;
  /** Zero step and clear residual accumulator (restart). */
  reset: () => void;
};

/**
 * Accumulator-based stepped animation on top of useAnimationLoop.
 * Owns period accumulation, modulus wrap, and reset-on-stop.
 */
export function useSteppedAnimation({
  playing,
  periodMs,
  modulus,
}: UseSteppedAnimationOptions): UseSteppedAnimationResult {
  const [step, setStep] = useState(0);
  const accumRef = useRef(0);

  // Clear residual on stop so a resume waits a full period.
  useEffect(() => {
    if (!playing) accumRef.current = 0;
  }, [playing]);

  useAnimationLoop({
    playing,
    onFrame: (deltaSeconds) => {
      if (deltaSeconds <= 0) return;
      // periodMs / modulus from this render; useAnimationLoop keeps latest onFrame.
      accumRef.current += deltaSeconds * 1000;
      while (accumRef.current >= periodMs) {
        accumRef.current -= periodMs;
        setStep((prev) => (prev + 1) % modulus);
      }
    },
  });

  const reset = useCallback(() => {
    setStep(0);
    accumRef.current = 0;
  }, []);

  return { step, reset };
}
