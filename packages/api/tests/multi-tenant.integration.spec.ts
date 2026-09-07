/**
 * Week 18.2 — multi-tenant integration tests.
 *
 * Boots the REAL express app (src/index) end-to-end through supertest with only
 * the Prisma layer stubbed (src/services/database). This exercises the full
 * request pipeline — JWT auth → tenant resolution (resolveTenant) → RBAC &
 * feature-flag middleware → controller — for isolation and authorization
 * boundaries that unit tests only cover in isolation.
 *
 * The tenant-scope data-access guard itself is unit-tested separately
 * (tenant-scope.spec) because it lives inside the mocked-out database module.
 */
jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    tenant: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    featureFlag: { findMany: jest.fn() },
    supplier: { findFirst: jest.fn() },
    reportTemplate: { findMany: jest.fn() },
    inventoryItem: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      fields: { minStock: {} },
    },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import request from 'supertest';
import app from '../src/index';
import prisma from '../src/services/database';
import { signAccessToken } from '../src/services/jwt';
import { UserRole } from '@prisma/client';

/** Joi uuid params require real-shaped identifiers. */
const uid = (n: number | string) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const TENANT_A = { id: 'tenant-a', slug: 'tenant-a', name: 'Restaurant A', features: {}, isActive: true };
const TENANT_B = { id: 'tenant-b', slug: 'tenant-b', name: 'Restaurant B', features: {}, isActive: true };

const adminA = signAccessToken({ userId: 'u-admin', tenantId: 'tenant-a', role: UserRole.ADMIN, email: 'admin@a.com' });
const managerA = signAccessToken({ userId: 'u-manager', tenantId: 'tenant-a', role: UserRole.MANAGER, email: 'manager@a.com' });
const serverA = signAccessToken({ userId: 'u-server', tenantId: 'tenant-a', role: UserRole.SERVER, email: 'server@a.com' });
const customerA = signAccessToken({ userId: 'u-cust', tenantId: 'tenant-a', role: UserRole.CUSTOMER, email: 'cust@a.com' });

describe('multi-tenant integration (18.2) — public surface', () => {
  it('serves the health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects unauthenticated calls with 401 before any tenant work', async () => {
    const res = await request(app).get('/api/inventory/items');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_TOKEN');
  });
});

describe('multi-tenant integration (18.2) — tenant isolation through HTTP', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.tenant.findFirst as jest.Mock).mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id === 'tenant-a') return TENANT_A;
      if (where.id === 'tenant-b') return TENANT_B;
      return null;
    });
    // u-server holds a per-user deny override on inventory:read (Week 16.5).
    (prisma.user.findUnique as jest.Mock).mockImplementation(async ({ where }: { where: Record<string, unknown> }) => ({
      id: where.id,
      permissionOverrides: where.id === 'u-server' ? { 'inventory:read': false } : null,
    }));
    (prisma.featureFlag.findMany as jest.Mock).mockResolvedValue([{ name: 'customer_reviews', isEnabled: false }]);
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.count as jest.Mock).mockResolvedValue(0);
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.inventoryItem.create as jest.Mock).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: uid(999),
      ...data,
    }));
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue(null);
  });

  it('scopes every list query to the caller tenant', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      { id: uid(1), name: 'Tomato', tenantId: 'tenant-a' },
      { id: uid(2), name: 'Flour', tenantId: 'tenant-a' },
    ]);
    (prisma.inventoryItem.count as jest.Mock).mockResolvedValue(2);

    const res = await request(app)
      .get('/api/inventory/items')
      .set('Authorization', `Bearer ${adminA}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const listCall = (prisma.inventoryItem.findMany as jest.Mock).mock.calls[0][0];
    expect(listCall.where.tenantId).toBe('tenant-a');
  });

  it('inherits the tenant on create so rows can never be written cross-tenant', async () => {
    const res = await request(app)
      .post('/api/inventory/items')
      .set('Authorization', `Bearer ${managerA}`)
      .send({ name: 'Basil', sku: 'BAS-001', minStock: 1, unit: 'KG' });

    expect(res.status).toBe(201);
    const createCall = (prisma.inventoryItem.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.tenantId).toBe('tenant-a');
  });

  it('forbids a tenant-id header that disagrees with the JWT tenant', async () => {
    const res = await request(app)
      .get('/api/inventory/items')
      .set('Authorization', `Bearer ${adminA}`)
      .set('X-Tenant-ID', 'tenant-b');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TENANT_MISMATCH');
    // The controller must never run after a mismatch.
    expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
  });

  it('returns 404 for a row that exists but is owned by another tenant', async () => {
    const res = await request(app)
      .get(`/api/inventory/items/${uid(1)}`)
      .set('Authorization', `Bearer ${adminA}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVENTORY_ITEM_NOT_FOUND');
  });
describe('multi-tenant integration (18.2) — authorization boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.tenant.findFirst as jest.Mock).mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.id === 'tenant-a' ? TENANT_A : null);
    (prisma.user.findUnique as jest.Mock).mockImplementation(async ({ where }: { where: Record<string, unknown> }) => ({
      id: where.id,
      permissionOverrides: where.id === 'u-server' ? { 'inventory:read': false } : null,
    }));
    (prisma.featureFlag.findMany as jest.Mock).mockResolvedValue([{ name: 'customer_reviews', isEnabled: false }]);
  });

  it('blocks a CUSTOMER from staff-only inventory mutations (RBAC role gate)', async () => {
    const res = await request(app)
      .post('/api/inventory/items')
      .set('Authorization', `Bearer ${customerA}`)
      .send({ name: 'Basil', sku: 'BAS-001', minStock: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('denies a role-granted permission overridden to false for that user (Week 16.5)', async () => {
    // KITCHEN/SERVER normally hold inventory:read via the role matrix; the
    // per-user override flips it off and the middleware denies.
    const res = await request(app)
      .get('/api/inventory/items')
      .set('Authorization', `Bearer ${serverA}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_PERMISSION');
    expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
  });

  it('fails closed when a tenant has disabled a feature-gated route (Week 14)', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${managerA}`)
      .send({ orderId: uid(1), rating: 5, comment: 'Great' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FEATURE_DISABLED');
  });

  it('keeps analytics a management surface (SERVER lacks analytics:read, Week 19)', async () => {
    const res = await request(app)
      .get('/api/analytics/sales')
      .set('Authorization', `Bearer ${serverA}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_PERMISSION');
  });
});
});