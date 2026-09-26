import { expect, test, type Page } from '@playwright/test';

/**
 * Logistic page, time-series view, iterations at the slider maximum (200),
 * x0 = 0.2.
 *
 * dynachaos zero_one_statistic on that series (atlas convention r*x*(1-x)):
 *   r = 4   → K = 0.984
 *   r = 3.2 → K = 0.077
 * x0 = 0.5 at r = 4 is the preperiodic trap (0.5 → 1 → 0 → 0) and K = 0,
 * so the spec must leave the default seed. Cobweb draws only min(iterations, 20)
 * steps, which is too short (r = 3.2, N = 50 already gives K = 0.41), so the
 * spec uses the time-series view the page already draws.
 *
 * Thresholds 0.75 and 0.25 sit in the gap between 0.984 and 0.077. They are
 * not the fixture tolerances; those live in the jest parity test.
 */
const CHAOTIC_K_MIN = 0.75;
const REGULAR_K_MAX = 0.25;

const MAP_PAGES = [
  '/maps/arnold/',
  '/maps/bakers/',
  '/maps/complex/',
  '/maps/duffing/',
  '/maps/henon/',
  '/maps/ikeda/',
  '/maps/logistic/',
  '/maps/standard/',
  '/maps/tent/',
  '/maps/tinkerbell/',
];

test.describe.configure({ mode: 'serial' });

async function setRange(page: Page, index: number, value: string): Promise<void> {
  const slider = page.locator('input[type="range"]:not([data-testid="playback-scrubber"])').nth(index);
  await slider.fill(value);
  await expect(slider).toHaveValue(value);
}

test('diagnostics panel is present on all 10 map pages', async ({ page }) => {
  test.setTimeout(180_000);
  for (const path of MAP_PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const panel = page.getByTestId('diagnostics-panel');
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('diagnostics-label')).toContainText(
      /computed by dynachaos-wasm \d+\.\d+\.\d+, the kernels of the dynachaos paper/,
    );
  }
});

test('logistic cobweb is too short for K', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/maps/logistic/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('diagnostics-panel')).toBeVisible();
  await expect(page.getByTestId('diagnostics-series')).toContainText('Cobweb Plot');
  await expect(page.getByTestId('diagnostics-k')).toContainText(/series too short \(N = \d+\)/);
});

test('Ikeda power spectrum has no time series', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/maps/ikeda/');
  await page.waitForLoadState('networkidle');
  await page.locator('select:has(option[value="spectrum"])').selectOption('spectrum');
  await expect(page.getByTestId('diagnostics-series')).toHaveText('no time series in this view', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('diagnostics-k')).toHaveText('—');
  await expect(page.getByTestId('diagnostics-d2')).toHaveText('—');
  await expect(page.getByTestId('diagnostics-pe')).toHaveText('—');
});

test('Duffing potential has no time series', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/maps/duffing/');
  await page.waitForLoadState('networkidle');
  await page.locator('select:has(option[value="potential"])').selectOption('potential');
  await expect(page.getByTestId('diagnostics-series')).toHaveText('no time series in this view', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('diagnostics-k')).toHaveText('—');
});

test('logistic r=4 has K near 1 and r=3.2 has K near 0', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/maps/logistic/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('diagnostics-panel')).toBeVisible();

  await page.locator('.logistic-map-visualization select').selectOption('time');
  await setRange(page, 1, '0.2');
  await setRange(page, 2, '200');
  await setRange(page, 0, '4');

  await expect
    .poll(async () => Number(await page.getByTestId('diagnostics-k').innerText()), {
      timeout: 30_000,
      intervals: [200, 400, 800],
    })
    .toBeGreaterThan(CHAOTIC_K_MIN);

  await setRange(page, 0, '3.2');
  await expect
    .poll(async () => Number(await page.getByTestId('diagnostics-k').innerText()), {
      timeout: 30_000,
      intervals: [200, 400, 800],
    })
    .toBeLessThan(REGULAR_K_MAX);
});
