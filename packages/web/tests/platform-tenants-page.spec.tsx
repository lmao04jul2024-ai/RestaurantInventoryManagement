jest.mock('@/services/platform.service', () => ({
  platformService: {
    listTenants: jest.fn(),
    getTenant: jest.fn(),
    updateTenant: jest.fn(),
  },
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PlatformTenantsPage from '@/components/platform/platform-tenants-page';
import { platformService } from '@/services/platform.service';

const listFn = platformService.listTenants as jest.Mock;

const tenantRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'tenant-1',
  name: 'The Bloom Bistro',
  slug: 'the-bloom-bistro',
  email: 'hello@bloombistro.test',
  plan: 'PRO',
  subscriptionStatus: 'ACTIVE',
  seatsLimit: 10,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  _count: { users: 3, orders: 40, menus: 4, inventory: 22 },
  ...overrides,
});

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PlatformTenantsPage />
    </QueryClientProvider>,
  );
};

describe('PlatformTenantsPage — S2.4 operator console', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listFn.mockResolvedValue({
      data: [tenantRow()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('lists workspaces with plan, status, seat usage and engagement counters', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'The Bloom Bistro' })).toBeInTheDocument();
    expect(screen.getByText('/the-bloom-bistro')).toBeInTheDocument();
    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
    expect(screen.getByText(/40 orders/)).toBeInTheDocument();
    // Manual billing: the operator records changes on the detail page.
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      '/platform/tenants/tenant-1',
    );
  });

  it('surfaces suspended and lapsed workspaces as an attention list', async () => {
    listFn.mockResolvedValue({
      data: [
        tenantRow(),
        tenantRow({ id: 'tenant-2', name: 'Lapsed Kitchen', slug: 'lapsed', subscriptionStatus: 'PAST_DUE' }),
        tenantRow({ id: 'tenant-3', name: 'Suspended Diner', slug: 'suspended', isActive: false }),
      ],
      pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
    });

    renderPage();

    expect(await screen.findByText('Needs attention')).toBeInTheDocument();
    expect(screen.getByText(/2 workspaces on this page are suspended or lapsed/)).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('applies the search filter server-side on submit', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'The Bloom Bistro' });

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'bistro' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(listFn).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: 'bistro' }));
  });

  it('paginates with the server envelope', async () => {
    listFn.mockResolvedValue({
      data: [tenantRow()],
      pagination: { page: 1, limit: 20, total: 25, totalPages: 2 },
    });

    renderPage();
    await screen.findByText(/Page 1 of 2/);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(listFn).toHaveBeenLastCalledWith({ page: 2, limit: 20 }));
  });

  it('shows an error state when the console cannot load workspaces', async () => {
    listFn.mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByText('Could not load workspaces')).toBeInTheDocument();
  });
});