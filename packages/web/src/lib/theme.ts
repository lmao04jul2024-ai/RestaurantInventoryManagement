/**
 * Week 13 — Theme engine foundation (13.1 tokens, 13.3 CSS-var generation,
 * 13.5 base templates, 13.6 persistence helpers).
 *
 * Single source of truth for every `--color-*` variable globals.css consumes
 * through tailwind.config.js. Values are raw RGB triplets ("234 88 12") so
 * Tailwind opacity utilities keep working. Everything here is pure and
 * unit-testable; the provider (theme-provider.tsx) just applies the output.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type PresetId = 'classic' | 'emerald' | 'sunset' | 'custom';
export type ShadeStep = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
export type Palette = Record<ShadeStep, string>;

export interface ThemePrefs {
  preset: PresetId;
  mode: ThemeMode;
  /** Base brand hexes for the `custom` preset (600 anchors). */
  custom?: { primary: string; secondary: string };
  /** Week 17 brand font — emitted as `--font-family-sans`; undefined = default stack. */
  font?: TenantFontId;
}

export const DEFAULT_THEME_PREFS: ThemePrefs = { preset: 'classic', mode: 'system' };

// ── Week 17 branding fonts & tenant theme document ──────────────────────────

/**
 * Web-safe stacks (no font files shipped); `inter` matches the globals.css
 * default. Mirrored server-side by tenantThemeSchema (validation.ts) —
 * keep the two unions in sync.
 */
