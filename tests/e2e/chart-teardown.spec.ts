import { test, expect } from '@playwright/test';

/**
 * Chart teardown budget: /maps/henon must not destroy and rebuild the SVG
 * structure on every animation frame. Baseline before the fix: ~3186 removals
 * / ~4215 additions over 3 s of playback (selectAll('*').remove() in
 * initChartBase). After the fix: structural nodes (axes, clip, labels) are
 * reused; only tick-text churn is allowed.
 */

type TeardownCounts = { removed: number; added: number };

async function installTeardownObserver(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const svg = document.querySelector('.henon-map-visualization svg')
      ?? document.querySelector('svg');
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
  });
}

async function readTeardownCounts(
  page: import('@playwright/test').Page
): Promise<TeardownCounts> {
  return page.evaluate(() => {
    const w = window as unknown as { __chartTeardown?: TeardownCounts };
    return w.__chartTeardown ?? { removed: -1, added: -1 };
  });
}

test.describe('Chart teardown budget (Hénon)', () => {
  test('playback 3s: fewer than 50 SVG node removals; no duplicate structure', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/maps/henon');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="playback-controls"]', {
      timeout: 30_000,
    });
    await page.waitForSelector('.henon-map-visualization svg', {
      timeout: 30_000,
    });

    // Let the first paint settle so the observer does not count mount work.
    await page.waitForTimeout(500);

    // Liveness fingerprint. removed=0 is only evidence of a FIX if the chart
    // was actually animating: a frozen visualization scores 0 removals too.
    // Sampled before and after the run and required to differ.
    const fingerprint = () =>
      page.evaluate(() => {
        const svg =
          document.querySelector('.henon-map-visualization svg') ??
          document.querySelector('svg');
        const ticks = Array.from(
          svg?.querySelectorAll('g.y-axis .tick text') ?? []
        )
          .map((t) => t.textContent)
          .join(',');
        const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
        let paintHash = 0;
        if (canvas) {
          const d = canvas
            .getContext('2d')!
            .getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 3; i < d.length; i += 4) {
            if (d[i] > 8) paintHash = (paintHash * 31 + i) >>> 0;
          }
        }
        return `${ticks}|${paintHash}`;
      });

    const beforePlay = await fingerprint();

    await installTeardownObserver(page);

    const play = page.getByTestId('playback-play-pause');
    await expect(play).toBeEnabled({ timeout: 15_000 });
    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'true');

    await page.waitForTimeout(3_000);

    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'false');

    const counts = await readTeardownCounts(page);
    // Log so the before/after numbers land in the gate transcript.
    console.log(
      `henon 3s teardown: removed=${counts.removed} added=${counts.added} (budget: removed < 50; pre-fix baseline ~3186/4215)`
    );

    // The chart must have MOVED for the removal count to mean anything.
    const afterPlay = await fingerprint();
    expect(
      afterPlay,
      'chart did not change during playback — a frozen chart also scores 0 removals, so the budget below would be meaningless'
    ).not.toBe(beforePlay);

    expect(counts.removed).toBeGreaterThanOrEqual(0);
    expect(counts.removed).toBeLessThan(50);

    // Idempotency failure mode: duplicate structural nodes accumulate.
    const structure = await page.evaluate(() => {
      const svg =
        document.querySelector('.henon-map-visualization svg') ??
        document.querySelector('svg');
      if (!svg) return null;
      return {
        xAxis: svg.querySelectorAll('g.x-axis').length,
        yAxis: svg.querySelectorAll('g.y-axis').length,
        clipRect: svg.querySelectorAll('clipPath rect').length,
        xLabel: svg.querySelectorAll('text.x-axis-label').length,
        yLabel: svg.querySelectorAll('text.y-axis-label').length,
      };
    });
    expect(structure).not.toBeNull();
    expect(structure!.xAxis).toBe(1);
    expect(structure!.yAxis).toBe(1);
    expect(structure!.clipRect).toBe(1);
    expect(structure!.xLabel).toBe(1);
    expect(structure!.yLabel).toBe(1);
  });

  test('domain padding: outermost y tick covers the data maximum', async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await page.goto('/maps/henon');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.henon-map-visualization svg g.y-axis', {
      timeout: 30_000,
    });
    // First paint uses a=1.4, b=0.3 defaults.
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
      // Prefer the actual max tick value (signed max for the upper spine).
      const maxYTick = Math.max(...finiteTicks);

      // Classic Hénon orbit extent (same kernel as the viz: skip 100, then 50k).
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
    // Pre-fix failure: ticks stopped at ±0.3 while data reached ~±0.385.
    expect(result.maxYTick).toBeGreaterThanOrEqual(result.dataMaxY);
  });
});
