/**
 * S3.4 — operator attention list (GET /api/platform/attention).
 *
 * Supertest against the real app with the prisma service mocked (same pattern
 * as platform.spec.ts): we assert role gating, the where-scope, and the
 * server-side reason derivation (SUSPENDED / PAST_DUE / CANCELLED /
 * TRIAL_ENDING / TRIAL_EXPIRED).
 */

jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    tenant: { findMany: jest.fn() },
  },
}));

import request from 'supertest';
import app from '../src/index';
import prisma from '../src/services/database';
import { signAccessToken } from '../src/services/jwt';
import { UserRole } from '@prisma/client';

const findMany = prisma.tenant.findMany as jest.Mock;

const platformToken = signAccessToken({
  userId: 'u-platform',
  tenantId: 'tenant-platform',
  role: UserRole.PLATFORM_ADMIN,
  email: 'platform@yourapp.com',
});
const adminToken = signAccessToken({
  userId: 'u-admin',
  tenantId: 'tenant-1',
  role: UserRole.ADMIN,
  email: 'admin@restaurant.com',
});

const row = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  name: 'Restaurant A',
  slug: 'restaurant-a',
  email: 'a@example.com',
  plan: 'PRO',
  subscriptionStatus: 'ACTIVE',
  seatsLimit: 10,
  isActive: true,
  createdAt: new Date(),
  _count: { users: 4 },
  ...over,
});

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

beforeEach(() => jest.clearAllMocks());

describe('S3.4 — GET /api/platform/attention', () => {
  it('is platform-admin only (401 anonymous, 403 tenant admin)', async () => {
    expect((await request(app).get('/api/platform/attention')).status).toBe(401);
    const res = await request(app)
      .get('/api/platform/attention')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns suspended and past-due tenants with reasons', async () => {
    findMany.mockResolvedValue([
      row({ id: 't1', name: 'Suspended Sue', isActive: false }),
      row({ id: 't2', name: 'Past-Due Pete', subscriptionStatus: 'PAST_DUE' }),
      row({ id: 't3', name: 'Cancelled Cal', subscriptionStatus: 'CANCELLED' }),
    ]);

    const res = await request(app)
      .get('/api/platform/attention')
      .set('Authorization', `Bearer ${platformToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    const byId = Object.fromEntries(res.body.data.map((t: { id: string }) => [t.id, t]));
    expect(byId.t1.reasons).toContain('SUSPENDED');
    expect(byId.t2.reasons).toContain('PAST_DUE');
    expect(byId.t3.reasons).toContain('CANCELLED');
  });

  it('flags a 25-day-old trial as TRIAL_ENDING and a 40-day-old trial as TRIAL_EXPIRED', async () => {
    findMany.mockResolvedValue([
      row({ id: 't1', plan: 'TRIAL', subscriptionStatus: 'TRIAL', createdAt: daysAgo(25) }),
      row({ id: 't2', plan: 'TRIAL', subscriptionStatus: 'TRIAL', createdAt: daysAgo(40) }),
      row({ id: 't3', plan: 'TRIAL', subscriptionStatus: 'TRIAL', createdAt: daysAgo(5) }),
    ]);

    const res = await request(app)
      .get('/api/platform/attention')
      .set('Authorization', `Bearer ${platformToken}`);

    const byId = Object.fromEntries(res.body.data.map((t: { id: string }) => [t.id, t]));
    expect(byId.t1.reasons).toEqual(['TRIAL_ENDING']);
    expect(byId.t2.reasons).toEqual(['TRIAL_EXPIRED']);
    // A fresh trial needs no operator action — it is filtered out.
    expect(byId.t3).toBeUndefined();
    expect(res.body.total).toBe(2);
  });

  it('stacks multiple reasons and returns an empty queue when all is well', async () => {
    findMany.mockResolvedValueOnce([
      row({ id: 't1', isActive: false, subscriptionStatus: 'PAST_DUE' }),
    ]);
    let res = await request(app)
      .get('/api/platform/attention')
      .set('Authorization', `Bearer ${platformToken}`);
    expect(res.body.data[0].reasons).toEqual(['SUSPENDED', 'PAST_DUE']);

    findMany.mockResolvedValueOnce([]);
    res = await request(app)
      .get('/api/platform/attention')
      .set('Authorization', `Bearer ${platformToken}`);
    expect(res.body).toEqual({ data: [], total: 0 });
  });
});
