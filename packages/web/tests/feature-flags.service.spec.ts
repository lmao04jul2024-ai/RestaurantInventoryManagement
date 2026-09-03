jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import api from '@/lib/api';
import { featureFlagService } from '@/services/feature-flags.service';

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;
const apiPatch = api.patch as jest.Mock;
const apiDelete = api.delete as jest.Mock;

describe('featureFlagService — Week 14 endpoint contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists flags via GET /feature-flags', async () => {
    apiGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 'flag-1',
            name: 'customer_reviews',
            description: 'Customers rate orders',
            globalEnabled: true,
            tenantOverride: null,
            enabled: true,
          },
        ],
      },
    });

    const flags = await featureFlagService.listFeatureFlags();

    expect(apiGet).toHaveBeenCalledWith('/feature-flags');
    expect(flags).toHaveLength(1);
    expect(flags[0].enabled).toBe(true);
  });

  it('creates a flag via POST /feature-flags', async () => {
    apiPost.mockResolvedValue({
      data: { data: { id: 'flag-2', name: 'loyalty_program', isEnabled: false } },
    });

    const flag = await featureFlagService.createFeatureFlag({
      name: 'loyalty_program',
      description: 'Points program',
      isEnabled: false,
    });

    expect(apiPost).toHaveBeenCalledWith('/feature-flags', {
      name: 'loyalty_program',
      description: 'Points program',
      isEnabled: false,
    });
    expect(flag.name).toBe('loyalty_program');
  });

  it('updates a flag via PATCH /feature-flags/:id', async () => {
    apiPatch.mockResolvedValue({
      data: { data: { id: 'flag-1', name: 'customer_reviews', isEnabled: false } },
    });

    await featureFlagService.updateFeatureFlag('flag-1', { isEnabled: false });

    expect(apiPatch).toHaveBeenCalledWith('/feature-flags/flag-1', { isEnabled: false });
  });

  it('deletes a flag via DELETE /feature-flags/:id', async () => {
    apiDelete.mockResolvedValue({ status: 204 });

    await featureFlagService.deleteFeatureFlag('flag-1');

    expect(apiDelete).toHaveBeenCalledWith('/feature-flags/flag-1');
  });

  it('gets the tenant config map via GET /feature-flags/config', async () => {
    apiGet.mockResolvedValue({
      data: { data: { customer_reviews: false, loyalty_program: true } },
    });

    const config = await featureFlagService.getConfig();

    expect(apiGet).toHaveBeenCalledWith('/feature-flags/config');
    expect(config).toEqual({ customer_reviews: false, loyalty_program: true });
  });

  it('updates tenant overrides via PATCH /feature-flags/config', async () => {
    apiPatch.mockResolvedValue({
      data: { data: { customer_reviews: true } },
    });

    const config = await featureFlagService.updateConfig({ customer_reviews: true });

    expect(apiPatch).toHaveBeenCalledWith('/feature-flags/config', {
      overrides: { customer_reviews: true },
    });
    expect(config).toEqual({ customer_reviews: true });
  });
});