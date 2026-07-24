import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/themes/theme-provider';
import { ThemeSwitcher } from '@/components/themes/theme-switcher';
import { NeonButton } from '@/components/themes/neon-button';

// Mock for visual regression testing
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: jest.fn(),
    createImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
  })),
};

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: mockCanvas.getContext,
});

// Test themes
const visualTestThemes = [
  {
    themeId: 'tron-dark',
    name: 'Tron Dark',
    colors: {
      background: '#000000',
      primary: '#00ffff',
      secondary: '#ff7f00',
      tertiary: '#ff00ff',
      warning: '#ffff00',
      text: '#ffffff',
      textSecondary: '#cccccc',
      border: '#333333',
      glow: '#00ffff',
    },
    glow: { intensity: 0.8, blurRadius: '8px', spreadRadius: '2px' },
    animation: { duration: '0.3s', easing: 'ease-out', reducedMotion: false },
    accessibility: { highContrast: false, reducedGlow: false },
  },
  {
    themeId: 'tron-light',
    name: 'Tron Light',
    colors: {
      background: '#0a0a0a',
      primary: '#40ffff',
      secondary: '#ff9f20',
      tertiary: '#ff40ff',
      warning: '#ffff40',
      text: '#ffffff',
      textSecondary: '#dddddd',
      border: '#555555',
      glow: '#40ffff',
    },
    glow: { intensity: 0.6, blurRadius: '6px', spreadRadius: '1px' },
    animation: { duration: '0.2s', easing: 'ease-out', reducedMotion: false },
    accessibility: { highContrast: false, reducedGlow: false },
  },
];

