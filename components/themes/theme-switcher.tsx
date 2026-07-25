'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ThemeSwitcherProps } from '@/lib/themes/theme-types';
import { useTheme } from './theme-provider';
import { cn } from '@/lib/themes/theme-utils';

export function ThemeSwitcher({
  themes: providedThemes,
  currentTheme: controlledTheme,
  onThemeChange,
  showCustomization = false,
  compact = false,
  position = 'header',
  isLoading = false,
  className,
}: ThemeSwitcherProps) {
  const { theme: contextTheme, setTheme, themes: contextThemes } = useTheme();

  // Defer theme-dependent rendering until after hydration to avoid SSR mismatch.
  // Server has no localStorage so contextTheme defaults to 'blue-tron', while
  // the client may load a different saved theme — the mounted flag ensures the
  // first render matches the server output exactly.
  const [mounted, setMounted] = useState(false);
  // This is the one setState-in-effect that cannot be derived during render:
  // "has hydration finished" is knowable only after the effect runs, and the
  // whole point is that the first client render must match the server output.
  // It runs once with an empty dependency array, so there is no cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const [glowIntensity, setGlowIntensity] = useState(0.8);
  const [animationSpeed, setAnimationSpeed] = useState(1);

  // Determine current theme
  const currentTheme = controlledTheme || contextTheme;
  const themes = providedThemes || contextThemes;

  // Custom theme change handler
  const handleThemeChange = useCallback((newTheme: string) => {
    if (onThemeChange) {
      onThemeChange(newTheme);
    } else {
      setTheme(newTheme);
    }
  }, [onThemeChange, setTheme]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, themeId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleThemeChange(themeId);
    }
  }, [handleThemeChange]);

  // Handle arrow key navigation
  const handleThemeNavigation = useCallback((event: React.KeyboardEvent) => {
    const currentIndex = themes.findIndex(t => t.themeId === currentTheme);

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % themes.length;
      handleThemeChange(themes[nextIndex].themeId);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + themes.length) % themes.length;
      handleThemeChange(themes[prevIndex].themeId);
    }
  }, [themes, currentTheme, handleThemeChange]);

  // Generate position classes
  const positionClasses = useMemo(() => {
    switch (position) {
      case 'header':
        return 'flex-row gap-2 p-2';
      case 'sidebar':
        return 'flex-col gap-2 p-4';
      case 'floating':
        return 'flex-col gap-2 p-4 rounded-lg border border-cyan-500/20 bg-black/80 backdrop-blur-xs';
      default:
        return 'flex-row gap-2 p-2';
    }
  }, [position]);

  // Generate theme preview styles
  const getThemePreview = useCallback((themeConfig: any) => {
    return {
      backgroundColor: themeConfig.colors.background,
      borderColor: themeConfig.colors.glow,
      boxShadow: `0 0 8px ${themeConfig.colors.glow}40`,
    };
  }, []);

  if (themes.length === 0) {
    return (
      <div className={cn(
        'text-center p-4 text-muted-foreground',
        className
      )}>
        No themes available
      </div>
    );
  }

  return (
    <div
      className={cn(
        'theme-switcher',
        positionClasses,
        isLoading && 'opacity-50 pointer-events-none',
        className
      )}
      role="radiogroup"
      aria-label="Theme selection"
      onKeyDown={handleThemeNavigation}
    >
      {themes.map((themeConfig) => {
        const isActive = mounted && themeConfig.themeId === currentTheme;

        return (
          <button
            key={themeConfig.themeId}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`Switch to ${themeConfig.name} theme`}
            className={cn(
              'theme-button relative rounded-md border-2 transition-all duration-300',
              'focus:outline-hidden focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black',
              'hover:scale-105 active:scale-95',
              isActive
                ? 'border-cyan-400 neon-glow-cyan'
                : 'border-gray-600 hover:border-gray-500',
              compact
                ? 'w-8 h-8 p-0'
                : 'px-3 py-2 min-w-[80px] text-sm font-medium'
            )}
            style={compact ? getThemePreview(themeConfig) : undefined}
            onClick={() => handleThemeChange(themeConfig.themeId)}
            onKeyDown={(e) => handleKeyDown(e, themeConfig.themeId)}
            disabled={isLoading}
          >
            {compact ? (
              <span className="w-full h-full rounded-xs block" style={{
                backgroundColor: themeConfig.colors.primary,
                boxShadow: isActive ? `0 0 12px ${themeConfig.colors.glow}` : 'none',
              }} />
            ) : (
              <span
                className={cn(
                  'relative z-10',
                  isActive ? 'text-cyan-400 neon-text-cyan' : 'text-gray-300'
                )}
                style={{
                  textShadow: isActive ? `0 0 8px ${themeConfig.colors.glow}` : 'none',
                }}
              >
                {themeConfig.name}
              </span>
            )}

            {isActive && (
              <span className="absolute inset-0 rounded-md pointer-events-none block">
                <span className="absolute inset-0 rounded-md bg-linear-to-r from-cyan-400/20 to-purple-400/20 animate-pulse block" />
              </span>
            )}
          </button>
        );
      })}

      {showCustomization && (
        <div className="theme-customization space-y-4 border-t border-gray-700 pt-4">
          <div className="customization-control">
            <label
              htmlFor="glow-intensity"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Glow Intensity
            </label>
            <input
              id="glow-intensity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={glowIntensity}
              onChange={(e) => setGlowIntensity(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              aria-label="Adjust glow intensity"
            />
            <span className="text-xs text-gray-400">{Math.round(glowIntensity * 100)}%</span>
          </div>

          <div className="customization-control">
            <label
              htmlFor="animation-speed"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Animation Speed
            </label>
            <input
              id="animation-speed"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
              aria-label="Adjust animation speed"
            />
            <span className="text-xs text-gray-400">{animationSpeed}x</span>
          </div>

          <div className="preset-buttons grid grid-cols-2 gap-2">
            <button
              type="button"
              className="px-2 py-1 text-xs bg-cyan-500/20 border border-cyan-500/50 rounded-sm hover:bg-cyan-500/30 transition-colors"
              onClick={() => {
                setGlowIntensity(0.8);
                setAnimationSpeed(1);
              }}
            >
              Default
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs bg-purple-500/20 border border-purple-500/50 rounded-sm hover:bg-purple-500/30 transition-colors"
              onClick={() => {
                setGlowIntensity(1);
                setAnimationSpeed(1.5);
              }}
            >
              High Energy
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs bg-orange-500/20 border border-orange-500/50 rounded-sm hover:bg-orange-500/30 transition-colors"
              onClick={() => {
                setGlowIntensity(0.4);
                setAnimationSpeed(0.5);
              }}
            >
              Subtle
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs bg-green-500/20 border border-green-500/50 rounded-sm hover:bg-green-500/30 transition-colors"
              onClick={() => {
                setGlowIntensity(0);
                setAnimationSpeed(0);
              }}
            >
              Minimal
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
          <span className="animate-spin h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full inline-block" />
        </span>
      )}
    </div>
  );
}
