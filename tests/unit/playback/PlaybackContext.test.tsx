import React, { useEffect, useRef } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import {
  PlaybackProvider,
  usePlaybackRegistry,
  type AnimatableParam,
} from '@/components/ui/PlaybackContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <PlaybackProvider>{children}</PlaybackProvider>;
}

function makeParam(name: string, value = 0): AnimatableParam {
  let current = value;
  return {
    name,
    label: name,
    min: 0,
    max: 1,
    step: 0.1,
    getValue: () => current,
    setValue: (v: number) => {
      current = v;
    },
  };
}

describe('PlaybackContext', () => {
  it('registers and lists params in registration order', () => {
    const { result } = renderHook(() => usePlaybackRegistry(), { wrapper });

    act(() => {
      result.current.register(makeParam('r'));
      result.current.register(makeParam('K'));
    });

    expect(result.current.getParams().map((p) => p.name)).toEqual(['r', 'K']);
    expect(result.current.getParam('r')?.name).toBe('r');
    expect(result.current.version).toBeGreaterThan(0);
  });

  it('deregisters on request and bumps version only on membership change', () => {
    const { result } = renderHook(() => usePlaybackRegistry(), { wrapper });

    act(() => {
      result.current.register(makeParam('r'));
    });
    const versionAfterRegister = result.current.version;

    act(() => {
      result.current.deregister('r');
    });
    expect(result.current.getParam('r')).toBeUndefined();
    expect(result.current.version).toBeGreaterThan(versionAfterRegister);

    const versionAfterDeregister = result.current.version;
    act(() => {
      result.current.deregister('missing');
    });
    expect(result.current.version).toBe(versionAfterDeregister);
  });

  it('does not re-render consumers when a param value changes via setValue', () => {
    const renderCount = { current: 0 };

    function Consumer() {
      const registry = usePlaybackRegistry();
      const paramRef = useRef<AnimatableParam | null>(null);

      useEffect(() => {
        renderCount.current += 1;
      });

      useEffect(() => {
        const param = makeParam('r', 0.5);
        paramRef.current = param;
        registry.register(param);
        return () => registry.deregister('r');
      }, [registry]);

      return (
        <div>
          <span data-testid="version">{registry.version}</span>
          <button
            type="button"
            onClick={() => paramRef.current?.setValue(0.9)}
          >
            set
          </button>
        </div>
      );
    }

    render(
      <PlaybackProvider>
        <Consumer />
      </PlaybackProvider>,
    );

    const rendersAfterMount = renderCount.current;

    act(() => {
      screen.getByRole('button', { name: 'set' }).click();
    });

    // Value change must not re-render the consumer (no extra effect pass).
    expect(renderCount.current).toBe(rendersAfterMount);
  });

  it('notifies subscribe listeners on mount/unmount only', () => {
    const { result } = renderHook(() => usePlaybackRegistry(), { wrapper });
    const listener = jest.fn();

    let unsubscribe: () => void = () => {};
    act(() => {
      unsubscribe = result.current.subscribe(listener);
    });

    act(() => {
      result.current.register(makeParam('r'));
    });
    expect(listener).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.getParam('r')?.setValue(1);
    });
    expect(listener).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.deregister('r');
    });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    act(() => {
      result.current.register(makeParam('r'));
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('throws when usePlaybackRegistry is used outside a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => usePlaybackRegistry());
    }).toThrow(/PlaybackProvider/);
    spy.mockRestore();
  });
});
