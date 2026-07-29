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

/**
 * Solid hex (`#rgb` / `#rrggbb`) + alpha in [0, 1] → `rgba(r, g, b, a)`.
 * Used so legacy slots that carried transparency (--bg-card, --viz-grid,
 * --viz-area, --border-*) keep the SAME alpha they had in :root when the
 * solid ThemeColors value is bridged in. No silent drop of transparency.
 */
export function hexWithAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Expand `#rgb` / `#rrggbb` to integer RGB channels in [0, 255]. */
export function parseHexRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Blend `from` toward `toward` by `fraction` in sRGB (0 = from, 1 = toward).
 * Returns `#rrggbb`. Used for surface slots so they stay visibly distinct from
 * the page background without inventing colours outside ThemeColors.
 */
export function blendHexToward(from: string, toward: string, fraction: number): string {
  const [fr, fg, fb] = parseHexRgb(from);
  const [tr, tg, tb] = parseHexRgb(toward);
  const t = Math.min(1, Math.max(0, fraction));
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Composite an `rgba(r,g,b,a)` colour over a solid hex background → opaque RGB.
 * Used by tests to compare painted surface colours after alpha compositing.
 */
export function resolveRgbaOverBackground(
  rgba: string,
  backgroundHex: string
): [number, number, number] {
  const m = rgba.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i
  );
  if (!m) {
    throw new Error(`resolveRgbaOverBackground: not rgba: ${rgba}`);
  }
  const fr = parseInt(m[1], 10);
  const fg = parseInt(m[2], 10);
  const fb = parseInt(m[3], 10);
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  const [br, bg, bb] = parseHexRgb(backgroundHex);
  return [
    Math.round(fr * a + br * (1 - a)),
    Math.round(fg * a + bg * (1 - a)),
    Math.round(fb * a + bb * (1 - a)),
  ];
}

