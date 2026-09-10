jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '@/lib/api';
import { securityService } from '@/services/security.service';
import type { SecurityEventsResponse } from '@/types/security';

const apiGet = api.get as jest.Mock;

describe('securityService — Week 22.6 contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches security events with the 24h rollup from /security/events', async () => {
    apiGet.mockResolvedValue({
      data: {
        data: [{ id: 'e1', action: 'security:rate_limited' }],
        meta: { page: 1, limit: 20, total: 1, pages: 1 },
        summary: { last24h: 1, byAction: { 'security:rate_limited': 1 } },
      },
    });

    const events = await securityService.events({ page: 1 });

    expect(apiGet).toHaveBeenCalledWith('/security/events', { params: { page: 1 } });
    expect(events.summary.last24h).toBe(1);
    expect((events.meta as SecurityEventsResponse['meta']).total).toBe(1);
  });

  it('fetches the control-objectives health from /security/health', async () => {
    apiGet.mockResolvedValue({
      data: {
        data: { healthy: true, checkedAt: '2026-09-10T00:00:00Z', checks: { rateLimit: { ok: true, detail: 'x' } } },
      },
    });

    const health = await securityService.health();

    expect(apiGet).toHaveBeenCalledWith('/security/health');
    expect(health.healthy).toBe(true);
  });
});