jest.mock('@/services/tenants.service', () => ({
  tenantService: {
    onboard: jest.fn(),
    getMyTenant: jest.fn(),
    updateMyTenant: jest.fn(),
    getAnalytics: jest.fn(),
  },
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TenantsPage from '@/components/dashboard/tenants-page';
import { tenantService } from '@/services/tenants.service';

const getTenantFn = tenantService.getMyTenant as jest.Mock;
const updateFn = tenantService.updateMyTenant as jest.Mock;
const analyticsFn = tenantService.getAnalytics as jest.Mock;

const HOURS = {
  monday: { open: '10:00', close: '21:00' },
  tuesday: { open: '10:00', close: '21:00' },
  wednesday: { open: '10:00', close: '21:00' },
  thursday: { open: '10:00', close: '21:00' },
  friday: { open: '10:00', close: '23:00' },
  saturday: { open: '10:00', close: '23:00' },
  // sunday intentionally absent → rendered as Closed
};

const TENANT = {
  id: 'tenant-1',
  name: 'The Bloom Bistro',
  slug: 'the-bloom-bistro',
  email: 'hello@bloombistro.test',
  phone: '+15551234567',
  address: '1 Main St',
  timezone: 'America/New_York',
  currency: 'USD',
  taxRate: 8.5,
  operatingHours: HOURS,
  plan: 'PRO',
  subscriptionStatus: 'ACTIVE',
  seatsLimit: 10,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
  _count: { users: 3 },
};

const ANALYTICS = {
  windowDays: 30,
  orders: { total: 40, inWindow: 12, active: 3 },
  revenue: { total: 1250, inWindow: 400 },
  customers: { total: 55, newInWindow: 6 },
  menu: { items: 24, available: 22 },
  inventory: { lowStock: 2 },
  reviews: { total: 18, avgRating: 4.5 },
  billing: { plan: 'PRO', subscriptionStatus: 'ACTIVE', seatsUsed: 3, seatsLimit: 10 },
};

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TenantsPage />
    </QueryClientProvider>,
  );
};

describe('TenantsPage — Week 15.5/15.6 self-service settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTenantFn.mockResolvedValue(TENANT);
    analyticsFn.mockResolvedValue(ANALYTICS);
    updateFn.mockResolvedValue({ ...TENANT, name: 'Bloom West' });
  });

  it('renders the profile, plan card and analytics stats', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('The Bloom Bistro')).toBeInTheDocument());
    expect(screen.getByText('/the-bloom-bistro')).toBeInTheDocument();
    // S2.6 — commercial state is displayed, not editable.
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.queryByLabelText('Plan')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Subscription status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Workspace active')).not.toBeInTheDocument();
    expect(screen.getByText(/managed by your platform operator/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Tax rate (%)')).toHaveValue(8.5);
    // Sunday is absent from configured hours → closed.
    expect(screen.getByLabelText('Closed on sunday')).toBeChecked();
    expect(screen.getByLabelText('monday opens at')).toHaveValue('10:00');

    // Seat usage progress at 30% (3/10).
    expect(screen.getByLabelText('Seat usage')).toHaveAttribute('aria-valuenow', '30');

    await waitFor(() => expect(screen.getByText('$1,250.00')).toBeInTheDocument());
    expect(screen.getByText('12 in last 30d · 3 active')).toBeInTheDocument();
    expect(screen.getByText('4.5 ★')).toBeInTheDocument();
    expect(screen.getByText('22/24')).toBeInTheDocument();
  });

  it('saves profile/config changes including operating hours', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('The Bloom Bistro')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Restaurant name'), { target: { value: 'Bloom West' } });
    fireEvent.change(screen.getByLabelText('Tax rate (%)'), { target: { value: '8.75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateFn).toHaveBeenCalledTimes(1));
    const payload = updateFn.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: 'Bloom West',
      email: 'hello@bloombistro.test',
      timezone: 'America/New_York',
      currency: 'USD',
      taxRate: 8.75,
    });
    // S2.6 — the self-service payload never carries commercial state.
    expect(payload).not.toHaveProperty('plan');
    expect(payload).not.toHaveProperty('subscriptionStatus');
    expect(payload).not.toHaveProperty('isActive');
    expect(payload.operatingHours).toMatchObject({ monday: { open: '10:00', close: '21:00' }, friday: { open: '10:00', close: '23:00' } });
    expect(payload.operatingHours.sunday).toBeUndefined();
  });

  it('opening a closed day restores it with house-default hours', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('The Bloom Bistro')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Closed on sunday'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateFn).toHaveBeenCalledTimes(1));
    const { operatingHours } = updateFn.mock.calls[0][0];
    expect(operatingHours.sunday).toEqual({ open: '09:00', close: '22:00' });
  });

  it('refetches analytics when the window changes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('$1,250.00')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '90d' }));
    await waitFor(() => expect(analyticsFn).toHaveBeenCalledWith(90));
  });

  it('shows an error state when the tenant cannot be loaded', async () => {
    getTenantFn.mockRejectedValue(new Error('boom'));
    renderPage();

    await waitFor(() => expect(screen.getByText('Could not load tenant settings')).toBeInTheDocument());
  });

  it('explains a suspended workspace without offering self-reactivation (S2.6)', async () => {
    getTenantFn.mockResolvedValue({ ...TENANT, isActive: false });
    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('The Bloom Bistro')).toBeInTheDocument());
    // Suspension is the operator's lapse lever — the tenant cannot undo it here.
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    expect(screen.getByText(/settle your account with your platform operator/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Workspace active')).not.toBeInTheDocument();
  });

  it('shows what the current plan includes vs what has been consumed (S3.5)', async () => {
    renderPage();

    expect(await screen.findByTestId('plan-entitlements')).toBeInTheDocument();
    expect(screen.getByText(/everything in basic/i)).toBeInTheDocument();
    expect(screen.getByText('Usage analytics and reporting')).toBeInTheDocument();
    // Consumption pairs with the analytics payload.
    expect(screen.getByText('Menu items')).toBeInTheDocument();
    expect(screen.getByText('Orders (total)')).toBeInTheDocument();
    expect(screen.getAllByText('Customers').length).toBeGreaterThan(0);
    // Seats are the hard-enforced ceiling (S2.5) — shown with the limit.
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
  });
});
