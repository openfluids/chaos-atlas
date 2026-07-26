import React from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Listener = (event: MediaQueryListEvent) => void;

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  const mediaQuery = {
    matches: initialMatches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null as ((this: MediaQueryList, ev: MediaQueryListEvent) => void) | null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn((event: string, listener: EventListener) => {
      if (event === 'change') listeners.add(listener as Listener);
    }),
    removeEventListener: jest.fn((event: string, listener: EventListener) => {
      if (event === 'change') listeners.delete(listener as Listener);
    }),
    dispatchEvent: jest.fn(),
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => {
      if (query === '(prefers-reduced-motion: reduce)') return mediaQuery;
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      };
    }),
  });

  return {
    mediaQuery,
    setMatches(next: boolean) {
      mediaQuery.matches = next;
      const event = { matches: next } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

describe('useReducedMotion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false on the first render (SSR-safe, no window during render)', () => {
    // matches: true would make a render-time matchMedia read return true.
    // Capture every render value so we see the pre-effect snapshot; renderHook
    // alone only exposes the post-effect result.
    mockMatchMedia(true);
    const renderValues: boolean[] = [];

    function Probe() {
      const reduced = useReducedMotion();
      renderValues.push(reduced);
      return null;
    }

    render(React.createElement(Probe));

    // First paint is always false even when the OS preference is reduce.
    // If the hook ever reads matchMedia during render, this fails.
    expect(renderValues[0]).toBe(false);
  });

  it('syncs from matchMedia after mount when reduced motion is preferred', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('syncs from matchMedia after mount when reduced motion is not preferred', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('live-updates when the media query changes', () => {
    const { setMatches } = mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      setMatches(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      setMatches(false);
    });
    expect(result.current).toBe(false);
  });

  it('removes the change listener on unmount', () => {
    const { mediaQuery } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());
    unmount();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });
});
