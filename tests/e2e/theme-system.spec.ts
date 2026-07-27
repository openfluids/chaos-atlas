import { test, expect } from '@playwright/test';

test.describe('Simple Theme System - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear context and localStorage to ensure fresh state
    await page.context().clearCookies();
    await page.goto('/');

    // Clear localStorage
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Reload page to ensure clean state
    await page.reload();

    // Wait for theme to be applied and components to load
    await page.waitForLoadState('networkidle');
  });

  test('main page loads with theme elements', async ({ page }) => {
    // Check main heading with neon text effect
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toContainText('Chaos Atlas');
    await expect(mainHeading).toHaveClass(/neon-text-cyan/);

    // Check theme switcher is present
    const themeSwitcher = page.locator('.theme-switcher');
    await expect(themeSwitcher).toBeVisible();

    // Check navigation entries are present and navigable. These are card
    // <Link> elements (app/page.tsx), not <button>s, and are not styled as
    // neon-buttons, so we only assert presence/navigability here.
    const diffusiveLink = page.locator('a[href^="/cml/diffusive"]');
    await expect(diffusiveLink).toBeVisible();

    const globalLink = page.locator('a[href^="/cml/global"]');
    await expect(globalLink).toBeVisible();
  });

  test('theme switcher functionality', async ({ page }) => {
    const themeSwitcher = page.locator('.theme-switcher');
    await expect(themeSwitcher).toBeVisible();

    // Wait a bit for theme to initialize
    await page.waitForTimeout(1000);

    // Check what theme is currently set on document
    const currentTheme = await page.locator('html').getAttribute('data-theme');
    console.log('Current theme:', currentTheme);

    // Check if any theme button is active
    const activeButtons = page.locator('button[aria-checked="true"]');
    const activeCount = await activeButtons.count();
    console.log('Active buttons count:', activeCount);

    // Check what theme is actually set and use that as baseline
    let expectedTheme = currentTheme || 'black-white';
    console.log('Expected theme:', expectedTheme);

    // Find the button for the current theme
    let activeThemeButton: any;
    if (expectedTheme === 'black-white') {
      activeThemeButton = page.locator('button:has-text("Black & White")');
    } else if (expectedTheme === 'neon-vintage') {
      activeThemeButton = page.locator('button:has-text("Neon Vintage")');
    } else {
      activeThemeButton = page.locator('button:has-text("Blue Tron")');
    }

    // If no button is active, click the expected theme button to set it
    if (activeCount === 0) {
      await activeThemeButton.click();
      await page.waitForTimeout(500);
    }

    // Now the expected theme should be active
    await expect(activeThemeButton).toHaveAttribute('aria-checked', 'true');

    // Switch to a different theme for testing
    const blueTronButton = page.locator('button:has-text("Blue Tron")');
    await blueTronButton.click();

    // Verify theme switched
    await expect(blueTronButton).toHaveAttribute('aria-checked', 'true');
    await expect(activeThemeButton).toHaveAttribute('aria-checked', 'false');

    // Check document theme attribute
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'blue-tron');
  });

  test('all three themes are available', async ({ page }) => {
    const themeSwitcher = page.locator('.theme-switcher');
    await expect(themeSwitcher).toBeVisible();

    // Check all three themes are present
    const blackWhiteButton = page.locator('button:has-text("Black & White")');
    const neonVintageButton = page.locator('button:has-text("Neon Vintage")');
    const blueTronButton = page.locator('button:has-text("Blue Tron")');

    await expect(blackWhiteButton).toBeVisible();
    await expect(neonVintageButton).toBeVisible();
    await expect(blueTronButton).toBeVisible();
  });

  test('navigation to CML pages works', async ({ page }) => {
    // Test CML Diffusive navigation
    const diffusiveLink = page.locator('a[href^="/cml/diffusive"]');
    await diffusiveLink.click();
    await expect(page).toHaveURL(/\/cml\/diffusive/);

    // Check CML Diffusive page content
    const diffusiveHeading = page.locator('h1');
    await expect(diffusiveHeading).toContainText('Coupled Map Lattice');

    // Go back home
    await page.goto('/');

    // Test CML Global navigation
    const globalLink = page.locator('a[href^="/cml/global"]');
    await globalLink.click();
    await expect(page).toHaveURL(/\/cml\/global/);

    // Check CML Global page content
    const globalHeading = page.locator('h1');
    await expect(globalHeading).toContainText('Global Coupled Map Lattice');
  });

  test('theme persistence across navigation', async ({ page }) => {
    // Switch to Black & White theme
    const blackWhiteButton = page.locator('button:has-text("Black & White")');
    await blackWhiteButton.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'black-white');

    // Navigate to about page
    const aboutButton = page.locator('a[href^="/about"]');
    await aboutButton.click();
    await expect(page).toHaveURL(/\/about/);

    // Verify theme persists
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'black-white');

    // Check theme switcher reflects current theme
    const activeThemeButton = page.locator('button[aria-checked="true"]');
    await expect(activeThemeButton).toContainText('Black & White');
  });

  test('keyboard navigation accessibility', async ({ page }) => {
    // Test Tab navigation through theme switcher
    await page.keyboard.press('Tab');

    // Focus should be on first interactive element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Test Arrow key navigation in theme switcher
    const themeSwitcher = page.locator('.theme-switcher button').first();
    await themeSwitcher.focus();

    // Use arrow keys to navigate themes
    await page.keyboard.press('ArrowRight');

    // Verify focus moved
    const newFocusedElement = page.locator(':focus');
    await expect(newFocusedElement).toBeVisible();
  });

  test('responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check mobile layout
    const mainTitle = page.locator('h1');
    await expect(mainTitle).toBeVisible();

    // Check theme switcher adapts to mobile
    const themeSwitcher = page.locator('.theme-switcher');
    await expect(themeSwitcher).toBeVisible();

    // Check buttons are touch-friendly
    const buttons = page.locator('button');
    const firstButton = buttons.first();
    const boundingBox = await firstButton.boundingBox();

    // Buttons should be at least 44x44 for touch accessibility
    expect(boundingBox?.width).toBeGreaterThanOrEqual(44);
    expect(boundingBox?.height).toBeGreaterThanOrEqual(44);
  });

  test('about page navigation and content', async ({ page }) => {
    // Navigate to about page
    const aboutButton = page.locator('a[href^="/about"]');
    await aboutButton.click();
    await expect(page).toHaveURL(/\/about/);

    // Check about page content
    const aboutTitle = page.locator('h1');
    await expect(aboutTitle).toContainText('About Chaos Atlas');

    // Check theme switcher is present on about page
    const themeSwitcher = page.locator('.theme-switcher');
    await expect(themeSwitcher).toBeVisible();

    // Check back to home button
    const backButton = page.locator('a:has-text("← Back to Home")');
    await expect(backButton).toBeVisible();
  });

  test('map page h1 follows theme primary under Black & White (not salmon)', async ({ page }) => {
    // Map pages use MapPageLayout h1 with color: var(--text-accent).
    // Under Black & White, primary is #ffffff — never the legacy salmon #ff6b6b.
    await page.goto('/maps/logistic');
    await page.waitForLoadState('networkidle');

    const blackWhiteButton = page.locator('button:has-text("Black & White")');
    await blackWhiteButton.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'black-white');

    const result = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (!h1) return null;
      const computed = getComputedStyle(h1).color;
      const textAccent = getComputedStyle(document.documentElement)
        .getPropertyValue('--text-accent')
        .trim();
      const themePrimary = getComputedStyle(document.documentElement)
        .getPropertyValue('--tron-primary')
        .trim();
      return { computed, textAccent, themePrimary };
    });

    expect(result).not.toBeNull();
    // Bridged accent equals the theme primary (from ThemeColors, not a literal copy)
    expect(result!.textAccent.toLowerCase()).toBe(result!.themePrimary.toLowerCase());
    // Not the pre-bridge salmon default
    expect(result!.computed).not.toBe('rgb(255, 107, 107)');
    // Black & White primary is white
    expect(result!.computed).toBe('rgb(255, 255, 255)');
  });

  /**
   * Palette remap: Tailwind colour utilities must resolve through bridged theme
   * vars (app/globals.css @theme inline), not stock Tailwind palette values.
   * Asserted under two themes so a single-theme coincidence cannot pass.
   */
  for (const { path, label } of [
    { path: '/', label: 'home' },
    { path: '/about', label: 'about' },
  ]) {
    for (const { name, id } of [
      { name: 'Black & White', id: 'black-white' },
      { name: 'Blue Tron', id: 'blue-tron' },
    ]) {
      test(`palette tokens follow theme on ${label} under ${name}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        await page.locator(`button:has-text("${name}")`).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', id);
        // ThemeProvider injects a 300ms color transition on * during switches;
        // wait for it so getComputedStyle is not mid-interpolation.
        await page.waitForTimeout(350);

        const result = await page.evaluate(() => {
          const byClass = (token: string) =>
            Array.from(document.querySelectorAll<HTMLElement>('*')).find((el) =>
              el.classList.contains(token)
            );

          const grayEl = byClass('text-gray-300');
          const cyanEl = byClass('text-cyan-400');
          const borderEl = byClass('border-cyan-500/20');
          if (!grayEl || !cyanEl || !borderEl) {
            return {
              ok: false as const,
              missing: {
                gray: !grayEl,
                cyan: !cyanEl,
                border: !borderEl,
              },
            };
          }

          const grayColor = getComputedStyle(grayEl).color;
          const cyanColor = getComputedStyle(cyanEl).color;
          const borderColor = getComputedStyle(borderEl).borderTopColor;

          // Theme-derived expectations via probe elements (runtime var resolution).
          const probeGray = document.createElement('span');
          probeGray.style.color = 'var(--text-secondary)';
          document.body.appendChild(probeGray);
          const expectedGray = getComputedStyle(probeGray).color;
          probeGray.remove();

          const probeCyan = document.createElement('span');
          probeCyan.style.color = 'var(--accent-cyan)';
          document.body.appendChild(probeCyan);
          const expectedCyan = getComputedStyle(probeCyan).color;
          probeCyan.remove();

          const probeBorder = document.createElement('div');
          probeBorder.style.borderTopWidth = '1px';
          probeBorder.style.borderTopStyle = 'solid';
          // Match Tailwind v4 /20: color-mix with the opaque palette source.
          probeBorder.style.borderTopColor =
            'color-mix(in oklab, var(--accent-cyan) 20%, transparent)';
          document.body.appendChild(probeBorder);
          const expectedBorder = getComputedStyle(probeBorder).borderTopColor;
          probeBorder.remove();

          const parseAlpha = (color: string): number => {
            // rgba(r, g, b, a) or rgb(r g b / a) or color(srgb r g b / a)
            const slash = color.match(/\/\s*([0-9.]+)\s*\)/);
            if (slash) return parseFloat(slash[1]);
            const legacy = color.match(
              /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([0-9.]+)\s*\)/
            );
            if (legacy) return parseFloat(legacy[1]);
            // Fully opaque rgb(...) has alpha 1
            if (/^rgb\(/.test(color)) return 1;
            return NaN;
          };

          return {
            ok: true as const,
            grayColor,
            cyanColor,
            borderColor,
            expectedGray,
            expectedCyan,
            expectedBorder,
            borderAlpha: parseAlpha(borderColor),
          };
        });

        expect(result.ok, `missing tokens on ${path}: ${JSON.stringify(result)}`).toBe(
          true
        );
        if (!result.ok) return;

        // Stock Tailwind defaults that must NOT survive a theme remap.
        expect(result.grayColor).not.toBe('rgb(209, 213, 219)'); // gray-300
        expect(result.cyanColor).not.toBe('rgb(34, 211, 238)'); // cyan-400

        // Opacity modifier must not compound into invisibility, and must stay
        // a real alpha (opaque rgb → alpha 1.0 would also pass a lower bound alone).
        expect(result.borderAlpha).toBeGreaterThan(0.1);
        expect(result.borderAlpha).toBeLessThan(0.5);

        // Theme-derived equality.
        expect(result.grayColor).toBe(result.expectedGray);
        expect(result.cyanColor).toBe(result.expectedCyan);
        expect(result.borderColor).toBe(result.expectedBorder);
      });
    }
  }
});