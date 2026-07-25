'use client';

import React, { useState } from 'react';
import { DataTheme, getDataTheme, getDataThemesByCategory } from '@/lib/themes/data-themes';

interface DataThemeSwitcherProps {
  currentThemeId: string;
  onThemeChange: (theme: DataTheme) => void;
  className?: string;
  showPreview?: boolean;
}

export const DataThemeSwitcher: React.FC<DataThemeSwitcherProps> = ({
  currentThemeId,
  onThemeChange,
  className = '',
  showPreview = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentTheme = getDataTheme(currentThemeId);

  const categories = [
    { id: 'simple', name: 'Simple', icon: '○' },
    { id: 'scientific', name: 'Scientific', icon: '▢' },
    { id: 'artistic', name: 'Artistic', icon: '◈' },
    { id: 'crazy', name: 'Crazy', icon: '✦' },
  ];

  const handleThemeSelect = (theme: DataTheme) => {
    onThemeChange(theme);
    setIsOpen(false);
  };

  const renderThemePreview = (theme: DataTheme, size = 'small') => {
    const isSmall = size === 'small';
    const barHeight = isSmall ? 3 : 6;
    const barWidth = isSmall ? 20 : 40;
    const spacing = isSmall ? 1 : 2;

    return (
      <div className={`flex ${isSmall ? 'flex-col' : 'flex-col'} gap-${spacing}`}>
        {theme.colors.data.slice(0, isSmall ? 3 : 5).map((color, index) => (
          <div
            key={index}
            className="rounded-xs"
            style={{
              backgroundColor: color,
              width: `${barWidth}px`,
              height: `${barHeight}px`,
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Current Theme Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-black/70 border border-cyan-500/30 rounded-lg px-4 py-2 hover:bg-black/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 text-sm">Data Theme:</span>
          <span className="text-white font-medium">{currentTheme.name}</span>
        </div>

        {showPreview && (
          <div className="flex items-center gap-2">
            {renderThemePreview(currentTheme)}
          </div>
        )}

        <svg
          className={`w-4 h-4 text-cyan-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Theme Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-black/90 border border-cyan-500/30 rounded-lg shadow-xl z-20 max-h-96 overflow-y-auto">
            <div className="p-4 border-b border-cyan-500/20">
              <h3 className="text-lg font-bold text-cyan-400">Choose Data Theme</h3>
              <p className="text-sm text-gray-400 mt-1">
                Colors will be applied to plots, data points, and visualizations
              </p>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {categories.map(category => {
                const categoryThemes = getDataThemesByCategory(category.id as DataTheme['category']);

                return (
                  <div key={category.id} className="border-b border-cyan-500/10 last:border-b-0">
                    <div className="px-4 py-2 bg-cyan-500/5">
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400">{category.icon}</span>
                        <span className="text-sm font-medium text-cyan-300">{category.name}</span>
                        <span className="text-xs text-gray-500">({categoryThemes.length} themes)</span>
                      </div>
                    </div>

                    <div className="p-2 space-y-1">
                      {categoryThemes.map(theme => (
                        <button
                          key={theme.id}
                          onClick={() => handleThemeSelect(theme)}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            currentTheme.id === theme.id
                              ? 'bg-cyan-500/20 border border-cyan-500/40'
                              : 'hover:bg-cyan-500/10 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {renderThemePreview(theme)}
                              <div>
                                <div className="font-medium text-white">{theme.name}</div>
                                <div className="text-xs text-gray-400">{theme.description}</div>
                              </div>
                            </div>

                            {currentTheme.id === theme.id && (
                              <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-cyan-500/20">
              <button
                onClick={() => {
                  // Random theme selection
                  const allThemes = [
                ...getDataThemesByCategory('simple'),
                ...getDataThemesByCategory('scientific'),
                ...getDataThemesByCategory('artistic'),
                ...getDataThemesByCategory('crazy'),
              ];
                  const randomTheme = allThemes[Math.floor(Math.random() * allThemes.length)];
                  handleThemeSelect(randomTheme);
                }}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Random Theme
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Compact version for smaller spaces
export const CompactDataThemeSwitcher: React.FC<DataThemeSwitcherProps> = ({
  currentThemeId,
  onThemeChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentTheme = getDataTheme(currentThemeId);

  const handleThemeSelect = (theme: DataTheme) => {
    onThemeChange(theme);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-black/70 border border-cyan-500/30 rounded-sm px-3 py-1.5 hover:bg-black/80 transition-colors"
      >
        <div className="flex gap-0.5">
          {currentTheme.colors.data.slice(0, 4).map((color, index) => (
            <div
              key={index}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span className="text-xs text-cyan-400">{currentTheme.name}</span>
        <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-1 w-64 bg-black/90 border border-cyan-500/30 rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto">
            <div className="p-3">
              <h4 className="text-sm font-bold text-cyan-400 mb-2">Data Theme</h4>
              <div className="space-y-1">
                {[
                  ...getDataThemesByCategory('simple').slice(0, 2),
                  ...getDataThemesByCategory('scientific').slice(0, 2),
                  ...getDataThemesByCategory('artistic').slice(0, 2),
                  ...getDataThemesByCategory('crazy').slice(0, 2),
                ].map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => handleThemeSelect(theme)}
                    className={`w-full text-left p-2 rounded text-sm transition-colors ${
                      currentTheme.id === theme.id
                        ? 'bg-cyan-500/20 border border-cyan-500/40'
                        : 'hover:bg-cyan-500/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {theme.colors.data.slice(0, 3).map((color, index) => (
                          <div
                            key={index}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <span className="text-white">{theme.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};