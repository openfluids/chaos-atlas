import React, { useEffect, useRef } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import {
  PlaybackProvider,
  usePlaybackRegistry,
  usePlaybackSelectedParam,
  usePlaybackSelection,
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

  it('notifies selection subscribers when the selected index changes', () => {
    const { result } = renderHook(() => usePlaybackRegistry(), { wrapper });
    const listener = jest.fn();

    act(() => {
      result.current.register(makeParam('a'));
      result.current.register(makeParam('b'));
    });

    let unsubscribe: () => void = () => {};
    act(() => {
      unsubscribe = result.current.subscribeSelection(listener);
    });

    act(() => {
      result.current.setSelectedIndex(1);
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(result.current.getSelectedIndex()).toBe(1);
    expect(result.current.getSelectedParam()?.name).toBe('b');

    // Same index must not re-notify.
    act(() => {
      result.current.setSelectedIndex(1);
    });
    expect(listener).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setSelectedIndex(0);
    });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(result.current.getSelectedParam()?.name).toBe('a');

    unsubscribe();
  });

  it('does not notify selection subscribers on value changes', () => {
    const { result } = renderHook(() => usePlaybackRegistry(), { wrapper });
    const selectionListener = jest.fn();

    act(() => {
      result.current.register(makeParam('a', 0.2));
      result.current.subscribeSelection(selectionListener);
    });

    act(() => {
      result.current.getParam('a')?.setValue(0.9);
    });
    expect(selectionListener).not.toHaveBeenCalled();
    expect(result.current.getParam('a')?.getValue()).toBe(0.9);
  });

  it('does not notify selection subscribers on membership changes', () => {
    const { result } = renderHook(() => usePlaybackRegistry(), { wrapper });
    const selectionListener = jest.fn();

    act(() => {
      result.current.subscribeSelection(selectionListener);
    });

    act(() => {
      result.current.register(makeParam('a'));
    });
    expect(selectionListener).not.toHaveBeenCalled();

    act(() => {
      result.current.deregister('a');
    });
    expect(selectionListener).not.toHaveBeenCalled();
  });

  it('usePlaybackSelection re-renders on selection, not on value change', () => {
    const selectionRenders = { current: 0 };

    function SelectionConsumer() {
      const { selectedIndex, setSelectedIndex } = usePlaybackSelection();
      const registry = usePlaybackRegistry();
      useEffect(() => {
        selectionRenders.current += 1;
      });
      return (
        <div>
          <span data-testid="sel">{selectedIndex}</span>
          <button type="button" onClick={() => setSelectedIndex(1)}>
            pick-b
          </button>
          <button
            type="button"
            onClick={() => registry.getParam('a')?.setValue(0.7)}
          >
            set-a
          </button>
        </div>
      );
    }

    function Host() {
      const registry = usePlaybackRegistry();
      useEffect(() => {
        registry.register(makeParam('a', 0.1));
        registry.register(makeParam('b', 0.2));
      }, [registry]);
      return (
        <SelectionConsumer />
      );
    }

    render(
      <PlaybackProvider>
        <Host />
      </PlaybackProvider>,
    );

    const afterMount = selectionRenders.current;

    act(() => {
      screen.getByRole('button', { name: 'set-a' }).click();
    });
    // Value write must not re-render the selection consumer.
    expect(selectionRenders.current).toBe(afterMount);

    act(() => {
      screen.getByRole('button', { name: 'pick-b' }).click();
    });
    expect(selectionRenders.current).toBeGreaterThan(afterMount);
    expect(screen.getByTestId('sel').textContent).toBe('1');
  });

  it('usePlaybackSelectedParam returns the clamped param', () => {
    function Host() {
      const registry = usePlaybackRegistry();
      const selected = usePlaybackSelectedParam();
      useEffect(() => {
        registry.register(makeParam('a'));
        registry.register(makeParam('b'));
      }, [registry]);
      return <span data-testid="name">{selected?.name ?? 'none'}</span>;
    }

    render(
      <PlaybackProvider>
        <Host />
      </PlaybackProvider>,
    );
    expect(screen.getByTestId('name').textContent).toBe('a');
  });
});
