'use client';

import React, { forwardRef, useState, useCallback } from 'react';
import { NeonButtonProps, ThemeContextType } from '@/lib/themes/theme-types';
import { useOptionalTheme } from './theme-provider';
import { cn, getThemeGlow, defaultThemes } from '@/lib/themes/theme-utils';

const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      disabled = false,
      loading = false,
      glowIntensity,
      className,
      onClick,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const themeContext: ThemeContextType | undefined = useOptionalTheme();

    const { theme, themes } = themeContext ?? {
      theme: 'blue-tron',
      themes: defaultThemes,
    };
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);

    // Get current theme configuration
    const currentTheme = themes.find(t => t.themeId === theme) || themes[0];

    // Generate variant colors
    const getVariantColors = useCallback(() => {
      const colors = currentTheme.colors;

      switch (variant) {
        case 'primary':
          return {
            background: colors.primary,
            hoverBackground: colors.primary + 'dd',
            text: colors.background,
            glow: getThemeGlow(currentTheme, 'primary'),
          };
        case 'secondary':
          return {
            background: colors.secondary,
            hoverBackground: colors.secondary + 'dd',
            text: colors.background,
            glow: getThemeGlow(currentTheme, 'secondary'),
          };
        case 'tertiary':
          return {
            background: colors.tertiary,
            hoverBackground: colors.tertiary + 'dd',
            text: colors.background,
            glow: getThemeGlow(currentTheme, 'tertiary'),
          };
        case 'ghost':
          return {
            background: 'transparent',
            hoverBackground: colors.glow + '20',
            text: colors.text,
            glow: getThemeGlow(currentTheme, 'glow'),
          };
        default:
          return {
            background: colors.primary,
            hoverBackground: colors.primary + 'dd',
            text: colors.background,
            glow: getThemeGlow(currentTheme, 'primary'),
          };
      }
    }, [variant, currentTheme]);

    // Generate size classes
    const getSizeClasses = useCallback(() => {
      switch (size) {
        case 'sm':
          return 'px-3 py-1.5 text-sm min-h-[32px]';
        case 'md':
          return 'px-4 py-2 text-base min-h-[40px]';
        case 'lg':
          return 'px-6 py-3 text-lg min-h-[48px]';
        default:
          return 'px-4 py-2 text-base min-h-[40px]';
      }
    }, [size]);

    const variantColors = getVariantColors();
    const sizeClasses = getSizeClasses();

    // Calculate final glow intensity
    const finalGlowIntensity = glowIntensity ?? currentTheme.glow.intensity;

    // Generate dynamic styles
    const buttonStyle = {
      '--neon-glow-intensity': finalGlowIntensity.toString(),
      '--neon-glow-color': variantColors.glow,
      backgroundColor: disabled ? '#444444' : isPressed ? variantColors.hoverBackground : variantColors.background,
      color: disabled ? '#888888' : variantColors.text,
      boxShadow: disabled
        ? 'none'
        : isHovered || isPressed
          ? variantColors.glow
          : `0 0 4px ${variantColors.glow}40`,
      transform: isPressed ? 'scale(0.98)' : isHovered ? 'scale(1.02)' : 'scale(1)',
      transition: 'all 0.2s ease-out',
    } as React.CSSProperties;

    // Handle click events
    const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) {
        event.preventDefault();
        return;
      }

    // Visual feedback animation
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);

    onClick?.(event);
  }, [disabled, loading, onClick]);

    // Generate accessibility attributes.
    // aria-busy alone conveys the loading state. Setting aria-label while loading
    // would *replace* the button's accessible name, so several loading buttons
    // would announce identically and voice control could no longer target them
    // by their visible label.
    const accessibilityProps = {
      'aria-disabled': disabled,
      'aria-busy': loading,
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'neon-button',
          'relative inline-flex items-center justify-center',
          'font-medium rounded-md border-2',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black',
          'transition-all duration-200 ease-out',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          'select-none',

          // Base styling
          'border-current shadow-lg',

          // Size classes
          sizeClasses,

          // Variant-specific classes
          variant === 'primary' && 'border-cyan-400 focus:ring-cyan-400',
          variant === 'secondary' && 'border-orange-400 focus:ring-orange-400',
          variant === 'tertiary' && 'border-purple-400 focus:ring-purple-400',
          variant === 'ghost' && 'border-transparent focus:ring-gray-400',

          // Interactive states
          !disabled && !loading && 'hover:shadow-xl active:shadow-inner',

          // Neon glow effects
          !disabled && finalGlowIntensity > 0 && 'neon-glow',

          className
        )}
        style={buttonStyle}
        disabled={disabled || loading}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsPressed(false);
        }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        {...accessibilityProps}
        {...props}
      >
        {/* Background glow effect */}
        {finalGlowIntensity > 0 && !disabled && (
          <span
            className="absolute inset-0 rounded-md opacity-30 blur-md -z-10 block"
            style={{
              background: `radial-gradient(circle, ${variantColors.glow}40 0%, transparent 70%)`,
              transform: isHovered ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.3s ease-out',
            }}
          />
        )}

        {/* Animated border effect */}
        {isHovered && !disabled && (
          <span
            className="absolute inset-0 rounded-md opacity-60 block"
            style={{
              background: `linear-gradient(45deg, transparent, ${variantColors.glow}60, transparent)`,
              backgroundSize: '200% 200%',
              animation: 'neon-scan 2s linear infinite',
            }}
          />
        )}

        {/* Loading spinner */}
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
            <span
              className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full inline-block"
              style={{
                borderTopColor: variantColors.text,
              }}
            />
          </span>
        )}

        {/* Button content */}
        <span
          className={cn(
            'relative z-10 flex items-center gap-2',
            loading && 'opacity-0'
          )}
          style={{
            textShadow: finalGlowIntensity > 0 && !disabled
              ? `0 0 ${finalGlowIntensity * 8}px ${variantColors.glow}60`
              : 'none',
          }}
        >
          {children}
        </span>

        {/* Press ripple effect */}
        {isPressed && (
          <span
            className="absolute inset-0 rounded-md bg-white/20 animate-ping block"
            style={{ animationDuration: '0.3s' }}
          />
        )}
      </button>
    );
  }
);

NeonButton.displayName = 'NeonButton';

export { NeonButton };
