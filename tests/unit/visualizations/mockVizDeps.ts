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

export const chartHelpersMock = {
  CHART_MARGIN: { top: 40, right: 20, bottom: 60, left: 60 },
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
  renderChartAxes: () => undefined,
  renderAxisLabelsRotated: () => undefined,
  renderAxisLabelsPlain: () => undefined,
  renderChartTitle: () => undefined,
  renderChartTitleAccent: () => undefined,
  padDomain: (d: [number, number]) => d,
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
};

export const useHydratedMock = {
  useHydrated: () => true,
};
