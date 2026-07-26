import { test, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  EXPECTED_PATH,
  MAP_PAGES,
  MATRIX_JSONL_PATH,
  SAMPLE_COUNT,
  SETTLE_MS,
} from './sweepConfig';
import type { SweepMatrixRow } from './sweepSummary';

/**
 * Systematic parameter-range sweep across every map page + CML.
 *
 * Drives registered ParamSliders via the playback registry (select + scrubber)
 * when present. Falls back to direct `input[type=range]` for pages that mount
 * ParamSliders outside a PlaybackProvider (e.g. /cml/diffusive) or that use
 * raw range inputs (complex map).
 *
 * Hard fails (a)/(b): pageerror, unmounted page.
 * Soft findings: blank_with_notice and degenerate are recorded in the matrix;
 * blank_no_notice is asserted once per run in globalTeardown via summarizeSweep
 * (not here — fullyParallel makes afterAll partial).
 */

// Declare participation at module scope (runs only when Playwright loads this
// spec). globalSetup cleared the expectation file; teardown branches on it.
{
  const expectedPath = path.join(process.cwd(), EXPECTED_PATH);
  fs.mkdirSync(path.dirname(expectedPath), { recursive: true });
  fs.writeFileSync(
    expectedPath,
    JSON.stringify(
      {
        pages: MAP_PAGES.slice(),
        sampleCount: SAMPLE_COUNT,
        settleMs: SETTLE_MS,
      },
      null,
      2
    )
  );
}

type MatrixRow = SweepMatrixRow;

const matrix: MatrixRow[] = [];
const MATRIX_JSONL = () => path.join(process.cwd(), MATRIX_JSONL_PATH);

function pushRow(row: MatrixRow): void {
  matrix.push(row);
  try {
    fs.appendFileSync(MATRIX_JSONL(), JSON.stringify(row) + '\n');
  } catch {
    // best-effort persistence for the CODER report
  }
}

/** Snap to a legal range tick so Playwright `fill` accepts the value. */
function quantizeToStep(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value)) return min;
  if (!(step > 0) || !Number.isFinite(step)) {
    return Math.min(max, Math.max(min, value));
  }
  const n = Math.round((value - min) / step);
  let q = min + n * step;
  const stepStr = String(step);
  const decimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
  q = Number(q.toFixed(Math.min(12, decimals + 2)));
  if (q > max) q = max;
  if (q < min) q = min;
  return q;
}

function samples(min: number, max: number, count: number, step = 0): number[] {
  if (!(max > min) || count <= 1) return [min];
  const raw: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    raw.push(min + (max - min) * t);
  }
  raw[0] = min;
  raw[raw.length - 1] = max;
  // Deduplicate after quantisation (coarse steps can collapse interior points).
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of raw) {
    const q = step > 0 ? quantizeToStep(v, min, max, step) : Number(v.toPrecision(10));
    if (!seen.has(q)) {
      seen.add(q);
      out.push(q);
    }
  }
  return out;
}

function failLabel(pagePath: string, param: string, value: number, why: string): string {
  return `[param-sweep] page=${pagePath} param=${JSON.stringify(param)} value=${value}: ${why}`;
}

/**
 * Set a range input without Playwright's strict step validation.
 * Scrubber steps are `range/10000` and often float-noisy (e.g. 0.00018999999999999998),
 * so `locator.fill("0.3375")` throws "Malformed value" even when the control
 * would accept it via the UI. Dispatch input+change so React onChange fires.
 */
async function setRangeValue(
  locator: import('@playwright/test').Locator,
  value: number
): Promise<void> {
  await locator.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const str = String(v);
    const proto = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    );
    if (proto?.set) {
      proto.set.call(input, str);
    } else {
      input.value = str;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  // Map pages mount playback; CML does not — either is fine.
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="playback-controls"]') != null ||
      document.querySelector('input[type="range"]') != null ||
      document.querySelector('canvas') != null ||
      document.querySelector('svg') != null,
    { timeout: 30_000 }
  );
}

async function plotPresent(page: Page): Promise<boolean> {
  const canvas = page.locator('canvas').first();
  const svg = page.locator('svg').first();
  if ((await canvas.count()) > 0 && (await canvas.isVisible().catch(() => false))) {
    return true;
  }
  if ((await svg.count()) > 0 && (await svg.isVisible().catch(() => false))) {
    return true;
  }
  return false;
}

