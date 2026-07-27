'use client';

import React, { useState, useRef } from 'react';
import { createPlotExporter, ExportOptions, PlotMetadata } from '@/lib/export/plot-export';
import { DataTheme } from '@/lib/themes/data-themes';

interface ExportControlsProps {
  svgElement: SVGSVGElement | null;
  metadata: PlotMetadata;
  currentTheme: DataTheme;
  data?: Array<{x: number, y: number, [key: string]: any}>;
  className?: string;
}

export const ExportControls: React.FC<ExportControlsProps> = ({
  svgElement,
  metadata,
  currentTheme,
  data = [],
  className = '',
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportMode, setExportMode] = useState<'clean' | 'academic'>('academic');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    mode: 'academic',
    width: 1920,
    height: 1080,
    quality: 0.95,
    dpi: 300,
  });

  const handleExportPNG = async () => {
    if (!svgElement || isExporting) return;

    setIsExporting(true);
    try {
      const exporter = createPlotExporter(svgElement, metadata);
      await exporter.exportPNG({
        ...exportOptions,
        mode: exportMode,
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSVG = async () => {
    if (!svgElement || isExporting) return;

    setIsExporting(true);
    try {
      const exporter = createPlotExporter(svgElement, metadata);
      await exporter.exportSVG();
    } catch (error) {
      console.error('SVG export failed:', error);
      alert(`SVG export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (data.length === 0) {
      alert('No data available to export as CSV');
      return;
    }

    if (!svgElement) {
      alert('No visualization available to export');
      return;
    }

    setIsExporting(true);
    try {
      const exporter = createPlotExporter(svgElement, metadata);
      await exporter.exportCSV(data);
    } catch (error) {
      console.error('CSV export failed:', error);
      alert(`CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const presetSizes = [
    { name: 'HD (1920×1080)', width: 1920, height: 1080 },
    { name: '4K (3840×2160)', width: 3840, height: 2160 },
    { name: 'Square (1080×1080)', width: 1080, height: 1080 },
    { name: 'Instagram (1080×1350)', width: 1080, height: 1350 },
    { name: 'A4 Print (2480×3508)', width: 2480, height: 3508 },
    { name: 'Custom', width: 0, height: 0 },
  ];

  const presetDPIs = [
    { name: 'Web (72 DPI)', value: 72 },
    { name: 'Standard (96 DPI)', value: 96 },
    { name: 'High Quality (300 DPI)', value: 300 },
    { name: 'Print (600 DPI)', value: 600 },
  ];

  return (
    <div className={`bg-black/90 border border-cyan-500/30 rounded-lg p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-cyan-400">Export Plot</h3>
        <div className="text-sm text-gray-400">
          Theme: {currentTheme.name}
        </div>
      </div>

      {/* Export Mode Selection */}
      <div>
        <label className="block text-sm font-medium mb-2 text-cyan-400">Export Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setExportMode('academic')}
            className={`px-3 py-2 rounded text-sm transition-colors ${
              exportMode === 'academic'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Academic Plot
          </button>
          <button
            onClick={() => setExportMode('clean')}
            className={`px-3 py-2 rounded text-sm transition-colors ${
              exportMode === 'clean'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Clean Plot
          </button>
        </div>
        <div className="mt-1 text-xs text-gray-400">
          {exportMode === 'academic'
            ? 'Include axes, labels, and annotations for papers'
            : 'Data only for artistic use and presentations'
          }
        </div>
      </div>

      {/* Size Settings */}
      <div>
        <label className="block text-sm font-medium mb-2 text-cyan-400">Size</label>
        <select
          value={`${exportOptions.width}x${exportOptions.height}`}
          onChange={(e) => {
            const [width, height] = e.target.value.split('x').map(Number);
            setExportOptions(prev => ({ ...prev, width, height }));
          }}
          className="w-full bg-black/50 border border-cyan-500/30 rounded-sm px-3 py-2 text-white text-sm"
        >
          {presetSizes.map(preset => (
            <option key={preset.name} value={`${preset.width}x${preset.height}`}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      {/* Custom Size (when Custom is selected) */}
      {exportOptions.width === 0 && exportOptions.height === 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs mb-1 text-gray-400">Width (px)</label>
            <input
              type="number"
              value={exportOptions.width || 1920}
              onChange={(e) => setExportOptions(prev => ({
                ...prev,
                width: parseInt(e.target.value) || 1920
              }))}
              className="w-full bg-black/50 border border-cyan-500/30 rounded-sm px-2 py-1 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs mb-1 text-gray-400">Height (px)</label>
            <input
              type="number"
              value={exportOptions.height || 1080}
              onChange={(e) => setExportOptions(prev => ({
                ...prev,
                height: parseInt(e.target.value) || 1080
              }))}
              className="w-full bg-black/50 border border-cyan-500/30 rounded-sm px-2 py-1 text-white text-sm"
            />
          </div>
        </div>
      )}

      {/* DPI Settings */}
      <div>
        <label className="block text-sm font-medium mb-2 text-cyan-400">Quality</label>
        <select
          value={exportOptions.dpi}
          onChange={(e) => setExportOptions(prev => ({
            ...prev,
            dpi: parseInt(e.target.value)
          }))}
          className="w-full bg-black/50 border border-cyan-500/30 rounded-sm px-3 py-2 text-white text-sm"
        >
          {presetDPIs.map(preset => (
            <option key={preset.name} value={preset.value}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      {/* Quality Slider */}
      <div>
        <label className="block text-sm font-medium mb-2 text-cyan-400">
          JPEG Quality: {Math.round((exportOptions.quality || 0.95) * 100)}%
        </label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={exportOptions.quality || 0.95}
          onChange={(e) => setExportOptions(prev => ({
            ...prev,
            quality: parseFloat(e.target.value)
          }))}
          className="w-full accent-cyan-500"
        />
      </div>

      {/* Export Buttons */}
      <div className="space-y-2">
        <button
          onClick={handleExportPNG}
          disabled={isExporting || !svgElement}
          className="w-full bg-cyan-600 hover:opacity-90 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-sm transition flex items-center justify-center gap-2"
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export PNG
            </>
          )}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportSVG}
            disabled={isExporting || !svgElement}
            className="bg-purple-600 hover:opacity-90 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-2 rounded-sm transition text-sm"
          >
            Export SVG
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isExporting || data.length === 0}
            className="bg-green-600 hover:opacity-90 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-2 rounded-sm transition text-sm"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Metadata Display */}
      <div className="text-xs text-gray-400 border-t border-gray-700 pt-3">
        <div className="mb-1 font-medium">Export Info:</div>
        <div>Map: {metadata.mapType}</div>
        <div>Parameters: {Object.keys(metadata.parameters).length}</div>
        <div>Data Points: {data.length.toLocaleString()}</div>
        <div>Output Size: {exportOptions.width}×{exportOptions.height}px</div>
        {exportMode === 'academic' && (
          <div className="text-yellow-400 mt-1">
            Note: Academic mode includes axes and labels
          </div>
        )}
      </div>
    </div>
  );
};