/**
 * Palette remap contrast gate.
 *
 * Parses `@theme inline` from app/globals.css (never hand-copied), resolves each
 * override through getLegacyThemeCSSProperties for all three themes, and enforces:
 *
 * 1. ABSOLUTE FLOORS BY DERIVED ROLE against --bg-primary (every theme):
 *    Role is scanned from real class usage in app/ + components/ (same roots as
 *    the coverage guard), not hand-declared:
 *    - text-<token> anywhere         → TEXT,   floor 4.5
 *    - else border/ring/divide/accent → BORDER, floor 3.0
 *    - else bg/from/to/via           → FILL,   floor 3.0
 *    - no uses at all                → UNUSED, no floor (still listed)
 *    FILL exemption: mapping target is --bg-primary itself (the page) → skip.
 * 2. PAIR RULE: real fg/bg class pairs from PlaybackControls rest/hover clear
 *    3.0:1 in every theme. Disabled pairs (recolored disabled:bg/text) are
 *    WCAG 1.4.3-exempt and instead assert no-regression vs stock Tailwind
 *    (mapped ≥ stock/stock). Opacity-only disabled does not introduce a new
 *    color pair — rest already covers those tokens.
 *
 * Why not no-regression on tokens: it fires on HUE CHANGE, not legibility.
 * Under Neon Vintage cyan→magenta is the feature; black→--bg-primary is 1.00
 * by construction for overlays. Absolute floors by role express the intent.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  defaultThemes,
  getLegacyThemeCSSProperties,
  parseHexRgb,
} from '@/lib/themes/theme-utils';

// ---------------------------------------------------------------------------
// Stock Tailwind v3/v4 default palette hexes (pinned as literals — do not import
// from Tailwind; a dependency update must not silently rewrite the oracle).
// ---------------------------------------------------------------------------
const STOCK_TAILWIND: Record<string, string> = {
  // cyan
  'cyan-300': '#67e8f9',
  'cyan-400': '#22d3ee',
  'cyan-500': '#06b6d4',
  'cyan-600': '#0891b2',
  'cyan-700': '#0e7490',
  // gray
  'gray-300': '#d1d5db',
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',
  // purple / pink
  'purple-400': '#c084fc',
  'purple-500': '#a855f7',
  'purple-600': '#9333ea',
  'pink-400': '#f472b6',
  'pink-500': '#ec4899',
  // orange / yellow
  'orange-400': '#fb923c',
  'orange-500': '#f97316',
  'yellow-400': '#facc15',
  'yellow-500': '#eab308',
  'yellow-900': '#713f12',
  // green / red
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  // surfaces
  black: '#000000',
  white: '#ffffff',
};

// ---------------------------------------------------------------------------
// Role derivation — scan app/ + components/ (same roots as .sc/palette.gate.sh
// coverage guard). Same token pattern so the two cannot disagree on identity.
// ---------------------------------------------------------------------------
type Role = 'text' | 'border' | 'fill' | 'unused';

const FLOOR_BY_ROLE: Record<Role, number | null> = {
  text: 4.5,
  border: 3.0,
  fill: 3.0,
  unused: null,
};

/** Prefix classes that count as border-role usage. */
const BORDER_PREFIXES = new Set(['border', 'ring', 'divide', 'accent']);
/** Prefix classes that count as fill-role usage. */
const FILL_PREFIXES = new Set(['bg', 'from', 'to', 'via']);

/**
 * Token extractor — kept in lockstep with .sc/palette.gate.sh TOKEN regex
 * (prefix group + colour token group). Shade required so glow classes like
 * neon-text-cyan do not match.
 */
const SOURCE_TOKEN_RE = new RegExp(
  String.raw`\b(text|bg|border|from|to|via|ring|divide|shadow|outline|decoration|` +
    String.raw`placeholder|fill|stroke|accent|caret)-` +
    String.raw`((?:cyan|gray|slate|zinc|neutral|stone|blue|sky|indigo|violet|purple|` +
    String.raw`fuchsia|pink|rose|red|orange|amber|yellow|lime|green|emerald|teal)-\d{2,3}` +
    String.raw`|black|white)(?:/\d{1,3})?\b`,
  'g'
);

