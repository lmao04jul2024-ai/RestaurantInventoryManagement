import { createAppTheme } from './tokens';
import { brandPalette, darkSemanticColors, lightSemanticColors, spacingScale } from '@shared/tokens';

describe('createAppTheme (token mapping layer)', () => {
  it('defaults to the light canonical palette', () => {
    const theme = createAppTheme();

    expect(theme.dark).toBe(false);
    expect(theme.surface).toBe(lightSemanticColors.surface);
    expect(theme.border).toBe('#E5E7EB');
    expect(theme.primary).toEqual(brandPalette.primary);
  });

  it('switches semantic colors and border in dark mode', () => {
    const theme = createAppTheme({ dark: true });

    expect(theme.dark).toBe(true);
    expect(theme.surface).toBe(darkSemanticColors.surface);
    expect(theme.border).toBe('#374151');
  });

  it('propagates tenant branding through the shared buildTenantTheme pipeline', () => {
    const theme = createAppTheme({ tenant: { primaryColor: '#E11D48' } });
    expect(theme.primary[600]).toBe('#E11D48');
  });

  it('keeps primitives referenced by identity with the shared source of truth', () => {
    const theme = createAppTheme();
    expect(theme.spacing).toBe(spacingScale);
    expect(theme.typography.h1).toMatchObject({ fontSize: 24, fontWeight: '700' });
    expect(theme.shadows.card.elevation).toBe(2);
  });

  it('exposes functional status ramps untouched', () => {
    const theme = createAppTheme();
    expect(theme.danger[500]).toBe('#EF4444');
    expect(theme.success[500]).toBe('#22C55E');
    expect(theme.warning[500]).toBe('#F59E0B');
  });
});
