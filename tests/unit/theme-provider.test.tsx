import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/components/themes/theme-provider';
import { runUserAction } from '../utils/test-actions';

// Mock localStorage
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

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('renders children without crashing', () => {
    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange>
        <div>Test Child</div>
      </ThemeProvider>
    );
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('provides default theme context', () => {
    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return <div>Theme: {context.theme}</div>;
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText(/Theme:/)).toBeInTheDocument();
  });

  it('provides setTheme function', () => {
    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return (
        <div>
          <button onClick={() => context.setTheme('test-theme')}>
            Set Theme
          </button>
          Current: {context.theme}
        </div>
      );
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('Set Theme')).toBeInTheDocument();
  });

  it('saves theme preference to localStorage', async () => {
    const user = userEvent.setup();

    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return (
        <div>
          <button onClick={() => context.setTheme('tron-dark')}>
            Set Tron Theme
          </button>
          Current: {context.theme}
        </div>
      );
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByText('Set Tron Theme');
    await runUserAction(() => user.click(button));

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cml-theme', 'black-white');
    });
  });

  it('loads theme from localStorage on mount', () => {
    localStorageMock.getItem.mockReturnValue('tron-dark');

    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return <div>Theme: {context.theme}</div>;
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange storageKey="cml-theme">
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText(/Theme:.*black-white/)).toBeInTheDocument();
    expect(localStorageMock.getItem).toHaveBeenCalledWith('cml-theme');
  });

  it('normalizes storage theme value to configured themes', () => {
    localStorageMock.getItem.mockReturnValue('light');

    const customThemes = [
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

    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return <div>Theme: {context.theme}</div>;
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={customThemes} storageKey="cml-theme">
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('Theme: tron-dark')).toBeInTheDocument();
    expect(localStorageMock.getItem).toHaveBeenCalledWith('cml-theme');
  });

  it('normalizes controlled currentTheme alias to configured theme IDs', async () => {
    const customThemes = [
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

    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return <div>Theme: {context.theme}</div>;
    };

    const { rerender } = render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={customThemes} currentTheme="light">
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Theme: tron-dark')).toBeInTheDocument();
    });

    rerender(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={customThemes} currentTheme="tron-light">
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Theme: tron-light')).toBeInTheDocument();
    });
  });

  it('respects system theme preference', () => {
    // Mock system theme as dark
    // jest.setup.js installs a mock over the real matchMedia, but the DOM lib
    // still types it as the native function, so reach for the mock explicitly.
    (window.matchMedia as unknown as jest.Mock).mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return <div>System: {context.systemTheme}</div>;
    };

    render(
      <ThemeProvider enableSystem disableTransitionOnChange>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText(/System:.*dark/)).toBeInTheDocument();
  });

  it('applies theme class to document element', async () => {
    const user = userEvent.setup();

    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return (
        <div>
          <button onClick={() => context.setTheme('black-white')}>
            Apply Theme
          </button>
          Current: {context.theme}
        </div>
      );
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByText('Apply Theme');
    await runUserAction(() => user.click(button));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'black-white');
    });
  });

  it('handles transitions without blocking when disabled', async () => {
    const user = userEvent.setup();

    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return (
        <div>
          <button onClick={() => context.setTheme('tron-theme')}>
            Apply Theme
          </button>
          Transitioning: {context.isTransitioning ? 'Yes' : 'No'}
        </div>
      );
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByText('Apply Theme');
    await runUserAction(() => user.click(button));

    expect(screen.getByText('Transitioning: No')).toBeInTheDocument();
  });

  it('provides resolved theme', () => {
    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return <div>Resolved: {context.resolvedTheme}</div>;
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange defaultTheme="tron-dark">
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText(/Resolved:.*black-white/)).toBeInTheDocument();
  });

  it('handles invalid theme gracefully', async () => {
    const user = userEvent.setup();

    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return (
        <div>
          <button onClick={() => context.setTheme('invalid-theme')}>
            Set Invalid Theme
          </button>
          Current: {context.theme}
        </div>
      );
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByText('Set Invalid Theme');
    await runUserAction(() => user.click(button));

    // Should not crash and should maintain or fallback to a valid theme
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
  });

  it('falls back to default theme when theme id is empty', async () => {
    const user = userEvent.setup();

    // Start with a theme applied
    document.documentElement.setAttribute('data-theme', 'old-theme');

    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return (
        <div>
          <button onClick={() => context.setTheme('')}>
            Clear Theme
          </button>
          Current: {context.theme}
        </div>
      );
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByText('Clear Theme');
    await runUserAction(() => user.click(button));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'black-white');
    });
  });

  it('works with custom themes array', () => {
    const customThemes = [
      {
        themeId: 'custom-tron',
        name: 'Custom Tron',
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

    const TestComponent = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return <div>Themes count: {context.themes.length}</div>;
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange themes={customThemes}>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('Themes count: 1')).toBeInTheDocument();
  });

  it('respects reduced motion preference', () => {
    // Mock reduced motion preference
    // jest.setup.js installs a mock over the real matchMedia, but the DOM lib
    // still types it as the native function, so reach for the mock explicitly.
    (window.matchMedia as unknown as jest.Mock).mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const TestComponent = () => {
      require('@/components/themes/theme-provider').useTheme();
      return <div>Theme Ready</div>;
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('Theme Ready')).toBeInTheDocument();
    // The theme system should respect the reduced motion preference
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('normalizes theme callback ids to known configured themes', async () => {
    const user = userEvent.setup();

    const mockOnThemeChange = jest.fn();
    const ThemeCallbackConsumer = () => {
      const context = require('@/components/themes/theme-provider').useTheme();
      return (
        <div>
          <button onClick={() => context.setTheme('light')}>
            Set Invalid Theme
          </button>
          Current: {context.theme}
        </div>
      );
    };

    render(
      <ThemeProvider enableSystem={false} disableTransitionOnChange onThemeChange={mockOnThemeChange}>
        <ThemeCallbackConsumer />
      </ThemeProvider>
    );

    await runUserAction(() => user.click(screen.getByText('Set Invalid Theme')));

    expect(mockOnThemeChange).toHaveBeenCalledWith('black-white');
  });
});