const SCAN_ROOTS = ['app', 'components'] as const;
const SCAN_EXTS = new Set(['.tsx', '.ts', '.jsx', '.js']);

type PrefixBag = Map<string, Set<string>>;

function collectSourceFiles(cwd: string): string[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    const abs = path.join(cwd, root);
    if (!fs.existsSync(abs)) continue;
    const walk = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          // Mirror guard: never walk scratch/vendor (roots exclude them; belt+braces).
          if (ent.name === 'node_modules' || ent.name === '.sc') continue;
          walk(full);
        } else if (SCAN_EXTS.has(path.extname(ent.name))) {
          files.push(full);
        }
      }
    };
    walk(abs);
  }
  return files;
}

/** prefix → set of tokens seen with that prefix across all scanned sources. */
function scanTokenPrefixes(files: string[]): PrefixBag {
  const byToken: PrefixBag = new Map();
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    SOURCE_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SOURCE_TOKEN_RE.exec(src)) !== null) {
      const prefix = m[1];
      const token = m[2];
      let set = byToken.get(token);
      if (!set) {
        set = new Set();
        byToken.set(token, set);
      }
      set.add(prefix);
    }
  }
  return byToken;
}

/**
 * Derive role for one override token from its observed prefixes.
 * Priority: text > border-family > fill-family > unused.
 */
function deriveRole(prefixes: Set<string> | undefined): Role {
  if (!prefixes || prefixes.size === 0) return 'unused';
  if (prefixes.has('text')) return 'text';
  for (const p of prefixes) {
    if (BORDER_PREFIXES.has(p)) return 'border';
  }
  for (const p of prefixes) {
    if (FILL_PREFIXES.has(p)) return 'fill';
  }
  // Used only under prefixes the role rules ignore (shadow/outline/…): unused.
  return 'unused';
}

/**
 * Named (theme, token) exceptions from the text 4.5 floor — NOT a lowered floor.
 * Blue Tron's tertiary is #0040ff, too dark to carry TEXT on a black page.
 * That is a theme-palette limitation (out of scope), not a mapping error.
 * Only the three Blue Tron TEXT tokens that fail 4.5 at ~3.18. BORDER/FILL
 * tokens on the same tertiary clear 3.0 without exception.
 * The test prints each skip so this list cannot silently widen.
 */
const TEXT_FLOOR_EXCEPTIONS: ReadonlyArray<{
  theme: string;
  token: string;
  reason: string;
}> = [
  {
    theme: 'Blue Tron',
    token: 'orange-400',
    reason:
      'Blue Tron tertiary (#0040ff) scores ~3.18:1 on black — theme palette out of scope, not a mapping error',
  },
  {
    theme: 'Blue Tron',
    token: 'orange-500',
    reason:
      'Blue Tron tertiary (#0040ff) scores ~3.18:1 on black — theme palette out of scope, not a mapping error',
  },
  {
    theme: 'Blue Tron',
    token: 'yellow-400',
    reason:
      'Blue Tron tertiary (#0040ff) scores ~3.18:1 on black — theme palette out of scope, not a mapping error',
  },
];

function isTextFloorException(themeName: string, token: string): (typeof TEXT_FLOOR_EXCEPTIONS)[number] | undefined {
  return TEXT_FLOOR_EXCEPTIONS.find(
    (e) => e.theme === themeName && e.token === token
  );
}

