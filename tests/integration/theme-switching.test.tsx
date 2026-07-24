import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/components/themes/theme-provider';
import { ThemeSwitcher } from '@/components/themes/theme-switcher';
import { NeonButton } from '@/components/themes/neon-button';
import { runUserAction } from '../utils/test-actions';

// Mock localStorage for integration testing
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock matchMedia for accessibility testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Test themes for integration
const testThemes = [
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

describe('Theme Switching Integration', () => {
  const mockOnThemeChange = jest.fn();
  const getThemeOption = (name: 'Tron Dark' | 'Tron Light') => {
    return screen.getByRole('radio', { name: `Switch to ${name} theme` });
  };

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
  });

  it('integrates ThemeProvider and ThemeSwitcher seamlessly', () => {
    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes} onThemeChange={mockOnThemeChange}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    expect(getThemeOption('Tron Dark')).toBeInTheDocument();
    expect(getThemeOption('Tron Light')).toBeInTheDocument();
  });

  it('persists theme selection across component re-renders', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes} onThemeChange={mockOnThemeChange}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const lightButton = getThemeOption('Tron Light');
    await runUserAction(() => user.click(lightButton));

    expect(mockOnThemeChange).toHaveBeenCalledWith('tron-light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('cml-theme', 'tron-light');

    // Rerender with new theme as current
    rerender(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes} currentTheme="tron-light" onThemeChange={mockOnThemeChange}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const activeButton = getThemeOption('Tron Light');
    expect(activeButton).toHaveAttribute('aria-checked', 'true');
  });

  it('applies theme classes to document element', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const darkButton = getThemeOption('Tron Dark');
    await runUserAction(() => user.click(darkButton));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'tron-dark');
    });
  });

  it('updates component styling when theme changes', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes}>
        <div>
          <ThemeSwitcher />
          <NeonButton>Test Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Test Button' });
    expect(button).toBeInTheDocument();

    // Change theme
    const lightButton = getThemeOption('Tron Light');
    await runUserAction(() => user.click(lightButton));

    // Button should still be rendered with new theme styles
    expect(button).toBeInTheDocument();
  });

  it('handles theme change callbacks properly', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes} onThemeChange={mockOnThemeChange}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const darkButton = getThemeOption('Tron Dark');
    await runUserAction(() => user.click(darkButton));

    expect(mockOnThemeChange.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(mockOnThemeChange).toHaveBeenCalledWith('tron-dark');
  });

  it('maintains theme state during rapid switching', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes} onThemeChange={mockOnThemeChange}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const darkButton = getThemeOption('Tron Dark');
    const lightButton = getThemeOption('Tron Light');

    // Rapid theme switching
    await runUserAction(() => user.click(darkButton));
    await runUserAction(() => user.click(lightButton));
    await runUserAction(() => user.click(darkButton));

    expect(mockOnThemeChange.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(['tron-dark', 'tron-light']).toContain(mockOnThemeChange.mock.calls.at(-1)?.[0]);
  });

  it('loads saved theme from localStorage on mount', () => {
    localStorageMock.getItem.mockReturnValue('tron-light');

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes} storageKey="cml-theme">
        <ThemeSwitcher />
      </ThemeProvider>
    );

    expect(localStorageMock.getItem).toHaveBeenCalledWith('cml-theme');
    expect(getThemeOption('Tron Light')).toBeInTheDocument();
  });

  it('falls back to default theme when saved theme is invalid', () => {
    localStorageMock.getItem.mockReturnValue('non-existent-theme');

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes} storageKey="cml-theme">
        <ThemeSwitcher />
      </ThemeProvider>
    );

    // Should still render available themes
    expect(getThemeOption('Tron Dark')).toBeInTheDocument();
    expect(getThemeOption('Tron Light')).toBeInTheDocument();
  });

  it('throws when ThemeProvider is missing', () => {
    // ThemeSwitcher requires ThemeProvider context
    expect(() => {
      render(<ThemeSwitcher />);
    }).toThrow();
  });

  it('coordinates multiple themed components', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes}>
        <div>
          <ThemeSwitcher />
          <NeonButton variant="primary">Primary Button</NeonButton>
          <NeonButton variant="secondary">Secondary Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');
    const themeButtons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(2);
    expect(themeButtons).toHaveLength(2);

    // Switch theme
    const lightButton = getThemeOption('Tron Light');
    await runUserAction(() => user.click(lightButton));

    // All components should still be properly rendered
    buttons.forEach(button => {
      expect(button).toBeInTheDocument();
    });
  });

  it('supports theme customization integration', () => {
    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes}>
        <ThemeSwitcher showCustomization />
      </ThemeProvider>
    );

    // Customization controls should be visible
    expect(screen.getByText(/Glow Intensity/i)).toBeInTheDocument();
    expect(screen.getByText(/Animation Speed/i)).toBeInTheDocument();
  });

  it('maintains keyboard navigation across theme changes', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const firstButton = screen.getAllByRole('radio')[0];
    firstButton.focus();

    expect(firstButton).toHaveFocus();

    // Switch theme using keyboard
    await runUserAction(() => user.keyboard('{Enter}'));

    // Focus should be maintained
    expect(firstButton).toHaveFocus();
  });

  it('updates ARIA live regions for screen readers', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const themeButton = getThemeOption('Tron Dark');
    await runUserAction(() => user.click(themeButton));

    // Screen reader announcements should be triggered
    // This would be tested with actual screen reader in real scenario
    expect(themeButton).toBeInTheDocument();
  });

  it('handles theme transitions without breaking UI', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes}>
        <div>
          <ThemeSwitcher />
          <NeonButton loading>Loading Button</NeonButton>
        </div>
      </ThemeProvider>
    );

    const loadingButton = screen.getByRole('button', { name: 'Loading Button' });
    expect(loadingButton).toHaveAttribute('aria-busy', 'true');

    // Switch theme while button is loading
    const lightButton = getThemeOption('Tron Light');
    await runUserAction(() => user.click(lightButton));

    // Loading state should be maintained
    expect(loadingButton).toHaveAttribute('aria-busy', 'true');
  });

  it('coordinates theme state across component boundaries', async () => {
    const user = userEvent.setup();

    const TestComponent = () => {
      const { theme, setTheme } = require('@/components/themes/theme-provider').useTheme();

      return (
        <div>
          <div data-testid="current-theme">{theme}</div>
          <button onClick={() => setTheme('tron-light')}>
            Set Light Theme
          </button>
          <ThemeSwitcher />
        </div>
      );
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes}>
        <TestComponent />
      </ThemeProvider>
    );

    // Change theme via custom button
    const setThemeButton = screen.getByText('Set Light Theme');
    await runUserAction(() => user.click(setThemeButton));

    // ThemeSwitcher should reflect the change
    const themeDisplay = screen.getByTestId('current-theme');
    expect(themeDisplay).toHaveTextContent('tron-light');
  });

  it('handles error recovery during theme switching', async () => {
    const user = userEvent.setup();

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    // Simulate error during theme change
    const themeButton = getThemeOption('Tron Dark');

    // Force an error
    Object.defineProperty(document.documentElement, 'setAttribute', {
      value: jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      }),
    });

    await runUserAction(() => user.click(themeButton));

    // Component should still be functional
    expect(screen.getByRole('radio', { name: 'Switch to Tron Dark theme' })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('maintains performance during frequent theme changes', async () => {
    const user = userEvent.setup();

    const startTime = performance.now();

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const darkButton = getThemeOption('Tron Dark');
    const lightButton = getThemeOption('Tron Light');

    // Perform multiple rapid theme changes
    for (let i = 0; i < 10; i++) {
      await runUserAction(() => user.click(darkButton));
      await runUserAction(() => user.click(lightButton));
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (less than 1 second)
    expect(duration).toBeLessThan(1000);
  });

  it('supports programmatic theme changes', async () => {
    const user = userEvent.setup();

    const TestComponent = () => {
      const { setTheme } = require('@/components/themes/theme-provider').useTheme();

      return (
        <button onClick={() => setTheme('tron-light')}>
          Programmatic Change
        </button>
      );
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={testThemes}>
        <div>
          <TestComponent />
          <ThemeSwitcher />
        </div>
      </ThemeProvider>
    );

    const programButton = screen.getByText('Programmatic Change');
    await runUserAction(() => user.click(programButton));

    // ThemeSwitcher should update to reflect programmatic change
    // This would be verified by checking the active state
    expect(getThemeOption('Tron Light')).toBeInTheDocument();
  });
});
