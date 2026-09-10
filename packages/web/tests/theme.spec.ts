import {
  buildCssVariables,
  buildPalette,
  hexToRgbTriplets,
  isValidThemePrefs,
  loadThemePrefs,
  luminance,
  parseStoredTheme,
  resolveIsDark,
  saveThemePrefs,
  tenantThemeToPrefs,
  THEME_BOOT_SCRIPT,
  THEME_STORAGE_KEY,
  type ShadeStep,
} from '@/lib/theme';

const LIGHT: Parameters<typeof buildCssVariables>[0] = { preset: 'classic', mode: 'light' };

describe('theme lib — Week 13 design tokens & CSS-var generation', () => {
  it('builds the full classic/light variable set matching globals.css defaults', () => {
    const vars = buildCssVariables(LIGHT, false);
    expect(vars['--color-primary-600']).toBe('234 88 12');
    expect(vars['--color-secondary-600']).toBe('13 148 136');
    expect(vars['--color-surface']).toBe('255 255 255');
    expect(vars['--color-content-muted']).toBe('120 113 108');
    expect(vars['--color-gray-300']).toBe('214 211 209');
    for (const step of ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'] as ShadeStep[]) {
      expect(vars[`--color-primary-${step}`]).toBeDefined();
      expect(vars[`--color-secondary-${step}`]).toBeDefined();
      expect(vars[`--color-gray-${step}`]).toBeDefined();
    }
  });

  it('flips surfaces & grays in dark mode but keeps brand palettes', () => {
    const vars = buildCssVariables({ preset: 'classic', mode: 'dark' }, false);
    expect(vars['--color-surface']).toBe('28 25 23');
    expect(vars['--color-content-default']).toBe('250 250 249');
    expect(vars['--color-gray-300']).toBe('87 83 78');
    expect(vars['--color-primary-600']).toBe('234 88 12');
  });

  it('resolveIsDark covers the mode × OS matrix', () => {
    expect(resolveIsDark('light', true)).toBe(false);
    expect(resolveIsDark('dark', false)).toBe(true);
    expect(resolveIsDark('system', true)).toBe(true);
    expect(resolveIsDark('system', false)).toBe(false);
  });

  it('generates a custom palette whose 600 anchor IS the brand hex', () => {
    const vars = buildCssVariables(
      { preset: 'custom', mode: 'light', custom: { primary: '#ff8800', secondary: '#123456' } },
      false,
    );
    expect(vars['--color-primary-600']).toBe('255 136 0');
    expect(vars['--color-secondary-600']).toBe('18 52 86');
  });

  it('custom shade ladder is monotonically light→dark', () => {
    const palette = buildPalette('#ff8800');
    const steps: ShadeStep[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
    for (let i = 0; i < steps.length - 1; i += 1) {
      expect(luminance(palette[steps[i]])).toBeGreaterThan(luminance(palette[steps[i + 1]]));
    }
  });

  it('hexToRgbTriplets expands shorthand and rejects garbage', () => {
    expect(hexToRgbTriplets('#abc')).toEqual([170, 187, 204]);
    expect(hexToRgbTriplets('#FF8800')).toEqual([255, 136, 0]);
    expect(() => hexToRgbTriplets('nope')).toThrow(/Invalid hex/);
  });
});

describe('theme lib — persistence (13.6)', () => {
  it('parseStoredTheme accepts valid prefs and rejects garbage', () => {
    expect(parseStoredTheme(null)).toBeNull();
    expect(parseStoredTheme('not json {')).toBeNull();
    expect(parseStoredTheme('{"mode":"purple","preset":"classic"}')).toBeNull();
    expect(parseStoredTheme('{"mode":"dark","preset":"emerald"}')).toEqual({
      mode: 'dark',
      preset: 'emerald',
    });
  });

  it('custom preset requires both brand hexes', () => {
    expect(isValidThemePrefs({ mode: 'light', preset: 'custom' })).toBe(false);
    expect(isValidThemePrefs({ mode: 'light', preset: 'custom', custom: { primary: '#123456' } })).toBe(false);
    expect(
      isValidThemePrefs({ mode: 'light', preset: 'custom', custom: { primary: '#123456', secondary: 'blue' } }),
    ).toBe(false);
    expect(
      isValidThemePrefs({ mode: 'light', preset: 'custom', custom: { primary: '#123456', secondary: '#654321' } }),
    ).toBe(true);
  });

  it('save/load roundtrips through localStorage', () => {
    expect(loadThemePrefs()).toBeNull();
    const prefs = { preset: 'sunset', mode: 'dark' } as const;
    saveThemePrefs(prefs);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(JSON.stringify(prefs));
    expect(loadThemePrefs()).toEqual(prefs);
  });

  it('boot script stamps data-theme for both modes before paint', () => {
    expect(THEME_BOOT_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_BOOT_SCRIPT).toContain("setAttribute('data-theme',dark?'dark':'light')");
  });
});

describe('theme lib — Week 17 brand fonts & tenant mapping', () => {
  it('emits the font variable only when a brand font is set', () => {
    const noFont = buildCssVariables(LIGHT, false);
    expect(noFont['--font-family-sans']).toBeUndefined();

    const withFont = buildCssVariables({ ...LIGHT, font: 'georgia' }, false);
    expect(withFont['--font-family-sans']).toContain('Georgia');

    const inter = buildCssVariables({ ...LIGHT, font: 'inter' }, false);
    expect(inter['--font-family-sans']).toContain('Inter');
  });

  it('validates the optional font against the catalog', () => {
    expect(isValidThemePrefs({ preset: 'classic', mode: 'light', font: 'georgia' })).toBe(true);
    expect(isValidThemePrefs({ preset: 'classic', mode: 'light', font: 'comic-sans' as never })).toBe(false);
  });

  it('tenantThemeToPrefs maps the published branding onto ThemePrefs', () => {
    expect(tenantThemeToPrefs(null)).toBeNull();
    expect(tenantThemeToPrefs(undefined)).toBeNull();

    expect(tenantThemeToPrefs({ preset: 'emerald', mode: 'dark' })).toEqual({
      preset: 'emerald',
      mode: 'dark',
    });

    expect(
      tenantThemeToPrefs({
        preset: 'custom',
        mode: 'light',
        custom: { primary: '#DC2626', secondary: '#7C3AED' },
        branding: { fontFamily: 'trebuchet' },
      }),
    ).toEqual({
      preset: 'custom',
      mode: 'light',
      custom: { primary: '#DC2626', secondary: '#7C3AED' },
      font: 'trebuchet',
    });
  });

  it('tenantThemeToPrefs rejects documents with invalid shape', () => {
    expect(tenantThemeToPrefs({ preset: 'neon' as never, mode: 'light' })).toBeNull();
    // custom preset without both brand hexes is invalid
    expect(tenantThemeToPrefs({ preset: 'custom', mode: 'light' })).toBeNull();
  });
});
