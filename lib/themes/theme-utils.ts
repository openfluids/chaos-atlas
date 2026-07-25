import clsx, { type ClassValue } from 'clsx';
import * as tailwindMerge from 'tailwind-merge';
import { ThemeConfiguration, ThemeColors } from './theme-types';

const importedTwMerge = (tailwindMerge as { twMerge?: (...classNames: string[]) => string }).twMerge;

// Utility function for combining CSS classes
export function cn(...inputs: ClassValue[]) {
  const merged = clsx(inputs);
  if (typeof importedTwMerge === 'function') {
    return importedTwMerge(merged);
  }
  return merged;
}

// Default themes - Simple 3 theme system
export const defaultThemes: ThemeConfiguration[] = [
  {
    themeId: 'black-white',
    name: 'Black & White',
    colors: {
      background: '#000000',
      primary: '#ffffff',
      secondary: '#cccccc',
      tertiary: '#999999',
      warning: '#ff4444',
      text: '#ffffff',
      textSecondary: '#dddddd',
      border: '#333333',
      glow: '#ffffff',
    },
    glow: { intensity: 0, blurRadius: '0px', spreadRadius: '0px' },
    animation: { duration: '0.2s', easing: 'ease-out', reducedMotion: false },
    accessibility: { highContrast: true, reducedGlow: true },
  },
  {
    themeId: 'neon-vintage',
    name: 'Neon Vintage',
    colors: {
      background: '#0a0a0a',
      primary: '#ff00ff',
      secondary: '#00ff00',
      tertiary: '#ffff00',
      warning: '#ff0000',
      text: '#ffffff',
      textSecondary: '#cccccc',
      border: '#333333',
      glow: '#ff00ff',
    },
    glow: { intensity: 0.9, blurRadius: '12px', spreadRadius: '3px' },
    animation: { duration: '0.4s', easing: 'ease-in-out', reducedMotion: false },
    accessibility: { highContrast: false, reducedGlow: false },
  },
  {
    themeId: 'blue-tron',
    name: 'Blue Tron',
    colors: {
      background: '#000000',
      primary: '#00ffff',
      secondary: '#0080ff',
      tertiary: '#0040ff',
      warning: '#ffaa00',
      text: '#ffffff',
      textSecondary: '#cccccc',
      border: '#0066cc',
      glow: '#00ffff',
    },
    glow: { intensity: 0.8, blurRadius: '8px', spreadRadius: '2px' },
    animation: { duration: '0.3s', easing: 'ease-out', reducedMotion: false },
    accessibility: { highContrast: false, reducedGlow: false },
  },
];

// Color validation utilities
function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