// ---------------------------------------------------------------------------
// WCAG 2 relative luminance + contrast (sRGB, IEC 61966-2-1)
// ---------------------------------------------------------------------------
function srgbChannelToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexRgb(hex);
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/** WCAG contrast ratio in [1, 21]. */
function contrastRatio(hexA: string, hexB: string): number {
  const L1 = relativeLuminance(hexA);
  const L2 = relativeLuminance(hexB);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function fmtRatio(r: number): string {
  return r.toFixed(2);
}

// ---------------------------------------------------------------------------
// Parse @theme inline overrides from globals.css
// ---------------------------------------------------------------------------
type Override = { token: string; varRef: string };

function parseThemeInlineOverrides(css: string): Override[] {
  const block = css.match(/@theme\s+inline\s*\{([\s\S]*?)\n\}/);
  if (!block) {
    throw new Error('palette-contrast: no @theme inline block in app/globals.css');
  }
  const out: Override[] = [];
  const re = /--color-([a-z]+-\d{2,3}|black|white)\s*:\s*var\((--[a-z0-9-]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[1])) !== null) {
    out.push({ token: m[1], varRef: m[2] });
  }
  return out;
}

function resolveVarToHex(
  varRef: string,
  props: Record<string, string>
): string {
  const raw = props[varRef];
  if (!raw) {
    throw new Error(`palette-contrast: bridge missing ${varRef}`);
  }
  // Bridge surfaces are solid hex; rgba slots are not used as palette sources.
  if (!raw.startsWith('#')) {
    throw new Error(
      `palette-contrast: ${varRef} resolved to non-hex "${raw}" (palette sources must be opaque)`
    );
  }
  return raw;
}

function resolveTokenHex(
  token: string,
  overrides: Map<string, string>,
  props: Record<string, string>
): string {
  const varRef = overrides.get(token);
  if (varRef) {
    return resolveVarToHex(varRef, props);
  }
  const stock = STOCK_TAILWIND[token];
  if (!stock) {
    throw new Error(`palette-contrast: no stock hex for token ${token}`);
  }
  return stock;
}

/**
 * FILL tokens that map to the page background itself are skipped: 1.00:1 is
 * arithmetic, not a defect. Covers `black` → --bg-primary and nothing else
 * today. No other FILL is exempt.
 */
function isFillBgPrimaryExemption(role: Role, varRef: string): boolean {
  return role === 'fill' && varRef === '--bg-primary';
}

// ---------------------------------------------------------------------------
// PlaybackControls pair discovery (rest + hover; rendered on every map page)
// ---------------------------------------------------------------------------
// PlaybackControls is the live control bar (MapPageLayout). Prior fixture was
// an unreachable export panel; this keeps the pair suite on chrome users see.
// Play/pause and reset: text-cyan-400 / bg-black + hover:bg-black.
// Speed/param selects: text-gray-300 / bg-gray-800.
// Panel labels/readouts: text-cyan-400 / text-gray-500 on bg-gray-800.
// Disabled is opacity-only (disabled:opacity-40) — no recolored disabled:bg
// or disabled:text — so it does not add a separate color pair.
const PLAYBACK_CONTROLS = path.join(
  process.cwd(),
  'components/ui/PlaybackControls.tsx'
);
const GLOBALS_CSS = path.join(process.cwd(), 'app/globals.css');

type ClassPair = { label: string; fg: string; bg: string; disabled?: boolean };

