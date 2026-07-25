// Theme system components barrel export

// Core components
export { ThemeProvider, useTheme } from './theme-provider';
export type { ThemeProviderProps } from '@/lib/themes/theme-types';

export { ThemeSwitcher } from './theme-switcher';
export type { ThemeSwitcherProps } from '@/lib/themes/theme-types';

export { NeonButton } from './neon-button';
export type { NeonButtonProps } from '@/lib/themes/theme-types';

// Re-export theme types and utilities
export * from '@/lib/themes/theme-types';
export * from '@/lib/themes/theme-utils';