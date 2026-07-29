'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  usePlaybackRegistry,
  type AnimatableParam,
} from '@/components/ui/PlaybackContext';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Full-range wall-clock sweep at 1× (seconds). Same duration for every scale. */
export const PLAYBACK_SWEEP_SECONDS = 10;

// 2x was faster than the structure could be read; 0.2x gives a 50 s full
// sweep, slow enough to follow a bifurcation as it happens.
const SPEEDS = [0.2, 0.5, 1] as const;
export type PlaybackSpeed = (typeof SPEEDS)[number];

/** Clamp a selection index into `[0, count)`. Empty registry → 0. */
export function clampSelectedIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.trunc(index)), count - 1);
}

/** Snap `value` to a legal slider tick in `[min, max]`. */
export function quantizeToStep(
  value: number,
  min: number,
  max: number,
  step: number,
): number {
  if (!Number.isFinite(value)) return min;
  if (!(step > 0) || !Number.isFinite(step)) {
    return Math.min(max, Math.max(min, value));
  }
  const steps = Math.round((value - min) / step);
  let q = min + steps * step;
  const stepStr = String(step);
  const decimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
  q = Number(q.toFixed(Math.min(12, decimals + 2)));
  if (q > max) q = max;
  if (q < min) q = min;
  return q;
}

/**
 * Advance a continuous playhead by `deltaSeconds` at `speed`×.
 * Rate is `(max - min) / sweepSeconds * speed` so every param sweeps its
 * full range in the same wall-clock time. Returns the continuous playhead
 * (wrapped into `[min, max)`) and the step-quantised value to write.
 */
export function advancePlayhead(
  playhead: number,
  min: number,
  max: number,
  step: number,
  deltaSeconds: number,
  speed: number,
  sweepSeconds: number = PLAYBACK_SWEEP_SECONDS,
): { playhead: number; quantized: number } {
  const range = max - min;
  if (!(range > 0) || !(deltaSeconds > 0) || !(speed > 0)) {
    return {
      playhead,
      quantized: quantizeToStep(playhead, min, max, step),
    };
  }
  const rate = (range / sweepSeconds) * speed;
  let next = playhead + rate * deltaSeconds;
  // Wrap at max → min, preserving remainder past the end.
  if (next >= max) {
    next = min + ((next - min) % range);
    if (next >= max) next = min;
  }
  if (next < min) next = min;
  return {
    playhead: next,
    quantized: quantizeToStep(next, min, max, step),
  };
}

/** Flatten a React label node to plain text for the param selector. */
export function flattenLabel(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenLabel).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return flattenLabel(props.children);
  }
  return '';
}

/** Fine scrubber step so values like K=0.9716 are reachable (not param.step). */
export function scrubberStep(min: number, max: number): number {
  const range = max - min;
  if (!(range > 0)) return 1;
  return Math.max(range / 10_000, 1e-6);
}

function formatValue(value: number, step: number): string {
  if (!Number.isFinite(value)) return '—';
  if (step >= 1) return String(Math.round(value));
  const stepStr = String(step);
  const decimals = stepStr.includes('.')
    ? Math.max(stepStr.split('.')[1].length, 4)
    : 4;
  // Scrubber is finer than step; show enough digits for precision control.
  return value.toFixed(Math.min(6, Math.max(decimals, 4)));
}

/**
 * Global playback bar for map pages. Mount once under a `PlaybackProvider`
 * (see `MapPageLayout`). Drives the selected registered `ParamSlider` via
 * the registry — no visualization code is involved.
 */
