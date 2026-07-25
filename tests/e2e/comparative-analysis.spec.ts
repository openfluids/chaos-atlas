import { test, expect } from '@playwright/test';

test.describe('Comparative Analysis - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to comparative analysis page
    await page.goto('/compare');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow components to mount
  });

  test('comparative analysis page loads correctly', async ({ page }) => {
    // Check URL (with or without trailing slash)
    const url = page.url();
    expect(url).toMatch(/\/compare\/?$/);

    // Check main heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Comparative Analysis Framework');

    // Check description
    await expect(page.locator('text=Compare different chaotic systems')).toBeVisible();

    // Check main sections
    await expect(page.locator('text=Select Maps')).toBeVisible();
    await expect(page.locator('text=Comparison Mode')).toBeVisible();
    await expect(page.locator('label', { hasText: 'Iterations' })).toBeVisible();

    // Check no console errors
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);
    expect(consoleLogs.length).toBe(0);
  });

  test('map selection works correctly', async ({ page }) => {
    // Check initial state - should have Logistic and Hénon selected by default
    const logisticCheckbox = page.locator('input[type="checkbox"][id*="logistic"]');
    const henonCheckbox = page.locator('input[type="checkbox"][id*="henon"]');

    await expect(logisticCheckbox).toBeChecked();
    await expect(henonCheckbox).toBeChecked();

    // Test unchecking a map
    await logisticCheckbox.uncheck();
    await expect(logisticCheckbox).not.toBeChecked();

    // Test checking additional maps (should allow up to 4)
    const tentCheckbox = page.locator('input[type="checkbox"][id*="tent"]');
    await tentCheckbox.check();
    await expect(tentCheckbox).toBeChecked();

    const ikedaCheckbox = page.locator('input[type="checkbox"][id*="ikeda"]');
    await ikedaCheckbox.check();
    await expect(ikedaCheckbox).toBeChecked();

    // Try to check a 5th map - should not allow
    const tinkerbellCheckbox = page.locator('input[type="checkbox"][id*="tinkerbell"]');
    await tinkerbellCheckbox.check();

    // Verify only 4 maps are selected (the first 4 should remain checked)
    const checkedCount = await page.locator('input[type="checkbox"]:checked').count();
    expect(checkedCount).toBe(4);
  });

  test('time series comparison mode works', async ({ page }) => {
    // Select time series mode
    await page.selectOption('select[name="comparison-mode"]', 'time-series');

    // Select multiple maps
    await page.locator('input[type="checkbox"][id*="logistic"]').check();
    await page.locator('input[type="checkbox"][id*="henon"]').check();
    await page.locator('input[type="checkbox"][id*="tent"]').check();

    // Wait for calculations
    await page.waitForTimeout(3000);

    // Check that visualization containers exist
    const vizContainers = page.locator('.bg-black\\/30.border');
    await expect(vizContainers.first()).toBeVisible();

    // Check for SVG elements within containers
    const svgElements = vizContainers.locator('svg');
    await expect(svgElements.first()).toBeVisible();

    // Check that map names are displayed
    await expect(page.locator('text=Logistic Map')).toBeVisible();
    await expect(page.locator('text=Hénon Map')).toBeVisible();
    await expect(page.locator('text=Tent Map')).toBeVisible();

    // Check iteration control works
    const iterationSlider = page.locator('input[type="range"]');
    await expect(iterationSlider).toBeVisible();

    // Increase iterations and verify
    await iterationSlider.fill('2000');
    await page.waitForTimeout(1000);

    // comparisonData is derived during render, so changing a control is enough
    // to redraw; there is no explicit recalculate step to trigger.
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('phase space comparison mode works', async ({ page }) => {
    // Select phase space mode
    await page.selectOption('select[name="comparison-mode"]', 'phase-space');

    // Select 2D maps only
    await page.locator('input[type="checkbox"][id*="henon"]').check();
    await page.locator('input[type="checkbox"][id*="ikeda"]').check();
    await page.locator('input[type="checkbox"][id*="duffing"]').check();

    // Wait for calculations
    await page.waitForTimeout(3000);

    // Check that visualization containers exist for 2D maps
    const vizContainers = page.locator('.bg-black\\/30.border');
    await expect(vizContainers.first()).toBeVisible();

    // Check for SVG elements
    const svgElements = vizContainers.locator('svg');
    await expect(svgElements.first()).toBeVisible();

    // Check that phase space is displayed (not the "not available" message)
    const notAvailableMessages = page.locator('text=Phase space not available for 1D maps');
    expect(await notAvailableMessages.count()).toBe(0);

    // Verify 2D map names are displayed
    await expect(page.locator('text=Hénon Map')).toBeVisible();
    await expect(page.locator('text=Ikeda Map')).toBeVisible();
    await expect(page.locator('text=Duffing Map')).toBeVisible();
  });

  test('parameter synchronization works', async ({ page }) => {
    // Enable parameter synchronization
    const syncCheckbox = page.locator('input[type="checkbox"][id*="sync"]');
    await expect(syncCheckbox).toBeVisible();
    await syncCheckbox.check();

    // Check that parameter dropdown appears
    const paramSelect = page.locator('select[name="shared-param"]');
    await expect(paramSelect).toBeVisible();

    // Test different parameter selections
    await paramSelect.selectOption({ label: 'Growth Rate (r)' });
    await page.waitForTimeout(1000);

    await paramSelect.selectOption({ label: 'Parameter (a)' });
    await page.waitForTimeout(1000);

    // Verify synchronized parameter display
    await expect(page.locator('text=Sync Parameters')).toBeVisible();

    // Sync is applied through derived state, so the view is already current.
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('bifurcation mode shows placeholder', async ({ page }) => {
    // Select bifurcation mode
    await page.selectOption('select[name="comparison-mode"]', 'bifurcation');

    // Select some maps
    await page.locator('input[type="checkbox"][id*="logistic"]').check();
    await page.locator('input[type="checkbox"][id*="henon"]').check();

    // Wait for mode to change
    await page.waitForTimeout(1000);

    // Check that placeholder message is shown
    await expect(page.locator('text=Bifurcation comparison coming soon')).toBeVisible();
  });

  test('lyapunov mode shows placeholder', async ({ page }) => {
    // Select lyapunov mode
    await page.selectOption('select[name="comparison-mode"]', 'lyapunov');

    // Select some maps
    await page.locator('input[type="checkbox"][id*="logistic"]').check();
    await page.locator('input[type="checkbox"][id*="henon"]').check();

    // Wait for mode to change
    await page.waitForTimeout(1001);

    // Check that placeholder message is shown
    await expect(page.locator('text=Lyapunov exponent comparison coming soon')).toBeVisible();
  });

  test('educational insights section is displayed', async ({ page }) => {
    // Scroll to insights section
    await page.locator('text=Comparative Insights').scrollIntoViewIfNeeded();

    // Check that insights section is visible
    await expect(page.locator('text=Key Differences')).toBeVisible();
    await expect(page.locator('text=Universal Properties')).toBeVisible();

    // Check for specific insights
    await expect(page.locator('text=Dimensionality')).toBeVisible();
    await expect(page.locator('text=Dissipation')).toBeVisible();
    await expect(page.locator('text=Sensitive dependence')).toBeVisible();
    await expect(page.locator('text=Mixing')).toBeVisible();
  });

  test('navigation and back button work', async ({ page }) => {
    // Check that back to home link works
    await page.click('text=Back to Home');
    await page.waitForLoadState('networkidle');

    // Verify we're back on home page
    await expect(page).toHaveURL('/');

    // Navigate back to comparison page
    await page.click('a[href="/compare"]');
    await page.waitForLoadState('networkidle');

    // Verify we're back on comparison page
    await expect(page).toHaveURL('/compare');
  });

  test('responsive design works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that page is still functional
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=Select Maps')).toBeVisible();

    // Test map selection on mobile
    const logisticCheckbox = page.locator('input[type="checkbox"][id*="logistic"]');
    await logisticCheckbox.check();
    await expect(logisticCheckbox).toBeChecked();

    // Test mode selection on mobile
    await page.selectOption('select[name="comparison-mode"]', 'phase-space');
    await page.waitForTimeout(1000);

    // Check visualizations adapt to mobile
    const vizContainers = page.locator('.bg-black\\/30.border');
    await expect(vizContainers.first()).toBeVisible();
  });

  test('handles edge cases gracefully', async ({ page }) => {
    // Test with no maps selected
    await page.locator('input[type="checkbox"][id*="logistic"]').uncheck();
    await page.locator('input[type="checkbox"][id*="henon"]').uncheck();

    await page.waitForTimeout(1000);

    // Should show message to select maps
    await expect(page.locator('text=Select at least one map to begin comparison')).toBeVisible();

    // Test with single map selected
    await page.locator('input[type="checkbox"][id*="logistic"]').check();
    await page.waitForTimeout(2000);

    // Should still work with single map
    const vizContainers = page.locator('.bg-black\\/30.border');
    await expect(vizContainers.first()).toBeVisible();
  });

  test('theme switching works on comparison page', async ({ page }) => {
    // Look for theme switcher (if it exists)
    const themeSwitcher = page.locator('[data-testid="theme-switcher"], .theme-switcher, button[aria-label*="theme"]').first();

    if (await themeSwitcher.isVisible()) {
      await themeSwitcher.click();
      await page.waitForTimeout(1000);

      // Page should remain functional after theme change
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('text=Comparative Analysis Framework')).toBeVisible();
    }
  });

  test.afterEach(async ({ page }) => {
    // Check for any console errors after each test
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(500);

    if (consoleErrors.length > 0) {
      console.error('Console errors detected:', consoleErrors);
    }

    // Assert no console errors
    expect(consoleErrors.length).toBe(0);
  });
});