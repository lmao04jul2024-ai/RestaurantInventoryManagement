/**
 * Week 13 — Theme engine foundation (13.1 tokens, 13.3 CSS-var generation,
 * 13.5 base templates, 13.6 persistence helpers).
 *
 * Single source of truth for every `--color-*` variable globals.css consumes
 * through tailwind.config.js. Values are raw RGB triplets ("37 99 235") so
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
}

export const DEFAULT_THEME_PREFS: ThemePrefs = { preset: 'classic', mode: 'system' };

const STEPS: ShadeStep[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

// ── 13.5 Base theme templates ────────────────────────────────────────────────
// Brand palettes (Tailwind constants) — surfaces are shared, mode picks them.

const BLUE: Palette = {
  50: '239 246 255', 100: '219 234 254', 200: '191 219 254', 300: '147 197 253',
  400: '96 165 250', 500: '59 130 246', 600: '37 99 235', 700: '29 78 216',
  800: '30 64 175', 900: '30 58 138',
};
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
  classic: { name: 'Classic Blue', primary: BLUE, secondary: TEAL },
  emerald: { name: 'Emerald', primary: EMERALD, secondary: AMBER },
  sunset: { name: 'Sunset', primary: ORANGE, secondary: VIOLET },
};

// ── Semantic surfaces & gray scale (light + dark) ────────────────────────────

const LIGHT_SURFACES: Record<string, string> = {
  '--color-surface': '255 255 255',
  '--color-surface-muted': '249 250 251',
  '--color-content-default': '17 24 39',
  '--color-content-muted': '107 114 128',
};
const DARK_SURFACES: Record<string, string> = {
  '--color-surface': '17 24 39',
  '--color-surface-muted': '31 41 55',
  '--color-content-default': '249 250 251',
  '--color-content-muted': '156 163 175',
};

/** Tailwind cool-gray ladder, mapped to vars so every gray-* utility flips. */
export const GRAYS_LIGHT: Record<string, string> = {
  '--color-gray-50': '249 250 251', '--color-gray-100': '243 244 246',
  '--color-gray-200': '229 231 235', '--color-gray-300': '209 213 219',
  '--color-gray-400': '156 163 175', '--color-gray-500': '107 114 128',
  '--color-gray-600': '75 85 99', '--color-gray-700': '55 65 81',
  '--color-gray-800': '31 41 55', '--color-gray-900': '17 24 39',
};
export const GRAYS_DARK: Record<string, string> = {
  '--color-gray-50': '31 41 55', '--color-gray-100': '31 41 55',
  '--color-gray-200': '55 65 81', '--color-gray-300': '75 85 99',
  '--color-gray-400': '107 114 128', '--color-gray-500': '156 163 175',
  '--color-gray-600': '156 163 175', '--color-gray-700': '209 213 219',
  '--color-gray-800': '229 231 235', '--color-gray-900': '243 244 246',
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

// ── Variable assembly ────────────────────────────────────────────────────────

export function resolveIsDark(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  return mode === 'dark' || (mode === 'system' && systemPrefersDark);
}

function paletteFor(prefs: ThemePrefs): { primary: Palette; secondary: Palette } {
  if (prefs.preset === 'custom') {
    const c = prefs.custom ?? { primary: '#2563eb', secondary: '#0d9488' };
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
    ...(dark ? DARK_SURFACES : LIGHT_SURFACES),
    ...(dark ? GRAYS_DARK : GRAYS_LIGHT),
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
 * Inline boot script (runs before first paint in the root layout): resolves
 * the stored mode against the OS preference and stamps `data-theme` on <html>
 * immediately — light OR dark — so the CSS `[data-theme='dark']` block can
 * flip surface/gray tokens with zero white-flash. Brand palettes apply at
 * hydration (classic === CSS defaults, so no visual jump).
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('${THEME_STORAGE_KEY}')||'null');var m=p&&p.mode||'system';var dark=m==='dark'||(m!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',dark?'dark':'light');}catch(e){}})()`;
