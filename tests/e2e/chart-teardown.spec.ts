import { test, expect } from '@playwright/test';

/**
 * Chart teardown budget: map pages must not destroy and rebuild SVG data
 * marks on every animation frame. Structural nodes (axes, clip, labels) are
 * reused; data marks use keyed d3 joins and update in place.
 *
 * Pre-fix baselines over 3 s of playback (childList removals):
 *   henon    ~0      (canvas; structure fixed in edeb62a)
 *   tent     ~174
 *   arnold   ~1530
 *   logistic ~6255
 */

type TeardownCounts = { removed: number; added: number };

/** Maps that expose playback controls and a chart SVG. */
type MapTeardownCase = {
  name: string;
  path: string;
  /** CSS selector for the chart SVG (or a parent that contains one). */
  svgRoot: string;
  /**
   * Selector under the SVG for the primary data marks whose count must stay
   * at `expectedMarkCount` (no accumulation). Null for canvas-only charts.
   */
  markSelector: string | null;
  expectedMarkCount: number | null;
  /** Optional per-map removal budget override; default is 50. */
  maxRemoved?: number;
  /** Written reason when maxRemoved is raised above the global budget. */
  budgetReason?: string;
};

const PLAYBACK_MAPS: MapTeardownCase[] = [
  {
    name: 'henon',
    path: '/maps/henon',
    svgRoot: '.henon-map-visualization svg',
    markSelector: null,
    expectedMarkCount: null,
  },
  {
    name: 'logistic',
    path: '/maps/logistic',
    // Plain svg: the wrapper class is not always present in older builds, and
    // waitForSelector on `.logistic-map-visualization svg` times out when it
    // is missing. Same pattern as arnold/bakers (page has one chart svg).
    svgRoot: 'svg',
    // Default view = cobweb; segs = 2 * (min(iterations,20) - 1) with iterations=50.
    markSelector: 'line.cobweb-seg',
    expectedMarkCount: 38,
  },
  {
    name: 'tent',
    path: '/maps/tent',
    svgRoot: 'svg',
    // Cobweb: tent-fn path + diagonal line + cobweb path (no per-point circles).
    markSelector: 'g.chart-data path, g.chart-data line.diagonal',
    expectedMarkCount: 3,
  },
  {
    name: 'arnold',
    path: '/maps/arnold',
    svgRoot: 'svg',
    // Default trajectory: one circle per iterate (iterations default 50).
    markSelector: 'g.chart-data circle.traj-point',
    expectedMarkCount: 50,
  },
  {
    name: 'bakers',
    path: '/maps/bakers',
    svgRoot: 'svg',
    markSelector: 'g.chart-data circle.traj-point',
    expectedMarkCount: 50,
  },
  {
    name: 'ikeda',
    path: '/maps/ikeda',
    svgRoot: 'svg',
    // Default attractor is canvas-painted; SVG holds axes only.
    markSelector: null,
    expectedMarkCount: null,
  },
  {
    name: 'tinkerbell',
    path: '/maps/tinkerbell',
    svgRoot: 'svg',
    // Fixed-point markers over the canvas attractor; count is param-set dependent
    // but must not grow during playback (no accumulation).
    markSelector: 'g.chart-data circle.fp-marker',
    expectedMarkCount: null, // asserted non-multiple / stable via no-growth check
  },
  {
    name: 'duffing',
    path: '/maps/duffing',
    svgRoot: 'svg',
    markSelector: 'g.chart-data circle.fp-marker',
    expectedMarkCount: null,
  },
  {
    name: 'standard',
    path: '/maps/standard',
    svgRoot: '.standard-map-visualization svg',
    markSelector: null,
    expectedMarkCount: null,
  },
  {
    name: 'complex',
    // Pure canvas Julia set — no chart SVG. Observe the canvas parent so the
    // MutationObserver still installs; expected removals are 0.
    path: '/maps/complex',
    svgRoot: 'canvas',
    markSelector: null,
    expectedMarkCount: null,
  },
];

const GLOBAL_REMOVAL_BUDGET = 50;

