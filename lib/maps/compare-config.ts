import {
  calculateLogisticMapWrapper,
  calculateHenonMapWrapper,
  calculateTentMapWrapper,
  calculateIkedaMapWrapper,
  calculateTinkerbellMapWrapper,
  calculateDuffingMapWrapper,
  ComparativeMapParams,
  ComparativeMapSeries,
} from '@/lib/maps/comparative-wrappers';

export type ComparisonMapData = {
  name: string;
  id: string;
  calculate: (params: ComparativeMapParams, iterations: number) => ComparativeMapSeries;
  defaultParams: ComparativeMapParams;
  paramRanges: Record<string, { min: number; max: number; step: number }>;
  description: string;
  dimension: number;
};

export const COMPARISON_MAPS: ComparisonMapData[] = [
  {
    name: 'Logistic Map',
    id: 'logistic',
    calculate: calculateLogisticMapWrapper,
    defaultParams: { r: 3.8, x0: 0.5 },
    paramRanges: {
      r: { min: 0, max: 4, step: 0.01 },
      x0: { min: 0, max: 1, step: 0.01 }
    },
    description: 'Classic 1D chaotic system showing period doubling route to chaos',
    dimension: 1
  },
  {
    name: 'Hénon Map',
    id: 'henon',
    calculate: calculateHenonMapWrapper,
    defaultParams: { a: 1.4, b: 0.3, x0: 0.1, y0: 0.1 },
    paramRanges: {
      a: { min: 0, max: 2, step: 0.01 },
      b: { min: 0, max: 1, step: 0.01 },
      x0: { min: -2, max: 2, step: 0.01 },
      y0: { min: -2, max: 2, step: 0.01 }
    },
    description: '2D dissipative system with strange attractor',
    dimension: 2
  },
  {
    name: 'Tent Map',
    id: 'tent',
    calculate: calculateTentMapWrapper,
    defaultParams: { alpha: 1.2, x0: 0.5 },
    paramRanges: {
      alpha: { min: 0.5, max: 2, step: 0.01 },
      x0: { min: 0, max: 1, step: 0.01 }
    },
    description: 'Piecewise linear map with exact chaos threshold',
    dimension: 1
  },
  {
    name: 'Ikeda Map',
    id: 'ikeda',
    calculate: calculateIkedaMapWrapper,
    defaultParams: { a: 0.9, b: 0.9, c: 0.4, d: 6.0, x0: 0.1, y0: 0.1 },
    paramRanges: {
      a: { min: 0, max: 1, step: 0.01 },
      b: { min: 0, max: 1, step: 0.01 },
      c: { min: 0, max: 1, step: 0.01 },
      d: { min: 0, max: 10, step: 0.1 },
      x0: { min: -2, max: 2, step: 0.01 },
      y0: { min: -2, max: 2, step: 0.01 }
    },
    description: 'Laser cavity dynamics with spiral attractors',
    dimension: 2
  },
  {
    name: 'Tinkerbell Map',
    id: 'tinkerbell',
    calculate: calculateTinkerbellMapWrapper,
    defaultParams: { a: 0.9, b: -0.6013, c: 2.0, d: 0.5, x0: 0.1, y0: 0.1 },
    paramRanges: {
      a: { min: -1, max: 1, step: 0.01 },
      b: { min: -1, max: 1, step: 0.01 },
      c: { min: -2, max: 2, step: 0.01 },
      d: { min: -2, max: 2, step: 0.01 },
      x0: { min: -2, max: 2, step: 0.01 },
      y0: { min: -2, max: 2, step: 0.01 }
    },
    description: 'Polynomial map with multi-loop chaotic attractors',
    dimension: 2
  },
  {
    name: 'Duffing Map',
    id: 'duffing',
    calculate: calculateDuffingMapWrapper,
    defaultParams: { a: 2.75, b: 0.2, x0: 0.1, y0: 0.1 },
    paramRanges: {
      a: { min: 0, max: 4, step: 0.01 },
      b: { min: 0, max: 1, step: 0.01 },
      x0: { min: -2, max: 2, step: 0.01 },
      y0: { min: -2, max: 2, step: 0.01 }
    },
    description: 'Discretized double-well oscillator',
    dimension: 2
  }
];

export const MAP_BY_ID = COMPARISON_MAPS.reduce<Record<string, ComparisonMapData>>((acc, map) => {
  acc[map.id] = map;
  return acc;
}, {});

