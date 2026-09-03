import { resolveFlagState, slugifyFlagName } from '@/lib/feature-flags';

describe('feature-flags lib — Week 14 client helpers', () => {
  it('slugifies labels into registry-safe `[a-z0-9_]` keys', () => {
    expect(slugifyFlagName('Online Review Snackbar')).toBe('online_review_snackbar');
    expect(slugifyFlagName('  QR Ordering ')).toBe('qr_ordering');
    expect(slugifyFlagName('Dark-Mode 2026!')).toBe('dark_mode_2026');
    expect(slugifyFlagName('')).toBe('');
    expect(slugifyFlagName('   ')).toBe('');
  });

  it('resolveFlagState lets the tenant override win over the global default', () => {
    expect(resolveFlagState({ globalEnabled: true, tenantOverride: false })).toBe(false);
    expect(resolveFlagState({ globalEnabled: false, tenantOverride: true })).toBe(true);
    expect(resolveFlagState({ globalEnabled: true, tenantOverride: null })).toBe(true);
    expect(resolveFlagState({ globalEnabled: false, tenantOverride: null })).toBe(false);
  });
});