/**
 * Unit tests for the legacy :root CSS variable bridge in theme-utils.
 *
 * Independent pins are hand-computed from defaultThemes colours (sRGB blend /
 * alpha composite arithmetic) — never recomputed with the production helpers
 * and never copied from a test run.
 */
import {
  applyThemeCSSProperties,
  blendHexToward,
  defaultThemes,
  getLegacyThemeCSSProperties,
  hexWithAlpha,
  LEGACY_MUTED_BLEND,
  LEGACY_SURFACE_BLEND,
  parseHexRgb,
  removeThemeCSSProperties,
  resolveRgbaOverBackground,
  rgbChannelDistance,
} from '@/lib/themes/theme-utils';

describe('hexWithAlpha', () => {
  it('preserves alpha on a 6-digit hex', () => {
    expect(hexWithAlpha('#000000', 0.7)).toBe('rgba(0, 0, 0, 0.7)');
    expect(hexWithAlpha('#ff00ff', 0.3)).toBe('rgba(255, 0, 255, 0.3)');
  });

  it('expands 3-digit hex', () => {
    expect(hexWithAlpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });
});

describe('blendHexToward', () => {
  it('returns from at fraction 0 and toward at fraction 1', () => {
    expect(blendHexToward('#000000', '#ffffff', 0)).toBe('#000000');
    expect(blendHexToward('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('blends midway', () => {
    expect(blendHexToward('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  /**
   * Hand pin: Black & White surface path.
   * from #000000=(0,0,0), toward #333333=(51,51,51), fraction 0.18
   * channel = round(0 + 51*0.18) = round(9.18) = 9 → #090909
   */
  it('independent pin: B&W bg→border at 0.18 is #090909', () => {
    expect(blendHexToward('#000000', '#333333', 0.18)).toBe('#090909');
  });
});

describe('getLegacyThemeCSSProperties — independent surface pins', () => {
  it('LEGACY_SURFACE_BLEND stays at the designed 0.18', () => {
    expect(LEGACY_SURFACE_BLEND).toBe(0.18);
  });

  /**
   * Black & White: bg #000000, border #333333
   * surface = blend(bg→border, 0.18) = #090909  (hand: round(51*0.18)=9)
   * --bg-card = rgba(9, 9, 9, 0.7)
   * resolve over #000000: round(9*0.7)=6 → [6, 6, 6]
   */
  it('Black & White --bg-card is rgba(9, 9, 9, 0.7) and resolves to [6,6,6]', () => {
    const colors = defaultThemes.find((t) => t.themeId === 'black-white')!.colors;
    const props = getLegacyThemeCSSProperties(colors);

    expect(props['--bg-secondary']).toBe('#090909');
    expect(props['--bg-card']).toBe('rgba(9, 9, 9, 0.7)');
    expect(resolveRgbaOverBackground(props['--bg-card'], colors.background)).toEqual([
      6, 6, 6,
    ]);
  });

  /**
   * Blue Tron: bg #000000, border #0066cc=(0,102,204)
   * surface: r=0, g=round(102*0.18)=round(18.36)=18, b=round(204*0.18)=round(36.72)=37
   * → #001225
   * --bg-card = rgba(0, 18, 37, 0.7)
   * resolve over #000: g=round(12.6)=13, b=round(25.9)=26 → [0, 13, 26]
   */
  it('Blue Tron --bg-card is rgba(0, 18, 37, 0.7) and resolves to [0,13,26]', () => {
    const colors = defaultThemes.find((t) => t.themeId === 'blue-tron')!.colors;
    const props = getLegacyThemeCSSProperties(colors);

    expect(props['--bg-secondary']).toBe('#001225');
    expect(props['--bg-card']).toBe('rgba(0, 18, 37, 0.7)');
    expect(resolveRgbaOverBackground(props['--bg-card'], colors.background)).toEqual([
      0, 13, 26,
    ]);
  });

  /**
   * Load-bearing proof for LEGACY_SURFACE_BLEND: a zero blend would make the
   * solid surface equal to background. The map must not do that.
   */
  it('LEGACY_SURFACE_BLEND is load-bearing: surfaces are not plain background', () => {
    expect(LEGACY_SURFACE_BLEND).toBeGreaterThan(0);
    for (const theme of defaultThemes) {
      const props = getLegacyThemeCSSProperties(theme.colors);
      const bg = theme.colors.background;
      expect(props['--bg-secondary']).not.toBe(bg);
      // Zero blend + alpha would still be pure bg channels under opaque composite.
      expect(props['--bg-card']).not.toBe(hexWithAlpha(bg, 0.7));
      expect(props['--bg-header']).not.toBe(hexWithAlpha(bg, 0.8));
    }
  });
});

describe('getLegacyThemeCSSProperties — --text-muted derivation', () => {
  it('LEGACY_MUTED_BLEND is 0.4', () => {
    expect(LEGACY_MUTED_BLEND).toBe(0.4);
  });

  /**
   * Hand pins: muted = blend(textSecondary → background, 0.4)
   *
   * Black & White: #dddddd=(221,221,221) → #000000
   *   round(221 + (0-221)*0.4) = round(132.6) = 133 → #858585
   *
   * Neon Vintage: #cccccc=(204,204,204) → #0a0a0a=(10,10,10)
   *   round(204 + (10-204)*0.4) = round(126.4) = 126 → #7e7e7e
   *
   * Blue Tron: #cccccc=(204,204,204) → #000000
   *   round(204*0.6) = round(122.4) = 122 → #7a7a7a
   *
   * Also: muted must NOT equal tertiary (Blue Tron tertiary is #0040ff).
   */
  it.each([
    ['black-white', '#858585'],
    ['neon-vintage', '#7e7e7e'],
    ['blue-tron', '#7a7a7a'],
  ] as const)('%s --text-muted is %s (not tertiary)', (themeId, expectedMuted) => {
    const theme = defaultThemes.find((t) => t.themeId === themeId)!;
    const props = getLegacyThemeCSSProperties(theme.colors);
    expect(props['--text-muted']).toBe(expectedMuted);
    expect(props['--text-muted']).not.toBe(theme.colors.tertiary);
    // tertiary still bridges viz/accent slots
    expect(props['--viz-tertiary']).toBe(theme.colors.tertiary);
    expect(props['--accent-orange']).toBe(theme.colors.tertiary);
  });
});

describe('getLegacyThemeCSSProperties — structural map', () => {
  it('maps --text-accent to colors.primary for every default theme', () => {
    for (const theme of defaultThemes) {
      const props = getLegacyThemeCSSProperties(theme.colors);
      expect(props['--text-accent']).toBe(theme.colors.primary);
    }
  });

  it('keeps legacy alphas on card/header/footer and border/viz slots', () => {
    const colors = defaultThemes[0].colors;
    const props = getLegacyThemeCSSProperties(colors);
    // Alpha only — colour channels covered by independent pins above.
    expect(props['--bg-card']).toMatch(/^rgba\(\d+, \d+, \d+, 0\.7\)$/);
    expect(props['--bg-header']).toMatch(/^rgba\(\d+, \d+, \d+, 0\.8\)$/);
    expect(props['--bg-footer']).toMatch(/^rgba\(\d+, \d+, \d+, 0\.8\)$/);
    expect(props['--border-primary']).toBe(hexWithAlpha(colors.border, 0.3));
    expect(props['--border-secondary']).toBe(hexWithAlpha(colors.primary, 0.3));
    expect(props['--viz-grid']).toBe(hexWithAlpha(colors.secondary, 0.2));
    expect(props['--viz-area']).toBe(hexWithAlpha(colors.primary, 0.3));
  });

  it('card/header/footer/secondary resolve measurably distinct from --bg-primary on every theme', () => {
    expect(LEGACY_SURFACE_BLEND).toBeGreaterThan(0);
    const MIN_DISTANCE = 8;

    for (const theme of defaultThemes) {
      const props = getLegacyThemeCSSProperties(theme.colors);
      const bg = props['--bg-primary'];
      expect(bg).toBe(theme.colors.background);
      const bgRgb = parseHexRgb(bg);

      const secondaryRgb = parseHexRgb(props['--bg-secondary']);
      expect(rgbChannelDistance(secondaryRgb, bgRgb)).toBeGreaterThan(MIN_DISTANCE);

      for (const slot of ['--bg-card', '--bg-header', '--bg-footer'] as const) {
        const resolved = resolveRgbaOverBackground(props[slot], bg);
        const dist = rgbChannelDistance(resolved, bgRgb);
        expect(dist).toBeGreaterThan(MIN_DISTANCE);
        expect(props[slot]).not.toBe(bg);
        expect(props[slot]).not.toBe(hexWithAlpha(theme.colors.background, 0.7));
        expect(props[slot]).not.toBe(hexWithAlpha(theme.colors.background, 0.8));
      }

      expect(props['--bg-secondary']).not.toBe(bg);
    }
  });
});

describe('applyThemeCSSProperties — full legacy bridge', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.documentElement;
    root.removeAttribute('style');
    root.removeAttribute('data-theme');
  });

  afterEach(() => {
    removeThemeCSSProperties(root);
    root.removeAttribute('style');
  });

  it.each(defaultThemes.map((t) => [t.themeId, t] as const))(
    'sets every bridged legacy variable for theme %s from actual ThemeColors',
    (_id, theme) => {
      applyThemeCSSProperties(theme, root);

      const effectiveGlow = theme.accessibility.reducedGlow
        ? { ...theme.glow, intensity: 0 }
        : theme.glow;
      const expected = getLegacyThemeCSSProperties(theme.colors, effectiveGlow);
      for (const [prop, value] of Object.entries(expected)) {
        expect(root.style.getPropertyValue(prop)).toBe(value);
      }

      expect(root.style.getPropertyValue('--text-accent')).toBe(theme.colors.primary);
    }
  );

  it('--text-accent differs between Black & White and Blue Tron', () => {
    const blackWhite = defaultThemes.find((t) => t.themeId === 'black-white');
    const blueTron = defaultThemes.find((t) => t.themeId === 'blue-tron');
    expect(blackWhite).toBeDefined();
    expect(blueTron).toBeDefined();

    applyThemeCSSProperties(blackWhite!, root);
    const accentBW = root.style.getPropertyValue('--text-accent');
    expect(accentBW).toBe(blackWhite!.colors.primary);

    applyThemeCSSProperties(blueTron!, root);
    const accentTron = root.style.getPropertyValue('--text-accent');
    expect(accentTron).toBe(blueTron!.colors.primary);

    expect(accentBW).not.toBe(accentTron);
    expect(blackWhite!.colors.primary).not.toBe(blueTron!.colors.primary);
  });

  it('removeThemeCSSProperties clears legacy bridge vars as well as --tron-*', () => {
    const theme = defaultThemes[0];
    applyThemeCSSProperties(theme, root);

    expect(root.style.getPropertyValue('--text-accent')).toBe(theme.colors.primary);
    expect(root.style.getPropertyValue('--tron-primary')).toBe(theme.colors.primary);

    removeThemeCSSProperties(root);

    expect(root.style.getPropertyValue('--text-accent')).toBe('');
    expect(root.style.getPropertyValue('--bg-card')).toBe('');
    expect(root.style.getPropertyValue('--viz-grid')).toBe('');
    expect(root.style.getPropertyValue('--tron-primary')).toBe('');
    expect(root.style.getPropertyValue('--tron-glow-cyan')).toBe('');
    expect(root.getAttribute('data-theme')).toBeNull();
  });
});

describe('getLegacyThemeCSSProperties — glow tokens', () => {
  it('Black & White (intensity 0) emits none for all eight --tron-glow-* slots', () => {
    const theme = defaultThemes.find((t) => t.themeId === 'black-white')!;
    const props = getLegacyThemeCSSProperties(theme.colors, theme.glow);
    for (const key of [
      '--tron-glow-cyan',
      '--tron-glow-orange',
      '--tron-glow-magenta',
      '--tron-glow-yellow',
      '--tron-glow-cyan-hover',
      '--tron-glow-orange-hover',
      '--tron-glow-magenta-hover',
      '--tron-glow-yellow-hover',
    ] as const) {
      expect(props[key]).toBe('none');
    }
  });

  it('Neon Vintage and Blue Tron emit non-empty, non-none cyan glow from primary', () => {
    for (const themeId of ['neon-vintage', 'blue-tron'] as const) {
      const theme = defaultThemes.find((t) => t.themeId === themeId)!;
      const props = getLegacyThemeCSSProperties(theme.colors, theme.glow);
      const cyan = props['--tron-glow-cyan'];
      expect(cyan).toBeTruthy();
      expect(cyan).not.toBe('none');
      expect(cyan).toContain('rgba');
      // Derived from primary + intensity via hexWithAlpha (not a hardcoded palette).
      expect(cyan).toBe(
        `0 0 ${theme.glow.blurRadius} ${hexWithAlpha(theme.colors.primary, theme.glow.intensity)}`
      );
    }
  });

  it('applyThemeCSSProperties zeros glow when accessibility.reducedGlow is true', () => {
    const root = document.documentElement;
    root.removeAttribute('style');
    const base = defaultThemes.find((t) => t.themeId === 'blue-tron')!;
    const reduced = {
      ...base,
      accessibility: { ...base.accessibility, reducedGlow: true },
    };
    applyThemeCSSProperties(reduced, root);
    expect(root.style.getPropertyValue('--tron-glow-cyan')).toBe('none');
    expect(root.style.getPropertyValue('--tron-glow-intensity')).toBe('0');
    removeThemeCSSProperties(root);
    root.removeAttribute('style');
  });
});
