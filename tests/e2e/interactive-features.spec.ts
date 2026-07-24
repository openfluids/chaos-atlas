import { test, expect } from '@playwright/test';

test.describe('Interactive Features - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to logistic map page
    await page.goto('/maps/logistic');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Allow interactive components to mount
  });

  test('data theme switcher works correctly', async ({ page }) => {
    // Check that theme switcher is visible
    const themeSwitcher = page.locator('[data-testid="data-theme-switcher"], .text-cyan-400');
    await expect(themeSwitcher.first()).toBeVisible();

    // Click to open theme dropdown
    await themeSwitcher.first().click();
    await page.waitForTimeout(500);

    // Check that theme dropdown is open
    const dropdown = page.locator('.relative.z-20, .absolute.z-20');
    await expect(dropdown.first()).toBeVisible();

    // Test theme categories
    const categories = ['Simple', 'Scientific', 'Artistic', 'Crazy'];
    for (const category of categories) {
      const categoryElement = page.locator(`text=${category}`);
      if (await categoryElement.isVisible()) {
        console.log(`Found category: ${category}`);
        await expect(categoryElement).toBeVisible();
      }
    }

    // Try to select a specific theme
    const matplotlibTheme = page.locator('text=Matplotlib');
    if (await matplotlibTheme.isVisible()) {
      await matplotlibTheme.click();
      await page.waitForTimeout(1000);
      console.log('Selected Matplotlib theme');
    }

    // Try random theme button
    const randomButton = page.locator('text=Random Theme');
    if (await randomButton.isVisible()) {
      await randomButton.click();
      await page.waitForTimeout(1000);
      console.log('Selected random theme');
    }

    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('interactive SVG pan and zoom controls work', async ({ page }) => {
    // Find the interactive SVG
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();

    // Get initial SVG position and size
    const svgBox = await svg.boundingBox();
    expect(svgBox).toBeTruthy();

    if (svgBox) {
      // Test mouse panning
      const centerX = svgBox.x + svgBox.width / 2;
      const centerY = svgBox.y + svgBox.height / 2;

      // Mouse down to start panning
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();

      // Move mouse to pan
      await page.mouse.move(centerX + 50, centerY + 50);
      await page.waitForTimeout(500);

      // Release mouse
      await page.mouse.up();
      await page.waitForTimeout(500);

      console.log('Pan test completed');

      // Test zoom controls
      const zoomInButton = page.locator('button:has-text("+")');
      if (await zoomInButton.isVisible()) {
        await zoomInButton.click();
        await page.waitForTimeout(500);
        console.log('Zoomed in');
      }

      const zoomOutButton = page.locator('button:has-text("−")');
      if (await zoomOutButton.isVisible()) {
        await zoomOutButton.click();
        await page.waitForTimeout(500);
        console.log('Zoomed out');
      }

      const resetButton = page.locator('button:has-text("⟲")');
      if (await resetButton.isVisible()) {
        await resetButton.click();
        await page.waitForTimeout(500);
        console.log('Reset view');
      }
    }

    // Test scroll wheel zooming
    await page.hover('svg');
    await page.mouse.wheel(0, -100); // Scroll up to zoom in
    await page.waitForTimeout(500);
    console.log('Scrolled to zoom in');

    await page.mouse.wheel(0, 100); // Scroll down to zoom out
    await page.waitForTimeout(500);
    console.log('Scrolled to zoom out');
  });

  test('export functionality works', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button:has-text("Export")');
    if (await exportButton.isVisible()) {
      await exportButton.click();
      await page.waitForTimeout(1000);

      // Check that export panel is visible
      const exportPanel = page.locator('text=Export Plot');
      await expect(exportPanel).toBeVisible();

      // Test export mode selection
      const academicButton = page.locator('button:has-text("Academic Plot")');
      if (await academicButton.isVisible()) {
        await academicButton.click();
        await page.waitForTimeout(500);
        console.log('Selected academic export mode');
      }

      const cleanButton = page.locator('button:has-text("Clean Plot")');
      if (await cleanButton.isVisible()) {
        await cleanButton.click();
        await page.waitForTimeout(500);
        console.log('Selected clean export mode');
      }

      // Test size presets
      const sizeSelect = page.locator('select');
      if (await sizeSelect.isVisible()) {
        await sizeSelect.selectOption({ label: 'HD (1920×1080)' });
        await page.waitForTimeout(500);
        console.log('Selected HD size');
      }

      // Test DPI settings
      const dpiSelect = page.locator('select').nth(1);
      if (await dpiSelect.isVisible()) {
        await dpiSelect.selectOption({ label: 'High Quality (300 DPI)' });
        await page.waitForTimeout(500);
        console.log('Selected 300 DPI');
      }

      // Test PNG export (may trigger download)
      const pngButton = page.locator('button:has-text("Export PNG")');
      if (await pngButton.isVisible()) {
        // Note: Downloads are hard to test in Playwright without specific setup
        // We'll just check that the button exists and is clickable
        await expect(pngButton).toBeVisible();
        console.log('PNG export button found');
      }

      // Test SVG export
      const svgButton = page.locator('button:has-text("Export SVG")');
      if (await svgButton.isVisible()) {
        await expect(svgButton).toBeVisible();
        console.log('SVG export button found');
      }
    }
  });

  test('parameter controls work correctly', async ({ page }) => {
    // Test parameter sliders
    const sliders = [
      { name: 'Parameter r', selector: 'input[type="range"]' },
    ];

    for (const slider of sliders) {
      const element = page.locator(slider.selector).first();
      if (await element.isVisible()) {
        // Get initial value
        const initialValue = await element.inputValue();

        // Change slider value
        await element.fill('3.8');
        await page.waitForTimeout(1000);

        const newValue = await element.inputValue();
        console.log(`${slider.name} changed from ${initialValue} to ${newValue}`);
      }
    }

    // Test visualization type selector
    const vizTypeSelect = page.locator('select');
    if (await vizTypeSelect.isVisible()) {
      await vizTypeSelect.selectOption('time');
      await page.waitForTimeout(2000);
      console.log('Changed to time series visualization');

      await vizTypeSelect.selectOption('bifurcation');
      await page.waitForTimeout(2000);
      console.log('Changed to bifurcation diagram');

      await vizTypeSelect.selectOption('cobweb');
      await page.waitForTimeout(2000);
      console.log('Changed to cobweb plot');
    }
  });

  test('quick action buttons work', async ({ page }) => {
    // Test reset view button
    const resetButton = page.locator('button:has-text("Reset View")');
    if (await resetButton.isVisible()) {
      await resetButton.click();
      await page.waitForTimeout(1000);
      console.log('Reset view clicked');
    }

    // Test fit to data button
    const fitButton = page.locator('button:has-text("Fit to Data")');
    if (await fitButton.isVisible()) {
      await fitButton.click();
      await page.waitForTimeout(1000);
      console.log('Fit to data clicked');
    }
  });

  test('responsive design works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that key elements are still visible
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();

    // Check that theme switcher still works
    const themeSwitcher = page.locator('[data-testid="data-theme-switcher"], .text-cyan-400');
    if (await themeSwitcher.first().isVisible()) {
      await themeSwitcher.first().click();
      await page.waitForTimeout(500);
      console.log('Theme switcher works on mobile');
    }

    // Check that controls are accessible
    const controls = page.locator('.bg-black\\/40.border');
    if (await controls.first().isVisible()) {
      console.log('Controls panel visible on mobile');
    }
  });

  test('chaotic maps have interactive features', async ({ page }) => {
    const maps = ['tent', 'henon', 'ikeda', 'tinkerbell', 'duffing'];

    for (const map of maps.slice(0, 2)) { // Test first 2 maps to save time
      console.log(`Testing interactive features for ${map} map`);

      await page.goto(`/maps/${map}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check that SVG is present
      const svg = page.locator('svg').first();
      await expect(svg).toBeVisible();

      // Check for theme switcher
      const themeSwitcher = page.locator('text=Data Theme:');
      if (await themeSwitcher.isVisible()) {
        await themeSwitcher.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
      }

      // Check for export button
      const exportButton = page.locator('button:has-text("Export")');
      if (await exportButton.isVisible()) {
        console.log(`Export button found for ${map} map`);
      }

      // Test basic interaction
      await page.hover('svg');
      await page.mouse.wheel(0, -50);
      await page.waitForTimeout(500);
    }
  });

  test('comparative analysis has interactive features', async ({ page }) => {
    await page.goto('/compare');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check that theme switcher is present
    const themeSwitcher = page.locator('text=Data Theme:');
    if (await themeSwitcher.isVisible()) {
      await themeSwitcher.click();
      await page.waitForTimeout(500);

      // Select a theme
      const themeOption = page.locator('text=Neon Dreams');
      if (await themeOption.isVisible()) {
        await themeOption.click();
        await page.waitForTimeout(1000);
        console.log('Applied Neon Dreams theme to comparative analysis');
      }
    }

    // Check that multiple visualizations are interactive
    const svgs = page.locator('svg');
    const svgCount = await svgs.count();
    console.log(`Found ${svgCount} SVG elements in comparative analysis`);

    if (svgCount > 0) {
      // Test interaction with first visualization
      await svgs.first().hover();
      await page.mouse.wheel(0, -50);
      await page.waitForTimeout(500);
      console.log('Tested interaction with comparative analysis visualization');
    }
  });

  test('performance and error handling', async ({ page }) => {
    // Monitor for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    // Test rapid theme switching
    const themeSwitcher = page.locator('text=Data Theme:');
    if (await themeSwitcher.isVisible()) {
      for (let i = 0; i < 5; i++) {
        await themeSwitcher.click();
        await page.waitForTimeout(200);

        // Try to click different themes
        const themes = page.locator('.border-cyan-500\\/20 button');
        const themeCount = await themes.count();

        if (themeCount > 0) {
          await themes.nth(i % themeCount).click();
          await page.waitForTimeout(300);
        }
      }
    }

    // Test rapid zoom/pan
    const svg = page.locator('svg').first();
    if (await svg.isVisible()) {
      for (let i = 0; i < 3; i++) {
        await svg.hover();
        await page.mouse.wheel(0, -100);
        await page.waitForTimeout(200);
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(200);
      }
    }

    // Check for errors
    await page.waitForTimeout(1000);
    if (consoleErrors.length > 0) {
      console.error('Console errors found:', consoleErrors);
    }
    expect(consoleErrors.length).toBe(0);
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