/** Soft diagnostic: canvas paint occupancy (blank / single-pixel / ok). */
async function canvasPaintDiagnosis(page: Page): Promise<{
  kind: 'none' | 'blank' | 'degenerate' | 'ok';
  nonZero: number;
}> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { kind: 'none' as const, nonZero: 0 };
    const ctx = canvas.getContext('2d');
    if (!ctx) return { kind: 'none' as const, nonZero: 0 };
    const w = canvas.width;
    const h = canvas.height;
    if (!(w > 0) || !(h > 0)) return { kind: 'blank' as const, nonZero: 0 };
    // Downsample scan for speed: every Nth pixel is enough for blank/degenerate.
    const step = Math.max(1, Math.floor(Math.min(w, h) / 80));
    let nonZero = 0;
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    const img = ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const a = img[(y * w + x) * 4 + 3];
        if (a > 0) {
          nonZero += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (nonZero === 0) return { kind: 'blank' as const, nonZero: 0 };
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    // All paint collapsed into ~one device pixel (or a tiny cluster).
    if (spanX <= step && spanY <= step && nonZero <= 4) {
      return { kind: 'degenerate' as const, nonZero };
    }
    return { kind: 'ok' as const, nonZero };
  });
}

async function hasEscapeNotice(page: Page): Promise<boolean> {
  const notice = page.getByTestId('orbit-escape-notice');
  return (await notice.count()) > 0 && (await notice.isVisible().catch(() => false));
}

async function assertStillMounted(
  page: Page,
  pagePath: string,
  param: string,
  value: number
): Promise<void> {
  // Playback controls when present; otherwise the page heading / main plot.
  const playback = page.getByTestId('playback-controls');
  if ((await playback.count()) > 0) {
    await expect(
      playback,
      failLabel(pagePath, param, value, 'playback controls unmounted')
    ).toBeVisible({ timeout: 5_000 });
  } else {
    // CML and similar: main content must still be in the DOM.
    const body = page.locator('main, h1, h2, h3').first();
    await expect(
      body,
      failLabel(pagePath, param, value, 'page content unmounted')
    ).toBeVisible({ timeout: 5_000 });
  }

  const hasPlot = await plotPresent(page);
  expect(
    hasPlot,
    failLabel(pagePath, param, value, 'canvas/svg plot element missing')
  ).toBe(true);
}

async function recordSoftFindings(
  page: Page,
  pagePath: string,
  param: string,
  value: number
): Promise<void> {
  const paint = await canvasPaintDiagnosis(page);
  if (paint.kind === 'blank') {
    const noticed = await hasEscapeNotice(page);
    pushRow({
      page: pagePath,
      param,
      value,
      verdict: noticed ? 'blank_with_notice' : 'blank_no_notice',
      detail: noticed
        ? 'canvas empty; orbit-escape-notice present'
        : 'canvas empty; no orbit-escape-notice',
    });
    return;
  }
  if (paint.kind === 'degenerate') {
    pushRow({
      page: pagePath,
      param,
      value,
      verdict: 'degenerate',
      detail: `canvas paint collapsed (nonZero≈${paint.nonZero})`,
    });
    return;
  }
  pushRow({ page: pagePath, param, value, verdict: 'ok' });
}

async function listPlaybackParams(
  page: Page
): Promise<Array<{ index: string; label: string }>> {
  const select = page.getByTestId('playback-param-select');
  if ((await select.count()) === 0) return [];
  if (await select.isDisabled()) return [];
  return select.evaluate((el: HTMLSelectElement) => {
    return Array.from(el.options)
      .filter((o) => o.value !== '')
      .map((o) => ({ index: o.value, label: (o.textContent ?? o.value).trim() }));
  });
}

