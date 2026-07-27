import React, { useEffect } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ComplexMapVisualization, {
  JULIA_C_IMAG_MAX,
  JULIA_C_IMAG_MIN,
  JULIA_C_REAL_MAX,
  JULIA_C_REAL_MIN,
} from '@/components/visualizations/ComplexMapVisualization';
import {
  PlaybackProvider,
  usePlaybackRegistry,
  type AnimatableParam,
} from '@/components/ui/PlaybackContext';
import { getInterestingJuliaParameters } from '@/lib/maps/complexQuadratic';

// Avoid 600×400 fractal work in unit tests — only the control wiring matters.
jest.mock('@/lib/maps/complexQuadratic', () => {
  const actual = jest.requireActual('@/lib/maps/complexQuadratic');
  const emptyField = () =>
    Array.from({ length: 2 }, () =>
      Array.from({ length: 2 }, () => ({
        iterations: 0,
        escaped: true,
        smoothIterations: 0,
      })),
    );
  return {
    ...actual,
    calculateJuliaSet: jest.fn(emptyField),
    calculateMandelbrotZoom: jest.fn(emptyField),
    calculateComplexQuadraticMap: jest.fn(() => ({
      iterations: 0,
      escaped: true,
      finalValue: new actual.ComplexNumber(0, 0),
      point: { real: 0, imag: 0 },
    })),
    calculateFractalColor: jest.fn(() => ({ r: 0, g: 0, b: 0 })),
  };
});

