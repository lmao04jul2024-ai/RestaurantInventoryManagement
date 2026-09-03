jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    tenant: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    user: { create: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    menu: { create: jest.fn() },
    order: { count: jest.fn(), aggregate: jest.fn() },
    menuItem: { count: jest.fn() },
    inventoryItem: { count: jest.fn(), fields: { minStock: {} } },
    review: { count: jest.fn(), aggregate: jest.fn() },
    session: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import prisma from '../src/services/database';
import { Prisma } from '@prisma/client';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { makeTenantProfileRow } from './factories/tenant';

// Interactive AND array transactions both run against the mocked delegates.
(prisma.$transaction as jest.Mock).mockImplementation(async (arg: unknown) => {
  if (typeof arg === 'function') return (arg as (tx: unknown) => Promise<unknown>)(prisma);
  return Promise.all(arg as Promise<unknown>[]);
});

const run = async (
  handler: (...args: any[]) => Promise<unknown>,
  reqPartial: Partial<TenantRequest>,
): Promise<{ res: MockRes; next: jest.Mock }> => {
  const res = createRes();
  const next = jest.fn();
  await handler(asRequest<TenantRequest>(reqPartial), res as any, next as any);
  return { res, next };
};

const tenantReq = (extra: Partial<TenantRequest> = {}): Partial<TenantRequest> => ({
  tenantId: 'tenant-1',
  user: { userId: 'user-1', tenantId: 'tenant-1' } as TenantRequest['user'],
  ...extra,
});

const bodyOf = (res: MockRes) => res.body as Record<string, unknown>;

const VALID_ONBOARDING = {
  restaurantName: 'Demo Restaurant',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@restaurant.com',
  password: 'StrongPass1',
  timezone: 'America/New_York',
  currency: 'USD',
  taxRate: 8.5,
};
describe('tenant onboarding (15.4)', () => {
  const { onboardTenant } = require('../src/controllers/tenant.controller');

  beforeEach(() => jest.clearAllMocks());

  it('creates a tenant + first ADMIN + default menu and returns tokens', async () => {
    const tenantRow = makeTenantProfileRow({ id: 't-new', slug: 'demo-restaurant' });
    const adminRow = {
      id: 'u-admin',
      email: 'ada@restaurant.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'ADMIN',
      tenantId: 't-new',
      emailVerified: true,
    };
    (prisma.tenant.create as jest.Mock).mockResolvedValue(tenantRow);
    (prisma.user.create as jest.Mock).mockResolvedValue(adminRow);
    (prisma.menu.create as jest.Mock).mockResolvedValue({ id: 'menu-1' });
    (prisma.session.create as jest.Mock).mockResolvedValue({ id: 'sess-1' });

    const { res } = await run(onboardTenant, {
      body: VALID_ONBOARDING,
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Demo Restaurant',
        slug: 'demo-restaurant',
        timezone: 'America/New_York',
        currency: 'USD',
        taxRate: 8.5,
      }),
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: 'ADMIN', tenantId: 't-new', emailVerified: true }),
    });
    expect(prisma.menu.create).toHaveBeenCalledWith({
      data: { name: 'Main Menu', tenantId: 't-new' },
    });
    expect(bodyOf(res)).toMatchObject({
      tenant: { id: 't-new', slug: 'demo-restaurant' },
      user: { id: 'u-admin', role: 'ADMIN' },
    });
    expect(typeof (bodyOf(res).accessToken)).toBe('string');
    expect(typeof (bodyOf(res).refreshToken)).toBe('string');
  });

  it('allocates a suffixed slug when the base is taken', async () => {
    (prisma.tenant.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'someone-else' })
      .mockResolvedValueOnce(null);
    (prisma.tenant.create as jest.Mock).mockResolvedValue(
      makeTenantProfileRow({ id: 't-new', slug: 'demo-restaurant-2' }),
    );
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });
    (prisma.menu.create as jest.Mock).mockResolvedValue({ id: 'menu-1' });
    (prisma.session.create as jest.Mock).mockResolvedValue({ id: 'sess-1' });

    const { res } = await run(onboardTenant, {
      body: { ...VALID_ONBOARDING, restaurantName: 'Demo Restaurant!' },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ slug: 'demo-restaurant-2' }),
    });
    expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(2);
  });

  it('rejects a weak password before touching the database', async () => {
    const { next } = await run(onboardTenant, {
      body: { ...VALID_ONBOARDING, password: 'short' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
describe('tenant profile & configuration (15.2 / 15.3)', () => {
  const { getMyTenant, updateMyTenant } = require('../src/controllers/tenant.controller');

  beforeEach(() => jest.clearAllMocks());

  it('returns the resolved tenant profile with a user count', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(makeTenantProfileRow());
    (prisma.user.count as jest.Mock).mockResolvedValue(5);

    const { res } = await run(getMyTenant, tenantReq());

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 'tenant-1' } });
    expect(bodyOf(res).data).toMatchObject({
      name: 'Demo Restaurant',
      timezone: 'America/New_York',
      currency: 'USD',
      plan: 'PRO',
      _count: { users: 5 },
    });
  });

  it('404s when the resolved tenant does not exist', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);

    const { next } = await run(getMyTenant, tenantReq());
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'TENANT_NOT_FOUND', statusCode: 404 });
  });

  it('updates configurable fields and never the slug', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(makeTenantProfileRow());
    (prisma.tenant.update as jest.Mock).mockResolvedValue(
      makeTenantProfileRow({ taxRate: 9.5, timezone: 'UTC' }),
    );

    const { res } = await run(updateMyTenant, {
      ...tenantReq(),
      body: { timezone: 'UTC', taxRate: 9.5, currency: 'EUR', plan: 'BASIC' },
    });

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { timezone: 'UTC', taxRate: 9.5, currency: 'EUR', plan: 'BASIC' },
    });
    expect(bodyOf(res).data).toMatchObject({ timezone: 'UTC', taxRate: 9.5 });
  });

  it('rejects an invalid plan tier with 400', async () => {
    const { next } = await run(updateMyTenant, {
      ...tenantReq(),
      body: { plan: 'GOLD' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('404s when updating an unknown tenant', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);

    const { next } = await run(updateMyTenant, {
      ...tenantReq(),
      body: { name: 'Rebrand' },
    });
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'TENANT_NOT_FOUND', statusCode: 404 });
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});
describe('tenant usage analytics & billing (15.6)', () => {
  const { getTenantAnalytics } = require('../src/controllers/tenant.controller');

  beforeEach(() => jest.clearAllMocks());

  it('aggregates usage + billing usage for the tenant window', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
      plan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      seatsLimit: 25,
    });
    (prisma.order.count as jest.Mock)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3);
    (prisma.order.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { totalAmount: 1250 } })
      .mockResolvedValueOnce({ _sum: { totalAmount: 400 } });
    (prisma.user.count as jest.Mock)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(8);
    (prisma.menuItem.count as jest.Mock)
      .mockResolvedValueOnce(42)
      .mockResolvedValueOnce(38);
    (prisma.inventoryItem.count as jest.Mock).mockResolvedValueOnce(4);
    (prisma.review.aggregate as jest.Mock).mockResolvedValueOnce({
      _avg: { rating: 4.5 },
      _count: 10,
    });

    const { res } = await run(getTenantAnalytics, tenantReq({ query: { days: '30' } }));

    expect(bodyOf(res).data).toEqual({
      windowDays: 30,
      orders: { total: 40, inWindow: 12, active: 3 },
      revenue: { total: 1250, inWindow: 400 },
      customers: { total: 30, newInWindow: 5 },
      menu: { items: 42, available: 38 },
      inventory: { lowStock: 4 },
      reviews: { total: 10, avgRating: 4.5 },
      billing: { plan: 'PRO', subscriptionStatus: 'ACTIVE', seatsUsed: 8, seatsLimit: 25 },
    });
    expect(prisma.review.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
  });

  it('404s for a missing tenant', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);

    const { next } = await run(getTenantAnalytics, tenantReq({ query: {} }));
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'TENANT_NOT_FOUND', statusCode: 404 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('tenant branding & theme (Week 17)', () => {
  const { updateMyTenant } = require('../src/controllers/tenant.controller');

  beforeEach(() => jest.clearAllMocks());

  it('persists a valid theme/branding document', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(makeTenantProfileRow());
    (prisma.tenant.update as jest.Mock).mockResolvedValue(
      makeTenantProfileRow({
        theme: {
          preset: 'custom',
          mode: 'dark',
          custom: { primary: '#DC2626', secondary: '#7C3AED' },
          branding: { logoUrl: 'https://cdn.example.com/logo.png', fontFamily: 'georgia' },
        },
      }),
    );

    const theme = {
      preset: 'custom',
      mode: 'dark',
      custom: { primary: '#DC2626', secondary: '#7C3AED' },
      branding: { logoUrl: 'https://cdn.example.com/logo.png', fontFamily: 'georgia' },
    };
    const { res } = await run(updateMyTenant, { ...tenantReq(), body: { theme } });

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { theme },
    });
    expect(bodyOf(res).data).toMatchObject({ theme: { preset: 'custom', mode: 'dark' } });
  });

  it('clears branding via theme null (Prisma.DbNull, never raw null)', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(makeTenantProfileRow());
    (prisma.tenant.update as jest.Mock).mockResolvedValue(makeTenantProfileRow({ theme: {} }));

    await run(updateMyTenant, { ...tenantReq(), body: { theme: null } });

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { theme: Prisma.DbNull },
    });
  });

  it('rejects a non-hex custom color with 400', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(makeTenantProfileRow());

    const { next } = await run(updateMyTenant, {
      ...tenantReq(),
      body: { theme: { preset: 'custom', mode: 'light', custom: { primary: 'red', secondary: '#7C3AED' } } },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('rejects a non-https logo URL with 400', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(makeTenantProfileRow());

    const { next } = await run(updateMyTenant, {
      ...tenantReq(),
      body: {
        theme: {
          preset: 'classic',
          mode: 'system',
          branding: { logoUrl: 'http://insecure.example.com/logo.png' },
        },
      },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown fontFamily with 400', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(makeTenantProfileRow());

    const { next } = await run(updateMyTenant, {
      ...tenantReq(),
      body: {
        theme: { preset: 'classic', mode: 'system', branding: { fontFamily: 'comic-sans' } },
      },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});
