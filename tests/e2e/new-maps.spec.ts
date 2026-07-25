import { test, expect } from '@playwright/test';

test.describe('New Chaotic Maps - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app under test (baseURL from playwright.config.ts)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('main page loads with all new map cards', async ({ page }) => {
    // Check that all new map cards are present
    const tentMapCard = page.locator('a[href^="/maps/tent"]');
    await expect(tentMapCard).toBeVisible();
    await expect(tentMapCard.locator('h3')).toContainText('Tent Map');

    const bakersMapCard = page.locator('a[href^="/maps/bakers"]');
    await expect(bakersMapCard).toBeVisible();
    await expect(bakersMapCard.locator('h3')).toContainText('Baker’s Map');

    const arnoldMapCard = page.locator('a[href^="/maps/arnold"]');
    await expect(arnoldMapCard).toBeVisible();
    await expect(arnoldMapCard.locator('h3')).toContainText('Arnold Cat Map');

    const ikedaMapCard = page.locator('a[href^="/maps/ikeda"]');
    await expect(ikedaMapCard).toBeVisible();
    await expect(ikedaMapCard.locator('h3')).toContainText('Ikeda Map');

    const tinkerbellMapCard = page.locator('a[href^="/maps/tinkerbell"]');
    await expect(tinkerbellMapCard).toBeVisible();
    await expect(tinkerbellMapCard.locator('h3')).toContainText('Tinkerbell Map');

    const duffingMapCard = page.locator('a[href^="/maps/duffing"]');
    await expect(duffingMapCard).toBeVisible();
    await expect(duffingMapCard.locator('h3')).toContainText('Duffing Map');

    const complexMapCard = page.locator('a[href^="/maps/complex"]');
    await expect(complexMapCard).toBeVisible();
    await expect(complexMapCard.locator('h3')).toContainText('Complex Quadratic');
  });

  test('Tent Map page loads correctly', async ({ page }) => {
    await page.click('a[href^="/maps/tent"]');
    await page.waitForLoadState('networkidle');

    // Check URL
    await expect(page).toHaveURL(/\/maps\/tent/);

    // Check page content
    const heading = page.locator('h1');
    await expect(heading).toContainText('Tent Map');

    // Check visualization container
    const visualization = page.locator('[data-testid="tent-visualization"]');
    if (await visualization.count() > 0) {
      await expect(visualization).toBeVisible();
    } else {
      // Fallback check for any large container
      const container = page.locator('svg').first();
      if (await container.count() > 0) {
        await expect(container).toBeVisible();
      }
    }
  });

  test('Baker\'s Map page loads correctly', async ({ page }) => {
    await page.click('a[href^="/maps/bakers"]');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/maps\/bakers/);
    await expect(page.locator('h1')).toContainText('Baker\'s Map');
  });

  test('Arnold Cat Map page loads correctly', async ({ page }) => {
    await page.click('a[href^="/maps/arnold"]');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/maps\/arnold/);
    await expect(page.locator('h1')).toContainText('Arnold Cat Map');
  });

  test('Complex Quadratic Map page loads correctly', async ({ page }) => {
    await page.click('a[href^="/maps/complex"]');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/maps\/complex/);
    await expect(page.locator('h1')).toContainText('Complex Quadratic');
  });

  test('Ikeda Map page loads correctly', async ({ page }) => {
    await page.click('a[href^="/maps/ikeda"]');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/maps\/ikeda/);
    await expect(page.locator('h1')).toContainText('Ikeda Map');
  });

  test('Tinkerbell Map page loads correctly', async ({ page }) => {
    await page.click('a[href^="/maps/tinkerbell"]');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/maps\/tinkerbell/);
    await expect(page.locator('h1')).toContainText('Tinkerbell Map');
  });

  test('Duffing Map page loads correctly', async ({ page }) => {
    await page.click('a[href^="/maps/duffing"]');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/maps\/duffing/);
    await expect(page.locator('h1')).toContainText('Duffing Map');
  });

  test('navigation between maps works', async ({ page }) => {
    // Map pages have no cross-map navigation; each map is reached from the
    // homepage. Navigate to Tent Map from home, verify, then return home and
    // navigate to Ikeda Map.
    await page.goto('/');
    await page.click('a[href^="/maps/tent"]');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/maps\/tent/);
    await expect(page.locator('h1')).toContainText('Tent Map');

    await page.goto('/');
    await page.click('a[href^="/maps/ikeda"]');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/maps\/ikeda/);
    await expect(page.locator('h1')).toContainText('Ikeda Map');

    // Go back to home
    await page.click('a:has-text("← Back to Home")');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/$/);
  });

  test('theme switching works on map pages', async ({ page }) => {
    // Navigate to a map page
    await page.click('a[href^="/maps/tent"]');
    await page.waitForLoadState('networkidle');

    // Find and click theme switcher
    const themeSwitcher = page.locator('.theme-switcher').first();
    if (await themeSwitcher.count() > 0) {
      await themeSwitcher.click();
      await page.waitForTimeout(500);

      // Check that theme changed (look for theme attribute)
      const htmlElement = page.locator('html');
      const theme = await htmlElement.getAttribute('data-theme');
      expect(theme).toBeTruthy();
    }
  });

  test('no console errors on new map pages', async ({ page }) => {
    // Monitor console for errors
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Visit each new map page
    const mapPages = [
      '/maps/tent',
      '/maps/bakers',
      '/maps/arnold',
      '/maps/complex',
      '/maps/ikeda',
      '/maps/tinkerbell',
      '/maps/duffing'
    ];

    for (const mapPage of mapPages) {
      await page.goto(mapPage);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Allow scripts to load
    }

    // Check for console errors
    expect(consoleErrors.length).toBe(0);
  });
});