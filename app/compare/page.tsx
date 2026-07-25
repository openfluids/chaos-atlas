'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

import {
  ComparativeMapParams,
  ComparativeMapSeries,
} from '@/lib/maps/comparative-wrappers';
import {
  COMPARISON_MAPS,
  MAP_BY_ID,
  ComparisonMapData,
} from '@/lib/maps/compare-config';

type ComparisonMode = 'time-series' | 'phase-space' | 'bifurcation' | 'lyapunov';
type ComparisonPoint = number | { x: number; y: number };

const getSafeValue = (value: number): number => {
  return Number.isFinite(value) ? value : 0;
};

const getPointScalar = (point: ComparisonPoint): number => {
  if (typeof point === 'number') {
    return getSafeValue(point);
  }
  return getSafeValue(point.x);
};

const getPointCoordinate = (
  point: ComparisonPoint,
  axis: 'x' | 'y',
  fallback = 0
): number => {
  if (typeof point === 'number') {
    return getSafeValue(fallback);
  }
  return getSafeValue(point[axis]);
};

const getDataRange = (data: ComparativeMapSeries, accessor: (p: ComparisonPoint) => number): [number, number] => {
  let min = Infinity;
  let max = -Infinity;
  for (const point of data) {
    const v = accessor(point);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const pad = (max - min) * 0.05 || 0.5;
  return [min - pad, max + pad];
};

const buildTimeSeriesPath = (data: ComparativeMapSeries): string => {
  if (data.length === 0) return '';
  const [yMin, yMax] = getDataRange(data, getPointScalar);
  const ySpan = yMax - yMin || 1;
  return data
    .map((point, i) => {
      const value = getPointScalar(point);
      const x = (i / data.length) * 100;
      const y = 100 - ((value - yMin) / ySpan) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' L ');
};

const buildPhaseSpacePath = (data: ComparativeMapSeries): string => {
  if (data.length === 0) return '';
  const [xMin, xMax] = getDataRange(data, (p) => getPointCoordinate(p, 'x', 0));
  const [yMin, yMax] = getDataRange(data, (p) => getPointCoordinate(p, 'y', 0));
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;
  return data
    .map((point) => {
      const px = getPointCoordinate(point, 'x', 0);
      const py = getPointCoordinate(point, 'y', 0);
      const x = ((px - xMin) / xSpan) * 100;
      const y = 100 - ((py - yMin) / ySpan) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' L ');
};

const renderMapComparisonGrid = (
  selectedMaps: string[],
  comparisonData: Record<string, ComparativeMapSeries>,
  cardRenderer: (map: ComparisonMapData | undefined, data: ComparativeMapSeries, mapId: string) => React.ReactElement | null
) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
      {selectedMaps.map(mapId => {
        const map = MAP_BY_ID[mapId];
        const data = comparisonData[mapId] || [];
        return cardRenderer(map, data, mapId);
      })}
    </div>
  );
};

const renderTimeSeriesCard = (
  map: ComparisonMapData | undefined,
  data: ComparativeMapSeries,
  mapId: string
): React.ReactElement => {
  return (
    <div key={map?.id || mapId} className="bg-black/30 border border-cyan-500/20 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-3 neon-text-cyan">{map?.name || mapId}</h3>
      <div className="h-64">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" className="border border-cyan-500/10 rounded-sm bg-black/80">
          {data.length > 0 && (
            <g>
              <path
                d={`M ${buildTimeSeriesPath(data)}`}
                fill="none"
                stroke="var(--accent-cyan, #00ffff)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
        </svg>
      </div>
      <p className="text-sm text-gray-400 mt-2">{map?.description}</p>
    </div>
  );
};

const renderPhaseSpaceCard = (
  map: ComparisonMapData | undefined,
  data: ComparativeMapSeries,
  mapId: string
): React.ReactElement => {
  if (map?.dimension !== 2) {
    return (
      <div key={map?.id || mapId} className="bg-black/30 border border-cyan-500/20 rounded-lg p-4 flex items-center justify-center">
        <p className="text-gray-400">Phase space not available for 1D maps</p>
      </div>
    );
  }

  return (
    <div key={map?.id || mapId} className="bg-black/30 border border-cyan-500/20 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-3 neon-text-cyan">{map?.name || mapId}</h3>
      <div className="h-64">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" className="border border-cyan-500/10 rounded-sm bg-black/80">
          {data.length > 0 && (
            <g>
              <path
                d={`M ${buildPhaseSpacePath(data)}`}
                fill="none"
                stroke="var(--accent-cyan, #00ffff)"
                strokeWidth="0.5"
                opacity="0.8"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
        </svg>
      </div>
      <p className="text-sm text-gray-400 mt-2">{map?.description}</p>
    </div>
  );
};

const renderComingSoon = (text: string) => (
  <div className="text-center py-12">
    <p className="text-gray-400">{text}</p>
  </div>
);

const renderComparisonContent = (
  mode: ComparisonMode,
  selectedMaps: string[],
  comparisonData: Record<string, ComparativeMapSeries>
): React.ReactElement => {
  switch (mode) {
    case 'time-series':
      return renderMapComparisonGrid(selectedMaps, comparisonData, renderTimeSeriesCard);
    case 'phase-space':
      return renderMapComparisonGrid(selectedMaps, comparisonData, renderPhaseSpaceCard);
    case 'bifurcation':
      return renderComingSoon('Bifurcation comparison coming soon...');
    case 'lyapunov':
      return renderComingSoon('Lyapunov exponent comparison coming soon...');
    default:
      return renderComingSoon('Unsupported comparison mode.');
  }
};

const ComparativeAnalysis: React.FC = () => {
  const [selectedMaps, setSelectedMaps] = useState<string[]>(['logistic', 'henon']);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('time-series');
  const [iterations, setIterations] = useState(1000);
  const [syncParams, setSyncParams] = useState(false);
  const [sharedParam, setSharedParam] = useState('r');
  // Derived from the controls below, so it is computed during render rather
  // than written into state by an effect. Effect-plus-state costs an extra
  // render and leaves one frame showing the previous selection's series.
  const comparisonData = useMemo<Record<string, ComparativeMapSeries>>(() => {
    const data: Record<string, ComparativeMapSeries> = {};

    selectedMaps.forEach(mapId => {
      const map = MAP_BY_ID[mapId];
      if (map) {
        try {
          // For synchronized parameters, modify the default parameters
          const params: ComparativeMapParams = { ...map.defaultParams };
          if (syncParams && sharedParam in map.paramRanges) {
            const range = map.paramRanges[sharedParam];
            params[sharedParam] = (range.min + range.max) / 2;
          }

          const result = map.calculate(params, iterations);
          // Validate the result
          if (Array.isArray(result) && result.length > 0) {
            data[mapId] = result;
          } else {
            console.warn(`Invalid result for ${map.name}:`, result);
            data[mapId] = [];
          }
        } catch (error) {
          console.error(`Error calculating ${map.name}:`, error);
          data[mapId] = [];
        }
      }
    });

    return data;
  }, [selectedMaps, iterations, syncParams, sharedParam]);

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-cyan-400 hover:text-cyan-300 mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold mb-4 bg-linear-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            Comparative Analysis Framework
          </h1>
          <p className="text-gray-300 text-lg">
            Compare different chaotic systems side-by-side to understand their unique behaviors and characteristics
          </p>
        </div>

        {/* Controls */}
        <div className="bg-black/40 border border-cyan-500/20 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Map Selection */}
            <div>
              <label className="block text-sm font-medium mb-2 text-cyan-400">
                Select Maps (2-4 recommended)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {COMPARISON_MAPS.map(map => (
                  <label key={map.id} className="flex items-center">
                    <input
                      id={`map-${map.id}`}
                      type="checkbox"
                      checked={selectedMaps.includes(map.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (selectedMaps.length < 4) {
                            setSelectedMaps([...selectedMaps, map.id]);
                          }
                        } else {
                          setSelectedMaps(selectedMaps.filter(id => id !== map.id));
                        }
                      }}
                      className="mr-2 rounded-sm border-cyan-500/30 bg-black/50 text-cyan-400"
                    />
                    <span className="text-sm">{map.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Comparison Mode */}
            <div>
              <label className="block text-sm font-medium mb-2 text-cyan-400">
                Comparison Mode
              </label>
              <select
                name="comparison-mode"
                value={comparisonMode}
                onChange={(e) => setComparisonMode(e.target.value as ComparisonMode)}
                className="w-full bg-black/50 border border-cyan-500/30 rounded-sm px-3 py-2 text-white"
              >
                <option value="time-series">Time Series</option>
                <option value="phase-space">Phase Space</option>
                <option value="bifurcation">Bifurcation Analysis</option>
                <option value="lyapunov">Lyapunov Exponents</option>
              </select>
            </div>

            {/* Iterations */}
            <div>
              <label className="block text-sm font-medium mb-2 text-cyan-400">
                Iterations: {iterations}
              </label>
              <input
                name="iterations"
                type="range"
                min="100"
                max="5000"
                value={iterations}
                onChange={(e) => setIterations(parseInt(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            {/* Parameter Synchronization */}
            <div>
              <label className="block text-sm font-medium mb-2 text-cyan-400">
                <input
                  name="sync-params"
                  type="checkbox"
                  checked={syncParams}
                  onChange={(e) => setSyncParams(e.target.checked)}
                  className="mr-2 rounded-sm border-cyan-500/30 bg-black/50 text-cyan-400"
                />
                Sync Parameters
              </label>
              {syncParams && (
                <select
                  name="shared-param"
                  value={sharedParam}
                  onChange={(e) => setSharedParam(e.target.value)}
                  className="w-full bg-black/50 border border-cyan-500/30 rounded-sm px-3 py-2 text-white text-sm"
                >
                  <option value="r">Growth Rate (r)</option>
                  <option value="a">Parameter (a)</option>
                  <option value="b">Parameter (b)</option>
                  <option value="x0">Initial X</option>
                </select>
              )}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-gray-400">
              {selectedMaps.length} maps selected • {comparisonMode} comparison • {iterations} iterations
            </p>
          </div>
        </div>

        {/* Comparison Visualization */}
        <div className="bg-black/40 border border-cyan-500/20 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 neon-text-cyan capitalize">
            {comparisonMode.replace('-', ' ')} Comparison
          </h2>

          {selectedMaps.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Select at least one map to begin comparison</p>
            </div>
          ) : (
            <>
              {renderComparisonContent(comparisonMode, selectedMaps, comparisonData)}
            </>
          )}
        </div>

        {/* Educational Insights */}
        <div className="mt-8 bg-black/40 border border-purple-500/20 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 neon-text-purple">Comparative Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-purple-400">Key Differences</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• <strong>Dimensionality:</strong> 1D vs 2D dynamics</li>
                <li>• <strong>Dissipation:</strong> Conservative vs dissipative systems</li>
                <li>• <strong>Attractors:</strong> Fixed points, cycles, strange attractors</li>
                <li>• <strong>Parameters:</strong> Different control parameters</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-purple-400">Universal Properties</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• <strong>Sensitive dependence:</strong> Butterfly effect</li>
                <li>• <strong>Mixing:</strong> Ergodic behavior</li>
                <li>• <strong>Dense orbits:</strong> Coverage of phase space</li>
                <li>• <strong>Periodicity:</strong> Windows of order in chaos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparativeAnalysis;