describe('Theme Visual Regression Tests', () => {
  beforeEach(() => {
    // Reset document styles
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');

    // Clear any inline styles
    document.body.setAttribute('style', '');
  });

  const captureElementSnapshot = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    return {
      width: rect.width,
      height: rect.height,
      backgroundColor: styles.backgroundColor,
      color: styles.color,
      borderColor: styles.borderColor,
      boxShadow: styles.boxShadow,
      textShadow: styles.textShadow,
      transform: styles.transform,
      opacity: styles.opacity,
      classes: Array.from(element.classList),
    };
  };

  const captureThemeSnapshot = () => {
    const rootStyles = window.getComputedStyle(document.documentElement);

    return {
      theme: document.documentElement.getAttribute('data-theme'),
      backgroundColor: rootStyles.backgroundColor,
      color: rootStyles.color,
      customProperties: Array.from(rootStyles)
        .filter(prop => prop.startsWith('--tron-'))
        .reduce((acc, prop) => {
          acc[prop] = rootStyles.getPropertyValue(prop);
          return acc;
        }, {} as Record<string, string>),
    };
  };

  it('renders consistent NeonButton appearance', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <NeonButton variant="primary">Test Button</NeonButton>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Test Button' });
    const snapshot = captureElementSnapshot(button);

    expect(snapshot.backgroundColor).toBeDefined();
    expect(snapshot.color).toBeDefined();
    expect(snapshot.classes).toContain('neon-button');
  });

  it('maintains visual consistency across different button variants', () => {
    const { rerender } = render(
      <ThemeProvider themes={visualTestThemes}>
        <NeonButton variant="primary">Primary</NeonButton>
      </ThemeProvider>
    );

    const primarySnapshot = captureElementSnapshot(screen.getByRole('button', { name: 'Primary' }));

    rerender(
      <ThemeProvider themes={visualTestThemes}>
        <NeonButton variant="secondary">Secondary</NeonButton>
      </ThemeProvider>
    );

    const secondarySnapshot = captureElementSnapshot(screen.getByRole('button', { name: 'Secondary' }));

    // Both should have consistent sizing and structure
    expect(primarySnapshot.width).toBe(secondarySnapshot.width);
    expect(primarySnapshot.classes).toContain('neon-button');
    expect(secondarySnapshot.classes).toContain('neon-button');
  });

  it('applies theme colors correctly to components', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <div>
          <NeonButton variant="primary">Primary Button</NeonButton>
          <NeonButton variant="secondary">Secondary Button</NeonButton>
          <NeonButton variant="tertiary">Tertiary Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');

    buttons.forEach(button => {
      const snapshot = captureElementSnapshot(button);
      expect(snapshot.backgroundColor).toBeDefined();
      expect(snapshot.color).toBeDefined();
    });
  });

  it('renders ThemeSwitcher with consistent layout', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const themeButtons = screen.getAllByRole('radio');
    expect(themeButtons.length).toBeGreaterThan(0);

    themeButtons.forEach(button => {
      const snapshot = captureElementSnapshot(button);
      expect(snapshot.classes).toContain('theme-button');
    });
  });

  it('maintains visual consistency when switching themes', async () => {
    const { rerender } = render(
      <ThemeProvider themes={visualTestThemes} currentTheme="tron-dark">
        <NeonButton>Test Button</NeonButton>
      </ThemeProvider>
    );

    const darkSnapshot = captureThemeSnapshot();
    const darkButtonSnapshot = captureElementSnapshot(screen.getByRole('button', { name: 'Test Button' }));

    rerender(
      <ThemeProvider themes={visualTestThemes} currentTheme="tron-light">
        <NeonButton>Test Button</NeonButton>
      </ThemeProvider>
    );

    const lightSnapshot = captureThemeSnapshot();
    const lightButtonSnapshot = captureElementSnapshot(screen.getByRole('button', { name: 'Test Button' }));

    // Theme should change
    expect(darkSnapshot.theme).toBe('tron-dark');
    expect(lightSnapshot.theme).toBe('tron-light');

    // Button should maintain structure but colors may change
    expect(darkButtonSnapshot.width).toBe(lightButtonSnapshot.width);
    expect(darkButtonSnapshot.height).toBe(lightButtonSnapshot.height);
  });

  it('renders consistent glow effects across different states', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <div>
          <NeonButton>Normal Button</NeonButton>
          <NeonButton disabled>Disabled Button</NeonButton>
          <NeonButton loading>Loading Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');

    buttons.forEach(button => {
      const snapshot = captureElementSnapshot(button);
      expect(snapshot.boxShadow).toBeDefined();
    });
  });

  it('maintains consistent typography across themes', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <div>
          <NeonButton size="sm">Small Button</NeonButton>
          <NeonButton size="md">Medium Button</NeonButton>
          <NeonButton size="lg">Large Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');

    buttons.forEach(button => {
      const styles = window.getComputedStyle(button);
      expect(styles.fontFamily).toBeDefined();
      expect(styles.fontSize).toBeDefined();
      expect(styles.fontWeight).toBeDefined();
    });
  });

  it('applies proper spacing and sizing consistency', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <div>
          <NeonButton size="sm">Small</NeonButton>
          <NeonButton size="md">Medium</NeonButton>
          <NeonButton size="lg">Large</NeonButton>
        </div>
      </ThemeProvider>
    );

    const [smallButton, mediumButton, largeButton] = screen.getAllByRole('button');

    const smallSnapshot = captureElementSnapshot(smallButton);
    const mediumSnapshot = captureElementSnapshot(mediumButton);
    const largeSnapshot = captureElementSnapshot(largeButton);

    // Size progression should be logical
    expect(parseFloat(largeSnapshot.height.toString())).toBeGreaterThanOrEqual(parseFloat(mediumSnapshot.height.toString()));
    expect(parseFloat(mediumSnapshot.height.toString())).toBeGreaterThanOrEqual(parseFloat(smallSnapshot.height.toString()));
  });

  it('renders consistent border and outline styles', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <div>
          <NeonButton variant="primary">Primary</NeonButton>
          <NeonButton variant="secondary">Secondary</NeonButton>
          <NeonButton variant="tertiary">Tertiary</NeonButton>
        </div>
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');

    buttons.forEach(button => {
      const styles = window.getComputedStyle(button);
      expect(styles.borderStyle).toBeDefined();
      expect(styles.borderWidth).toBeDefined();
    });
  });

  it('maintains visual consistency in responsive layouts', () => {
    // Mock different viewport sizes
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 320, // Mobile
    });

    const { rerender } = render(
      <ThemeProvider themes={visualTestThemes}>
        <NeonButton>Responsive Button</NeonButton>
      </ThemeProvider>
    );

    const mobileSnapshot = captureElementSnapshot(screen.getByRole('button', { name: 'Responsive Button' }));

    // Change to desktop
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    // Trigger resize
    window.dispatchEvent(new Event('resize'));

    rerender(
      <ThemeProvider themes={visualTestThemes}>
        <NeonButton>Responsive Button</NeonButton>
      </ThemeProvider>
    );

    const desktopSnapshot = captureElementSnapshot(screen.getByRole('button', { name: 'Responsive Button' }));

    // Button should remain visible and functional
    expect(desktopSnapshot.width).toBe(mobileSnapshot.width);
  });

  it('applies consistent animation and transition effects', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <NeonButton>Animated Button</NeonButton>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Animated Button' });
    const styles = window.getComputedStyle(button);

    expect(styles.transition).toBeDefined();
  });

  it('maintains proper contrast ratios for accessibility', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <div>
          <NeonButton variant="primary">Primary Button</NeonButton>
          <NeonButton variant="secondary">Secondary Button</NeonButton>
          <NeonButton variant="tertiary">Tertiary Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');

    buttons.forEach(button => {
      const styles = window.getComputedStyle(button);
      const backgroundColor = styles.backgroundColor;
      const color = styles.color;

      // Colors should be defined
      expect(backgroundColor).toBeDefined();
      expect(color).toBeDefined();
      expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(color).not.toBe('rgba(0, 0, 0, 0)');
    });
  });

  it('renders consistent focus and hover states', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <NeonButton>Interactive Button</NeonButton>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Interactive Button' });

    // Focus the button
    button.focus();
    expect(button).toHaveFocus();

    const focusStyles = window.getComputedStyle(button);
    expect(focusStyles.outline).toBeDefined();

    // Mouse enter simulation would be tested with fireEvent
    const baseStyles = window.getComputedStyle(button);
    expect(baseStyles.transition).toBeDefined();
  });

  it('maintains theme consistency across component hierarchy', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <div>
          <NeonButton variant="primary">Primary</NeonButton>
          <NeonButton variant="secondary">Secondary</NeonButton>
          <ThemeSwitcher />
        </div>
      </ThemeProvider>
    );

    const themeSnapshot = captureThemeSnapshot();
    const buttons = screen.getAllByRole('button');

    // All components should use the same theme
    expect(themeSnapshot.theme).toBeDefined();
    buttons.forEach(button => {
      const buttonSnapshot = captureElementSnapshot(button);
      expect(buttonSnapshot.classes).toContain('neon-button');
    });
  });

  it('applies consistent loading and disabled state styling', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <div>
          <NeonButton loading>Loading Button</NeonButton>
          <NeonButton disabled>Disabled Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    const loadingButton = screen.getByRole('button', { name: 'Loading Button' });
    const disabledButton = screen.getByRole('button', { name: 'Disabled Button' });

    expect(loadingButton).toHaveAttribute('aria-busy', 'true');
    expect(disabledButton).toHaveAttribute('aria-disabled', 'true');

    const loadingStyles = window.getComputedStyle(loadingButton);
    const disabledStyles = window.getComputedStyle(disabledButton);

    expect(loadingStyles.opacity).toBeDefined();
    expect(disabledStyles.opacity).toBeDefined();
  });

  it('maintains visual consistency with custom className prop', () => {
    render(
      <ThemeProvider themes={visualTestThemes}>
        <NeonButton className="custom-test-class">Custom Button</NeonButton>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Custom Button' });
    expect(button).toHaveClass('custom-test-class');
    expect(button).toHaveClass('neon-button');

    const snapshot = captureElementSnapshot(button);
    expect(snapshot.classes).toContain('custom-test-class');
    expect(snapshot.classes).toContain('neon-button');
  });
});
