import React from 'react';

/** Default className shared by the majority of map visualizations' sliders. */
export const PARAM_SLIDER_INPUT_CLASS =
  'w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider';
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
  className?: string;
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
  className = PARAM_SLIDER_INPUT_CLASS,
  labelClassName = PARAM_SLIDER_LABEL_CLASS,
  labelStyle,
  disabled,
}: ParamSliderProps): React.ReactElement {
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
        className={className}
      />
    </div>
  );
}

export default ParamSlider;
