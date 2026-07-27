"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ComplexNumber,
  calculateComplexQuadraticMap,
  calculateJuliaSet,
  getInterestingJuliaParameters,
  calculateFractalColor,
  calculateMandelbrotZoom,
  getInterestingMandelbrotLocations,
  type FractalColorScheme,
  type FractalEscapeResult
} from '@/lib/maps/complexQuadratic';
import { ParamSlider } from '@/components/ui/ParamSlider';

/** Slider domain for Julia c. Every preset from getInterestingJuliaParameters()
 *  fits in [-2, 2]. Values with |c| > 2 escape the critical orbit immediately
 *  (Cantor-dust Julia sets), so clamping click-to-set into this box loses no
 *  picture worth showing — and without a clamp, zoomLevel=0.1 can land near c≈±20. */
export const JULIA_C_REAL_MIN = -2;
export const JULIA_C_REAL_MAX = 2;
export const JULIA_C_IMAG_MIN = -2;
export const JULIA_C_IMAG_MAX = 2;
export const JULIA_C_STEP = 0.001;

function clampJuliaC(real: number, imag: number): { real: number; imag: number } {
  return {
    real: Math.min(JULIA_C_REAL_MAX, Math.max(JULIA_C_REAL_MIN, real)),
    imag: Math.min(JULIA_C_IMAG_MAX, Math.max(JULIA_C_IMAG_MIN, imag)),
  };
}

