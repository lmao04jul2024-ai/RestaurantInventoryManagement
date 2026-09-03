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
import CustomizationPage from '@/components/dashboard/customization-page';
import { tenantService } from '@/services/tenants.service';
import { useAuth } from '@/hooks/use-auth';

const getTenantFn = tenantService.getMyTenant as jest.Mock;
const updateFn = tenantService.updateMyTenant as jest.Mock;
const useAuthFn = useAuth as jest.Mock;

const TENANT = {
  id: 'tenant-1',
  name: 'The Bloom Bistro',
  slug: 'the-bloom-bistro',
  theme: { preset: 'classic', mode: 'system' },
};

const renderAs = (role: 'ADMIN' | 'MANAGER') => {
  useAuthFn.mockReturnValue({
    user: { id: 'u1', role, firstName: 'Ada' },
    hasRole: (...roles: string[]) => roles.includes(role),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CustomizationPage />
    </QueryClientProvider>,
  );
};

describe('CustomizationPage — Week 17 admin console', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTenantFn.mockResolvedValue(TENANT);
    updateFn.mockResolvedValue(TENANT);
  });

  it('renders the tabbed console with the live preview for admins', async () => {
    renderAs('ADMIN');

    expect(screen.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(screen.getByText('Brand palette')).toBeInTheDocument());
    expect(screen.getByLabelText('Storefront preview')).toBeInTheDocument();
    expect(screen.getByText('The Bloom Bistro')).toBeInTheDocument();
  });

  it('drafting a preset updates the scoped preview before publishing', async () => {
    renderAs('ADMIN');
    await waitFor(() => expect(screen.getByText('Brand palette')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('radio', { name: /emerald/i }));

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    const scope = screen.getByTestId('preview-scope') as HTMLElement;
    await waitFor(() => expect(scope.style.getPropertyValue('--color-primary-600')).toBe('5 150 105'));
  });

  it('publishes the drafted theme document via PATCH', async () => {
    renderAs('ADMIN');
    await waitFor(() => expect(screen.getByText('Brand palette')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(updateFn).toHaveBeenCalledWith({ theme: { preset: 'classic', mode: 'dark' } }),
    );
  });

  it('edits branding: logo preview chip and font var in the scoped preview', async () => {
    renderAs('ADMIN');
    await waitFor(() => expect(screen.getByText('Brand palette')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Branding' }));
    fireEvent.change(screen.getByLabelText('Logo URL'), {
      target: { value: 'https://cdn.bloom.test/logo.png' },
    });
    expect(screen.getByAltText('Logo preview')).toHaveAttribute('src', 'https://cdn.bloom.test/logo.png');

    fireEvent.change(screen.getByLabelText('Brand font'), { target: { value: 'georgia' } });
    const scope = screen.getByTestId('preview-scope') as HTMLElement;
    expect(scope.style.getPropertyValue('--font-family-sans')).toContain('Georgia');
  });

  it('links the shipped feature-flag and tenant-settings surfaces', async () => {
    renderAs('ADMIN');
    await waitFor(() => expect(screen.getByText('Brand palette')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Features & Settings' }));

    expect(screen.getByRole('link', { name: /feature flags/i })).toHaveAttribute(
      'href',
      '/dashboard/features',
    );
    expect(screen.getByRole('link', { name: /tenant settings/i })).toHaveAttribute(
      'href',
      '/dashboard/tenants',
    );
  });

  it('blocks non-admins', () => {
    renderAs('MANAGER');
    expect(screen.getByText('Admins only')).toBeInTheDocument();
    expect(updateFn).not.toHaveBeenCalled();
  });
});
