import React from 'react';

/** Default classNames shared by the "Visualization Type" / "Parameter Set" selects. */
export const VIEW_MODE_SELECT_CLASS =
  'w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40';
export const VIEW_MODE_LABEL_CLASS = 'block text-sm font-medium text-gray-300 mb-2';

export interface ViewModeOption {
  value: string | number;
  label: string;
}

interface ViewModeSelectProps {
  label: string;
  value: string | number;
  onChange: (rawValue: string) => void;
  options: ViewModeOption[];
  /** Optional trailing description paragraph, used by "Parameter Set" selects. */
  description?: string;
  className?: string;
  labelClassName?: string;
}

export function ViewModeSelect({
  label,
  value,
  onChange,
  options,
  description,
  className = VIEW_MODE_SELECT_CLASS,
  labelClassName = VIEW_MODE_LABEL_CLASS,
}: ViewModeSelectProps): React.ReactElement {
  return (
    <div>
      <label className={labelClassName}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description !== undefined && (
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      )}
    </div>
  );
}

export default ViewModeSelect;
