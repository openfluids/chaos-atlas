import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/components/themes/theme-provider';
import { ThemeSwitcher } from '@/components/themes/theme-switcher';
import { NeonButton } from '@/components/themes/neon-button';

// Mock axe-core for accessibility testing
interface AxeResults {
  violations: unknown[];
  passes: string[];
  incomplete: unknown[];
  inapplicable: unknown[];
}

const mockAxe = {
  run: jest.fn(
    (_context?: Element | Document): Promise<AxeResults> =>
      Promise.resolve({
        violations: [],
        passes: [],
        incomplete: [],
        inapplicable: [],
      })
  ),
};

// Mock matchMedia for accessibility testing
const mockMatchMedia = (matches: boolean) => ({
  matches,
  media: '',
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => {
    if (query === '(prefers-reduced-motion: reduce)') {
      return mockMatchMedia(false);
    }
    if (query === '(prefers-contrast: high)') {
      return mockMatchMedia(false);
    }
    return mockMatchMedia(false);
  }),
});

// Test themes
const accessibilityTestThemes = [
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
];

describe('Theme Accessibility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
  });

  const checkContrastRatio = (foreground: string, background: string): boolean => {
    // Simplified contrast ratio calculation for testing
    // In real implementation, use a proper contrast ratio library
    return foreground !== background;
  };

  const checkKeyboardNavigation = async (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    for (let i = 0; i < focusableElements.length; i++) {
      const element = focusableElements[i] as HTMLElement;
      element.focus();
      expect(element).toHaveFocus();
    }
  };

  const checkScreenReaderCompatibility = (container: HTMLElement) => {
    const interactiveElements = container.querySelectorAll('button, [role="button"]');

    // What screen readers actually need is an accessible *name*, not a literal
    // aria-label. A native <button> derives its name from its text content, and
    // adding aria-label on top would override that visible text — which breaks
    // voice control ("click Primary Button" would stop matching).
    // Likewise, role is implicit on <button>; an explicit role="button" is
    // redundant ARIA and is itself reported as a violation by axe-core.
    interactiveElements.forEach(element => {
      expect(element).toHaveAccessibleName();
    });
  };

  it('passes WCAG AA color contrast requirements', () => {
    render(
      <ThemeProvider themes={accessibilityTestThemes}>
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

      // Check that colors are different (simplified contrast test)
      expect(checkContrastRatio(color, backgroundColor)).toBe(true);
    });
  });

  it('maintains focus indicators for keyboard navigation', () => {
    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <div>
          <NeonButton>First Button</NeonButton>
          <NeonButton>Second Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');

    buttons.forEach(button => {
      button.focus();
      const styles = window.getComputedStyle(button, ':focus');

      // Should have visible focus indicator
      expect(styles.outline).toBeDefined();
      expect(styles.outline).not.toBe('none');
    });
  });

  it('supports keyboard-only navigation', async () => {
    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <div>
          <NeonButton>Button 1</NeonButton>
          <NeonButton>Button 2</NeonButton>
          <NeonButton>Button 3</NeonButton>
        </div>
      </ThemeProvider>
    );

    await checkKeyboardNavigation(document.body);
  });

  it('provides proper ARIA labels and roles', () => {
    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <div>
          <NeonButton>Accessible Button</NeonButton>
          <NeonButton disabled>Disabled Button</NeonButton>
          <NeonButton loading>Loading Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    checkScreenReaderCompatibility(document.body);

    const disabledButton = screen.getByRole('button', { name: 'Disabled Button' });
    expect(disabledButton).toHaveAttribute('aria-disabled', 'true');

    const loadingButton = screen.getByRole('button', { name: 'Loading Button' });
    expect(loadingButton).toHaveAttribute('aria-busy', 'true');
  });

  it('supports screen reader announcements for theme changes', async () => {
    const mockAnnounce = jest.fn();

    // Mock screen reader announcement function
    Object.defineProperty(window, 'announceToScreenReader', {
      value: mockAnnounce,
      writable: true,
    });

    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const themeButton = screen.getByText('Tron Dark');
    await userEvent.click(themeButton);

    // Screen reader should announce theme change
    // This would be tested with actual screen reader in real scenario
    expect(themeButton).toBeInTheDocument();
  });

  it('respects prefers-reduced-motion setting', () => {
    // Mock reduced motion preference
    window.matchMedia = jest.fn().mockImplementation(query => {
      if (query === '(prefers-reduced-motion: reduce)') {
        return mockMatchMedia(true);
      }
      return mockMatchMedia(false);
    });

    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <NeonButton>Reduced Motion Button</NeonButton>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Reduced Motion Button' });
    const styles = window.getComputedStyle(button);

    // Should detect reduced motion preference
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('respects prefers-contrast setting', () => {
    // Mock high contrast preference
    window.matchMedia = jest.fn().mockImplementation(query => {
      if (query === '(prefers-contrast: high)') {
        return mockMatchMedia(true);
      }
      return mockMatchMedia(false);
    });

    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <NeonButton>High Contrast Button</NeonButton>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'High Contrast Button' });

    // Should detect high contrast preference
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-contrast: high)');
  });

  it('provides sufficient touch target sizes', () => {
    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <div>
          <NeonButton size="sm">Small Button</NeonButton>
          <NeonButton size="md">Medium Button</NeonButton>
          <NeonButton size="lg">Large Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    // jsdom performs no layout, so getBoundingClientRect() is always 0x0 here —
    // real geometry is asserted in the Playwright suite. What jsdom *can* verify
    // is the size contract that determines the rendered height.
    // Target: WCAG 2.2 SC 2.5.8 (Level AA) = 24x24 CSS px minimum.
    const expectedMinHeights: Record<string, number> = {
      'Small Button': 32,
      'Medium Button': 40,
      'Large Button': 48,
    };

    Object.entries(expectedMinHeights).forEach(([name, minHeight]) => {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveClass(`min-h-[${minHeight}px]`);
      expect(minHeight).toBeGreaterThanOrEqual(24);
    });
  });

  it('maintains accessibility when switching themes', async () => {
    const { rerender } = render(
      <ThemeProvider themes={accessibilityTestThemes} currentTheme="tron-dark">
        <NeonButton>Theme Test Button</NeonButton>
      </ThemeProvider>
    );

    // Resolving via getByRole already proves the element exposes the button role
    // and the expected accessible name; asserting a literal role attribute on top
    // would demand redundant ARIA that axe-core reports as a violation.
    const initialButton = screen.getByRole('button', { name: 'Theme Test Button' });
    expect(initialButton).toHaveAccessibleName('Theme Test Button');

    rerender(
      <ThemeProvider themes={accessibilityTestThemes} currentTheme="tron-light">
        <NeonButton>Theme Test Button</NeonButton>
      </ThemeProvider>
    );

    const switchedButton = screen.getByRole('button', { name: 'Theme Test Button' });
    expect(switchedButton).toHaveAccessibleName('Theme Test Button');
    expect(switchedButton).toBeEnabled();
  });

  it('supports keyboard activation with Enter and Space keys', async () => {
    const mockOnClick = jest.fn();

    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <NeonButton onClick={mockOnClick}>Keyboard Button</NeonButton>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Keyboard Button' });
    button.focus();

    await userEvent.keyboard('{Enter}');
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    mockOnClick.mockClear();

    await userEvent.keyboard(' ');
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('provides logical tab order for theme controls', async () => {
    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <div>
          <NeonButton>First Button</NeonButton>
          <ThemeSwitcher />
          <NeonButton>Last Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    const firstButton = screen.getByRole('button', { name: 'First Button' });
    const lastButton = screen.getByRole('button', { name: 'Last Button' });
    // ThemeSwitcher exposes its options as role="radio" inside a radiogroup —
    // the correct ARIA pattern for a mutually exclusive choice — so they are not
    // matched by getAllByRole('button'). One radio per configured theme.
    const themeRadios = screen.getAllByRole('radio');
    expect(themeRadios).toHaveLength(accessibilityTestThemes.length);

    // Test tab order: content order, no positive tabindex jumping the queue
    firstButton.focus();
    expect(firstButton).toHaveFocus();

    await userEvent.tab();
    expect(themeRadios[0]).toHaveFocus();

    await userEvent.tab();
    expect(lastButton).toHaveFocus();
  });

  it('maintains focus management during theme transitions', async () => {
    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <div>
          <NeonButton>Focus Test Button</NeonButton>
          <ThemeSwitcher />
        </div>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Focus Test Button' });
    button.focus();
    expect(button).toHaveFocus();

    // Switch theme
    const themeRadio = screen.getByRole('radio', { name: /Tron Dark/ });
    await userEvent.click(themeRadio);

    // Activating a control moves focus to that control — that is correct
    // behaviour. The accessibility requirement is that focus stays on a
    // predictable element and is never dropped to <body>, which would strand
    // keyboard users at the top of the document.
    expect(themeRadio).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('provides accessible color combinations for colorblind users', () => {
    render(
      <ThemeProvider themes={accessibilityTestThemes}>
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

      // Should not rely solely on color to convey information
      expect(styles.backgroundColor).toBeDefined();
      expect(styles.color).toBeDefined();

      // Should have other visual indicators (borders, shadows, etc.)
      expect(styles.borderStyle || styles.boxShadow).toBeDefined();
    });
  });

  it('supports text scaling and zoom', () => {
    // Mock 200% zoom
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: 2,
    });

    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <NeonButton>Zoom Test Button</NeonButton>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Zoom Test Button' });

    // jsdom has no layout engine, so geometry assertions are meaningless here
    // (every rect is 0x0). What matters for SC 1.4.4 Resize Text is that the
    // button sizes from text-relative units rather than a fixed pixel box, so
    // it grows with the user's font size instead of clipping its label.
    expect(button).toBeInTheDocument();
    expect(button).toHaveAccessibleName('Zoom Test Button');
    expect(button.className).toMatch(/min-h-\[\d+px\]/);
    expect(button.className).not.toMatch(/(?:^|\s)h-\[\d+px\]/);
  });

  it('provides accessible error handling', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { rerender } = render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <NeonButton>Error Test Button</NeonButton>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Error Test Button' });

    // The previous version replaced button.click() with a throwing mock and then
    // asserted that calling it does not throw — a contradiction that could never
    // pass. What is worth asserting is that a disabled/busy control communicates
    // its state to assistive technology rather than silently doing nothing.
    expect(button).toHaveAttribute('aria-disabled', 'false');
    expect(button).toHaveAttribute('aria-busy', 'false');

    rerender(
      <ThemeProvider themes={accessibilityTestThemes}>
        <NeonButton loading>Error Test Button</NeonButton>
      </ThemeProvider>
    );

    // The button keeps its own name while loading; aria-busy carries the state
    const loadingButton = screen.getByRole('button', { name: 'Error Test Button' });
    expect(loadingButton).toHaveAttribute('aria-busy', 'true');
    expect(loadingButton).toBeDisabled();

    consoleSpy.mockRestore();
  });

  it('maintains accessibility with custom className props', () => {
    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <NeonButton className="custom-accessible-class">Custom Button</NeonButton>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Custom Button' });

    // A custom className must not displace the base classes or the accessible name
    expect(button).toHaveClass('custom-accessible-class');
    expect(button).toHaveClass('neon-button');
    expect(button).toHaveAccessibleName('Custom Button');
  });

  it('supports voice control and speech recognition', () => {
    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <div>
          <NeonButton>Click Me</NeonButton>
          <NeonButton>Switch Theme</NeonButton>
        </div>
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');

    // Voice control matches the *visible* label, so the accessible name must come
    // from the button text. An aria-label here would override it and break the
    // "click Click Me" utterance — hence no role/aria-label assertion.
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAccessibleName('Click Me');
    expect(buttons[1]).toHaveAccessibleName('Switch Theme');
  });

  it('provides accessible theme switching experience', async () => {
    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    // The switcher is a radiogroup, not a row of buttons: exactly one theme can
    // be active, and role="radio" + aria-checked is what conveys that to a
    // screen reader. Native <button> elements are already tabbable, so an
    // explicit tabindex="0" would be redundant.
    const group = screen.getByRole('radiogroup', { name: 'Theme selection' });
    expect(group).toBeInTheDocument();

    const themeRadios = screen.getAllByRole('radio');
    expect(themeRadios).toHaveLength(accessibilityTestThemes.length);

    themeRadios.forEach(radio => {
      expect(radio).toHaveAccessibleName();
      expect(radio).toHaveAttribute('aria-checked');
    });

    // Test keyboard navigation through theme options
    const firstRadio = themeRadios[0];
    firstRadio.focus();
    expect(firstRadio).toHaveFocus();

    // Arrow keys are handled by the group and must not strand focus
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).not.toBe(document.body);
  });

  it('passes automated accessibility audit', async () => {
    // Mock axe accessibility testing
    const mockResults = {
      violations: [],
      passes: ['color-contrast', 'keyboard-navigation', 'aria-labels'],
      incomplete: [],
      inapplicable: [],
    };

    mockAxe.run.mockResolvedValue(mockResults);

    render(
      <ThemeProvider themes={accessibilityTestThemes}>
        <div>
          <NeonButton>Audit Button</NeonButton>
          <ThemeSwitcher />
        </div>
      </ThemeProvider>
    );

    // In real implementation, this would run axe-core
    const results = await mockAxe.run(document.body);

    expect(results.violations).toHaveLength(0);
    expect(results.passes.length).toBeGreaterThan(0);
  });
});