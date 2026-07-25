"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import {
  ComplexNumber,
  calculateComplexQuadraticMap,
  calculateJuliaSet,
  calculateMandelbrotSet,
  calculateJuliaSetBoundary,
  getInterestingJuliaParameters,
  calculateFractalColor,
  calculateMandelbrotZoom,
  getInterestingMandelbrotLocations
} from '@/lib/maps/complexQuadratic';

const ComplexMapVisualization: React.FC = () => {
  const [visualizationType, setVisualizationType] = useState<'julia' | 'mandelbrot'>('julia');
  const [selectedJuliaParam, setSelectedJuliaParam] = useState(0);
  const [selectedMandelbrotLocation, setSelectedMandelbrotLocation] = useState(0);
  const [maxIterations, setMaxIterations] = useState(100);
  const [colorScheme, setColorScheme] = useState<'classic' | 'fire' | 'ocean' | 'rainbow'>('classic');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isRendering, setIsRendering] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; value: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = 600;
  const height = 400;

  const juliaParameters = useMemo(() => getInterestingJuliaParameters(), []);
  const mandelbrotLocations = useMemo(() => getInterestingMandelbrotLocations(), []);

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
        juliaParameters[selectedJuliaParam].c,
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

      // For a clicked point in Mandelbrot set, we could show the corresponding Julia set
      // This would require additional state management
      console.log(`Julia parameter for clicked point: ${complexX.toFixed(4)} + ${complexY.toFixed(4)}i`);
    }
  };

  const resetZoom = () => {
    setZoomLevel(1);
  };

  const getCurrentInfo = () => {
    if (visualizationType === 'julia') {
      const param = juliaParameters[selectedJuliaParam];
      return {
        title: `Julia Set: ${param.name}`,
        equation: `z_{n+1} = z_n² + ${param.c.real.toFixed(3)} + ${param.c.imag.toFixed(3)}i`,
        description: `Visualizing the Julia set for c = ${param.c.real.toFixed(3)} + ${param.c.imag.toFixed(3)}i`
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
      if (!ctx) return;

      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      let fractalData: number[][];

      if (visualizationType === 'julia') {
        const param = juliaParameters[selectedJuliaParam];
        fractalData = calculateJuliaSet(
          param.c,
          -2, 2, -2, 2,
          width, height,
          maxIterations
        );
      } else {
        const location = mandelbrotLocations[selectedMandelbrotLocation];
        fractalData = calculateMandelbrotZoom(
          location.x,
          location.y,
          location.zoom * zoomLevel,
          width, height,
          location.maxIterations
        );
      }

      // Convert fractal data to pixel colors
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const iterations = fractalData[y][x];
          const color = calculateFractalColor(iterations, maxIterations, colorScheme);
          const index = (y * width + x) * 4;

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
  }, [visualizationType, selectedJuliaParam, selectedMandelbrotLocation, maxIterations, colorScheme, zoomLevel, isRendering, juliaParameters, mandelbrotLocations]);

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
              onChange={(e) => setVisualizationType(e.target.value as 'julia' | 'mandelbrot')}
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
                value={selectedJuliaParam}
                onChange={(e) => setSelectedJuliaParam(parseInt(e.target.value))}
                className="w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40"
              >
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
                onChange={(e) => setSelectedMandelbrotLocation(parseInt(e.target.value))}
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

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Iterations: {maxIterations}
            </label>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={maxIterations}
              onChange={(e) => setMaxIterations(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {visualizationType === 'mandelbrot' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Zoom Level: {zoomLevel}x
              </label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <button
                onClick={resetZoom}
                className="mt-2 w-full p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Reset Zoom
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Color Scheme
            </label>
            <select
              value={colorScheme}
              onChange={(e) => setColorScheme(e.target.value as 'classic' | 'fire' | 'ocean' | 'rainbow')}
              className="w-full p-2 bg-gray-800 text-gray-300 border border-cyan-500/20 rounded-lg focus:outline-hidden focus:border-cyan-400/40"
            >
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