const ComplexMapVisualization: React.FC = () => {
  const [visualizationType, setVisualizationType] = useState<'julia' | 'mandelbrot'>('julia');
  const [selectedJuliaParam, setSelectedJuliaParam] = useState(0);
  // A Julia parameter picked by clicking on the Mandelbrot set. Takes
  // precedence over `selectedJuliaParam` when set; cleared when the user
  // explicitly chooses a preset from the dropdown instead.
  const [customJuliaC, setCustomJuliaC] = useState<ComplexNumber | null>(null);
  const [selectedMandelbrotLocation, setSelectedMandelbrotLocation] = useState(0);
  const [maxIterations, setMaxIterations] = useState(100);
  const [colorScheme, setColorScheme] = useState<FractalColorScheme>('viridis');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isRendering, setIsRendering] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; value: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = 600;
  const height = 400;

  const juliaParameters = useMemo(() => getInterestingJuliaParameters(), []);
  const mandelbrotLocations = useMemo(() => getInterestingMandelbrotLocations(), []);

  const currentJuliaC = customJuliaC ?? juliaParameters[selectedJuliaParam].c;

  // Single source of truth for the iteration cap: `maxIterations` state
  // drives both the compute pass and the color normalisation. Previously
  // the compute pass used the Mandelbrot preset's own `maxIterations`
  // while coloring divided by the slider's value, so a lower slider
  // setting made every ratio exceed 1 and the whole view render as flat
  // clipped color. Selecting a Mandelbrot preset (or switching into the
  // Mandelbrot tab) now seeds the slider from that preset directly in the
  // event handler, rather than via a state-syncing effect.
  const selectMandelbrotLocation = (index: number) => {
    setSelectedMandelbrotLocation(index);
    setMaxIterations(mandelbrotLocations[index].maxIterations);
  };

  const selectVisualizationType = (type: 'julia' | 'mandelbrot') => {
    setVisualizationType(type);
    if (type === 'mandelbrot') {
      setMaxIterations(mandelbrotLocations[selectedMandelbrotLocation].maxIterations);
    }
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;

    // Convert pixel coordinates to complex plane coordinates
    let complexX, complexY;

    if (visualizationType === 'julia') {
      complexX = (x / width) * 4 - 2;
      complexY = (y / height) * 4 - 2;
    } else {
      const location = mandelbrotLocations[selectedMandelbrotLocation];
      const range = 4 / (location.zoom * zoomLevel);
      complexX = location.x - range / 2 + (x / width) * range;
      complexY = location.y - range / 2 + (y / height) * range;
    }

    // Calculate value at this point
    let value: number;
    if (visualizationType === 'julia') {
      const result = calculateComplexQuadraticMap(
        currentJuliaC,
        new ComplexNumber(complexX, complexY),
        maxIterations
      );
      value = result.iterations;
    } else {
      const result = calculateComplexQuadraticMap(
        new ComplexNumber(complexX, complexY),
        new ComplexNumber(0, 0),
        maxIterations
      );
      value = result.iterations;
    }

    setHoveredPoint({ x: complexX, y: complexY, value });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (visualizationType === 'mandelbrot') {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * width;
      const y = ((event.clientY - rect.top) / rect.height) * height;

      const location = mandelbrotLocations[selectedMandelbrotLocation];
      const range = 4 / (location.zoom * zoomLevel);
      const complexX = location.x - range / 2 + (x / width) * range;
      const complexY = location.y - range / 2 + (y / height) * range;

      // Clicking a point in the Mandelbrot set shows the corresponding
      // Julia set for c = (complexX, complexY). Clamp into the slider domain:
      // zoom can map a click far outside [-2, 2], and |c| > 2 is Cantor dust
      // (critical orbit escapes), so no clamped-away value was worth showing.
      const clamped = clampJuliaC(complexX, complexY);
      setCustomJuliaC(new ComplexNumber(clamped.real, clamped.imag));
      setVisualizationType('julia');
    }
  };

  const resetZoom = () => {
    setZoomLevel(1);
  };

  const getCurrentInfo = () => {
    if (visualizationType === 'julia') {
      // customJuliaC is set by slider drag or Mandelbrot click — do not
      // attribute it to a click that may never have happened.
      const name = customJuliaC ? 'Custom' : juliaParameters[selectedJuliaParam].name;
      return {
        title: `Julia Set: ${name}`,
        equation: `z_{n+1} = z_n² + ${currentJuliaC.real.toFixed(3)} + ${currentJuliaC.imag.toFixed(3)}i`,
        description: `Visualizing the Julia set for c = ${currentJuliaC.real.toFixed(3)} + ${currentJuliaC.imag.toFixed(3)}i`
      };
    } else {
      const location = mandelbrotLocations[selectedMandelbrotLocation];
      return {
        title: `Mandelbrot Set: ${location.name}`,
        equation: `z_{n+1} = z_n² + c`,
        description: `Exploring the Mandelbrot set at (${location.x.toFixed(6)}, ${location.y.toFixed(6)}) with zoom ${location.zoom * zoomLevel}x`
      };
    }
  };

  const info = getCurrentInfo();

  useEffect(() => {
    const renderFractal = async () => {
      if (!canvasRef.current || isRendering) return;

      setIsRendering(true);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsRendering(false);
        return;
      }

      // Scale the canvas backing store by devicePixelRatio so the render
      // matches the physical pixel density of the screen -- otherwise a 2x
      // display shows an upsampled, soft image. The CSS box size is left
      // untouched (still governed by the `style` prop below: 100% width,
      // capped at `width`px, height locked via aspect-ratio), so only the
      // drawing-buffer resolution changes, not the on-screen box. `window`
      // is only ever touched inside this effect (client-only, never during
      // render/SSR).
      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      const imageData = ctx.createImageData(pixelWidth, pixelHeight);
      const data = imageData.data;

      let fractalData: FractalEscapeResult[][];

      if (visualizationType === 'julia') {
        fractalData = calculateJuliaSet(
          currentJuliaC,
          -2, 2, -2, 2,
          pixelWidth, pixelHeight,
          maxIterations
        );
      } else {
        const location = mandelbrotLocations[selectedMandelbrotLocation];
        // Use the single `maxIterations` state for both the compute pass
        // and the color normalisation below -- previously this passed the
        // preset's own `location.maxIterations` while coloring divided by
        // the slider's `maxIterations`, so a lower slider value made every
        // ratio exceed 1 and the whole view render as flat clipped color.
        fractalData = calculateMandelbrotZoom(
          location.x,
          location.y,
          location.zoom * zoomLevel,
          pixelWidth, pixelHeight,
          maxIterations
        );
      }

      // Convert fractal data to pixel colors, coloring on the smooth
      // (normalised) iteration count rather than the raw integer count to
      // avoid banded contour rings.
      for (let y = 0; y < pixelHeight; y++) {
        for (let x = 0; x < pixelWidth; x++) {
          const cell = fractalData[y][x];
          const color = calculateFractalColor(cell.smoothIterations, maxIterations, colorScheme, cell.escaped);
          const index = (y * pixelWidth + x) * 4;

          data[index] = color.r;
          data[index + 1] = color.g;
          data[index + 2] = color.b;
          data[index + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      setIsRendering(false);
    };

    renderFractal();
    // `currentJuliaC` is a freshly-constructed ComplexNumber every render;
    // depend on its primitive fields instead of the object reference so
    // this effect doesn't re-fire every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualizationType, currentJuliaC.real, currentJuliaC.imag, selectedMandelbrotLocation, maxIterations, colorScheme, zoomLevel, isRendering, mandelbrotLocations]);

  return (
    <div className="p-6 rounded-lg border-2 border-cyan-500/20 bg-black/30 backdrop-blur-xs">
      <h3 className="text-2xl font-bold mb-4 neon-text-cyan">Complex Quadratic Map Visualization</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Fractal Type
            </label>
            <select
              value={visualizationType}
              onChange={(e) => selectVisualizationType(e.target.value as 'julia' | 'mandelbrot')}
              className="w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40"
            >
              <option value="julia">Julia Set</option>
              <option value="mandelbrot">Mandelbrot Set</option>
            </select>
          </div>

          {visualizationType === 'julia' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Julia Set Parameter
              </label>
              <select
                value={customJuliaC !== null ? 'custom' : String(selectedJuliaParam)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'custom') return;
                  setSelectedJuliaParam(parseInt(v, 10));
                  setCustomJuliaC(null);
                }}
                className="w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40"
              >
                {customJuliaC !== null && (
                  <option value="custom">
                    Custom (c = {customJuliaC.real.toFixed(3)} + {customJuliaC.imag.toFixed(3)}i)
                  </option>
                )}
                {juliaParameters.map((param, index) => (
                  <option key={index} value={index}>
                    {param.name} (c = {param.c.real.toFixed(3)} + {param.c.imag.toFixed(3)}i)
                  </option>
                ))}
              </select>
            </div>
          )}

          {visualizationType === 'mandelbrot' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mandelbrot Location
              </label>
              <select
                value={selectedMandelbrotLocation}
                onChange={(e) => selectMandelbrotLocation(parseInt(e.target.value))}
                className="w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40"
              >
                {mandelbrotLocations.map((location, index) => (
                  <option key={index} value={index}>
                    {location.name} (zoom: {location.zoom}x)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Julia c sliders register first so play animates Re(c). They write
              customJuliaC and read currentJuliaC — one source of truth shared
              with the preset dropdown (clears customJuliaC) and Mandelbrot
              click-to-set. */}
          {visualizationType === 'julia' && (
            <>
              <ParamSlider
                label={`Re(c): ${currentJuliaC.real.toFixed(3)}`}
                min={JULIA_C_REAL_MIN}
                max={JULIA_C_REAL_MAX}
                step={JULIA_C_STEP}
                value={currentJuliaC.real}
                onChange={(real) =>
                  setCustomJuliaC((prev) => {
                    const imag = prev?.imag ?? juliaParameters[selectedJuliaParam].c.imag;
                    return new ComplexNumber(real, imag);
                  })
                }
              />
              <ParamSlider
                label={`Im(c): ${currentJuliaC.imag.toFixed(3)}`}
                min={JULIA_C_IMAG_MIN}
                max={JULIA_C_IMAG_MAX}
                step={JULIA_C_STEP}
                value={currentJuliaC.imag}
                onChange={(imag) =>
                  setCustomJuliaC((prev) => {
                    const real = prev?.real ?? juliaParameters[selectedJuliaParam].c.real;
                    return new ComplexNumber(real, imag);
                  })
                }
              />
            </>
          )}

          {/* Zoom first among Mandelbrot continuous controls so it is the
              default playback axis when Max Iterations is opted out. */}
          {visualizationType === 'mandelbrot' && (
            <div>
              <ParamSlider
                label={`Zoom Level: ${zoomLevel}x`}
                min={0.1}
                max={10}
                step={0.1}
                value={zoomLevel}
                onChange={setZoomLevel}
              />
              <button
                onClick={resetZoom}
                className="mt-2 w-full p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Reset Zoom
              </button>
            </div>
          )}

          <ParamSlider
            label={`Max Iterations: ${maxIterations}`}
            min={50}
            max={1000}
            step={50}
            value={maxIterations}
            onChange={setMaxIterations}
            parse={parseInt}
            animate={false}
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Color Scheme
            </label>
            <select
              value={colorScheme}
              onChange={(e) => setColorScheme(e.target.value as FractalColorScheme)}
              className="w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40"
            >
              <option value="viridis">Viridis</option>
              <option value="inferno">Inferno</option>
              <option value="magma">Magma</option>
              <option value="classic">Classic</option>
              <option value="fire">Fire</option>
              <option value="ocean">Ocean</option>
              <option value="rainbow">Rainbow</option>
            </select>
          </div>

          {/* Information Panel */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400 mb-1">{info.title}</p>
            <p className="text-xs text-gray-300 font-mono mb-2">{info.equation}</p>
            <p className="text-xs text-gray-400">{info.description}</p>
          </div>

          {/* Hover Information */}
          {hoveredPoint && (
            <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
              <p className="text-sm text-gray-300">
                <span className="font-medium text-cyan-400">Position:</span> ({hoveredPoint.x.toFixed(4)}, {hoveredPoint.y.toFixed(4)})
              </p>
              <p className="text-sm text-gray-300">
                <span className="font-medium text-cyan-400">Iterations:</span> {hoveredPoint.value}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {hoveredPoint.value === maxIterations ? 'Point is in the set' : 'Point escaped'}
              </p>
            </div>
          )}

          {/* Rendering Status */}
          {isRendering && (
            <div className="p-3 bg-yellow-900/30 rounded-lg border border-yellow-500/20">
              <p className="text-sm text-yellow-400">Rendering fractal...</p>
            </div>
          )}
        </div>

        {/* Visualization */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="border border-cyan-500/20 rounded-lg bg-black cursor-crosshair"
              style={{ width: '100%', maxWidth: width, height: 'auto', aspectRatio: `${width}/${height}` }}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => setHoveredPoint(null)}
              onClick={handleCanvasClick}
            />
          </div>

          {/* Instructions */}
          <div className="p-3 bg-gray-800/30 rounded-lg border border-cyan-500/10">
            <p className="text-xs text-gray-400">
              <span className="font-medium">Instructions:</span><br/>
              • Move mouse over the fractal to see coordinates and iteration values<br/>
              • Click on Mandelbrot set to explore corresponding Julia sets<br/>
              • Adjust zoom level for Mandelbrot exploration<br/>
              • Try different color schemes for better visualization
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplexMapVisualization;