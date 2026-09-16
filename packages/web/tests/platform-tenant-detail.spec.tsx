jest.mock('@/services/platform.service', () => ({
  platformService: {
    listTenants: jest.fn(),
    getTenant: jest.fn(),
    updateTenant: jest.fn(),
  },
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PlatformTenantDetail from '@/components/platform/platform-tenant-detail';
import { platformService } from '@/services/platform.service';

const getFn = platformService.getTenant as jest.Mock;
const updateFn = platformService.updateTenant as jest.Mock;

const DETAIL = {
  id: 'tenant-1',
  name: 'The Bloom Bistro',
  slug: 'the-bloom-bistro',
  email: 'hello@bloombistro.test',
  plan: 'PRO',
  subscriptionStatus: 'ACTIVE',
  seatsLimit: 10,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  billing: { seatsUsed: 3, seatsLimit: 10 },
  recentChanges: [],
  _count: { users: 3, orders: 40, menus: 4, inventory: 22, suppliers: 5 },
};

const renderDetail = (tenantId = 'tenant-1') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PlatformTenantDetail tenantId={tenantId} />
    </QueryClientProvider>,
  );
};

describe('PlatformTenantDetail — S2.4 operator billing editor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFn.mockResolvedValue(DETAIL);
    updateFn.mockResolvedValue({ ...DETAIL, plan: 'ENTERPRISE' });
  });

  it('shows usage, seat pressure and the current commercial state', async () => {
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'The Bloom Bistro' })).toBeInTheDocument();
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByLabelText('Seat usage')).toHaveAttribute('aria-valuenow', '30');
    expect(screen.getByLabelText('Plan')).toHaveValue('PRO');
    expect(screen.getByLabelText('Subscription status')).toHaveValue('ACTIVE');
    expect(screen.getByLabelText('Seat limit')).toHaveValue(10);
    expect(screen.getByLabelText('Workspace active')).toBeChecked();
  });
});

describe('PlatformTenantDetail — operator edits (S2.2/S2.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFn.mockResolvedValue(DETAIL);
    updateFn.mockResolvedValue({ ...DETAIL, plan: 'ENTERPRISE' });
  });

  it('sends only the changed fields so the audit records a precise diff', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: 'The Bloom Bistro' });

    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'ENTERPRISE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateFn).toHaveBeenCalledTimes(1));
    // A no-op save would audit nothing, so unchanged fields must be omitted.
    expect(updateFn).toHaveBeenCalledWith('tenant-1', { plan: 'ENTERPRISE' });
    expect(await screen.findByText(/recorded in the change history/)).toBeInTheDocument();
  });

  it('records a suspension without also resending unchanged fields', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: 'The Bloom Bistro' });

    fireEvent.click(screen.getByLabelText('Workspace active'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateFn).toHaveBeenCalledWith('tenant-1', { isActive: false }));
  });

  it('disables the save button until the operator changes something', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: 'The Bloom Bistro' });

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByText('No changes to save')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Seat limit'), { target: { value: '25' } });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('surfaces the API error when a seat limit drops below current usage', async () => {
    updateFn.mockRejectedValue(new Error('Seat limit cannot be below current usage'));
    renderDetail();
    await screen.findByRole('heading', { name: 'The Bloom Bistro' });

    fireEvent.change(screen.getByLabelText('Seat limit'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Seat limit cannot be below current usage')).toBeInTheDocument();
  });

  it('replays the operator change history from the audit trail', async () => {
    getFn.mockResolvedValue({
      ...DETAIL,
      recentChanges: [
        {
          id: 'audit-1',
          action: 'platform:tenant.updated',
          actorId: 'u-platform',
          targetType: 'Tenant',
          targetId: 'tenant-1',
          metadata: {
            changes: {
              plan: { from: 'TRIAL', to: 'PRO' },
              seatsLimit: { from: 5, to: 10 },
            },
          },
          createdAt: '2026-02-01T10:30:00.000Z',
        },
      ],
    });

    renderDetail();

    expect(await screen.findByText('Change history')).toBeInTheDocument();
    // Field label, then the from → to transition, then who made the change.
    expect(screen.getByText(/^Plan:$/)).toBeInTheDocument();
    expect(screen.getByText('TRIAL → PRO')).toBeInTheDocument();
    expect(screen.getByText(/^Seat limit:$/)).toBeInTheDocument();
    expect(screen.getByText('5 → 10')).toBeInTheDocument();
    expect(screen.getByText('by u-platform')).toBeInTheDocument();
  });

  it('explains an empty change history instead of rendering a blank table', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: 'The Bloom Bistro' });

    expect(screen.getByText('No operator changes recorded yet.')).toBeInTheDocument();
  });
});