async function installTeardownObserver(
  page: import('@playwright/test').Page,
  svgSelector: string
) {
  await page.evaluate((sel) => {
    const svg =
      document.querySelector(sel) ?? document.querySelector('svg');
    const state = { removed: 0, added: 0 };
    (window as unknown as { __chartTeardown: TeardownCounts }).__chartTeardown =
      state;
    if (!svg) return;
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        state.removed += m.removedNodes.length;
        state.added += m.addedNodes.length;
      }
    });
    obs.observe(svg, { childList: true, subtree: true });
    (window as unknown as { __chartTeardownObs: MutationObserver }).__chartTeardownObs =
      obs;
  }, svgSelector);
}

async function readTeardownCounts(
  page: import('@playwright/test').Page
): Promise<TeardownCounts> {
  return page.evaluate(() => {
    const w = window as unknown as { __chartTeardown?: TeardownCounts };
    return w.__chartTeardown ?? { removed: -1, added: -1 };
  });
}

/** Liveness: ticks + canvas paint + title + a sample of data-mark geometry. */
function fingerprintFn() {
  return (sel: string) => {
    const svg =
      document.querySelector(sel) ?? document.querySelector('svg');
    const ticks = Array.from(
      svg?.querySelectorAll('g.y-axis .tick text') ?? []
    )
      .map((t) => t.textContent)
      .join(',');
    const title =
      svg?.querySelector('text.chart-title')?.textContent ?? '';
    const geometry = Array.from(
      svg?.querySelectorAll(
        'g.chart-data path, g.chart-data line, g.chart-data circle, g.chart-data rect'
      ) ?? []
    )
      .slice(0, 24)
      .map((el) => {
        const tag = el.tagName.toLowerCase();
        if (tag === 'path') return el.getAttribute('d')?.slice(0, 48) ?? '';
        if (tag === 'circle') {
          return `c:${el.getAttribute('cx')},${el.getAttribute('cy')},${el.getAttribute('r')}`;
        }
        if (tag === 'line') {
          return `l:${el.getAttribute('x1')},${el.getAttribute('y1')},${el.getAttribute('x2')},${el.getAttribute('y2')}`;
        }
        return `r:${el.getAttribute('x')},${el.getAttribute('y')},${el.getAttribute('fill')}`;
      })
      .join('|');
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    let paintHash = 0;
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      try {
        const d = canvas
          .getContext('2d')!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        // Sample RGBA, not alpha alone. Fractal canvases (Julia/Mandelbrot)
        // are fully opaque; only RGB changes when c / zoom moves, so an
        // alpha-only hash freezes and falsely fails the liveness check.
        for (let i = 0; i < d.length; i += 64) {
          paintHash =
            (paintHash * 31 +
              d[i] +
              d[i + 1] * 3 +
              d[i + 2] * 5 +
              d[i + 3] * 7 +
              i) >>>
            0;
        }
      } catch {
        paintHash = -1;
      }
    }
    return `${ticks}|${title}|${paintHash}|${geometry}`;
  };
}

