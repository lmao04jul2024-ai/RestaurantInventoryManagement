jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    tenant: { findFirst: jest.fn() },
  },
}));

import prisma from '../src/services/database';
import type { TenantRequest } from '../src/middleware/tenant';
import { getScopedWhere, resolveTenant } from '../src/middleware/tenant';
import { UserRole } from '@prisma/client';
import { asRequest, createRes, MockRes } from './helpers/mock-express';
import { makeTenantRow, makeUser } from './factories/user';

const findFirst = prisma.tenant.findFirst as jest.Mock;

const call = (
  reqPartial: Partial<TenantRequest>,
): Promise<{ res: MockRes; next: jest.Mock }> => {
  const res = createRes();
  const nextFn = jest.fn();
  return resolveTenant(asRequest<TenantRequest>(reqPartial), res as never, nextFn).then(
    () => ({ res, next: nextFn }),
  );
};

beforeEach(() => findFirst.mockReset());

describe('tenant resolution priority', () => {
  it('X-Tenant-ID header wins over query param', async () => {
    const t = makeTenantRow({ id: 't-header' });
    findFirst.mockResolvedValue(t);

    const { next } = await call({
      headers: { 'x-tenant-id': 't-header' },
      query: { tenantId: 't-query' },
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 't-header' }) }),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to ?tenantId= when header absent', async () => {
    const t = makeTenantRow({ id: 't-query' });
    findFirst.mockResolvedValue(t);

    await call({ headers: {}, query: { tenantId: 't-query' } });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 't-query' }) }),
    );
  });

  it('authenticated user JWT tenant is used last among explicit hints', async () => {
    const u = makeUser({ role: UserRole.CUSTOMER, tenantId: 't-user' });
    const t = makeTenantRow({ id: 't-user' });
    findFirst.mockResolvedValue(t);

    await call({ headers: {}, query: {}, user: { ...u } as never });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 't-user' }) }),
    );
  });

  it('resolves subdomain slugs for non-local hosts', async () => {
    const t = makeTenantRow({ slug: 'demo' });
    findFirst.mockResolvedValue(t);

    const { next, res } = await call({ headers: { host: 'demo.api.example.com' }, query: {} });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ slug: 'demo' }),
      }),
    );
    expect(res.statusCode).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('S1.3 — TENANT_ROOT_DOMAIN deterministic subdomain resolution', () => {
  let rootEnv: string | undefined;

  beforeEach(() => {
    rootEnv = process.env.TENANT_ROOT_DOMAIN;
    process.env.TENANT_ROOT_DOMAIN = 'yourapp.com';
  });

  afterEach(() => {
    if (rootEnv === undefined) delete process.env.TENANT_ROOT_DOMAIN;
    else process.env.TENANT_ROOT_DOMAIN = rootEnv;
  });

  it('resolves {tenant}.{root} to a slug lookup', async () => {
    findFirst.mockResolvedValue(makeTenantRow({ slug: 'acme' }));
    const { next, res } = await call({ headers: { host: 'acme.yourapp.com' }, query: {} });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ slug: 'acme', isActive: true }) }),
    );
    expect(res.statusCode).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('resolves api.{tenant}.{root} to the tenant label', async () => {
    findFirst.mockResolvedValue(makeTenantRow({ slug: 'acme' }));
    await call({ headers: { host: 'api.acme.yourapp.com:3001' }, query: {} });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ slug: 'acme' }) }),
    );
  });

  it('never resolves the apex or www host (marketing site)', async () => {
    for (const host of ['yourapp.com', 'www.yourapp.com', 'YOURAPP.COM:443']) {
      const { res, next } = await call({ headers: { host }, query: {} });
      expect(findFirst).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'TENANT_REQUIRED' } });
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('never heuristic-resolves hosts outside the configured root', async () => {
    const { res, next } = await call({ headers: { host: 'demo.api.example.com' }, query: {} });
    expect(findFirst).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps the legacy heuristic when TENANT_ROOT_DOMAIN is unset', async () => {
    delete process.env.TENANT_ROOT_DOMAIN;
    findFirst.mockResolvedValue(makeTenantRow({ slug: 'demo' }));
    await call({ headers: { host: 'demo.api.example.com' }, query: {} });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ slug: 'demo' }) }),
    );
  });
});

describe('guard rails', () => {
  it('400 TENANT_REQUIRED when unresolvable on localhost', async () => {
    const { res, next } = await call({ headers: { host: 'localhost:3001' }, query: {} });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'TENANT_REQUIRED' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('404 TENANT_NOT_FOUND for inactive/missing tenants', async () => {
    findFirst.mockResolvedValue(null);
    const { res } = await call({
      headers: { 'x-tenant-id': 'ghost' },
      query: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ error: { code: 'TENANT_NOT_FOUND' } });
  });

  it('403 TENANT_MISMATCH prevents cross-tenant credential use', async () => {
    const u = makeUser({ tenantId: 'my-home-tenant' });
    findFirst.mockResolvedValue(makeTenantRow({ id: 'other-tenant' }));

    const { res } = await call({
      headers: { 'x-tenant-id': 'other-tenant' },
      query: {},
      user: { ...u } as never,
    });
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ error: { code: 'TENANT_MISMATCH' } });
  });

  // ── Inactive-workspace recovery (self-lockout fix) ──────────────────────────
  describe('inactive workspace recovery', () => {
    const inactiveRow = makeTenantRow({ id: 't-inactive', isActive: false });
    const member = makeUser({ tenantId: 't-inactive', role: UserRole.ADMIN });

    it('lets a member GET their settings while inactive (settings page can load)', async () => {
      findFirst.mockResolvedValue(inactiveRow);
      const { next } = await call({
        headers: { 'x-tenant-id': 't-inactive' },
        query: {},
        method: 'GET',
        originalUrl: '/api/tenants/me',
        url: '/me',
        user: { ...member } as never,
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('lets a member PATCH their settings while inactive (reactivation path)', async () => {
      findFirst.mockResolvedValue(inactiveRow);
      const { next } = await call({
        headers: { 'x-tenant-id': 't-inactive' },
        query: {},
        method: 'PATCH',
        originalUrl: '/api/tenants/me',
        url: '/me',
        user: { ...member } as never,
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('blocks members from every other surface with 403 WORKSPACE_INACTIVE', async () => {
      findFirst.mockResolvedValue(inactiveRow);
      const { res, next } = await call({
        headers: { 'x-tenant-id': 't-inactive' },
        query: {},
        method: 'GET',
        originalUrl: '/api/menus',
        url: '/',
        user: { ...member } as never,
      });
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({ error: { code: 'WORKSPACE_INACTIVE' } });
    });

    it('still 404s inactive tenants for unauthenticated callers (no existence leak)', async () => {
      findFirst.mockResolvedValue(inactiveRow);
      const { res, next } = await call({
        headers: { 'x-tenant-id': 't-inactive' },
        query: {},
        method: 'GET',
        originalUrl: '/api/tenants/me',
        url: '/me',
      });
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'TENANT_NOT_FOUND' } });
    });
  });

});

describe('getScopedWhere helper', () => {
  it('returns scoped filter when tenant context exists', () => {
    const req = asRequest<TenantRequest>({ tenantId: 't-ok' });
    expect(getScopedWhere(req)).toEqual({ tenantId: 't-ok' });
  });

  it('fails loudly without middleware run first', () => {
    const req = asRequest<TenantRequest>({});
    expect(() => getScopedWhere(req)).toThrow(/Tenant context missing/);
  });
});
