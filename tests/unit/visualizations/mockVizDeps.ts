/**
 * Shared paint-stack stubs for visualisation unit tests.
 * Call `jest.mock(...)` factories that `require` this module so hoisting works.
 */

const paintStub: Record<string, unknown> = {};
const self = () => paintStub;
paintStub.append = self;
paintStub.attr = self;
paintStub.style = self;
paintStub.text = self;
paintStub.datum = self;
paintStub.call = self;
paintStub.remove = self;
paintStub.each = self;
paintStub.on = self;
paintStub.html = self;
paintStub.classed = self;
paintStub.property = self;
paintStub.transition = self;
paintStub.duration = self;
paintStub.ease = self;
paintStub.data = () => ({
  enter: () => ({
    append: self,
  }),
  join: self,
  exit: () => ({ remove: self }),
});
paintStub.selectAll = () => paintStub;
paintStub.select = () => paintStub;

export const d3Mock = (() => {
  const chain: unknown = new Proxy(function mockD3() {
    return chain;
  }, {
    get: (_t, prop) => {
      if (prop === 'domain' || prop === 'range' || prop === 'nice') {
        return () => chain;
      }
      return chain;
    },
    apply: () => chain,
  });
  return new Proxy(
    {},
    {
      get: () => chain,
    },
  );
})();

// Start from the real module so a newly added pure export is present (not
// undefined). Override only the DOM-painting entry points that need paintStub.
//
// EVERY DOM-touching export must appear in the overrides below. Spreading the
// real module turns a missing stub from "undefined is not a function" into the
// subtler "<method> is not a function" thrown from inside the real helper the
// first time a suite reaches it — paintStub implements only the selection
// methods listed above (no `.empty()`, for one).
const chartHelpersActual = jest.requireActual(
  '@/components/visualizations/chartHelpers',
) as Record<string, unknown>;

export const chartHelpersMock = {
  ...chartHelpersActual,
  initChartBase: () => ({
    svg: paintStub,
    g: paintStub,
    margin: { top: 40, right: 20, bottom: 60, left: 60 },
    innerWidth: 520,
    innerHeight: 300,
  }),
  equalAspectScales: () => ({
    xScale: Object.assign((v: number) => v, {
      domain: () => [0, 1],
      range: () => [0, 300],
    }),
    yScale: Object.assign((v: number) => v, {
      domain: () => [0, 1],
      range: () => [300, 0],
    }),
    offsetX: 0,
    offsetY: 0,
    plotWidth: 300,
    plotHeight: 300,
    plotSize: 300,
  }),
  createClippedDataGroup: () => paintStub,
  // Same family as createClippedDataGroup: the real one calls `.empty()` on the
  // selection, which paintStub does not implement. Unreached by today's mocked
  // suites (they all use createClippedDataGroup) but reached by any suite for a
  // component that uses this instead — e.g. LogisticMapVisualization.
  ensureChartDataGroup: () => paintStub,
  renderChartAxes: () => undefined,
  renderAxisLabelsRotated: () => undefined,
  renderAxisLabelsPlain: () => undefined,
  renderChartTitle: () => undefined,
  renderChartTitleAccent: () => undefined,
  // Keyed-join helpers. `joinByIndex` still INVOKES its update callback so the
  // per-mark attribute code stays covered under the stub rather than being
  // silently skipped — a no-op mock here would hide a throwing update fn.
  upsertMark: () => paintStub,
  joinByIndex: (
    _parent: unknown,
    _selector: string,
    _tagName: string,
    _data: unknown[],
    _className: string,
    update?: (sel: unknown) => void
  ) => {
    update?.(paintStub);
  },
};

export const densityCanvasMock = {
  renderDensityCanvas: () => undefined,
  // Dual-orbit Duffing paint imports this; keep a no-op LUT builder so
  // suites that mock the canvas module do not throw on the dual path.
  buildColorLut: () => new Uint8ClampedArray(256 * 3),
};

export const useHydratedMock = {
  useHydrated: () => true,
};