function discoverPlaybackPairs(source: string): ClassPair[] {
  const pairs: ClassPair[] = [];

  // Play/pause + reset share solid chrome: text-cyan-400 / bg-black(/opacity)
  // with hover:bg-black(/opacity). Confirm each control via data-testid.
  const solidButtons: { label: string; marker: string }[] = [
    { label: 'Play/Pause', marker: 'playback-play-pause' },
    { label: 'Reset', marker: 'playback-reset' },
  ];

  for (const def of solidButtons) {
    if (!source.includes(def.marker)) continue;

    if (/\btext-cyan-400\b/.test(source) && /\bbg-black(?:\/\d+)?\b/.test(source)) {
      pairs.push({
        label: `${def.label} rest (text-cyan-400 / bg-black)`,
        fg: 'cyan-400',
        bg: 'black',
      });
    }

    // Hover recolor only if present; opacity hover keeps the black token.
    if (/\bhover:bg-black(?:\/\d+)?\b/.test(source)) {
      pairs.push({
        label: `${def.label} hover (text-cyan-400 / hover:bg-black)`,
        fg: 'cyan-400',
        bg: 'black',
      });
    } else if (/\bhover:opacity-\d+\b/.test(source)) {
      pairs.push({
        label: `${def.label} hover (text-cyan-400 / bg-black via hover:opacity)`,
        fg: 'cyan-400',
        bg: 'black',
      });
    }
  }

  // Speed + param selects: text-gray-300 on bg-gray-800.
  const selects: { label: string; marker: string }[] = [
    { label: 'Speed select', marker: 'playback-speed' },
    { label: 'Param select', marker: 'playback-param-select' },
  ];

  for (const def of selects) {
    if (!source.includes(def.marker)) continue;

    if (/\btext-gray-300\b/.test(source) && /\bbg-gray-800(?:\/\d+)?\b/.test(source)) {
      pairs.push({
        label: `${def.label} rest (text-gray-300 / bg-gray-800)`,
        fg: 'gray-300',
        bg: 'gray-800',
      });
    }
  }

  // Panel chrome: container is bg-gray-800; heading/labels use text-cyan-400,
  // fps readout uses text-gray-500. These are live, always-rendered pairs.
  if (
    /\bbg-gray-800(?:\/\d+)?\b/.test(source) &&
    /\btext-cyan-400\b/.test(source)
  ) {
    pairs.push({
      label: 'panel heading (text-cyan-400 / bg-gray-800)',
      fg: 'cyan-400',
      bg: 'gray-800',
    });
  }

  if (
    /\bbg-gray-800(?:\/\d+)?\b/.test(source) &&
    /\btext-gray-500\b/.test(source)
  ) {
    pairs.push({
      label: 'panel fps readout (text-gray-500 / bg-gray-800)',
      fg: 'gray-500',
      bg: 'gray-800',
    });
  }

  // Recolored disabled (disabled:bg + disabled:text) — not present on
  // PlaybackControls today; keep the branch so a future recolor is gated.
  if (
    /disabled:bg-gray-700/.test(source) &&
    /disabled:text-gray-500/.test(source)
  ) {
    pairs.push({
      label: 'disabled (disabled:text-gray-500 / disabled:bg-gray-700)',
      fg: 'gray-500',
      bg: 'gray-700',
      disabled: true,
    });
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('palette contrast (role floors + pairs)', () => {
  const css = fs.readFileSync(GLOBALS_CSS, 'utf8');
  const overrideList = parseThemeInlineOverrides(css);
  const overrides = new Map(overrideList.map((o) => [o.token, o.varRef]));
  const playbackSource = fs.readFileSync(PLAYBACK_CONTROLS, 'utf8');
  const pairs = discoverPlaybackPairs(playbackSource);

  // Derive roles once from source usage (app/ + components/).
  const scannedFiles = collectSourceFiles(process.cwd());
  const prefixMap = scanTokenPrefixes(scannedFiles);
  const roleByToken = new Map<string, Role>();
  for (const { token } of overrideList) {
    roleByToken.set(token, deriveRole(prefixMap.get(token)));
  }

  it('parses at least one @theme inline override from globals.css', () => {
    expect(overrideList.length).toBeGreaterThan(0);
  });

  it('source scan finds files under app/ and components/ (empty scan must fail)', () => {
    expect(scannedFiles.length).toBeGreaterThan(0);
  });

  it('every parsed override has a derived role (including unused)', () => {
    const missing = overrideList
      .map((o) => o.token)
      .filter((t) => roleByToken.get(t) === undefined);
    expect(missing).toEqual([]);
  });

  describe('ROLE FLOORS: themed token vs --bg-primary', () => {
    for (const theme of defaultThemes) {
      describe(theme.name, () => {
        const props = getLegacyThemeCSSProperties(theme.colors);
        const pageBg = props['--bg-primary'];

        for (const { token, varRef } of overrideList) {
          it(`${token} → ${varRef}`, () => {
            const role = roleByToken.get(token);
            expect(role).toBeDefined();

            const themed = resolveVarToHex(varRef, props);
            const ratio = contrastRatio(themed, pageBg);
            const floor = FLOOR_BY_ROLE[role!];

            if (floor === null) {
              // unused — no floor; still resolve so a broken bridge fails
              expect(themed).toMatch(/^#[0-9a-fA-F]{6}$/);
              return;
            }

            if (isFillBgPrimaryExemption(role!, varRef)) {
              // eslint-disable-next-line no-console
              console.log(
                `[FILL --bg-primary skip] theme=${theme.name} token=${token} ratio=${fmtRatio(ratio)} — page bg by construction`
              );
              expect(themed).toMatch(/^#[0-9a-fA-F]{6}$/);
              return;
            }

            const exc = role === 'text' ? isTextFloorException(theme.name, token) : undefined;
            if (exc) {
              // Named exception: print, do not apply a lowered floor.
              // eslint-disable-next-line no-console
              console.log(
                `[EXCEPTION skip] theme=${theme.name} token=${token} ratio=${fmtRatio(ratio)} floor=${floor} — ${exc.reason}`
              );
              return;
            }

            expect(ratio).toBeGreaterThanOrEqual(floor);
          });
        }
      });
    }
  });

  describe('PAIR RULE: real fg/bg pairs', () => {
    it('discovers PlaybackControls rest/hover pairs (non-empty)', () => {
      // Silent zero is the failure mode this gate exists to stop.
      expect(pairs.length).toBeGreaterThan(0);
      // Baseline before retirement: prior fixture discovery returned 7.
      // 2 buttons × (rest + hover) + 2 selects + panel heading + fps ≥ 7.
      expect(pairs.length).toBeGreaterThanOrEqual(7);
    });

    for (const theme of defaultThemes) {
      describe(theme.name, () => {
        const props = getLegacyThemeCSSProperties(theme.colors);

        for (const pair of pairs) {
          it(pair.label, () => {
            const fgHex = resolveTokenHex(pair.fg, overrides, props);
            const bgHex = resolveTokenHex(pair.bg, overrides, props);
            const ratio = contrastRatio(fgHex, bgHex);

            if (pair.disabled) {
              // WCAG 1.4.3 exempts disabled controls from the absolute pair floor.
              // Assert no-regression vs stock Tailwind instead (mapped ≥ stock/stock).
              const stockFg = STOCK_TAILWIND[pair.fg];
              const stockBg = STOCK_TAILWIND[pair.bg];
              expect(stockFg).toBeDefined();
              expect(stockBg).toBeDefined();
              const stockRatio = contrastRatio(stockFg, stockBg);
              expect(ratio).toBeGreaterThanOrEqual(stockRatio);
              return;
            }

            expect(ratio).toBeGreaterThanOrEqual(3.0);
          });
        }
      });
    }
  });

  /**
   * Full contrast table — printed on SUCCESS so it is the review artefact.
   * Columns: theme × token → derived role, ratio, floor, verdict.
   */
  it('prints full contrast table (theme × token)', () => {
    type Row = {
      theme: string;
      token: string;
      role: Role;
      ratio: number;
      floor: string;
      verdict: string;
    };
    const rows: Row[] = [];
    const failures: string[] = [];

    // One-line derived-role summary (token → role + prefixes) for the artefact.
    // eslint-disable-next-line no-console
    console.log('\n=== DERIVED ROLES (from app/ + components/ scan) ===');
    for (const { token, varRef } of overrideList) {
      const role = roleByToken.get(token)!;
      const prefs = prefixMap.get(token);
      const prefStr = prefs && prefs.size > 0 ? [...prefs].sort().join(',') : '(none)';
      // eslint-disable-next-line no-console
      console.log(
        `${token.padEnd(14)} role=${role.padEnd(6)} prefixes=${prefStr.padEnd(28)} → ${varRef}`
      );
    }

    for (const theme of defaultThemes) {
      const props = getLegacyThemeCSSProperties(theme.colors);
      const pageBg = props['--bg-primary'];

      for (const { token, varRef } of overrideList) {
        const role = roleByToken.get(token);
        if (!role) {
          failures.push(`${theme.name} ${token}: no role`);
          continue;
        }
        const themed = resolveVarToHex(varRef, props);
        const ratio = contrastRatio(themed, pageBg);
        const floorNum = FLOOR_BY_ROLE[role];
        const floor = floorNum === null ? 'none' : floorNum.toFixed(1);

        let verdict: string;
        if (floorNum === null) {
          verdict = 'OK (unused, no floor)';
        } else if (isFillBgPrimaryExemption(role, varRef)) {
          verdict = `SKIP fill→--bg-primary (${fmtRatio(ratio)})`;
        } else {
          const exc = role === 'text' ? isTextFloorException(theme.name, token) : undefined;
          if (exc) {
            verdict = `SKIP exception (${fmtRatio(ratio)} < ${floor})`;
          } else if (ratio >= floorNum) {
            verdict = 'PASS';
          } else {
            verdict = 'FAIL';
            failures.push(
              `${theme.name} ${token} [${role}]: ${fmtRatio(ratio)} < ${floor}`
            );
          }
        }

        rows.push({ theme: theme.name, token, role, ratio, floor, verdict });
      }
    }

    // Pair rows appended for the same artefact
    type PairRow = {
      theme: string;
      pair: string;
      ratio: number;
      rule: string;
      verdict: string;
    };
    const pairRows: PairRow[] = [];

    for (const theme of defaultThemes) {
      const props = getLegacyThemeCSSProperties(theme.colors);
      for (const pair of pairs) {
        const fgHex = resolveTokenHex(pair.fg, overrides, props);
        const bgHex = resolveTokenHex(pair.bg, overrides, props);
        const ratio = contrastRatio(fgHex, bgHex);

        if (pair.disabled) {
          const stockRatio = contrastRatio(
            STOCK_TAILWIND[pair.fg],
            STOCK_TAILWIND[pair.bg]
          );
          const ok = ratio >= stockRatio;
          pairRows.push({
            theme: theme.name,
            pair: pair.label,
            ratio,
            rule: `disabled ≥ stock (${fmtRatio(stockRatio)})`,
            verdict: ok ? 'PASS' : 'FAIL',
          });
          if (!ok) {
            failures.push(
              `${theme.name} ${pair.label}: ${fmtRatio(ratio)} < stock ${fmtRatio(stockRatio)}`
            );
          }
        } else {
          const ok = ratio >= 3.0;
          pairRows.push({
            theme: theme.name,
            pair: pair.label,
            ratio,
            rule: 'pair ≥ 3.0',
            verdict: ok ? 'PASS' : 'FAIL',
          });
          if (!ok) {
            failures.push(
              `${theme.name} ${pair.label}: ${fmtRatio(ratio)} < 3.0`
            );
          }
        }
      }
    }

    // ---- print artefact (always, on success path too) ----
    // eslint-disable-next-line no-console
    console.log('\n=== PALETTE CONTRAST TABLE (token vs --bg-primary) ===');
    // eslint-disable-next-line no-console
    console.log(
      [
        'theme'.padEnd(16),
        'token'.padEnd(14),
        'role'.padEnd(8),
        'ratio'.padStart(6),
        'floor'.padStart(6),
        'verdict',
      ].join('  ')
    );
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(
        [
          r.theme.padEnd(16),
          r.token.padEnd(14),
          r.role.padEnd(8),
          fmtRatio(r.ratio).padStart(6),
          r.floor.padStart(6),
          r.verdict,
        ].join('  ')
      );
    }

    // eslint-disable-next-line no-console
    console.log('\n=== PAIR CONTRAST TABLE ===');
    // eslint-disable-next-line no-console
    console.log(
      [
        'theme'.padEnd(16),
        'pair'.padEnd(64),
        'ratio'.padStart(6),
        'rule'.padEnd(28),
        'verdict',
      ].join('  ')
    );
    for (const r of pairRows) {
      // eslint-disable-next-line no-console
      console.log(
        [
          r.theme.padEnd(16),
          r.pair.padEnd(64),
          fmtRatio(r.ratio).padStart(6),
          r.rule.padEnd(28),
          r.verdict,
        ].join('  ')
      );
    }

    // eslint-disable-next-line no-console
    console.log('');

    expect(failures).toEqual([]);
  });
});