export const FONT_OPTIONS = {
  inter: { label: 'Inter (default)', stack: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif" },
  georgia: { label: 'Georgia (classic serif)', stack: "Georgia, 'Times New Roman', serif" },
  trebuchet: { label: 'Trebuchet (friendly)', stack: "'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif" },
  mono: { label: 'Mono', stack: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
} as const;

export type TenantFontId = keyof typeof FONT_OPTIONS;
export const FONT_FAMILY_VAR = '--font-family-sans';

export interface TenantBranding {
  logoUrl?: string | null;
  fontFamily?: TenantFontId | null;
}

/** The `Tenant.theme` JSON document (API-validated by tenantThemeSchema). */
export interface TenantTheme {
  preset: PresetId;
  mode: ThemeMode;
  custom?: { primary: string; secondary: string };
  branding?: TenantBranding | null;
}

const STEPS: ShadeStep[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

// ── 13.5 Base theme templates ────────────────────────────────────────────────
// Brand palettes (Tailwind constants) — surfaces are shared, mode picks them.

const TEAL: Palette = {
  50: '240 253 250', 100: '204 251 241', 200: '153 246 228', 300: '94 234 212',
  400: '45 212 191', 500: '20 184 166', 600: '13 148 136', 700: '15 118 110',
  800: '17 94 89', 900: '19 78 74',
};
const EMERALD: Palette = {
  50: '236 253 245', 100: '209 250 229', 200: '167 243 208', 300: '110 231 183',
  400: '52 211 153', 500: '16 185 129', 600: '5 150 105', 700: '4 120 87',
  800: '6 95 70', 900: '6 78 59',
};
const AMBER: Palette = {
  50: '255 251 235', 100: '254 243 199', 200: '253 230 138', 300: '252 211 77',
  400: '251 191 36', 500: '245 158 11', 600: '217 119 6', 700: '180 83 9',
  800: '146 64 14', 900: '120 53 15',
};
const ORANGE: Palette = {
  50: '255 247 237', 100: '255 237 213', 200: '254 215 170', 300: '253 186 116',
  400: '251 146 60', 500: '249 115 22', 600: '234 88 12', 700: '194 65 12',
  800: '154 52 18', 900: '124 45 18',
};
const VIOLET: Palette = {
  50: '245 243 255', 100: '237 233 254', 200: '221 214 254', 300: '196 181 253',
  400: '167 139 250', 500: '139 92 246', 600: '124 58 237', 700: '109 40 217',
  800: '91 33 182', 900: '76 29 149',
};

export interface ThemePreset {
  name: string;
  primary: Palette;
  secondary: Palette;
}

export const PRESETS: Record<Exclude<PresetId, 'custom'>, ThemePreset> = {
  classic: { name: 'Classic Amber', primary: ORANGE, secondary: TEAL },
  emerald: { name: 'Emerald', primary: EMERALD, secondary: AMBER },
  sunset: { name: 'Sunset', primary: ORANGE, secondary: VIOLET },
};

// ── Semantic surfaces & gray scale (light + dark) ────────────────────────────

const LIGHT_SURFACES: Record<string, string> = {
  '--color-surface': '255 255 255',
  '--color-surface-muted': '250 250 249',
  '--color-content-default': '28 25 23',
  '--color-content-muted': '120 113 108',
};
const DARK_SURFACES: Record<string, string> = {
  '--color-surface': '28 25 23',
  '--color-surface-muted': '41 37 36',
  '--color-content-default': '250 250 249',
  '--color-content-muted': '168 162 158',
};

/** Warm stone ladder, mapped to vars so every gray-* utility flips. */
export const GRAYS_LIGHT: Record<string, string> = {
  '--color-gray-50': '250 250 249', '--color-gray-100': '245 245 244',
  '--color-gray-200': '231 229 228', '--color-gray-300': '214 211 209',
  '--color-gray-400': '168 162 158', '--color-gray-500': '120 113 108',
  '--color-gray-600': '87 83 78', '--color-gray-700': '68 64 60',
  '--color-gray-800': '41 37 36', '--color-gray-900': '28 25 23',
};
export const GRAYS_DARK: Record<string, string> = {
  '--color-gray-50': '41 37 36', '--color-gray-100': '41 37 36',
  '--color-gray-200': '68 64 60', '--color-gray-300': '87 83 78',
  '--color-gray-400': '120 113 108', '--color-gray-500': '168 162 158',
  '--color-gray-600': '168 162 158', '--color-gray-700': '214 211 209',
  '--color-gray-800': '231 229 228', '--color-gray-900': '245 245 244',
};

// ── 13.3 Custom palette generation (hex → 50–900 shade ladder) ──────────────

export function hexToRgbTriplets(hex: string): [number, number, number] {
  const m = hex.replace('#', '').trim();
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const table: Array<[number, number, number]> = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ];
  const [r, g, b] = table[seg];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Relative luminance proxy (0–255) — used by tests to assert shade order. */
export function luminance(triplets: string): number {
  const [r, g, b] = triplets.split(' ').map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Generates a 50–900 palette from one brand hex. The input IS the 600 anchor
 * (Tailwind DEFAULT); other steps walk a lightness ladder around it —
 * guaranteed monotonic, so contrast relationships stay predictable.
 */
export function buildPalette(hex: string): Palette {
  const [r, g, b] = hexToRgbTriplets(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const sat = Math.min(90, Math.max(35, Math.round(s)));
  const ladder: Record<ShadeStep, number> = {
    50: 97, 100: l + 43, 200: l + 35, 300: l + 27, 400: l + 18,
    500: l + 9, 600: l, 700: l - 8, 800: l - 16, 900: l - 24,
  };
  return STEPS.reduce((acc, step) => {
    const light = Math.min(97, Math.max(8, ladder[step]));
    const rgb = step === '600' ? [r, g, b] : hslToRgb(h, sat, light);
    acc[step] = rgb.join(' ');
    return acc;
  }, {} as Palette);
}

/**
 * Picks a readable text color for a background: dark stone on light fills,
 * white on dark fills (YIQ-style luminance threshold 160/255). Used for the
 * `--color-on-primary` / `--color-on-secondary` tokens so buttons stay legible
 * even when a tenant brands with a very light custom color (e.g. white).
 */
export function onColor(triplets: string): string {
  return luminance(triplets) > 160 ? '28 25 23' : '255 255 255';
}

// ── Variable assembly ────────────────────────────────────────────────────────

export function resolveIsDark(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  return mode === 'dark' || (mode === 'system' && systemPrefersDark);
}

function paletteFor(prefs: ThemePrefs): { primary: Palette; secondary: Palette } {
  if (prefs.preset === 'custom') {
    const c = prefs.custom ?? { primary: '#ea580c', secondary: '#0d9488' };
    return { primary: buildPalette(c.primary), secondary: buildPalette(c.secondary) };
  }
  const preset = PRESETS[prefs.preset];
  return { primary: preset.primary, secondary: preset.secondary };
}

/** Full `--color-*` map for the resolved theme (applied verbatim to :root). */
export function buildCssVariables(prefs: ThemePrefs, systemPrefersDark: boolean): Record<string, string> {
  const dark = resolveIsDark(prefs.mode, systemPrefersDark);
  const { primary, secondary } = paletteFor(prefs);
  return {
    ...STEPS.reduce((acc, step) => {
      acc[`--color-primary-${step}`] = primary[step];
      acc[`--color-secondary-${step}`] = secondary[step];
      return acc;
    }, {} as Record<string, string>),
    // Week 18 — contrast-aware text colors for brand fills (custom presets
    // can pick near-white brand colors; text must stay legible).
    '--color-on-primary': onColor(primary['600']),
    '--color-on-secondary': onColor(secondary['600']),
    ...(dark ? DARK_SURFACES : LIGHT_SURFACES),
    ...(dark ? GRAYS_DARK : GRAYS_LIGHT),
    // Week 17 — brand font rides along with the palette (undefined = CSS default).
    ...(prefs.font ? { [FONT_FAMILY_VAR]: FONT_OPTIONS[prefs.font].stack } : {}),
  };
}

// ── 13.6 Persistence ─────────────────────────────────────────────────────────

export const THEME_STORAGE_KEY = 'rms-theme';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidThemePrefs(value: unknown): value is ThemePrefs {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ThemePrefs>;
  const modes: ThemeMode[] = ['light', 'dark', 'system'];
  if (!modes.includes(v.mode as ThemeMode)) return false;
  const presets: PresetId[] = ['classic', 'emerald', 'sunset', 'custom'];
  if (!presets.includes(v.preset as PresetId)) return false;
  if (v.preset === 'custom') {
    const c = v.custom as ThemePrefs['custom'] | undefined;
    if (!c || !HEX_RE.test(c.primary) || !HEX_RE.test(c.secondary)) return false;
  }
  if (v.font !== undefined && !(v.font in FONT_OPTIONS)) return false;
  return true;
}

/** Parses + validates stored prefs; returns null for garbage/absent state. */
export function parseStoredTheme(raw: string | null): ThemePrefs | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidThemePrefs(parsed) ? (parsed as ThemePrefs) : null;
  } catch {
    return null;
  }
}

export function loadThemePrefs(): ThemePrefs | null {
  if (typeof window === 'undefined') return null;
  return parseStoredTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function saveThemePrefs(prefs: ThemePrefs): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * Week 17 — maps a published `Tenant.theme` document onto per-user ThemePrefs
 * (used by the provider's signed-in fallback and the console preview).
 * Returns null for absent/invalid documents so callers keep their defaults.
 */
export function tenantThemeToPrefs(theme: TenantTheme | null | undefined): ThemePrefs | null {
  if (!theme || typeof theme !== 'object') return null;
  const prefs: ThemePrefs = {
    preset: theme.preset,
    mode: theme.mode,
    ...(theme.custom ? { custom: theme.custom } : {}),
    ...(theme.branding?.fontFamily ? { font: theme.branding.fontFamily } : {}),
  };
  return isValidThemePrefs(prefs) ? prefs : null;
}

/**
 * Inline boot script (runs before first paint in the root layout): resolves
 * the stored mode against the OS preference and stamps `data-theme` on <html>
 * immediately — light OR dark — so the CSS `[data-theme='dark']` block can
 * flip surface/gray tokens with zero white-flash. Brand palettes apply at
 * hydration (classic === CSS defaults, so no visual jump).
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('${THEME_STORAGE_KEY}')||'null');var m=p&&p.mode||'system';var dark=m==='dark'||(m!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',dark?'dark':'light');}catch(e){}})()`;
