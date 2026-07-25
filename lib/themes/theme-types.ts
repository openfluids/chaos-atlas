// Theme system types for Tron-themed dark mode

export interface ThemeColors {
  background: string;
  primary: string;
  secondary: string;
  tertiary: string;
  warning: string;
  text: string;
  textSecondary: string;
  border: string;
  glow: string;
}

interface GlowSettings {
  intensity: number;
  blurRadius: string;
  spreadRadius: string;
}

interface AnimationSettings {
  duration: string;
  easing: string;
  reducedMotion: boolean;
}

interface AccessibilitySettings {
  highContrast: boolean;
  reducedGlow: boolean;
}

export interface ThemeConfiguration {
  themeId: string;
  name: string;
  colors: ThemeColors;
  glow: GlowSettings;
  animation: AnimationSettings;
  accessibility: AccessibilitySettings;
}

export interface ThemeContextType {
  theme: string;
  setTheme: (theme: string) => void;
  systemTheme?: string;
  themes: ThemeConfiguration[];
  resolvedTheme: string;
  isTransitioning: boolean;
}

export type ThemeProviderProps = {
  children: React.ReactNode;
  themes?: ThemeConfiguration[];
  defaultTheme?: string;
  storageKey?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  currentTheme?: string;
  onThemeChange?: (theme: string) => void;
  isLoading?: boolean;
};

export type ThemeSwitcherProps = {
  themes?: ThemeConfiguration[];
  currentTheme?: string;
  onThemeChange?: (theme: string) => void;
  showCustomization?: boolean;
  compact?: boolean;
  position?: 'header' | 'sidebar' | 'floating';
  isLoading?: boolean;
  className?: string;
};

export type NeonButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  glowIntensity?: number;
  className?: string;
  onClick?: (event: React.MouseEvent) => void;
};