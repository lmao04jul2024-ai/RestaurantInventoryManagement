/**
 * Canonical design tokens — single source of truth for ALL platforms.
 *
 * The web app mirrors these values into CSS variables (packages/web/src/app/globals.css)
 * and Tailwind maps those into utilities; the mobile app maps them into React Native
 * styles (packages/mobile/src/theme/tokens.ts).
 *
 * Keep palettes byte-identical across platforms when changing brand values:
 * Tenant.theme overrides flow through buildTenantTheme() so the Customization
 * Engine can re-brand every surface at runtime without rebuilding.
 */

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

/** Brand palettes (Tailwind constants — match globals.css exactly) */
export const brandPalette = {
  primary: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#F97316',
    600: '#EA580C',
    700: '#C2410C',
    800: '#9A3412',
    900: '#7C2D12',
  },
  secondary: {
    50: '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',
    700: '#0F766E',
    800: '#115E59',
    900: '#134E4A',
  },
} satisfies Record<string, ColorScale>;

export interface SemanticColors {
  /** Page/card background */
  surface: string;
  /** Muted background (inputs, dividers rows) */
  surfaceMuted: string;
  /** Primary text */
  contentDefault: string;
  /** Secondary text */
  contentMuted: string;
}

export const lightSemanticColors: SemanticColors = {
  surface: '#FFFFFF',
  surfaceMuted: '#FAFAF9',
  contentDefault: '#1C1917',
  contentMuted: '#78716C',
};

export const darkSemanticColors: SemanticColors = {
  surface: '#1C1917',
  surfaceMuted: '#292524',
  contentDefault: '#FAFAF9',
  contentMuted: '#A8A29E',
};

/** Functional colors shared by every platform (web has no vars for these yet) */
export const statusColors = {
  danger: { 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
  success: { 500: '#22C55E', 600: '#16A34A', 700: '#15803D' },
  warning: { 500: '#F59E0B', 600: '#D97706' },
} as const;

/** Spacing scale = multiples of 4 (matches Tailwind's rem scale × 16 ÷ mobile-dp) */
export const spacingScale = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const radii = {
  default: 8,
  card: 12,
  pill: 999,
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** `#RRGGBB` → `"R G B"` raw-triplet string, e.g. `#3B82F6` → `"59 130 246"`. */
export function hexToRgbTriplet(hex: string): string {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ].join(' ');
}

/** Returns a color in rgb()/rgba() form with 0–1 alpha appended. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbTriplet(hex).split(' ').map(Number);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Applies tenant branding (from Tenant.theme in the API payload) on top of the
 * default token set. Only shades near DEFAULT are shifted so gradients/scales
 * remain usable; full multi-shade generation lands with the Customization Engine.
 */
export interface TenantBrandInput {
  primaryColor?: string;
  secondaryColor?: string;
}

export function buildTenantTheme(theme?: TenantBrandInput): {
  primary: ColorScale;
  secondary: ColorScale;
} {
  if (!theme) return brandPalette;
  return {
    primary: theme.primaryColor
      ? { ...brandPalette.primary, 600: theme.primaryColor }
      : brandPalette.primary,
    secondary: theme.secondaryColor
      ? { ...brandPalette.secondary, 600: theme.secondaryColor }
      : brandPalette.secondary,
  };
}