function isValidThemeColors(colors: Partial<ThemeColors>): colors is ThemeColors {
  const requiredColors: (keyof ThemeColors)[] = [
    'background', 'primary', 'secondary', 'tertiary', 'warning',
    'text', 'textSecondary', 'border', 'glow'
  ];

  return requiredColors.every(colorKey => {
    const color = colors[colorKey];
    return color && isValidHexColor(color);
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeTheme(theme: Partial<ThemeConfiguration> | null | undefined): ThemeConfiguration | null {
  try {
    if (!isObject(theme)) {
      console.warn('Invalid theme object provided');
      return null;
    }

    const typedTheme = theme as Partial<ThemeConfiguration> & Record<string, unknown>;

    // Validate required fields
    if (typeof typedTheme.themeId !== 'string' || typedTheme.themeId.trim().length === 0 ||
        typeof typedTheme.name !== 'string' || typedTheme.name.trim().length === 0) {
      console.warn('Theme missing required fields: themeId or name');
      return null;
    }

    // Validate colors
    if (!isObject(typedTheme.colors) || !isValidThemeColors(typedTheme.colors as Partial<ThemeColors>)) {
      console.warn(`Theme "${typedTheme.name}" has invalid colors`);
      return null;
    }

    // Merge with defaults
    const sanitizedTheme: ThemeConfiguration = {
      themeId: typedTheme.themeId,
      name: typedTheme.name,
      colors: typedTheme.colors as ThemeColors,
      glow: {
        intensity: 0.8,
        blurRadius: '8px',
        spreadRadius: '2px',
        ...(typedTheme.glow || {}),
      },
      animation: {
        duration: '0.3s',
        easing: 'ease-out',
        reducedMotion: false,
        ...(typedTheme.animation || {}),
      },
      accessibility: {
        highContrast: false,
        reducedGlow: false,
        ...(typedTheme.accessibility || {}),
      },
    };

    return sanitizedTheme;
  } catch (error) {
    const themeName = isObject(theme) && typeof (theme as Record<string, unknown>).name === 'string'
      ? (theme as Record<string, unknown>).name
      : 'unknown';
    console.error(`Error sanitizing theme "${themeName}":`, error);
    return null;
  }
}

export function sanitizeThemes(themes: Partial<ThemeConfiguration>[]): ThemeConfiguration[] {
  if (!Array.isArray(themes)) {
    console.warn('Themes must be an array');
    return defaultThemes;
  }

  const sanitized = themes
    .map(sanitizeTheme)
    .filter((theme): theme is ThemeConfiguration => theme !== null);

  if (sanitized.length === 0) {
    console.warn('No valid themes provided, falling back to defaults');
    return defaultThemes;
  }

  return sanitized;
}

// Theme color utilities
function getThemeColor(theme: ThemeConfiguration, colorKey: keyof ThemeColors): string {
  return theme.colors[colorKey] || defaultThemes[0].colors[colorKey];
}

function createGlowEffect(color: string, intensity: number, blurRadius: string, spreadRadius: string): string {
  return `0 0 ${blurRadius} ${spreadRadius} ${color}${Math.round(intensity * 255).toString(16).padStart(2, '0')}`;
}

export function getThemeGlow(theme: ThemeConfiguration, colorKey: keyof ThemeColors = 'primary'): string {
  const color = getThemeColor(theme, colorKey);
  return createGlowEffect(
    color,
    theme.glow.intensity,
    theme.glow.blurRadius,
    theme.glow.spreadRadius
  );
}

// System theme detection
export function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function watchSystemTheme(callback: (theme: 'dark' | 'light') => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };

  mediaQuery.addEventListener('change', handleChange);

  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
}

// Accessibility utilities
export function getReducedMotionPreference(): boolean {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getHighContrastPreference(): boolean {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(prefers-contrast: high)').matches;
}

// CSS custom property utilities
export function applyThemeCSSProperties(theme: ThemeConfiguration, element: HTMLElement = document.documentElement): void {
  if (!element || !theme) return;

  const safeSetAttribute = (...args: Parameters<HTMLElement['setAttribute']>) => {
    try {
      element.setAttribute(...args);
    } catch (error) {
      console.error('Error applying theme data attribute:', error);
    }
  };

  const safeSetProperty = (...args: Parameters<CSSStyleDeclaration['setProperty']>) => {
    try {
      element.style.setProperty(...args);
    } catch (error) {
      console.error('Error setting theme CSS property:', error);
    }
  };

  // Apply root data attribute
  safeSetAttribute('data-theme', theme.themeId);

  // Apply color variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    safeSetProperty(`--tron-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
  });

  // Apply glow variables
  safeSetProperty('--tron-glow-intensity', theme.glow.intensity.toString());
  safeSetProperty('--tron-glow-blur-radius', theme.glow.blurRadius);
  safeSetProperty('--tron-glow-spread-radius', theme.glow.spreadRadius);

  // Apply animation variables
  safeSetProperty('--tron-animation-duration', theme.animation.duration);
  safeSetProperty('--tron-animation-easing', theme.animation.easing);
  safeSetProperty('--tron-reduced-motion', theme.animation.reducedMotion ? 'reduce' : 'no-preference');

  // Apply accessibility variables
  safeSetProperty('--tron-high-contrast', theme.accessibility.highContrast ? 'high' : 'normal');
  safeSetProperty('--tron-reduced-glow', theme.accessibility.reducedGlow ? 'true' : 'false');

  // Bridge --bg-* variables used by globals.css and page components
  safeSetProperty('--bg-primary', theme.colors.background);
  // Derive a subtle secondary background by tinting background toward the border color
  safeSetProperty('--bg-secondary', theme.colors.background);
  safeSetProperty('--text-primary', theme.colors.text);
  safeSetProperty('--text-secondary', theme.colors.textSecondary);
  safeSetProperty('--border-primary', `${theme.colors.border}4d`);

  // Bridge --accent-* variables used by D3 visualizations
  safeSetProperty('--accent-cyan', theme.colors.primary);
  safeSetProperty('--accent-orange', theme.colors.tertiary || '#ff7f00');
  safeSetProperty('--accent-magenta', theme.colors.secondary || '#ff00ff');
  safeSetProperty('--accent-red', theme.colors.warning || '#ff4444');
}

export function removeThemeCSSProperties(element: HTMLElement = document.documentElement): void {
  if (!element) return;

  try {
    element.removeAttribute('data-theme');

    // Remove only our custom properties
    const computedStyle = window.getComputedStyle(element);
    Array.from(computedStyle).forEach(property => {
      if (property.startsWith('--tron-')) {
        element.style.removeProperty(property);
      }
    });
  } catch (error) {
    console.error('Error removing theme CSS properties:', error);
  }
}

// Performance utilities
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Error boundary utilities
export function createSafeThemeWrapper<T extends (...args: any[]) => any>(
  fn: T,
  fallback: ReturnType<T>
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    try {
      const result = fn(...args);
      return result ?? fallback;
    } catch (error) {
      console.error('Theme utility error:', error);
      return fallback;
    }
  };
}

// LocalStorage utilities with error handling
export function safeStorageGet(key: string, fallback: string = ''): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return fallback;
    }

    const value = window.localStorage.getItem(key);
    return value ?? fallback;
  } catch (error) {
    console.warn('Error reading from localStorage:', error);
    return fallback;
  }
}

export function safeStorageSet(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('Error writing to localStorage:', error);
    return false;
  }
}

