import React from 'react';

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
}

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
}: ParamSliderProps): React.ReactElement {
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