export function PlaybackControls(): React.ReactElement {
  const registry = usePlaybackRegistry();
  const params = registry.getParams();
  // Policy hook: reduced motion suppresses autoplay only. There is no
  // autoplay this cycle — play is always user-initiated and never gated.
  useReducedMotion();

  const [playing, setPlaying] = useState(false);
  // Default to the slowest speed: a full sweep at 1x moves too fast to read
  // the structure the plots exist to show.
  const [speed, setSpeed] = useState<PlaybackSpeed>(0.5);
  // Selection is an INDEX, not a useId() name — names are tree-position
  // opaque and would not survive a view-mode remount of sibling sliders.
  // Stored raw; always read through clampSelectedIndex so a shrink cannot
  // leave us pointing past the end.
  const [selectedIndexRaw, setSelectedIndexRaw] = useState(0);
  const [displayValue, setDisplayValue] = useState(0);

  const clampedIndex = clampSelectedIndex(selectedIndexRaw, params.length);
  const selected: AnimatableParam | undefined = params[clampedIndex];
  const empty = params.length === 0;
  const selectedKey = selected?.name ?? null;

  const playheadRef = useRef<number | null>(null);
  const selectedIndexRef = useRef(clampedIndex);
  const speedRef = useRef(speed);
  const paramsRef = useRef(params);

  useLayoutEffect(() => {
    selectedIndexRef.current = clampedIndex;
    speedRef.current = speed;
    paramsRef.current = params;
  });

  // Re-seed the continuous playhead + readout when membership or selection
  // changes. External system: the registry map (same role as
  // useAnimationLoop's playing→frameRate=0 reset).
  useLayoutEffect(() => {
    if (!selected) {
      playheadRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- registry empty-state sync
      setDisplayValue(0);
      setPlaying(false);
      return;
    }
    const v = selected.getValue();
    playheadRef.current = v;
    setDisplayValue(v);
  }, [selected, selectedKey, registry.version, clampedIndex]);

  // Fresh closure each render is fine: useAnimationLoop holds onFrame in a ref.
  const onFrame = (deltaSeconds: number) => {
    if (deltaSeconds <= 0) return;
    const list = paramsRef.current;
    const idx = clampSelectedIndex(selectedIndexRef.current, list.length);
    const param = list[idx];
    if (!param) return;

    const min = param.min;
    const max = param.max;
    const step = param.step;
    if (playheadRef.current === null) {
      playheadRef.current = param.getValue();
    }

    const { playhead, quantized } = advancePlayhead(
      playheadRef.current,
      min,
      max,
      step,
      deltaSeconds,
      speedRef.current,
    );
    playheadRef.current = playhead;

    if (quantized !== param.getValue()) {
      param.setValue(quantized);
    }
    setDisplayValue(quantized);
  };

  const { frameRate } = useAnimationLoop({
    playing: playing && !empty,
    onFrame,
  });

  const handleToggle = () => {
    if (empty) return;
    setPlaying((p) => {
      if (!p) {
        // Seed playhead from the live value so play resumes where the
        // slider (or scrubber) left off.
        const param = params[clampedIndex];
        if (param) playheadRef.current = param.getValue();
      }
      return !p;
    });
  };

  const handleReset = () => {
    if (empty || !selected) return;
    setPlaying(false);
    playheadRef.current = selected.min;
    selected.setValue(selected.min);
    setDisplayValue(selected.min);
  };

  const handleScrub = (raw: string) => {
    if (empty || !selected) return;
    const next = parseFloat(raw);
    if (!Number.isFinite(next)) return;
    // Scrub is precision control: write the exact value, pause playback.
    setPlaying(false);
    playheadRef.current = next;
    selected.setValue(next);
    setDisplayValue(next);
  };

  const handleSelectParam = (raw: string) => {
    const next = parseInt(raw, 10);
    if (!Number.isFinite(next)) return;
    setPlaying(false);
    setSelectedIndexRaw(clampSelectedIndex(next, params.length));
    playheadRef.current = null;
  };

  const handleSpeed = (raw: string) => {
    // Validate against SPEEDS itself rather than repeating its values — a
    // hand-copied list here silently rejected any speed added to SPEEDS.
    const next = parseFloat(raw);
    if ((SPEEDS as readonly number[]).includes(next)) {
      setSpeed(next as PlaybackSpeed);
    }
  };

  const min = selected?.min ?? 0;
  const max = selected?.max ?? 1;
  const step = selected?.step ?? 0.01;
  const fineStep = scrubberStep(min, max);

  return (
    <div
      className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20"
      data-testid="playback-controls"
      data-selected-index={empty ? -1 : clampedIndex}
      aria-disabled={empty || undefined}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-cyan-400 shrink-0">Playback</p>

        <button
          type="button"
          data-testid="playback-play-pause"
          aria-pressed={playing}
          aria-label={playing ? 'Pause' : 'Play'}
          disabled={empty}
          onClick={handleToggle}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-cyan-500/30 bg-black/40 text-cyan-400 hover:bg-black/60 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {playing ? 'Pause' : 'Play'}
        </button>

        <button
          type="button"
          data-testid="playback-reset"
          aria-label="Reset"
          disabled={empty}
          onClick={handleReset}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-cyan-500/30 bg-black/40 text-cyan-400 hover:bg-black/60 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reset
        </button>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <span className="text-cyan-400 font-medium">Speed</span>
          <select
            data-testid="playback-speed"
            value={speed}
            disabled={empty}
            onChange={(e) => handleSpeed(e.target.value)}
            className="p-1.5 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40 disabled:opacity-40"
            aria-label="Playback speed"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-300 min-w-0 flex-1">
          <span className="text-cyan-400 font-medium shrink-0">Param</span>
          <select
            data-testid="playback-param-select"
            value={empty ? '' : String(clampedIndex)}
            disabled={empty}
            onChange={(e) => handleSelectParam(e.target.value)}
            className="p-1.5 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40 disabled:opacity-40 min-w-0 max-w-full"
            aria-label="Animated parameter"
          >
            {empty ? (
              <option value="">No animatable parameters</option>
            ) : (
              params.map((p, i) => (
                <option key={p.name} value={i}>
                  {flattenLabel(p.label) || `Parameter ${i + 1}`}
                </option>
              ))
            )}
          </select>
        </label>

        <span
          className="text-sm text-gray-300 tabular-nums"
          data-testid="playback-value"
          aria-live="polite"
        >
          {empty ? '—' : formatValue(displayValue, step)}
        </span>

        <span
          className="text-xs text-gray-500 tabular-nums"
          data-testid="playback-fps"
          title="Achieved animation frame rate"
        >
          {playing ? `${frameRate.toFixed(1)} fps` : '— fps'}
        </span>
      </div>

      <div className="mt-3">
        <label className="block text-sm font-medium text-cyan-400 mb-1">
          Scrubber
          <input
            type="range"
            data-testid="playback-scrubber"
            aria-label="Parameter scrubber"
            min={min}
            max={max}
            step={fineStep}
            value={empty ? min : displayValue}
            disabled={empty}
            onChange={(e) => handleScrub(e.target.value)}
            className="w-full h-2 mt-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </label>
      </div>
    </div>
  );
}

export default PlaybackControls;
