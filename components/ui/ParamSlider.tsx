'use client';

import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { usePlaybackRegistryOptional } from '@/components/ui/PlaybackContext';

/**
 * Default className shared by the majority of map visualizations' sliders.
 * This is combined additively with any `className` prop passed to ParamSlider.
 */
export const PARAM_SLIDER_INPUT_CLASS =
  'w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider';
/**
 * Default label className. This is replaced (not merged) when a `labelClassName` prop
 * is provided, because callers sometimes intentionally omit the text color to set it
 * via `labelStyle` instead.
 */
export const PARAM_SLIDER_LABEL_CLASS = 'block text-sm font-medium text-gray-300 mb-2';

interface ParamSliderProps {
  /** Fully composed label content, e.g. `Parameter r: ${r.toFixed(3)}`. */
  label: React.ReactNode;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  /** Defaults to `parseFloat`; pass `parseInt` for integer-valued params. */
  parse?: (raw: string) => number;
  /**
   * Additional Tailwind classes, combined additively with the default slider classes.
   * If undefined, only the default classes are used.
   */
  className?: string;
  /**
   * Custom label className, which replaces (does not merge with) the default.
   */
  labelClassName?: string;
  labelStyle?: React.CSSProperties;
  disabled?: boolean;
  /**
   * When true (default), self-register with the nearest `PlaybackProvider` so
   * playback can drive this axis. Set `false` to opt a control out (view-mode
   * indices, cosmetic settings). No-ops when no provider is mounted.
   *
   * Convention: map pages declare the primary control parameter first — the
   * default "animate the first registered slider" behaviour then does the
   * right thing on nearly every page with no per-page configuration.
   */
  animate?: boolean;
}

type LiveFields = {
  value: number;
  onChange: (value: number) => void;
  label: React.ReactNode;
  min: number;
  max: number;
  step: number;
};

export function ParamSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  parse = parseFloat,
  className,
  labelClassName = PARAM_SLIDER_LABEL_CLASS,
  labelStyle,
  disabled,
  animate = true,
}: ParamSliderProps): React.ReactElement {
  const registry = usePlaybackRegistryOptional();
  // Stable per-instance key; no new required prop, additive to existing call sites.
  const autoName = useId();

  // Live fields for the registry: updated in layout effect so we never write
  // refs during render (react-hooks/refs). Animation reads these between
  // frames, after layout has committed.
  const liveRef = useRef<LiveFields>({
    value,
    onChange,
    label,
    min,
    max,
    step,
  });
  useLayoutEffect(() => {
    liveRef.current.value = value;
    liveRef.current.onChange = onChange;
    liveRef.current.label = label;
    liveRef.current.min = min;
    liveRef.current.max = max;
    liveRef.current.step = step;
  });

  useEffect(() => {
    if (!animate || !registry) return;

    // Flip to false on cleanup so a caller holding a cached AnimatableParam
    // cannot setState on an unmounted owner after deregistration.
    let mounted = true;

    registry.register({
      name: autoName,
      get label() {
        return liveRef.current.label;
      },
      get min() {
        return liveRef.current.min;
      },
      get max() {
        return liveRef.current.max;
      },
      get step() {
        return liveRef.current.step;
      },
      getValue: () => liveRef.current.value,
      setValue: (next: number) => {
        if (!mounted) return;
        liveRef.current.onChange(next);
      },
    });

    return () => {
      mounted = false;
      registry.deregister(autoName);
    };
  }, [animate, registry, autoName]);

  // Combine default classes with any additional className
  const computedClassName = className
    ? `${PARAM_SLIDER_INPUT_CLASS} ${className}`
    : PARAM_SLIDER_INPUT_CLASS;

  return (
    <div>
      <label className={labelClassName} style={labelStyle}>
        {label}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parse(e.target.value))}
        disabled={disabled}
        className={computedClassName}
      />
    </div>
  );
}

export default ParamSlider;
