jest.mock('@/services/tenants.service', () => ({
  tenantService: {
    onboard: jest.fn(),
    getMyTenant: jest.fn(),
    updateMyTenant: jest.fn(),
    getAnalytics: jest.fn(),
  },
}));

jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ThemeProvider from '@/components/theme/theme-provider';
import CustomizationPage from '@/components/dashboard/customization-page';
import { tenantService } from '@/services/tenants.service';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth.store';

const getTenantFn = tenantService.getMyTenant as jest.Mock;
const updateFn = tenantService.updateMyTenant as jest.Mock;
const useAuthFn = useAuth as jest.Mock;

const rootVar = (name: string) => document.documentElement.style.getPropertyValue(name);

/**
 * Week 18.3 — end-to-end customization workflow (component level).
 *
 * Compose the real ThemeProvider + CustomizationPage (only external services
 * are stubbed) and drive the complete admin journey: published tenant branding
 * applies app-wide → the console drafts a rebrand in a scoped preview →
 * publishing persists the tenant-wide document → the console re-syncs from the
 * refetched tenant profile.
 */
describe('customization workflow (18.3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.cssText = '';
    useAuthStore.setState({
      user: { id: 'u1', firstName: 'Ada', email: 'ada@bloom.test', role: 'ADMIN', tenantId: 'tenant-1' } as never,
      accessToken: 'at',
      refreshToken: null,
      isAuthenticated: true,
    });
    useAuthFn.mockReturnValue({
      user: { id: 'u1', role: 'ADMIN' },
      hasRole: (...roles: string[]) => roles.includes('ADMIN'),
    });

    // The service mock resolves FRESH objects each call (like a real API),
    // while updateMyTenant mutates the backing document server-side — so the
    // post-publish react-query refetch naturally sees the updated branding.
    const published = { preset: 'emerald', mode: 'light' } as Record<string, unknown>;
    getTenantFn.mockImplementation(async () => ({
      id: 'tenant-1',
      name: 'The Bloom Bistro',
      slug: 'the-bloom-bistro',
      theme: { ...published },
    }));
    updateFn.mockImplementation(async (payload: { theme?: Record<string, unknown> }) => {
      if (payload.theme) Object.assign(published, payload.theme);
      return { id: 'tenant-1', name: 'The Bloom Bistro', slug: 'the-bloom-bistro', theme: { ...published } };
    });
  });

  it('applies published branding, drafts & previews a rebrand in isolation, then publishes it', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <CustomizationPage />
        </ThemeProvider>
      </QueryClientProvider>,
    );

    // 1. Published tenant branding (emerald) is applied app-wide to :root.
    await waitFor(() => expect(rootVar('--color-primary-600')).toBe('5 150 105'));

    // 2. The console initializes its draft from the same published document.
    await waitFor(() => expect(screen.getByText('Brand palette')).toBeInTheDocument());
    const scope = screen.getByTestId('preview-scope') as HTMLElement;
    await waitFor(() => expect(scope.style.getPropertyValue('--color-primary-600')).toBe('5 150 105'));

    // 3. Drafting Sunset updates ONLY the scoped preview, never :root.
    fireEvent.click(screen.getByRole('radio', { name: 'Sunset' }));
    await waitFor(() => expect(scope.style.getPropertyValue('--color-primary-600')).toBe('234 88 12'));
    expect(rootVar('--color-primary-600')).toBe('5 150 105');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    // 4. Publish persists the drafted document tenant-wide.
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(updateFn).toHaveBeenCalledWith({ theme: { preset: 'sunset', mode: 'light' } }),
    );

    // 5. The refetched tenant profile re-syncs the console (draft == saved).
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument());
    expect(scope.style.getPropertyValue('--color-primary-600')).toBe('234 88 12');
  });

  it('discard reverts an unsaved draft back to the published branding', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <CustomizationPage />
        </ThemeProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('Brand palette')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'Sunset' }));
    await waitFor(() => expect(screen.getByText('Unsaved changes')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    const scope = screen.getByTestId('preview-scope') as HTMLElement;
    await waitFor(() => expect(scope.style.getPropertyValue('--color-primary-600')).toBe('5 150 105'));
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(updateFn).not.toHaveBeenCalled();
  });
});