/** Euclidean distance in RGB space (0 = identical). */
export function rgbChannelDistance(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Fraction of the path from `background` toward `border` used for surface
 * slots (--bg-secondary, --bg-card, --bg-header, --bg-footer). Chosen so every
 * default theme paints a measurable edge against --bg-primary while staying
 * inside ThemeColors (no freestanding literals). 0.18 is enough that even
 * Black & White (border #333 over #000) stays visibly lifted after alpha
 * compositing. Independent pin tests lock the 0.18 product; a zero blend
 * would fail those pins.
 */
export const LEGACY_SURFACE_BLEND = 0.18;

/**
 * Fraction of the path from `textSecondary` toward `background` used for
 * `--text-muted`. Tertiary is often a saturated accent (Blue Tron `#0040ff`),
 * not a muted label colour — so muted is derived, not mapped from tertiary.
 */
export const LEGACY_MUTED_BLEND = 0.4;

/** Default glow used when the map is keyed without a theme.glow argument. */
const DEFAULT_GLOW = { intensity: 0.8, blurRadius: '8px', spreadRadius: '2px' };

/**
 * CSS box/text-shadow token for a glow slot. Intensity 0 → `none` (no halo).
 * Reuses hexWithAlpha; no parallel colour path.
 */
function themeGlowShadow(color: string, intensity: number, blurRadius: string): string {
  if (intensity <= 0) return 'none';
  return `0 0 ${blurRadius} ${hexWithAlpha(color, intensity)}`;
}

/** Hover twin: double blur, full opacity when intensity > 0; else `none`. */
function themeGlowShadowHover(color: string, intensity: number, blurRadius: string): string {
  if (intensity <= 0) return 'none';
  const n = parseFloat(blurRadius);
  const hoverBlur = Number.isFinite(n) ? `${n * 2}px` : blurRadius;
  return `0 0 ${hoverBlur} ${hexWithAlpha(color, 1)}`;
}

/**
 * Single source of truth for the legacy :root bridge (globals.css).
 * Every key is both applied by `applyThemeCSSProperties` and cleared by
 * `removeThemeCSSProperties` — one map, not two hand-maintained lists.
 *
 * Surface slots (card/header/footer/secondary) are NOT plain `background` +
 * alpha: that made them identical to the page under every theme. Instead they
 * blend `background` toward `border` by LEGACY_SURFACE_BLEND (0.18), then keep
 * the legacy alphas (card 0.7, header/footer 0.8; secondary is solid).
 *
 * Mapping (ThemeColors → CSS var):
 *   background                          → --bg-primary
 *   blend(bg→border, 0.18)              → --bg-secondary
 *   blend(bg→border, 0.18) + α 0.7      → --bg-card
 *   blend(bg→border, 0.18) + α 0.8      → --bg-header, --bg-footer
 *   text                                → --text-primary, --viz-accent
 *   textSecondary                       → --text-secondary
 *   blend(textSecondary→bg, 0.4)        → --text-muted
 *   primary                             → --text-accent, --viz-secondary, --viz-point,
 *                                         --border-secondary (α0.3), --viz-area (α0.3),
 *                                         --accent-cyan, --tron-glow-cyan
 *   secondary                           → --border-focus, --viz-primary, --viz-line,
 *                                         --viz-grid (α0.2), --accent-magenta,
 *                                         --tron-glow-magenta
 *   tertiary                            → --viz-tertiary, --accent-orange, --tron-glow-orange
 *   glow color + glow.{intensity,blur}  → --tron-glow-yellow (+ -hover twins for all four)
 *   border + α 0.3                      → --border-primary
 *   warning                             → --accent-red
 *   intensity 0 (or reducedGlow)        → all eight --tron-glow-* = none
 */
export function getLegacyThemeCSSProperties(
  colors: ThemeColors,
  glow: { intensity: number; blurRadius: string; spreadRadius: string } = DEFAULT_GLOW
): Record<string, string> {
  // Surface tint: background → border by LEGACY_SURFACE_BLEND, then legacy alphas.
  const surface = blendHexToward(
    colors.background,
    colors.border,
    LEGACY_SURFACE_BLEND
  );
  // Muted text: textSecondary → background (never tertiary — often a saturated accent).
  const muted = blendHexToward(
    colors.textSecondary,
    colors.background,
    LEGACY_MUTED_BLEND
  );

  const { intensity, blurRadius } = glow;
  // Slot colours follow the same accent bridge as --accent-*; yellow uses
  // colors.glow (the dedicated glow colour on ThemeColors).
  const glowCyan = themeGlowShadow(colors.primary, intensity, blurRadius);
  const glowOrange = themeGlowShadow(colors.tertiary, intensity, blurRadius);
  const glowMagenta = themeGlowShadow(colors.secondary, intensity, blurRadius);
  const glowYellow = themeGlowShadow(colors.glow, intensity, blurRadius);

  return {
    '--bg-primary': colors.background,
    '--bg-secondary': surface,
    '--bg-card': hexWithAlpha(surface, 0.7),
    '--bg-header': hexWithAlpha(surface, 0.8),
    '--bg-footer': hexWithAlpha(surface, 0.8),

    '--text-primary': colors.text,
    '--text-secondary': colors.textSecondary,
    '--text-accent': colors.primary,
    '--text-muted': muted,

    '--border-primary': hexWithAlpha(colors.border, 0.3),
    '--border-secondary': hexWithAlpha(colors.primary, 0.3),
    '--border-focus': colors.secondary,

    '--viz-primary': colors.secondary,
    '--viz-secondary': colors.primary,
    '--viz-tertiary': colors.tertiary,
    '--viz-accent': colors.text,
    '--viz-grid': hexWithAlpha(colors.secondary, 0.2),
    '--viz-point': colors.primary,
    '--viz-line': colors.secondary,
    '--viz-area': hexWithAlpha(colors.primary, 0.3),

    '--accent-cyan': colors.primary,
    '--accent-orange': colors.tertiary,
    '--accent-magenta': colors.secondary,
    '--accent-red': colors.warning,

    '--tron-glow-cyan': glowCyan,
    '--tron-glow-orange': glowOrange,
    '--tron-glow-magenta': glowMagenta,
    '--tron-glow-yellow': glowYellow,
    '--tron-glow-cyan-hover': themeGlowShadowHover(colors.primary, intensity, blurRadius),
    '--tron-glow-orange-hover': themeGlowShadowHover(colors.tertiary, intensity, blurRadius),
    '--tron-glow-magenta-hover': themeGlowShadowHover(colors.secondary, intensity, blurRadius),
    '--tron-glow-yellow-hover': themeGlowShadowHover(colors.glow, intensity, blurRadius),
  };
}

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

  // Apply glow dimension variables (intensity also drives the shadow map below)
  const effectiveIntensity = theme.accessibility.reducedGlow ? 0 : theme.glow.intensity;
  const effectiveGlow = {
    intensity: effectiveIntensity,
    blurRadius: theme.glow.blurRadius,
    spreadRadius: theme.glow.spreadRadius,
  };
  safeSetProperty('--tron-glow-intensity', effectiveIntensity.toString());
  safeSetProperty('--tron-glow-blur-radius', theme.glow.blurRadius);
  safeSetProperty('--tron-glow-spread-radius', theme.glow.spreadRadius);

  // Apply animation variables
  safeSetProperty('--tron-animation-duration', theme.animation.duration);
  safeSetProperty('--tron-animation-easing', theme.animation.easing);
  safeSetProperty('--tron-reduced-motion', theme.animation.reducedMotion ? 'reduce' : 'no-preference');

  // Accessibility: reducedGlow is folded into effectiveIntensity above (glow
  // slots become `none`). highContrast is carried by the theme palette itself
  // — no unused string flag on :root.

  // Bridge every legacy :root var from the shared map (one loop — keys come
  // from the map; do not hand-maintain a second list for apply). Includes the
  // eight --tron-glow-* shadow tokens derived from theme colours + glow.
  Object.entries(getLegacyThemeCSSProperties(theme.colors, effectiveGlow)).forEach(([k, v]) =>
    safeSetProperty(k, v)
  );
}

export function removeThemeCSSProperties(element: HTMLElement = document.documentElement): void {
  if (!element) return;

  try {
    element.removeAttribute('data-theme');

    // Remove --tron-* properties written as dynamic keys
    const computedStyle = window.getComputedStyle(element);
    Array.from(computedStyle).forEach(property => {
      if (property.startsWith('--tron-')) {
        element.style.removeProperty(property);
      }
    });

    // Remove the legacy bridge from the same map apply uses (keys only;
    // values are irrelevant for teardown). Includes --tron-glow-*.
    const legacyKeys = Object.keys(
      getLegacyThemeCSSProperties(defaultThemes[0].colors, defaultThemes[0].glow)
    );
    legacyKeys.forEach((property) => {
      element.style.removeProperty(property);
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

