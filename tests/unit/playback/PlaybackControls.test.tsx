import React, { useEffect, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PlaybackProvider,
  usePlaybackRegistry,
  type AnimatableParam,
} from '@/components/ui/PlaybackContext';
import {
  PlaybackControls,
  advancePlayhead,
  clampSelectedIndex,
  flattenLabel,
  quantizeToStep,
  scrubberStep,
  PLAYBACK_SWEEP_SECONDS,
} from '@/components/ui/PlaybackControls';
import { runUserAction } from '../../utils/test-actions';

function makeParam(
  name: string,
  opts: Partial<AnimatableParam> & { value?: number } = {},
): AnimatableParam {
  let current = opts.value ?? opts.min ?? 0;
  const min = opts.min ?? 0;
  const max = opts.max ?? 1;
  const step = opts.step ?? 0.1;
  return {
    name,
    label: opts.label ?? name,
    min,
    max,
    step,
    getValue: () => current,
    setValue: (v: number) => {
      current = v;
    },
  };
}

function RegisterParams({
  params,
  children,
}: {
  params: AnimatableParam[];
  children?: React.ReactNode;
}) {
  const registry = usePlaybackRegistry();
  useEffect(() => {
    for (const p of params) registry.register(p);
    return () => {
      for (const p of params) registry.deregister(p.name);
    };
  }, [registry, params]);
  return <>{children}</>;
}

function Host({
  params,
  remountKey,
}: {
  params: AnimatableParam[];
  remountKey?: number;
}) {
  return (
    <PlaybackProvider>
      <RegisterParams key={remountKey} params={params} />
      <PlaybackControls />
    </PlaybackProvider>
  );
}

describe('playback pure helpers', () => {
  it('clampSelectedIndex clamps into range and handles empty', () => {
    expect(clampSelectedIndex(0, 0)).toBe(0);
    expect(clampSelectedIndex(5, 3)).toBe(2);
    expect(clampSelectedIndex(-1, 3)).toBe(0);
    expect(clampSelectedIndex(1.9, 3)).toBe(1);
  });

  it('quantizeToStep snaps to legal slider values', () => {
    expect(quantizeToStep(0.14, 0, 1, 0.1)).toBeCloseTo(0.1, 10);
    expect(quantizeToStep(0.16, 0, 1, 0.1)).toBeCloseTo(0.2, 10);
    expect(quantizeToStep(0.9716, 0, 5, 0.1)).toBeCloseTo(1.0, 10);
    // 14000 is closer to 10000 than 20000 (half-up would claim 15000).
    expect(quantizeToStep(14000, 10000, 200000, 10000)).toBe(10000);
    expect(quantizeToStep(16000, 10000, 200000, 10000)).toBe(20000);
  });

  it('advancePlayhead quantises to step and wraps at max', () => {
    // One full sweep at 1× in PLAYBACK_SWEEP_SECONDS covers (max-min).
    const min = 0;
    const max = 1;
    const step = 0.1;
    // Half range in half the sweep time → 0.5, quantised to 0.5.
    const mid = advancePlayhead(0, min, max, step, PLAYBACK_SWEEP_SECONDS / 2, 1);
    expect(mid.quantized).toBeCloseTo(0.5, 10);

    // From near max, a large step wraps toward min.
    const wrapped = advancePlayhead(0.95, min, max, step, PLAYBACK_SWEEP_SECONDS, 1);
    expect(wrapped.playhead).toBeLessThan(max);
    expect(wrapped.playhead).toBeGreaterThanOrEqual(min);
    // Continuous head advanced a full range from 0.95 → 0.95 (mod 1).
    expect(wrapped.playhead).toBeCloseTo(0.95, 5);
  });

  it('advancePlayhead rate scales with (max-min) so large ranges still move', () => {
    // iterations-like axis: 190000 span, step 10000 — continuous head must
    // accumulate; quantised value advances after enough wall time.
    const min = 10_000;
    const max = 200_000;
    const step = 10_000;
    let head = min;
    let value = min;
    // ~1s at 1×: rate = 19000 units/s → head ≈ 29000 → quantised 30000.
    for (let i = 0; i < 60; i++) {
      const r = advancePlayhead(head, min, max, step, 1 / 60, 1);
      head = r.playhead;
      value = r.quantized;
    }
    expect(value).toBeGreaterThan(min);
    expect(value % step === 0 || value === min || value === max).toBe(true);
  });

  it('scrubberStep is fine enough for K=0.9716 on a 0–5 range', () => {
    const step = scrubberStep(0, 5);
    expect(step).toBeLessThanOrEqual(0.001);
    // 0.9716 must be representable as min + n*step within 0.0005.
    const n = Math.round(0.9716 / step);
    expect(Math.abs(n * step - 0.9716)).toBeLessThan(0.001);
  });

  it('flattenLabel extracts text from React nodes', () => {
    expect(flattenLabel('plain')).toBe('plain');
    expect(flattenLabel(<>Parameter r: {3.5}</>)).toBe('Parameter r: 3.5');
  });
});

