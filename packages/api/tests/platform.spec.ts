jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    tenant: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: { count: jest.fn() },
    auditLog: { create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import request from 'supertest';
import app from '../src/index';
import prisma from '../src/services/database';
import { signAccessToken } from '../src/services/jwt';
import { UserRole } from '@prisma/client';

const uid = (n: number | string) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const TENANT_ID = uid(1);
const platformToken = signAccessToken({
  userId: 'u-platform',
  tenantId: 'tenant-platform',
  role: UserRole.PLATFORM_ADMIN,
  email: 'platform@yourapp.com',
});
const adminToken = signAccessToken({
  userId: 'u-admin',
  tenantId: TENANT_ID,
  role: UserRole.ADMIN,
  email: 'admin@restaurant.com',
});

const platformTenantRow = {
  id: TENANT_ID,
  name: 'Restaurant A',
  slug: 'restaurant-a',
  email: 'a@example.com',
  plan: 'TRIAL',
  subscriptionStatus: 'TRIAL',
  seatsLimit: 10,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  _count: { users: 5, orders: 120, menus: 1, inventory: 30, suppliers: 4 },
};

const findUniqueMock = prisma.tenant.findUnique as jest.Mock;
const auditCreate = prisma.auditLog.create as jest.Mock;
const auditCount = prisma.auditLog.count as jest.Mock;
const auditFindMany = prisma.auditLog.findMany as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  auditCreate.mockResolvedValue({});
  // S2.4 — the detail read also pulls the operator change trail.
  auditCount.mockResolvedValue(0);
  auditFindMany.mockResolvedValue([]);
});

describe('S2.1 — platform surface is role-gated', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app).get('/api/platform/tenants');
    expect(res.status).toBe(401);
  });

  it('rejects a tenant ADMIN with 403 FORBIDDEN_ROLE', async () => {
    const res = await request(app)
      .get('/api/platform/tenants')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });
});

describe('S2.1 — PLATFORM_ADMIN is rejected on tenant surfaces', () => {
  it('resolveTenant returns 403 PLATFORM_ADMIN_FORBIDDEN for the platform role', async () => {
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({
      id: 'tenant-platform',
      slug: 'platform',
      isActive: true,
      features: {},
    });
    const res = await request(app)
      .get('/api/tenants/me')
      .set('Authorization', `Bearer ${platformToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLATFORM_ADMIN_FORBIDDEN');
  });
});

describe('S2.2 — platform tenant list', () => {
  it('lists tenants with usage counts and a pagination envelope', async () => {
    (prisma.tenant.count as jest.Mock).mockResolvedValue(1);
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([platformTenantRow]);

    const res = await request(app)
      .get('/api/platform/tenants')
      .set('Authorization', `Bearer ${platformToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]._count.users).toBe(5);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });
    expect((prisma.tenant.findMany as jest.Mock).mock.calls[0][0]).toMatchObject({
      skip: 0,
      take: 20,
    });
  });

  it('applies the search filter to name/slug', async () => {
    (prisma.tenant.count as jest.Mock).mockResolvedValue(0);
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/platform/tenants?search=bistro')
      .set('Authorization', `Bearer ${platformToken}`);

    expect(res.status).toBe(200);
    const args = (prisma.tenant.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.OR[0]).toMatchObject({ name: { contains: 'bistro', mode: 'insensitive' } });
    expect(args.where.OR[1]).toMatchObject({ slug: { contains: 'bistro', mode: 'insensitive' } });
  });
});

describe('S2.2/S2.3 — platform tenant detail & audited updates', () => {
  it('returns tenant detail with a billing usage block', async () => {
    findUniqueMock.mockResolvedValue(platformTenantRow);
    const res = await request(app)
      .get(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.billing).toEqual({ seatsUsed: 5, seatsLimit: 10 });
  });

  it('404s an unknown tenant id', async () => {
    findUniqueMock.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/platform/tenants/does-not-exist')
      .set('Authorization', `Bearer ${platformToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TENANT_NOT_FOUND');
  });

  it('returns the operator change history alongside usage (S2.4)', async () => {
    findUniqueMock.mockResolvedValue(platformTenantRow);
    auditCount.mockResolvedValue(1);
    auditFindMany.mockResolvedValue([
      {
        id: 'audit-1',
        tenantId: TENANT_ID,
        actorId: 'u-platform',
        action: 'platform:tenant.updated',
        targetType: 'Tenant',
        targetId: TENANT_ID,
        metadata: { changes: { plan: { from: 'TRIAL', to: 'PRO' } }, surface: 'platform' },
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ]);

    const res = await request(app)
      .get(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', `Bearer ${platformToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.recentChanges).toHaveLength(1);
    expect(res.body.data.recentChanges[0].metadata.changes.plan).toEqual({ from: 'TRIAL', to: 'PRO' });
    // History is scoped to the AFFECTED tenant and to operator changes only.
    expect(auditFindMany.mock.calls[0][0]).toMatchObject({
      where: { tenantId: TENANT_ID, action: 'platform:tenant.updated' },
      take: 10,
    });
  });

  it('PATCH changes plan/status and writes an audited from→to trail scoped to the affected tenant', async () => {
    findUniqueMock.mockResolvedValue(platformTenantRow);
    (prisma.tenant.update as jest.Mock).mockResolvedValue({
      ...platformTenantRow,
      plan: 'PRO',
      subscriptionStatus: 'ACTIVE',
    });

    const res = await request(app)
      .patch(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ plan: 'PRO', subscriptionStatus: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    const auditArgs = auditCreate.mock.calls[0][0].data;
    expect(auditArgs).toMatchObject({
      tenantId: TENANT_ID, // audit lives in the AFFECTED tenant's scope
      action: 'platform:tenant.updated',
      targetType: 'Tenant',
      targetId: TENANT_ID,
      actorId: 'u-platform',
    });
    expect(auditArgs.metadata.changes).toMatchObject({
      plan: { from: 'TRIAL', to: 'PRO' },
      subscriptionStatus: { from: 'TRIAL', to: 'ACTIVE' },
    });
  });

  it('a no-op PATCH persists and audits nothing', async () => {
    findUniqueMock.mockResolvedValue(platformTenantRow);
    const res = await request(app)
      .patch(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ plan: 'TRIAL' });
    expect(res.status).toBe(200);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('rejects lowering seatsLimit below current user count with 409 SEATS_BELOW_USAGE', async () => {
    findUniqueMock.mockResolvedValue(platformTenantRow); // seatsLimit 10
    (prisma.user.count as jest.Mock).mockResolvedValue(5);
    const res = await request(app)
      .patch(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ seatsLimit: 3 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SEATS_BELOW_USAGE');
  });

  it('allows raising seatsLimit and audits it', async () => {
    findUniqueMock.mockResolvedValue(platformTenantRow);
    (prisma.tenant.update as jest.Mock).mockResolvedValue({ ...platformTenantRow, seatsLimit: 25 });
    const res = await request(app)
      .patch(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ seatsLimit: 25 });
    expect(res.status).toBe(200);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect((prisma.tenant.update as jest.Mock).mock.calls[0][0].data).toEqual({ seatsLimit: 25 });
  });

  it('400s an invalid plan value', async () => {
    const res = await request(app)
      .patch(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ plan: 'ULTIMATE' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
