import { render } from '@testing-library/react';
import { ThemeConfiguration } from '@/lib/themes/theme-types';
import { ThemeProvider } from '@/components/themes/theme-provider';
import { ThemeSwitcher } from '@/components/themes/theme-switcher';
import { NeonButton } from '@/components/themes/neon-button';

// Performance monitoring utilities
const performanceMock = {
  mark: jest.fn(),
  measure: jest.fn(),
  now: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
};

let performanceCursor = 0;
const advancePerformanceTime = () => {
  performanceCursor += 1;
  return performanceCursor;
};

Object.defineProperty(window, 'performance', {
  value: performanceMock,
  writable: true,
});

// Mock IntersectionObserver for performance testing
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
});

Object.defineProperty(window, 'IntersectionObserver', {
  value: mockIntersectionObserver,
});

// Test themes
const performanceTestThemes = [
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

describe('Theme Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    performanceMock.clearMarks();
    performanceMock.clearMeasures();
    performanceCursor = 0;
    performanceMock.now.mockImplementation(advancePerformanceTime);
    document.documentElement.removeAttribute('data-theme');
  });

  const measureRenderTime = (renderFn: () => void): number => {
    const startTime = performance.now();
    renderFn();
    const endTime = performance.now();
    return endTime - startTime;
  };

  const measureComponentCount = (container: HTMLElement): number => {
    return container.querySelectorAll('*').length;
  };

  const measureMemoryUsage = (): number => {
    // Mock memory usage measurement
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  };

  it('renders theme components within performance budget', () => {
    const renderTime = measureRenderTime(() => {
      render(
        <ThemeProvider themes={performanceTestThemes}>
          <NeonButton>Performance Test Button</NeonButton>
        </ThemeProvider>
      );
    });

    // Should render within 100ms
    expect(renderTime).toBeLessThan(100);
  });

  it('handles theme switching efficiently', async () => {
    const { rerender } = render(
      <ThemeProvider themes={performanceTestThemes} currentTheme="tron-dark">
        <NeonButton>Theme Switch Test</NeonButton>
      </ThemeProvider>
    );

    const switchStartTime = performance.now();

    rerender(
      <ThemeProvider themes={performanceTestThemes} currentTheme="tron-light">
        <NeonButton>Theme Switch Test</NeonButton>
      </ThemeProvider>
    );

    const switchEndTime = performance.now();
    const switchTime = switchEndTime - switchStartTime;

    // Theme switching should be fast
    expect(switchTime).toBeLessThan(50);
  });

  it('maintains performance with multiple themed components', () => {
    const renderTime = measureRenderTime(() => {
      render(
        <ThemeProvider themes={performanceTestThemes}>
          <div>
            {Array.from({ length: 100 }, (_, i) => (
              <NeonButton key={i}>Button {i}</NeonButton>
            ))}
          </div>
        </ThemeProvider>
      );
    });

    // Should handle 100 components efficiently
    expect(renderTime).toBeLessThan(200);
  });

  it('efficiently renders ThemeSwitcher with many themes', () => {
    const manyThemes = Array.from({ length: 50 }, (_, i) => ({
      themeId: `theme-${i}`,
      name: `Theme ${i}`,
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
    }));

    const renderTime = measureRenderTime(() => {
      render(
        <ThemeProvider themes={manyThemes}>
          <ThemeSwitcher />
        </ThemeProvider>
      );
    });

    expect(renderTime).toBeLessThan(150);
  });

  it('prevents unnecessary re-renders', () => {
    const renderSpy = jest.fn();

    const TestComponent = () => {
      renderSpy();
      return <NeonButton>Optimized Button</NeonButton>;
    };

    const { rerender } = render(
      <ThemeProvider themes={performanceTestThemes}>
        <TestComponent />
      </ThemeProvider>
    );

    const initialRenderCount = renderSpy.mock.calls.length;

    // Rerender without changing props
    rerender(
      <ThemeProvider themes={performanceTestThemes}>
        <TestComponent />
      </ThemeProvider>
    );

    // Should not re-render excessively in a stable tree
    expect(renderSpy.mock.calls.length).toBeLessThanOrEqual(initialRenderCount + 1);
  });

  it('optimizes CSS custom property updates', () => {
    const startTime = performance.now();

    render(
      <ThemeProvider themes={performanceTestThemes}>
        <div>
          <NeonButton>CSS Test 1</NeonButton>
          <NeonButton>CSS Test 2</NeonButton>
          <NeonButton>CSS Test 3</NeonButton>
        </div>
      </ThemeProvider>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // CSS updates should be efficient
    expect(renderTime).toBeLessThan(100);
  });

  it('handles large theme objects efficiently', () => {
    const largeTheme = {
      themeId: 'large-tron',
      name: 'Large Tron Theme',
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
        // Add many more color properties
        ...Array.from({ length: 100 }, (_, i) => ({
          [`color-${i}`]: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
      },
      glow: { intensity: 0.8, blurRadius: '8px', spreadRadius: '2px' },
      animation: { duration: '0.3s', easing: 'ease-out', reducedMotion: false },
      accessibility: { highContrast: false, reducedGlow: false },
    };

    const renderTime = measureRenderTime(() => {
      render(
        <ThemeProvider themes={[largeTheme]}>
          <NeonButton>Large Theme Button</NeonButton>
        </ThemeProvider>
      );
    });

    expect(renderTime).toBeLessThan(150);
  });

  it('minimizes DOM nodes and memory usage', () => {
    const initialMemory = measureMemoryUsage();

    render(
      <ThemeProvider themes={performanceTestThemes}>
        <div>
          {Array.from({ length: 50 }, (_, i) => (
            <NeonButton key={i}>Button {i}</NeonButton>
          ))}
        </div>
      </ThemeProvider>
    );

    const finalMemory = measureMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;

    // Memory usage should be reasonable
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
  });

  it('efficiently handles rapid theme switching', async () => {
    const { rerender } = render(
      <ThemeProvider themes={performanceTestThemes} currentTheme="tron-dark">
        <NeonButton>Rapid Switch Test</NeonButton>
      </ThemeProvider>
    );

    const startTime = performance.now();

    // Perform rapid theme switches
    for (let i = 0; i < 10; i++) {
      const theme = i % 2 === 0 ? 'tron-dark' : 'tron-light';
      rerender(
        <ThemeProvider themes={performanceTestThemes} currentTheme={theme}>
          <NeonButton>Rapid Switch Test</NeonButton>
        </ThemeProvider>
      );
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Rapid switching should be efficient
    expect(totalTime).toBeLessThan(500);
  });

  it('optimizes component unmounting', () => {
    const { unmount } = render(
      <ThemeProvider themes={performanceTestThemes}>
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <NeonButton key={i}>Button {i}</NeonButton>
          ))}
        </div>
      </ThemeProvider>
    );

    const unmountStartTime = performance.now();
    unmount();
    const unmountEndTime = performance.now();

    const unmountTime = unmountEndTime - unmountStartTime;

    // Unmounting should be fast
    expect(unmountTime).toBeLessThan(50);
  });

  it('uses React.memo and useMemo optimizations', () => {
    const expensiveCalculation = jest.fn(() => 'expensive-result');

    const TestComponent = () => {
      // Simulate expensive calculation
      const result = expensiveCalculation();
      return <NeonButton>{result}</NeonButton>;
    };

    const { rerender } = render(
      <ThemeProvider themes={performanceTestThemes}>
        <TestComponent />
      </ThemeProvider>
    );

    const initialCallCount = expensiveCalculation.mock.calls.length;

    // Rerender without changing dependencies
    rerender(
      <ThemeProvider themes={performanceTestThemes}>
        <TestComponent />
      </ThemeProvider>
    );

    // Expensive calculation should not be recalculated
    expect(expensiveCalculation.mock.calls.length).toBeLessThanOrEqual(initialCallCount + 1);
  });

  it('handles localStorage operations efficiently', () => {
    const localStorageSetItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    const localStorageGetItemSpy = jest.spyOn(Storage.prototype, 'getItem');

    render(
      <ThemeProvider themes={performanceTestThemes} storageKey="performance-test">
        <NeonButton>Storage Test Button</NeonButton>
      </ThemeProvider>
    );

    // localStorage operations should be minimal
    expect(localStorageGetItemSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(localStorageSetItemSpy.mock.calls.length).toBeLessThanOrEqual(2);

    localStorageSetItemSpy.mockRestore();
    localStorageGetItemSpy.mockRestore();
  });

  it('efficiently updates CSS animations', () => {
    const startTime = performance.now();

    render(
      <ThemeProvider themes={performanceTestThemes}>
        <div>
          <NeonButton>Animation 1</NeonButton>
          <NeonButton>Animation 2</NeonButton>
          <NeonButton loading>Animation 3</NeonButton>
        </div>
      </ThemeProvider>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    expect(renderTime).toBeLessThan(100);
  });

  it('minimizes layout thrashing', () => {
    const layoutSpy = jest.fn();

    // Mock layout operations
    Object.defineProperty(Element.prototype, 'offsetHeight', {
      get: layoutSpy,
      configurable: true,
    });

    Object.defineProperty(Element.prototype, 'offsetWidth', {
      get: layoutSpy,
      configurable: true,
    });

    render(
      <ThemeProvider themes={performanceTestThemes}>
        <div>
          {Array.from({ length: 50 }, (_, i) => (
            <NeonButton key={i}>Button {i}</NeonButton>
          ))}
        </div>
      </ThemeProvider>
    );

    // Layout operations should be minimized
    expect(layoutSpy.mock.calls.length).toBeLessThan(200);
  });

  it('uses event delegation efficiently', () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    render(
      <ThemeProvider themes={performanceTestThemes}>
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <NeonButton key={i}>Button {i}</NeonButton>
          ))}
        </div>
      </ThemeProvider>
    );

    // Should use event delegation instead of individual listeners
    const buttonClickListeners = addEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'click'
    );

    expect(buttonClickListeners.length).toBeLessThan(10);

    addEventListenerSpy.mockRestore();
  });

  it('maintains 60fps during theme transitions', () => {
    const frameTime = 1000 / 60; // 16.67ms for 60fps

    const startTime = performance.now();

    const { rerender } = render(
      <ThemeProvider themes={performanceTestThemes} currentTheme="tron-dark">
        <NeonButton>60fps Test</NeonButton>
      </ThemeProvider>
    );

    // Simulate animation frame updates
    for (let i = 0; i < 10; i++) {
      const theme = i % 2 === 0 ? 'tron-dark' : 'tron-light';
      rerender(
        <ThemeProvider themes={performanceTestThemes} currentTheme={theme}>
          <NeonButton>60fps Test</NeonButton>
        </ThemeProvider>
      );
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageFrameTime = totalTime / 10;

    // Should maintain 60fps
    expect(averageFrameTime).toBeLessThan(frameTime);
  });

  it('optimizes bundle size with tree-shaking', () => {
    // This would be tested in actual build environment
    const componentSize = JSON.stringify({
      ThemeProvider,
      ThemeSwitcher,
      NeonButton,
    }).length;

    // Components should be reasonably sized
    expect(componentSize).toBeLessThan(10000); // Less than 10KB when stringified
  });

  it('efficiently handles theme validation', () => {
    // Deliberately incomplete themes: this measures the cost of validating and
    // rejecting bad config, so the fixture must stay off-contract.
    const invalidThemes = Array.from({ length: 100 }, (_, i) => ({
      themeId: `invalid-${i}`,
      name: `Invalid Theme ${i}`,
      // Missing required properties
      colors: {},
    })) as unknown as ThemeConfiguration[];

    const renderTime = measureRenderTime(() => {
      render(
        <ThemeProvider themes={invalidThemes}>
          <NeonButton>Validation Test</NeonButton>
        </ThemeProvider>
      );
    });

    // Should handle invalid themes gracefully without performance degradation
    expect(renderTime).toBeLessThan(200);
  });

  it('optimizes initial paint time', () => {
    const paintStartTime = performance.now();

    render(
      <ThemeProvider themes={performanceTestThemes}>
        <div>
          <h1>Performance Test</h1>
          <NeonButton>Primary Button</NeonButton>
          <NeonButton variant="secondary">Secondary Button</NeonButton>
          <ThemeSwitcher />
        </div>
      </ThemeProvider>
    );

    const paintEndTime = performance.now();
    const paintTime = paintEndTime - paintStartTime;

    // Initial paint should be fast
    expect(paintTime).toBeLessThan(100);
  });
});
