import { test, expect } from '@playwright/test';

/**
 * Playback is mounted once in MapPageLayout. These two pages exercise the
 * registry path end-to-end: ParamSliders self-register, controls drive the
 * first param, readout moves while playing and freezes on pause.
 */
async function playAndAssertMotion(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  // Visualizations + self-registering sliders need a moment to mount.
  await page.waitForSelector('[data-testid="playback-controls"]', {
    timeout: 30_000,
  });
  const play = page.getByTestId('playback-play-pause');
  await expect(play).toBeEnabled({ timeout: 15_000 });

  const readout = page.getByTestId('playback-value');
  const before = (await readout.textContent())?.trim() ?? '';

  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');

  // Parameter must move within a few seconds of wall clock.
  await expect
    .poll(
      async () => (await readout.textContent())?.trim() ?? '',
      { timeout: 8_000, intervals: [200, 400, 800] },
    )
    .not.toBe(before);

  const mid = (await readout.textContent())?.trim() ?? '';
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');

  // Hold still after pause — sample twice with a gap.
  await page.waitForTimeout(800);
  const paused1 = (await readout.textContent())?.trim() ?? '';
  await page.waitForTimeout(800);
  const paused2 = (await readout.textContent())?.trim() ?? '';
  expect(paused1).toBe(paused2);
  // And it had moved while playing.
  expect(mid).not.toBe(before);
}

test.describe('Playback controls', () => {
  test('logistic: play advances readout, pause freezes it', async ({ page }) => {
    await page.goto('/maps/logistic');
    await playAndAssertMotion(page);
  });

  test('henon: play advances readout, pause freezes it', async ({ page }) => {
    await page.goto('/maps/henon');
    await playAndAssertMotion(page);
  });

  test('henon: stays responsive over 10s of play with readout advancing', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/maps/henon');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="playback-controls"]', {
      timeout: 30_000,
    });

    const play = page.getByTestId('playback-play-pause');
    await expect(play).toBeEnabled({ timeout: 15_000 });

    const readout = page.getByTestId('playback-value');
    const before = (await readout.textContent())?.trim() ?? '';
    expect(before.length).toBeGreaterThan(0);
    expect(before).not.toBe('—');

    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'true');

    // Wall-clock play: rate is (max-min)/10s at 1×, so the playhead wraps
    // every PLAYBACK_SWEEP_SECONDS. Sampling only the 10 s endpoint can land
    // back on the start value (1.4 → full range → 1.4). Assert mid-play
    // motion, then that the page is still alive after a full 10 s.
    await page.waitForTimeout(3_000);
    const mid = (await readout.textContent({ timeout: 5_000 }))?.trim() ?? '';
    expect(mid).not.toBe(before);
    expect(mid).not.toBe('—');

    await page.waitForTimeout(7_000);

    // Page must still respond to normal DOM reads (no main-thread wedge).
    const after = (await readout.textContent({ timeout: 5_000 }))?.trim() ?? '';
    const pressed = await play.getAttribute('aria-pressed', { timeout: 5_000 });
    const fpsText = (await page.getByTestId('playback-fps').textContent())?.trim() ?? '';

    expect(pressed).toBe('true');
    expect(after).not.toBe('—');
    // Optional signal for the report: fps HUD still readable after 10 s.
    expect(fpsText.length).toBeGreaterThan(0);

    // Still interactive: pause must take effect without timing out.
    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'false', { timeout: 10_000 });
  });

  // Regression: live-site crash for Hénon a ≥ 1.5 (orbit escapes → NaN
  // domain → createImageData(NaN) → React unmounts the page).
  test('henon: divergent a keeps the page alive and shows escape notice', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/maps/henon');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="playback-controls"]', {
      timeout: 30_000,
    });

    // Parameter a is the first ParamSlider range input (not the scrubber).
    const aSlider = page
      .locator('input[type="range"]:not([data-testid="playback-scrubber"])')
      .first();
    await aSlider.fill('1.6');
    await expect(aSlider).toHaveValue('1.6');

    // Give the density re-render a beat; previously this unmounted everything.
    await page.waitForTimeout(1_500);

    await expect(page.getByTestId('playback-controls')).toBeVisible();
    await expect(page.getByTestId('playback-play-pause')).toBeVisible();
    await expect(page.getByTestId('orbit-escape-notice')).toBeVisible();
    await expect(page.getByTestId('orbit-escape-notice')).toContainText(
      /orbit escapes to infinity/i
    );
    expect(pageErrors).toEqual([]);
  });
});
