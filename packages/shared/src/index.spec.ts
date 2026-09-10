/**
 * Behavioral pins for the canonical token library.
 * These encode CURRENT documented behavior — including deliberate
 * pass-throughs (e.g. unvalidated tenant colors) so regressions surface.
 */
import {
  brandPalette,
  buildTenantTheme,
  darkSemanticColors,
  hexToRgbTriplet,
  lightSemanticColors,
  radii,
  spacingScale,
  statusColors,
  withAlpha,
} from './index';

describe('hexToRgbTriplet', () => {
  it('converts 6-digit hex to space-separated triplet', () => {
    // #E11D48 -> 225 29 72
    expect(hexToRgbTriplet('#E11D48')).toBe('225 29 72');
    // #3B82F6 -> 59 130 246
    expect(hexToRgbTriplet('#3B82F6')).toBe('59 130 246');
  });

  it('treats lower/upper case digits identically', () => {
    expect(hexToRgbTriplet('#e11d48')).toBe(hexToRgbTriplet('#E11D48'));
  });

  it('rejects malformed colors loudly', () => {
    expect(() => hexToRgbTriplet('not-a-color')).toThrow(/Invalid hex color/);
    expect(() => hexToRgbTriplet('#12345')).toThrow();
  });
});

describe('withAlpha', () => {
  it('emits spaced rgba form', () => {
    expect(withAlpha('#3B82F6', 0.25)).toBe('rgba(59, 130, 246, 0.25)');
  });

  it('composes directly on top of hexToRgbTriplet', () => {
    // Implementation splits the spaced triplet and rejoins with ", ".
    expect(withAlpha('#E11D48', 0.5)).toBe('rgba(225, 29, 72, 0.5)');
  });
});

describe('buildTenantTheme', () => {
  it('returns the canonical brand palette when unbranded', () => {
    // Identity return documented: zero-copy reuse of brandPalette.
    expect(buildTenantTheme()).toBe(brandPalette);
    expect(buildTenantTheme({}).primary[600]).toBe(brandPalette.primary[600]);
  });

  it('shifts ONLY the 600 shade toward tenant branding while preserving the rest of the scale', () => {
    const theme = buildTenantTheme({ primaryColor: '#E11D48' });

    expect(theme.primary[600]).toBe('#E11D48');
    expect(theme.primary[500]).toBe(brandPalette.primary[500]);
    expect(Object.keys(theme.primary)).toEqual(Object.keys(brandPalette.primary));
  });

  it('leaves secondary untouched unless separately branded', () => {
    const theme = buildTenantTheme({ primaryColor: '#E11D48' });
    expect(theme.secondary).toEqual(brandPalette.secondary);
  });

  it('passes colors through unvalidated (validation lives upstream in the Customization Engine)', () => {
    const theme = buildTenantTheme({ primaryColor: 'not-a-color' });
    expect(theme.primary[600]).toBe('not-a-color');
  });
});

describe('semantic palettes', () => {
  it('light and dark surfaces differ at the documented anchors', () => {
    expect(lightSemanticColors.surface).not.toBe(darkSemanticColors.surface);
    expect(lightSemanticColors.surface).toBe('#FFFFFF');
    expect(darkSemanticColors.surface).toBe('#1C1917');
  });
});

describe('spacingScale & radii integrity', () => {
  it('matches documented scale steps', () => {
    expect(spacingScale.xs).toBe(4);
    expect(spacingScale.sm).toBe(8);
    expect(spacingScale.md).toBe(12);
    expect(spacingScale.lg).toBe(16);
    expect(spacingScale.xl).toBe(24);
  });

  it('radii pill caps at 999', () => {
    expect(radii.pill).toBe(999);
  });

  it('status colors expose functional ramps', () => {
    expect(statusColors.danger[500]).toBe('#EF4444');
    expect(statusColors.success[500]).toBe('#22C55E');
  });
});