async function sweepViaPlayback(
  page: Page,
  pagePath: string,
  pageErrors: Error[]
): Promise<void> {
  const params = await listPlaybackParams(page);
  if (params.length === 0) {
    pushRow({
      page: pagePath,
      param: '(none registered)',
      value: NaN,
      verdict: 'ok',
      detail: 'no animatable parameters in playback registry',
    });
    return;
  }

  // Snapshot labels/indices up front; re-goto between params so a divergent
  // endpoint on param A does not poison the sweep of param B (Hénon a=2 left
  // the page in "orbit escaped" for every subsequent b/x0/y0 sample).
  for (const { index, label } of params) {
    await page.goto(pagePath);
    await waitForPageReady(page);
    const select = page.getByTestId('playback-param-select');
    const scrubber = page.getByTestId('playback-scrubber');
    await select.selectOption(index);
    await page.waitForTimeout(150);

    const min = Number(await scrubber.getAttribute('min'));
    const max = Number(await scrubber.getAttribute('max'));
    expect(
      Number.isFinite(min) && Number.isFinite(max),
      failLabel(pagePath, label, NaN, `scrubber min/max non-finite min=${min} max=${max}`)
    ).toBe(true);

    const scrubStep = Number(await scrubber.getAttribute('step')) || 0;
    for (const value of samples(min, max, SAMPLE_COUNT, scrubStep)) {
      const errBefore = pageErrors.length;
      await setRangeValue(scrubber, value);
      // Confirm the registry accepted the write (React onChange path).
      await expect
        .poll(async () => Number(await scrubber.inputValue()), {
          timeout: 3_000,
          intervals: [50, 100, 200],
        })
        .toBeCloseTo(value, 4);
      await page.waitForTimeout(SETTLE_MS);

      if (pageErrors.length > errBefore) {
        const err = pageErrors[pageErrors.length - 1];
        pushRow({
          page: pagePath,
          param: label,
          value,
          verdict: 'pageerror',
          detail: err.message,
        });
        expect(
          pageErrors.slice(errBefore),
          failLabel(pagePath, label, value, `pageerror: ${err.message}`)
        ).toEqual([]);
      }

      try {
        await assertStillMounted(page, pagePath, label, value);
      } catch (e) {
        pushRow({
          page: pagePath,
          param: label,
          value,
          verdict: 'unmounted',
          detail: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }

      await recordSoftFindings(page, pagePath, label, value);
    }
  }
}

async function sweepDirectRanges(
  page: Page,
  pagePath: string,
  pageErrors: Error[]
): Promise<void> {
  const ranges = page.locator(
    'input[type="range"]:not([data-testid="playback-scrubber"])'
  );
  const count = await ranges.count();
  if (count === 0) {
    pushRow({
      page: pagePath,
      param: '(no range inputs)',
      value: NaN,
      verdict: 'ok',
      detail: 'no range inputs to sweep',
    });
    return;
  }

  for (let i = 0; i < count; i++) {
    // Re-query each iteration — React remounts can invalidate handles.
    const live = page
      .locator('input[type="range"]:not([data-testid="playback-scrubber"])')
      .nth(i);
    if (!(await live.isVisible().catch(() => false))) continue;

    const min = Number(await live.getAttribute('min'));
    const max = Number(await live.getAttribute('max'));
    const step = Number(await live.getAttribute('step')) || 0;
    const label =
      (await live.evaluate((el) => {
        const root = el.closest('div');
        const lab = root?.querySelector('label');
        return (lab?.textContent ?? `range[${i}]`).trim().slice(0, 80);
      })) || `range[${i}]`;

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      pushRow({
        page: pagePath,
        param: label,
        value: NaN,
        verdict: 'pageerror',
        detail: `non-finite min/max min=${min} max=${max}`,
      });
      expect(
        false,
        failLabel(pagePath, label, NaN, `non-finite min/max min=${min} max=${max}`)
      ).toBe(true);
      continue;
    }

    for (const value of samples(min, max, SAMPLE_COUNT, step)) {
      const errBefore = pageErrors.length;
      await setRangeValue(live, value);
      await page.waitForTimeout(SETTLE_MS);

      if (pageErrors.length > errBefore) {
        const err = pageErrors[pageErrors.length - 1];
        pushRow({
          page: pagePath,
          param: label,
          value,
          verdict: 'pageerror',
          detail: err.message,
        });
        expect(
          pageErrors.slice(errBefore),
          failLabel(pagePath, label, value, `pageerror: ${err.message}`)
        ).toEqual([]);
      }

      try {
        await assertStillMounted(page, pagePath, label, value);
      } catch (e) {
        pushRow({
          page: pagePath,
          param: label,
          value,
          verdict: 'unmounted',
          detail: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }

      await recordSoftFindings(page, pagePath, label, value);
    }
  }
}

test.describe('Parameter range sweep (crash hunt)', () => {
  // Independent per page so one failure does not skip the rest of the hunt.
  // Run with --workers=1 when collecting a coherent matrix file.
  // Matrix truncate → globalSetup; summary write + blank_no_notice assert →
  // globalTeardown. Do not truncate jsonl or summarise in beforeAll/afterAll.

  for (const pagePath of MAP_PAGES) {
    test(`${pagePath}: every registered/available slider across full range`, async ({
      page,
    }) => {
      test.setTimeout(180_000);

      const pageErrors: Error[] = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      await page.goto(pagePath);
      await waitForPageReady(page);

      // Initial mount must not already be broken.
      await assertStillMounted(page, pagePath, '(initial)', Number.NaN);
      expect(
        pageErrors,
        failLabel(pagePath, '(initial)', Number.NaN, `pageerror on load: ${pageErrors[0]?.message}`)
      ).toEqual([]);

      const playback = page.getByTestId('playback-controls');
      const hasPlayback = (await playback.count()) > 0;
      const registered = hasPlayback ? await listPlaybackParams(page) : [];

      if (registered.length > 0) {
        await sweepViaPlayback(page, pagePath, pageErrors);
      } else {
        // CML has ParamSliders but no PlaybackProvider; complex has raw ranges
        // and an empty registry. Direct range sweep still exercises the page.
        await sweepDirectRanges(page, pagePath, pageErrors);
      }

      expect(
        pageErrors,
        failLabel(
          pagePath,
          '(final)',
          Number.NaN,
          `accumulated pageerrors: ${pageErrors.map((e) => e.message).join(' | ')}`
        )
      ).toEqual([]);
    });
  }
});