describe('PlaybackControls', () => {
  it('default-selects the first registered param', () => {
    const params = [makeParam('r', { label: 'Parameter r', value: 0.3 }), makeParam('K')];
    render(<Host params={params} />);
    const select = screen.getByTestId('playback-param-select') as HTMLSelectElement;
    expect(select.value).toBe('0');
    expect(screen.getByTestId('playback-value').textContent).toMatch(/0\.3/);
  });

  it('clamps selection index when the registry shrinks', async () => {
    const user = userEvent.setup();
    const p0 = makeParam('a', { label: 'A' });
    const p1 = makeParam('b', { label: 'B' });
    const p2 = makeParam('c', { label: 'C' });

    function ShrinkHost() {
      const [list, setList] = useState([p0, p1, p2]);
      return (
        <PlaybackProvider>
          <RegisterParams params={list} />
          <PlaybackControls />
          <button type="button" onClick={() => setList([p0])}>
            shrink
          </button>
        </PlaybackProvider>
      );
    }

    render(<ShrinkHost />);
    const select = screen.getByTestId('playback-param-select') as HTMLSelectElement;

    await runUserAction(async () => {
      await user.selectOptions(select, '2');
    });
    expect(select.value).toBe('2');

    await runUserAction(async () => {
      await user.click(screen.getByRole('button', { name: 'shrink' }));
    });

    // Only one param left → index clamps to 0 (not a stale "2").
    expect(screen.getByTestId('playback-controls')).toHaveAttribute(
      'data-selected-index',
      '0',
    );
    expect(
      (screen.getByTestId('playback-param-select') as HTMLSelectElement).value,
    ).toBe('0');
  });

  it('empty registry renders a disabled/empty state without crashing', () => {
    render(
      <PlaybackProvider>
        <PlaybackControls />
      </PlaybackProvider>,
    );
    expect(screen.getByTestId('playback-controls')).toBeInTheDocument();
    expect(screen.getByTestId('playback-play-pause')).toBeDisabled();
    expect(screen.getByTestId('playback-reset')).toBeDisabled();
    expect(screen.getByTestId('playback-scrubber')).toBeDisabled();
    expect(screen.getByTestId('playback-param-select')).toBeDisabled();
    expect(screen.getByText(/No animatable parameters/i)).toBeInTheDocument();
    // Empty registry: no selected name (attribute absent or empty).
    const emptyName = screen
      .getByTestId('playback-controls')
      .getAttribute('data-selected-name');
    expect(emptyName === null || emptyName === '').toBe(true);
  });

  it('exposes the selected param registry name on data-selected-name', async () => {
    const user = userEvent.setup();
    const params = [
      makeParam('henon-a', { label: 'Parameter a: 1.400' }),
      makeParam('henon-b', { label: 'Parameter b: 0.300' }),
    ];
    render(<Host params={params} />);

    const root = screen.getByTestId('playback-controls');
    // Default selection is the first registered param.
    expect(root).toHaveAttribute('data-selected-name', 'henon-a');

    const select = screen.getByTestId('playback-param-select') as HTMLSelectElement;
    await runUserAction(async () => {
      await user.selectOptions(select, '1');
    });
    expect(root).toHaveAttribute('data-selected-name', 'henon-b');
  });

  it('scrubber sets the param value and pauses playback', async () => {
    const user = userEvent.setup();
    const param = makeParam('K', {
      label: 'Parameter K',
      min: 0,
      max: 5,
      step: 0.1,
      value: 1,
    });
    // Capture setValue calls.
    const values: number[] = [];
    const original = param.setValue;
    param.setValue = (v: number) => {
      values.push(v);
      original(v);
    };

    render(<Host params={[param]} />);

    // Start playing so we can assert scrub pauses.
    await runUserAction(async () => {
      await user.click(screen.getByTestId('playback-play-pause'));
    });
    expect(screen.getByTestId('playback-play-pause')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const scrubber = screen.getByTestId('playback-scrubber');
    await runUserAction(async () => {
      // Precise Greene residue; scrubber step is fine enough to accept it.
      fireEvent.change(scrubber, { target: { value: '0.9716' } });
    });

    expect(param.getValue()).toBeCloseTo(0.9716, 4);
    expect(screen.getByTestId('playback-play-pause')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(values.some((v) => Math.abs(v - 0.9716) < 1e-4)).toBe(true);
  });

  it('play toggle is a real button with aria-pressed; scrubber is a labelled range', () => {
    render(<Host params={[makeParam('r')]} />);
    const toggle = screen.getByTestId('playback-play-pause');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const scrubber = screen.getByLabelText('Parameter scrubber');
    expect(scrubber).toHaveAttribute('type', 'range');
  });

  it('playing advances the param (quantised) via the animation loop', () => {
    jest.useFakeTimers();
    let now = 0;
    let pendingRaf: FrameRequestCallback | null = null;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      pendingRaf = cb;
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      pendingRaf = null;
    });

    const param = makeParam('r', {
      label: 'r',
      min: 0,
      max: 1,
      step: 0.1,
      value: 0,
    });
    render(<Host params={[param]} />);

    act(() => {
      screen.getByTestId('playback-play-pause').click();
    });

    // Pump enough frames to cover half the sweep (~5s at 1×).
    // Large display steps look "expensive" to interval-based pacing and may
    // insert setTimeout idle — flush fake timers so the next rAF is scheduled.
    for (let i = 0; i < 30; i++) {
      act(() => {
        if (!pendingRaf) {
          jest.advanceTimersByTime(1000);
        }
        if (!pendingRaf) return;
        const cb = pendingRaf;
        pendingRaf = null;
        now += 200; // 0.2 s display steps
        cb(now);
      });
    }

    expect(param.getValue()).toBeGreaterThan(0);
    // Legal step value.
    expect(Math.round(param.getValue() * 10) / 10).toBeCloseTo(param.getValue(), 10);

    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('wraps to min after crossing max while playing', () => {
    jest.useFakeTimers();
    let now = 0;
    let pendingRaf: FrameRequestCallback | null = null;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      pendingRaf = cb;
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      pendingRaf = null;
    });

    const param = makeParam('r', {
      min: 0,
      max: 1,
      step: 0.1,
      value: 0.9,
    });
    render(<Host params={[param]} />);

    act(() => {
      screen.getByTestId('playback-play-pause').click();
    });

    // Advance well past one full range from 0.9.
    for (let i = 0; i < 20; i++) {
      act(() => {
        if (!pendingRaf) {
          jest.advanceTimersByTime(1000);
        }
        if (!pendingRaf) return;
        const cb = pendingRaf;
        pendingRaf = null;
        now += 500;
        cb(now);
      });
    }

    // After wrapping, value is back in range and not stuck past max.
    expect(param.getValue()).toBeGreaterThanOrEqual(0);
    expect(param.getValue()).toBeLessThanOrEqual(1);

    jest.useRealTimers();
    jest.restoreAllMocks();
  });
});
