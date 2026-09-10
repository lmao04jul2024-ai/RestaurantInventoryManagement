jest.mock('@/services/tenants.service', () => ({
  tenantService: {
    onboard: jest.fn(),
    getMyTenant: jest.fn(),
    updateMyTenant: jest.fn(),
    getAnalytics: jest.fn(),
  },
}));

import { render, waitFor } from '@testing-library/react';
import ThemeProvider from '@/components/theme/theme-provider';
import { tenantService } from '@/services/tenants.service';
import { useAuthStore } from '@/store/auth.store';
import { loadThemePrefs, saveThemePrefs } from '@/lib/theme';

const getMyTenantFn = tenantService.getMyTenant as jest.Mock;

const varOf = (name: string) => document.documentElement.style.getPropertyValue(name);

describe('ThemeProvider — Week 17 tenant branding fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.cssText = '';
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  it('applies published tenant branding for signed-in users without local prefs — without persisting it', async () => {
    useAuthStore.setState({ accessToken: 'at', isAuthenticated: true });
    getMyTenantFn.mockResolvedValue({ theme: { preset: 'emerald', mode: 'light' } });

    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    await waitFor(() => expect(varOf('--color-primary-600')).toBe('5 150 105'));
    expect(getMyTenantFn).toHaveBeenCalledTimes(1);
    // The tenant fallback must NOT claim the user's localStorage slot —
    // a later tenant rebrand still reaches users who never customized.
    expect(loadThemePrefs()).toBeNull();
  });

  it('explicit local prefs win over the tenant branding (fetch skipped)', async () => {
    saveThemePrefs({ preset: 'sunset', mode: 'light' });
    useAuthStore.setState({ accessToken: 'at', isAuthenticated: true });
    getMyTenantFn.mockResolvedValue({ theme: { preset: 'emerald', mode: 'light' } });

    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    await waitFor(() => expect(varOf('--color-primary-600')).toBe('234 88 12'));
    expect(getMyTenantFn).not.toHaveBeenCalled();
  });

  it('anonymous visitors never trigger the tenant fetch', async () => {
    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    await waitFor(() => expect(varOf('--color-primary-600')).toBe('234 88 12'));
    expect(getMyTenantFn).not.toHaveBeenCalled();
  });
});
