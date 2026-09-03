jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import api from '@/lib/api';
import { tenantService } from '@/services/tenants.service';

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;
const apiPatch = api.patch as jest.Mock;

describe('tenantService — Week 15 endpoint contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('onboards a brand-new restaurant via POST /tenants', async () => {
    const session = {
      user: { id: 'u1', email: 'ada@bloom.test', firstName: 'Ada', lastName: 'Lee', role: 'ADMIN', tenantId: 't1', emailVerified: false },
      tenant: { id: 't1', name: 'The Bloom Bistro', slug: 'the-bloom-bistro' },
      accessToken: 'at',
      refreshToken: 'rt',
    };
    apiPost.mockResolvedValue({ data: session });

    const payload = {
      restaurantName: 'The Bloom Bistro',
      firstName: 'Ada',
      lastName: 'Lee',
      email: 'ada@bloom.test',
      password: 'Passw0rd!',
      timezone: 'UTC',
    };
    await expect(tenantService.onboard(payload)).resolves.toBe(session);
    expect(apiPost).toHaveBeenCalledWith('/tenants', payload);
  });

  it('fetches the current tenant via GET /tenants/me', async () => {
    const tenant = { id: 't1', name: 'The Bloom Bistro', slug: 'the-bloom-bistro' };
    apiGet.mockResolvedValue({ data: { data: tenant } });

    await expect(tenantService.getMyTenant()).resolves.toBe(tenant);
    expect(apiGet).toHaveBeenCalledWith('/tenants/me');
  });

  it('updates profile/config/billing via PATCH /tenants/me', async () => {
    const updated = { id: 't1', name: 'Bloom West', taxRate: 8.75 };
    apiPatch.mockResolvedValue({ data: { data: updated } });

    const payload = { name: 'Bloom West', taxRate: 8.75, plan: 'PRO' as const };
    await expect(tenantService.updateMyTenant(payload)).resolves.toBe(updated);
    expect(apiPatch).toHaveBeenCalledWith('/tenants/me', payload);
  });

  it('fetches usage analytics with the selected window', async () => {
    const analytics = {
      windowDays: 90,
      orders: { total: 40, inWindow: 30, active: 3 },
      revenue: { total: 1250, inWindow: 900 },
      customers: { total: 55, newInWindow: 12 },
      menu: { items: 24, available: 22 },
      inventory: { lowStock: 2 },
      reviews: { total: 18, avgRating: 4.5 },
      billing: { plan: 'PRO', subscriptionStatus: 'ACTIVE', seatsUsed: 3, seatsLimit: 10 },
    };
    apiGet.mockResolvedValue({ data: { data: analytics } });

    await expect(tenantService.getAnalytics(90)).resolves.toBe(analytics);
    expect(apiGet).toHaveBeenCalledWith('/tenants/me/analytics', { params: { days: 90 } });
  });
});