function mockCanvas() {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData: jest.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

function sliderByLabelPrefix(prefix: string): HTMLInputElement {
  const label = screen.getByText((_, el) => {
    if (!el || el.tagName !== 'LABEL') return false;
    return (el.textContent ?? '').startsWith(prefix);
  });
  const input = label.parentElement!.querySelector('input[type="range"]');
  if (!input) throw new Error(`No range input for label starting with ${prefix}`);
  return input as HTMLInputElement;
}

function RegistryCapture({
  onSnapshot,
  onParams,
}: {
  onSnapshot?: (labels: string[]) => void;
  onParams?: (params: AnimatableParam[]) => void;
}) {
  const registry = usePlaybackRegistry();
  useEffect(() => {
    const params = registry.getParams();
    onParams?.(params);
    onSnapshot?.(
      params.map((p) => {
        const label = p.label;
        if (typeof label === 'string') return label;
        // Flatten simple string children from our labels.
        return String(label);
      }),
    );
  }, [registry, registry.version, onSnapshot, onParams]);
  return null;
}

function renderWithPlayback(
  ui: React.ReactElement,
  onSnapshot?: (labels: string[]) => void,
  onParams?: (params: AnimatableParam[]) => void,
) {
  return render(
    <PlaybackProvider>
      {ui}
      {onSnapshot || onParams ? (
        <RegistryCapture onSnapshot={onSnapshot} onParams={onParams} />
      ) : null}
    </PlaybackProvider>,
  );
}

describe('ComplexMapVisualization ParamSlider wiring', () => {
  beforeEach(() => {
    mockCanvas();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Re(c)/Im(c) ranges contain every preset from getInterestingJuliaParameters()', () => {
    const presets = getInterestingJuliaParameters();
    for (const { c } of presets) {
      expect(c.real).toBeGreaterThanOrEqual(JULIA_C_REAL_MIN);
      expect(c.real).toBeLessThanOrEqual(JULIA_C_REAL_MAX);
      expect(c.imag).toBeGreaterThanOrEqual(JULIA_C_IMAG_MIN);
      expect(c.imag).toBeLessThanOrEqual(JULIA_C_IMAG_MAX);
    }

    render(<ComplexMapVisualization />);
    const re = sliderByLabelPrefix('Re(c):');
    const im = sliderByLabelPrefix('Im(c):');
    expect(Number(re.min)).toBe(JULIA_C_REAL_MIN);
    expect(Number(re.max)).toBe(JULIA_C_REAL_MAX);
    expect(Number(im.min)).toBe(JULIA_C_IMAG_MIN);
    expect(Number(im.max)).toBe(JULIA_C_IMAG_MAX);
    // Domain is exactly [-2, 2] on both axes (click-to-set clamps here).
    expect(JULIA_C_REAL_MIN).toBe(-2);
    expect(JULIA_C_REAL_MAX).toBe(2);
    expect(JULIA_C_IMAG_MIN).toBe(-2);
    expect(JULIA_C_IMAG_MAX).toBe(2);

    for (const { c } of presets) {
      expect(c.real).toBeGreaterThanOrEqual(Number(re.min));
      expect(c.real).toBeLessThanOrEqual(Number(re.max));
      expect(c.imag).toBeGreaterThanOrEqual(Number(im.min));
      expect(c.imag).toBeLessThanOrEqual(Number(im.max));
    }
  });

  it('choosing a preset moves both Re(c) and Im(c) sliders to that preset c', () => {
    render(<ComplexMapVisualization />);
    const presets = getInterestingJuliaParameters();
    const rabbitIndex = presets.findIndex((p) => p.name === 'Rabbit');
    expect(rabbitIndex).toBeGreaterThanOrEqual(0);
    const rabbit = presets[rabbitIndex];

    const select = screen.getByDisplayValue(/Dragon/);
    fireEvent.change(select, { target: { value: String(rabbitIndex) } });

    const re = sliderByLabelPrefix('Re(c):');
    const im = sliderByLabelPrefix('Im(c):');
    expect(Number(re.value)).toBeCloseTo(rabbit.c.real, 5);
    expect(Number(im.value)).toBeCloseTo(rabbit.c.imag, 5);
    expect(screen.getByText(`Re(c): ${rabbit.c.real.toFixed(3)}`)).toBeInTheDocument();
    expect(screen.getByText(`Im(c): ${rabbit.c.imag.toFixed(3)}`)).toBeInTheDocument();
  });

  it('clicking the Mandelbrot canvas moves Re(c)/Im(c) to the clicked point', () => {
    render(<ComplexMapVisualization />);

    // Switch to Mandelbrot so click-to-set is active.
    const typeSelect = screen.getByDisplayValue('Julia Set');
    fireEvent.change(typeSelect, { target: { value: 'mandelbrot' } });

    const canvas = document.querySelector('canvas');
    expect(canvas).not.toBeNull();
    // getBoundingClientRect → full logical size so click maps to known coords.
    jest.spyOn(canvas!, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 400,
      right: 600,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Default location is Main Cardioid (-0.5, 0), zoom 1 → range = 4.
    // Center of canvas → complex ≈ (-0.5, 0).
    fireEvent.click(canvas!, { clientX: 300, clientY: 200 });

    // Switched to Julia with custom c from the click.
    expect(screen.getByDisplayValue('Julia Set')).toBeInTheDocument();
    const re = sliderByLabelPrefix('Re(c):');
    const im = sliderByLabelPrefix('Im(c):');
    expect(Number(re.value)).toBeCloseTo(-0.5, 2);
    expect(Number(im.value)).toBeCloseTo(0, 2);
  });

  it('dragging a slider after a preset keeps the dragged value', () => {
    render(<ComplexMapVisualization />);
    const presets = getInterestingJuliaParameters();
    const spiralIndex = presets.findIndex((p) => p.name === 'Spiral');
    const select = screen.getByDisplayValue(/Dragon/);
    fireEvent.change(select, { target: { value: String(spiralIndex) } });

    const re = sliderByLabelPrefix('Re(c):');
    fireEvent.change(re, { target: { value: '-0.5' } });

    expect(Number(sliderByLabelPrefix('Re(c):').value)).toBeCloseTo(-0.5, 5);
    // Imag still from Spiral until the user moves it.
    expect(Number(sliderByLabelPrefix('Im(c):').value)).toBeCloseTo(
      presets[spiralIndex].c.imag,
      5,
    );

    // Drag imag too.
    fireEvent.change(sliderByLabelPrefix('Im(c):'), { target: { value: '0.25' } });
    expect(Number(sliderByLabelPrefix('Im(c):').value)).toBeCloseTo(0.25, 5);
    expect(Number(sliderByLabelPrefix('Re(c):').value)).toBeCloseTo(-0.5, 5);
  });

  it('registers Re(c) then Im(c) in Julia mode; Max Iterations is opted out', () => {
    let labels: string[] = [];
    renderWithPlayback(<ComplexMapVisualization />, (snap) => {
      labels = snap;
    });

    // Labels include the live value; match by prefix.
    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatch(/^Re\(c\):/);
    expect(labels[1]).toMatch(/^Im\(c\):/);
    // Max Iterations is present in the DOM but animate={false}.
    expect(screen.getByText(/Max Iterations:/)).toBeInTheDocument();
    expect(labels.some((l) => /Max Iterations/.test(l))).toBe(false);
  });

  it('registers Zoom first in Mandelbrot mode; Max Iterations opted out', () => {
    let labels: string[] = [];
    renderWithPlayback(<ComplexMapVisualization />, (snap) => {
      labels = snap;
    });

    act(() => {
      fireEvent.change(screen.getByDisplayValue('Julia Set'), {
        target: { value: 'mandelbrot' },
      });
    });

    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatch(/^Zoom Level:/);
    expect(labels.some((l) => /Max Iterations/.test(l))).toBe(false);
    expect(screen.queryByText(/^Re\(c\):/)).not.toBeInTheDocument();
  });

  it('Max Iterations ParamSlider carries animate={false} via non-registration', () => {
    // Structural + behavioural: the only non-registered continuous control
    // that remains mounted in both modes is Max Iterations.
    let labels: string[] = [];
    renderWithPlayback(<ComplexMapVisualization />, (snap) => {
      labels = snap;
    });
    const maxIter = sliderByLabelPrefix('Max Iterations:');
    expect(maxIter).toBeInTheDocument();
    expect(labels.some((l) => /Max Iterations/.test(l))).toBe(false);

    fireEvent.change(maxIter, { target: { value: '200' } });
    expect(Number(sliderByLabelPrefix('Max Iterations:').value)).toBe(200);
    // Still not in the registry after a value change.
    expect(labels.some((l) => /Max Iterations/.test(l))).toBe(false);
  });

  it('slider drag selects Custom option; re-picking the same preset clears customJuliaC', () => {
    render(<ComplexMapVisualization />);
    const presets = getInterestingJuliaParameters();
    // Default selectedJuliaParam is 0 (Dragon). Drag Re(c) so customJuliaC is set.
    const dragon = presets[0];
    fireEvent.change(sliderByLabelPrefix('Re(c):'), { target: { value: '-0.4' } });

    // Dropdown now shows Custom (truthful), not the stale preset name.
    const customOption = screen.getByRole('option', { name: /^Custom / });
    expect((customOption as HTMLOptionElement).selected).toBe(true);
    expect(screen.queryByDisplayValue(/Dragon/)).not.toBeInTheDocument();

    // Re-select Dragon: controlled <select> fires onChange because value was
    // "custom", so customJuliaC clears and sliders snap back to the preset.
    const select = customOption.closest('select')!;
    fireEvent.change(select, { target: { value: '0' } });

    expect(Number(sliderByLabelPrefix('Re(c):').value)).toBeCloseTo(dragon.c.real, 5);
    expect(Number(sliderByLabelPrefix('Im(c):').value)).toBeCloseTo(dragon.c.imag, 5);
    expect(screen.queryByRole('option', { name: /^Custom / })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(/Dragon/)).toBeInTheDocument();
  });

  it('info panel label is Custom after a slider drag and never mentions a click', () => {
    render(<ComplexMapVisualization />);
    fireEvent.change(sliderByLabelPrefix('Re(c):'), { target: { value: '-0.3' } });

    const title = screen.getByText(/^Julia Set: /);
    expect(title.textContent).toBe('Julia Set: Custom');
    expect(title.textContent).not.toMatch(/click/i);
    expect(title.textContent).not.toMatch(/Mandelbrot/i);
    // No "from Mandelbrot click" anywhere in the panel after a pure drag.
    expect(document.body.textContent).not.toMatch(/from Mandelbrot click/);
  });

  it('out-of-range Mandelbrot click clamps c into [-2, 2] and labels match thumbs', () => {
    render(<ComplexMapVisualization />);

    fireEvent.change(screen.getByDisplayValue('Julia Set'), {
      target: { value: 'mandelbrot' },
    });
    // zoomLevel=0.1 → range = 4/(1*0.1) = 40; corner maps far outside [-2, 2].
    fireEvent.change(sliderByLabelPrefix('Zoom Level:'), { target: { value: '0.1' } });

    const canvas = document.querySelector('canvas');
    expect(canvas).not.toBeNull();
    jest.spyOn(canvas!, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 400,
      right: 600,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Top-left pixel → complex ≈ (-0.5 - 20, 0 - 20) = (-20.5, -20).
    fireEvent.click(canvas!, { clientX: 0, clientY: 0 });

    expect(screen.getByDisplayValue('Julia Set')).toBeInTheDocument();
    const re = sliderByLabelPrefix('Re(c):');
    const im = sliderByLabelPrefix('Im(c):');
    expect(Number(re.value)).toBe(JULIA_C_REAL_MIN);
    expect(Number(im.value)).toBe(JULIA_C_IMAG_MIN);
    expect(Number(re.value)).toBeGreaterThanOrEqual(JULIA_C_REAL_MIN);
    expect(Number(re.value)).toBeLessThanOrEqual(JULIA_C_REAL_MAX);
    expect(Number(im.value)).toBeGreaterThanOrEqual(JULIA_C_IMAG_MIN);
    expect(Number(im.value)).toBeLessThanOrEqual(JULIA_C_IMAG_MAX);
    // Label thumbs match the clamped slider values.
    expect(screen.getByText(`Re(c): ${Number(re.value).toFixed(3)}`)).toBeInTheDocument();
    expect(screen.getByText(`Im(c): ${Number(im.value).toFixed(3)}`)).toBeInTheDocument();
  });

  it('two axis writes from one render snapshot keep both axes (functional updates)', () => {
    // Drive the registry the way playback does, NOT via fireEvent: two
    // fireEvent.change calls each flush their own render, so the second
    // handler sees fresh props and a closure-over-sibling bug survives.
    // Both setValue calls here come from ONE render's captured handlers, with
    // no commit in between — which is precisely when the non-functional form
    // drops an axis. Verified to fail against `new ComplexNumber(real,
    // currentJuliaC.imag)` and pass against the functional update.
    let params: AnimatableParam[] = [];
    renderWithPlayback(<ComplexMapVisualization />, undefined, (p) => {
      params = p;
    });

    const re = params.find((p) => String(p.label).startsWith('Re(c):'))!;
    const im = params.find((p) => String(p.label).startsWith('Im(c):'))!;
    expect(re).toBeDefined();
    expect(im).toBeDefined();

    act(() => {
      re.setValue(-0.7);
      im.setValue(0.4);
    });

    expect(Number(sliderByLabelPrefix('Re(c):').value)).toBeCloseTo(-0.7, 5);
    expect(Number(sliderByLabelPrefix('Im(c):').value)).toBeCloseTo(0.4, 5);
    expect(screen.getByText('Re(c): -0.700')).toBeInTheDocument();
    expect(screen.getByText('Im(c): 0.400')).toBeInTheDocument();
  });
});

// Empty-registry disabled state for /cml/global is covered by
// tests/unit/playback/PlaybackControls.test.tsx
// ("empty registry renders a disabled/empty state without crashing").
