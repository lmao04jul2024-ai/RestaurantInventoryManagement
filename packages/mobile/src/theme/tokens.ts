/**
 * Maps the canonical design tokens (@restaurant/shared/src/tokens.ts) into a
 * React Native-flavored theme object. Web keeps its own CSS-variable layer in
 * sync; changing a value here starts at the shared package.
 */
import {
  brandPalette,
  buildTenantTheme,
  darkSemanticColors,
  lightSemanticColors,
  radii,
  spacingScale,
  statusColors,
  withAlpha,
  type ColorScale,
} from '@shared/tokens';
import { TextStyle } from 'react-native';

export const spacing = spacingScale;
export { radii, withAlpha };

export interface Typography {
  h1: TextStyle;
  h2: TextStyle;
  h3: TextStyle;
  body: TextStyle;
  bodySmall: TextStyle;
  caption: TextStyle;
}

const baseTypography: Typography = {
  h1: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '700', lineHeight: 28 },
  h3: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
};

export interface AppTheme {
  dark: boolean;
  /** Brand palettes (scales intact so gradients/shades stay usable) */
  primary: ColorScale;
  secondary: ColorScale;
  /** Functional colors */
  danger: typeof statusColors.danger;
  success: typeof statusColors.success;
  warning: typeof statusColors.warning;
  /** Semantics */
  surface: string;
  surfaceMuted: string;
  contentDefault: string;
  contentMuted: string;
  border: string;
  /** Primitives */
  spacing: typeof spacing;
  radii: typeof radii;
  typography: Typography;
  shadows: {
    card: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
      elevation: number;
    };
  };
}

export interface TenantBrandOverride {
  primaryColor?: string;
  secondaryColor?: string;
}

export function createAppTheme(
  options: { dark?: boolean; tenant?: TenantBrandOverride } = {},
): AppTheme {
  const { dark = false, tenant } = options;
  const palette = buildTenantTheme(tenant);
  const semantic = dark ? darkSemanticColors : lightSemanticColors;

  return {
    dark,
    primary: palette.primary,
    secondary: palette.secondary,
    danger: statusColors.danger,
    success: statusColors.success,
    warning: statusColors.warning,
    surface: semantic.surface,
    surfaceMuted: semantic.surfaceMuted,
    contentDefault: semantic.contentDefault,
    contentMuted: semantic.contentMuted,
    border: dark ? '#374151' : '#E5E7EB',
    spacing,
    radii,
    typography: baseTypography,
    shadows: {
      card: {
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      },
    },
  };
}
