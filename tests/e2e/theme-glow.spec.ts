import { test, expect } from '@playwright/test';

/**
 * Glow layer must follow the active theme's glow config.
 *
 * Assertion map (both must fail if the fix is reverted):
 * 1. `--tron-glow-cyan` on documentElement:
 *    - Black & White → `none` (intensity 0). Catches hardcoded :root rgba
 *      in tron.css still winning over the theme map.
 *    - Neon Vintage / Blue Tron → non-empty and not `none`. Catches the
 *      map never emitting glow tokens (or always emitting none).
 * 2. Resolved `text-shadow` on a glow-classed element (h1.neon-text-cyan):
 *    under Black & White must be `none`. Catches vars set correctly but
 *    stylesheets still hardcoding a shadow, or cascade ignoring the var.
 */
const THEMES = [
  { label: 'Black & White', id: 'black-white', expectGlow: false },
  { label: 'Neon Vintage', id: 'neon-vintage', expectGlow: true },
  { label: 'Blue Tron', id: 'blue-tron', expectGlow: true },
] as const;

test.describe('Theme glow tokens', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  for (const theme of THEMES) {
    test(`${theme.label}: --tron-glow-cyan is ${theme.expectGlow ? 'active' : 'none'}`, async ({
      page,
    }) => {
      await page.locator(`button:has-text("${theme.label}")`).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);

      const cyan = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--tron-glow-cyan')
          .trim()
      );

      if (theme.expectGlow) {
        expect(cyan.length).toBeGreaterThan(0);
        expect(cyan).not.toBe('none');
      } else {
        expect(cyan).toBe('none');
      }
    });
  }

  test('Black & White: glow-classed element has text-shadow none', async ({ page }) => {
    await page.locator('button:has-text("Black & White")').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'black-white');

    const heading = page.locator('h1.neon-text-cyan, h1').first();
    await expect(heading).toBeVisible();

    const textShadow = await heading.evaluate((el) =>
      getComputedStyle(el).textShadow
    );

    // Browsers report "none" for no shadow.
    expect(textShadow === 'none' || textShadow === '').toBe(true);
  });
});
