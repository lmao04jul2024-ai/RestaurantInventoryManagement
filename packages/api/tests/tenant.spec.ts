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
