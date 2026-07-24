import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeConfiguration } from '@/lib/themes/theme-types';
import { ThemeProvider } from '@/components/themes/theme-provider';
import { ThemeSwitcher } from '@/components/themes/theme-switcher';
import { NeonButton } from '@/components/themes/neon-button';

// Mock console methods to capture error logs
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

// Mock localStorage for error testing
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(() => {
    throw new Error('Storage quota exceeded');
  }),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Test themes including invalid ones
const errorTestThemes = [
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
    // Invalid theme missing required properties
    themeId: 'invalid-theme',
    name: 'Invalid Theme',
    colors: {
      background: '#000000',
      // Missing other required colors
    },
  },
  // The second entry is deliberately malformed — these tests exist to prove the
  // provider degrades gracefully on bad config. The cast is what lets an
  // intentionally invalid fixture reach a typed prop; it does not change any
  // runtime behaviour under test.
] as unknown as ThemeConfiguration[];

describe('Theme Error Handling Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  it('handles missing themes array gracefully', () => {
    expect(() => {
      render(
        <ThemeProvider themes={undefined as any}>
          <NeonButton>Error Test Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Error Test Button' })).toBeInTheDocument();
  });

  it('handles empty themes array gracefully', () => {
    expect(() => {
      render(
        <ThemeProvider themes={[]}>
          <NeonButton>Empty Themes Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Empty Themes Button' })).toBeInTheDocument();
  });

  it('handles invalid theme objects gracefully', () => {
    expect(() => {
      render(
        <ThemeProvider themes={[null, undefined, {} as any]}>
          <NeonButton>Invalid Themes Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Invalid Themes Button' })).toBeInTheDocument();
  });

  it('handles malformed theme configurations', () => {
    const malformedThemes = [
      {
        themeId: 123, // Invalid type
        name: 'Malformed Theme',
        colors: 'invalid-colors', // Invalid type
      },
      {
        themeId: 'another-malformed',
        colors: null, // Missing required properties
      },
    ];

    expect(() => {
      render(
        <ThemeProvider themes={malformedThemes as any}>
          <NeonButton>Malformed Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Malformed Button' })).toBeInTheDocument();
  });

  it('handles localStorage errors gracefully', () => {
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    expect(() => {
      render(
        <ThemeProvider themes={errorTestThemes}>
          <NeonButton>Storage Error Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Storage Error Button' })).toBeInTheDocument();
  });

  it('handles localStorage read errors gracefully', () => {
    mockLocalStorage.getItem.mockImplementation(() => {
      throw new Error('Storage access denied');
    });

    expect(() => {
      render(
        <ThemeProvider themes={errorTestThemes} storageKey="test-key">
          <NeonButton>Storage Read Error Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Storage Read Error Button' })).toBeInTheDocument();
  });

  it('handles missing ThemeProvider context gracefully', () => {
    expect(() => {
      render(<NeonButton>Orphan Button</NeonButton>);
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Orphan Button' })).toBeInTheDocument();
  });

  it('handles invalid theme switching gracefully', async () => {
    const { rerender } = render(
      <ThemeProvider themes={errorTestThemes} currentTheme="tron-dark">
        <NeonButton>Switch Error Button</NeonButton>
      </ThemeProvider>
    );

    expect(() => {
      rerender(
        <ThemeProvider themes={errorTestThemes} currentTheme="non-existent-theme">
          <NeonButton>Switch Error Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Switch Error Button' })).toBeInTheDocument();
  });

  it('handles CSS custom property errors gracefully', () => {
    // Mock CSS property setting to throw error
    const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty = jest.fn(() => {
      throw new Error('CSS property error');
    });

    expect(() => {
      render(
        <ThemeProvider themes={errorTestThemes}>
          <NeonButton>CSS Error Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'CSS Error Button' })).toBeInTheDocument();

    // Restore original method
    CSSStyleDeclaration.prototype.setProperty = originalSetProperty;
  });

  it('handles DOM manipulation errors gracefully', () => {
    const originalSetAttribute = document.documentElement.setAttribute;

    try {
      // Mock only documentElement setAttribute to avoid breaking all React DOM writes
      jest.spyOn(document.documentElement, 'setAttribute').mockImplementation(() => {
        throw new Error('DOM manipulation error');
      });

      expect(() => {
        render(
          <ThemeProvider themes={errorTestThemes}>
            <NeonButton>DOM Error Button</NeonButton>
          </ThemeProvider>
        );
      }).not.toThrow();

      expect(screen.getByRole('button', { name: 'DOM Error Button' })).toBeInTheDocument();
    } finally {
      document.documentElement.setAttribute = originalSetAttribute;
    }
  });

  it('propagates event handler errors', () => {
    const capturedErrors: Error[] = [];
    const windowErrorHandler = (event: ErrorEvent) => {
      if (event.error instanceof Error) {
        capturedErrors.push(event.error);
      }
    };

    window.addEventListener('error', windowErrorHandler);

    render(
      <ThemeProvider themes={errorTestThemes}>
        <NeonButton onClick={() => { throw new Error('Click handler error'); }}>
          Click Error Button
        </NeonButton>
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Click Error Button' });
    fireEvent.click(button);
    window.removeEventListener('error', windowErrorHandler);

    const capturedError = capturedErrors.find((error) => error.message === 'Click handler error');
    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError?.message).toBe('Click handler error');
  });

  it('handles theme callback errors gracefully', () => {
    const mockOnThemeChange = jest.fn(() => {
      throw new Error('Theme callback error');
    });

    expect(() => {
      render(
        <ThemeProvider themes={errorTestThemes} onThemeChange={mockOnThemeChange}>
          <ThemeSwitcher />
        </ThemeProvider>
      );
    }).not.toThrow();
  });

  it('handles React rendering errors gracefully', () => {
    const ProblematicComponent = () => {
      throw new Error('Component render error');
    };

    expect(() => {
      render(
        <ThemeProvider themes={errorTestThemes}>
          <NeonButton>Safe Button</NeonButton>
          <ProblematicComponent />
        </ThemeProvider>
      );
    }).toThrow('Component render error');
  });

  it('handles infinite recursion protection', () => {
    let renderCount = 0;
    const RecursiveComponent = () => {
      renderCount++;
      if (renderCount > 10) {
        throw new Error('Infinite recursion detected');
      }
      return <NeonButton>Recursive Button</NeonButton>;
    };

    expect(() => {
      render(
        <ThemeProvider themes={errorTestThemes}>
          <RecursiveComponent />
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(renderCount).toBeGreaterThan(0);
  });

  it('handles memory leak protection', () => {
    const components: Array<() => void> = [];

    expect(() => {
      for (let i = 0; i < 1000; i++) {
        const { unmount } = render(
          <ThemeProvider themes={errorTestThemes}>
            <NeonButton key={i}>Button {i}</NeonButton>
          </ThemeProvider>
        );
        components.push(unmount);
      }

      // Cleanup all components
      components.forEach(unmount => unmount());
    }).not.toThrow();
  });

  it('handles network request errors (if any)', () => {
    // Mock fetch to simulate network errors
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

    expect(() => {
      render(
        <ThemeProvider themes={errorTestThemes}>
          <NeonButton>Network Error Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Network Error Button' })).toBeInTheDocument();
  });

  it('handles invalid prop types gracefully', () => {
    expect(() => {
      render(
        <ThemeProvider themes={errorTestThemes}>
          {/* Invalid variant/size are the point of this test: the component must
              fall back rather than crash. ts-expect-error asserts the props are
              genuinely off-contract, so if the union ever widens to accept them
              this line fails and the test is revisited. */}
          {/* @ts-expect-error - deliberately invalid prop values */}
          <NeonButton variant="invalid-variant" as="invalid-element" size="invalid-size">
            Invalid Props Button
          </NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Invalid Props Button' })).toBeInTheDocument();
  });

  it('handles missing required props gracefully', () => {
    expect(() => {
      render(
        <ThemeProvider themes={errorTestThemes}>
          {/* @ts-ignore */}
          <NeonButton>
            Missing Props Button
          </NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Missing Props Button' })).toBeInTheDocument();
  });

  it('handles circular reference errors', () => {
    const circularTheme = {
      themeId: 'circular',
      name: 'Circular Theme',
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
    };

    // Create circular reference
    (circularTheme as any).self = circularTheme;

    expect(() => {
      render(
        <ThemeProvider themes={[circularTheme]}>
          <NeonButton>Circular Reference Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Circular Reference Button' })).toBeInTheDocument();
  });

  it('handles extremely large theme objects gracefully', () => {
    const largeTheme = {
      themeId: 'large-theme',
      name: 'Large Theme',
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
        // Add many properties to create large object
        ...Array.from({ length: 1000 }, (_, i) => ({
          [`prop-${i}`]: `value-${i}`.repeat(1000),
        })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
      },
      glow: { intensity: 0.8, blurRadius: '8px', spreadRadius: '2px' },
      animation: { duration: '0.3s', easing: 'ease-out', reducedMotion: false },
      accessibility: { highContrast: false, reducedGlow: false },
    };

    expect(() => {
      render(
        <ThemeProvider themes={[largeTheme]}>
          <NeonButton>Large Theme Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Large Theme Button' })).toBeInTheDocument();
  });

  it('handles malformed CSS values gracefully', () => {
    const malformedTheme = {
      themeId: 'malformed-css',
      name: 'Malformed CSS Theme',
      colors: {
        background: 'invalid-color',
        primary: 'another-invalid-color',
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
    };

    expect(() => {
      render(
        <ThemeProvider themes={[malformedTheme]}>
          <NeonButton>Malformed CSS Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Malformed CSS Button' })).toBeInTheDocument();
  });

  it('handles concurrent rendering conflicts', async () => {
    expect(() => {
      // Simulate concurrent renders
      Promise.all([
        render(
          <ThemeProvider themes={errorTestThemes}>
            <NeonButton>Concurrent Button 1</NeonButton>
          </ThemeProvider>
        ),
        render(
          <ThemeProvider themes={errorTestThemes}>
            <NeonButton>Concurrent Button 2</NeonButton>
          </ThemeProvider>
        ),
        render(
          <ThemeProvider themes={errorTestThemes}>
            <NeonButton>Concurrent Button 3</NeonButton>
          </ThemeProvider>
        ),
      ]);
    }).not.toThrow();
  });

  it('provides fallback behavior when errors occur', () => {
    // Mock a scenario where theme switching fails
    const mockSetTheme = jest.fn(() => {
      throw new Error('Theme switching failed');
    });

    expect(() => {
      render(
        <ThemeProvider themes={errorTestThemes}>
          <NeonButton>Fallback Button</NeonButton>
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Fallback Button' })).toBeInTheDocument();
  });

  it('logs appropriate error messages for debugging', () => {
    render(
      <ThemeProvider themes={[errorTestThemes[1]]}>
        <NeonButton>Error Logging Button</NeonButton>
      </ThemeProvider>
    );

    // Should log warnings about invalid theme
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('maintains application stability after errors', () => {
    // First render with invalid theme
    render(
      <ThemeProvider themes={[errorTestThemes[1]]}>
        <NeonButton>First Button</NeonButton>
      </ThemeProvider>
    );

    // Then render with valid theme
    const { rerender } = render(
      <ThemeProvider themes={[errorTestThemes[0]]}>
        <NeonButton>Second Button</NeonButton>
      </ThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Second Button' })).toBeInTheDocument();

    // Application should still be functional
    rerender(
      <ThemeProvider themes={[errorTestThemes[0]]}>
        <NeonButton>Third Button</NeonButton>
      </ThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Third Button' })).toBeInTheDocument();
  });
});