test.describe('Chart teardown budget (all playback maps)', () => {
  for (const map of PLAYBACK_MAPS) {
    test(`${map.name}: playback 3s under removal budget; live; no mark accumulation`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.goto(map.path);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="playback-controls"]', {
        timeout: 30_000,
      });
      await page.waitForSelector(map.svgRoot, { timeout: 30_000 });

      // Let the first paint settle so the observer does not count mount work.
      await page.waitForTimeout(600);

      const fingerprint = () =>
        page.evaluate(fingerprintFn(), map.svgRoot);

      const beforePlay = await fingerprint();

      const markCountBefore =
        map.markSelector == null
          ? null
          : await page.evaluate(
              ({ root, mark }) => {
                const svg =
                  document.querySelector(root) ?? document.querySelector('svg');
                return svg?.querySelectorAll(mark).length ?? -1;
              },
              { root: map.svgRoot, mark: map.markSelector }
            );

      await installTeardownObserver(page, map.svgRoot);

      const play = page.getByTestId('playback-play-pause');
      await expect(play).toBeEnabled({ timeout: 15_000 });
      await play.click();
      await expect(play).toHaveAttribute('aria-pressed', 'true');

      await page.waitForTimeout(3_000);

      await play.click();
      await expect(play).toHaveAttribute('aria-pressed', 'false');

      const counts = await readTeardownCounts(page);
      const budget = map.maxRemoved ?? GLOBAL_REMOVAL_BUDGET;
      console.log(
        `${map.name} 3s teardown: removed=${counts.removed} added=${counts.added} (budget: removed < ${budget}${map.budgetReason ? `; exception: ${map.budgetReason}` : ''})`
      );

      const afterPlay = await fingerprint();
      expect(
        afterPlay,
        `${map.name}: chart did not change during playback — a frozen chart also scores 0 removals, so the budget below would be meaningless`
      ).not.toBe(beforePlay);

      expect(counts.removed).toBeGreaterThanOrEqual(0);
      expect(
        counts.removed,
        `${map.name}: removed=${counts.removed} exceeds budget ${budget}`
      ).toBeLessThan(budget);

      // No duplicate accumulation: mark count equals expected (or stays at the
      // pre-play count when the expected count is param-set-dependent).
      if (map.markSelector != null) {
        const markCountAfter = await page.evaluate(
          ({ root, mark }) => {
            const svg =
              document.querySelector(root) ?? document.querySelector('svg');
            return svg?.querySelectorAll(mark).length ?? -1;
          },
          { root: map.svgRoot, mark: map.markSelector }
        );
        console.log(
          `${map.name} marks: before=${markCountBefore} after=${markCountAfter} expected=${map.expectedMarkCount}`
        );
        if (map.expectedMarkCount != null) {
          expect(markCountAfter).toBe(map.expectedMarkCount);
        } else {
          expect(markCountAfter).toBe(markCountBefore);
          // Guard against "zero marks both times" masking a missing join.
          expect(markCountAfter).toBeGreaterThan(0);
        }
        // Explicit anti-accumulation: not a multiple of a plausible base.
        if (markCountBefore != null && markCountBefore > 0) {
          expect(markCountAfter).toBeLessThan(markCountBefore * 2);
        }
      }

      // Structural nodes stay single.
      const structure = await page.evaluate((sel) => {
        const svg =
          document.querySelector(sel) ?? document.querySelector('svg');
        if (!svg) return null;
        return {
          xAxis: svg.querySelectorAll('g.x-axis').length,
          yAxis: svg.querySelectorAll('g.y-axis').length,
          chartRoot: svg.querySelectorAll('g.chart-root').length,
        };
      }, map.svgRoot);
      expect(structure).not.toBeNull();
      expect(structure!.chartRoot).toBeLessThanOrEqual(1);
      // Some views omit axes (rare); when present they must not duplicate.
      if (structure!.xAxis > 0) expect(structure!.xAxis).toBe(1);
      if (structure!.yAxis > 0) expect(structure!.yAxis).toBe(1);
    });
  }

  test('domain padding: outermost y tick covers the data maximum (henon)', async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await page.goto('/maps/henon');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.henon-map-visualization svg g.y-axis', {
      timeout: 30_000,
    });
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const svg =
        document.querySelector('.henon-map-visualization svg') ??
        document.querySelector('svg');
      if (!svg) return { ok: false as const, reason: 'no svg' };

      const tickTexts = Array.from(
        svg.querySelectorAll('g.y-axis .tick text')
      ).map((el) => parseFloat(el.textContent ?? 'NaN'));
      const finiteTicks = tickTexts.filter((v) => Number.isFinite(v));
      if (finiteTicks.length === 0) {
        return { ok: false as const, reason: 'no y ticks' };
      }
      const outermostYTick = Math.max(...finiteTicks.map(Math.abs));
      const maxYTick = Math.max(...finiteTicks);

      const a = 1.4;
      const b = 0.3;
      let x = 0;
      let y = 0;
      for (let i = 0; i < 100; i++) {
        const xNext = 1 - a * x * x + y;
        const yNext = b * x;
        x = xNext;
        y = yNext;
      }
      let dataMaxY = -Infinity;
      for (let i = 0; i < 50_000; i++) {
        const xNext = 1 - a * x * x + y;
        const yNext = b * x;
        x = xNext;
        y = yNext;
        if (Number.isFinite(y) && y > dataMaxY) dataMaxY = y;
      }

      return {
        ok: true as const,
        maxYTick,
        outermostYTick,
        dataMaxY,
      };
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    console.log(
      `henon domain pad: maxYTick=${result.maxYTick} dataMaxY=${result.dataMaxY}`
    );
    expect(result.maxYTick).toBeGreaterThanOrEqual(result.dataMaxY);
  });
});
