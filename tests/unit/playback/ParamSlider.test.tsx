import React, { useEffect, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParamSlider } from '@/components/ui/ParamSlider';
import {
  PlaybackProvider,
  usePlaybackRegistry,
  type AnimatableParam,
} from '@/components/ui/PlaybackContext';
import { runUserAction } from '../../utils/test-actions';

function RegistryProbe({
  onSnapshot,
}: {
  onSnapshot: (names: string[], version: number) => void;
}) {
  const registry = usePlaybackRegistry();
  useEffect(() => {
    onSnapshot(
      registry.getParams().map((p) => p.name),
      registry.version,
    );
  }, [registry, registry.version, onSnapshot]);
  return null;
}

function SliderHost({
  animate,
  onSnapshot,
}: {
  animate?: boolean;
  onSnapshot: (names: string[], version: number) => void;
}) {
  const [value, setValue] = useState(0.5);
  return (
    <PlaybackProvider>
      <ParamSlider
        label={`Parameter r: ${value.toFixed(3)}`}
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={setValue}
        animate={animate}
      />
      <RegistryProbe onSnapshot={onSnapshot} />
    </PlaybackProvider>
  );
}

describe('ParamSlider playback registration', () => {
  it('self-registers on mount and deregisters on unmount', () => {
    // Keep ONE provider mounted; unmount only the slider. A fresh provider
    // would have an empty registry even if deregister were a no-op.
    const snapshots: { names: string[]; version: number }[] = [];
    const onSnapshot = (names: string[], version: number) => {
      snapshots.push({ names, version });
    };

    function Host() {
      const [showSlider, setShowSlider] = useState(true);
      const [value, setValue] = useState(0.5);
      return (
        <PlaybackProvider>
          {showSlider ? (
            <ParamSlider
              label={`Parameter r: ${value.toFixed(3)}`}
              min={0}
              max={1}
              step={0.01}
              value={value}
              onChange={setValue}
            />
          ) : null}
          <button type="button" onClick={() => setShowSlider(false)}>
            hide
          </button>
          <RegistryProbe onSnapshot={onSnapshot} />
        </PlaybackProvider>
      );
    }

    render(<Host />);

    const mounted = snapshots[snapshots.length - 1];
    expect(mounted.names).toHaveLength(1);

    act(() => {
      screen.getByRole('button', { name: 'hide' }).click();
    });

    const after = snapshots[snapshots.length - 1];
    expect(after.names).toHaveLength(0);
  });

  it('opts out of the registry when animate={false}', () => {
    const snapshots: string[][] = [];
    render(
      <SliderHost
        animate={false}
        onSnapshot={(names) => {
          snapshots.push(names);
        }}
      />,
    );
    expect(snapshots[snapshots.length - 1]).toEqual([]);
  });

  it('registers by default when animate is omitted (additive API)', () => {
    const snapshots: string[][] = [];
    render(
      <SliderHost
        onSnapshot={(names) => {
          snapshots.push(names);
        }}
      />,
    );
    expect(snapshots[snapshots.length - 1]).toHaveLength(1);
  });

  it('renders the same slider controls without a PlaybackProvider', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <ParamSlider
        label="Parameter r: 0.500"
        min={0}
        max={1}
        step={0.01}
        value={0.5}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Parameter r: 0.500')).toBeInTheDocument();
    const input = screen.getByRole('slider');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '1');
    expect(input).toHaveValue('0.5');

    await runUserAction(async () => {
      await user.click(input);
    });
    // Still interactive — no throw without provider.
    expect(input).toBeEnabled();
  });

  it('exposes live getValue/setValue without membership thrash on value change', () => {
    const bag: {
      params: AnimatableParam[];
      version: number;
    } = { params: [], version: -1 };

    function Capture() {
      const registry = usePlaybackRegistry();
      useEffect(() => {
        bag.params = registry.getParams();
        bag.version = registry.version;
      }, [registry, registry.version]);
      return null;
    }

    function Host() {
      const [value, setValue] = useState(0.25);
      return (
        <PlaybackProvider>
          <ParamSlider
            label={`r=${value}`}
            min={0}
            max={1}
            step={0.01}
            value={value}
            onChange={setValue}
          />
          <Capture />
        </PlaybackProvider>
      );
    }

    render(<Host />);
    const versionAfterMount = bag.version;
    expect(bag.params).toHaveLength(1);
    expect(bag.params[0].getValue()).toBe(0.25);

    act(() => {
      bag.params[0].setValue(0.75);
    });

    // Membership version must not bump on value change.
    expect(bag.version).toBe(versionAfterMount);
    expect(bag.params[0].getValue()).toBe(0.75);
  });

  it('setValue is a no-op after the slider deregisters (unmount)', () => {
    // Caller may cache AnimatableParam after getParams(); without a mounted
    // guard that would setState on an unmounted owner.
    const onChange = jest.fn();
    let cached: AnimatableParam | null = null;

    function Capture() {
      const registry = usePlaybackRegistry();
      useEffect(() => {
        const params = registry.getParams();
        if (params.length > 0) cached = params[0];
      }, [registry, registry.version]);
      return null;
    }

    function Host({ show }: { show: boolean }) {
      const [value, setValue] = useState(0.25);
      return (
        <PlaybackProvider>
          {show ? (
            <ParamSlider
              label={`r=${value}`}
              min={0}
              max={1}
              step={0.01}
              value={value}
              onChange={(v) => {
                onChange(v);
                setValue(v);
              }}
            />
          ) : null}
          <Capture />
        </PlaybackProvider>
      );
    }

    const { rerender } = render(<Host show />);
    expect(cached).not.toBeNull();

    act(() => {
      cached!.setValue(0.5);
    });
    expect(onChange).toHaveBeenCalledWith(0.5);
    onChange.mockClear();

    rerender(<Host show={false} />);

    act(() => {
      cached!.setValue(0.9);
    });
    // After deregistration setValue must not call the owner onChange.
    expect(onChange).not.toHaveBeenCalled();
  });
});
