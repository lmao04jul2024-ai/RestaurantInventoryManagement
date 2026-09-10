/**
 * L052 regression — credential-entry auth must not require upfront tenant
 * resolution. `resolveTenant` gating POST /api/auth/login made every web
 * login fail with TENANT_REQUIRED: the browser has no JWT yet, sends no
 * X-Tenant-ID before its first successful login, and dev has no subdomain.
 * The controller now resolves the tenant from the credential match itself.
 *
 * Pattern: controller-level unit with a mocked Prisma layer (same as
 * tests/tenant.spec.ts); REAL bcrypt at a low cost keeps credential checks
 * honest without mocking crypto.
 */

jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    user: {
      findMany: jest.fn(),
    },
    session: { create: jest.fn() },
  },
}));

import prisma from '../src/services/database';
import bcrypt from 'bcryptjs';
import { login } from '../src/controllers/auth.controller';
import { asRequest, createRes } from './helpers/mock-express';
import type { TenantRequest } from '../src/middleware/tenant';

const findMany = prisma.user.findMany as jest.Mock;
const sessionCreate = prisma.session.create as jest.Mock;

const PASSWORD = 'Sup3rSecret!';
const hash = bcrypt.hashSync(PASSWORD, 4); // low cost — real KDF, fast in tests

const userRow = (
  overrides: Partial<{ id: string; email: string; tenantId: string; role: string; password: string }> = {},
) => ({
  id: overrides.id ?? 'u-1',
  email: overrides.email ?? 'admin@example.com',
  password: overrides.password ?? hash,
  firstName: 'Ada',
  lastName: 'Admin',
  role: overrides.role ?? 'ADMIN',
  tenantId: overrides.tenantId ?? 'tenant-1',
  emailVerified: false,
});

const callLogin = async (body: Record<string, unknown>) => {
  const res = createRes();
  await login(
    asRequest<TenantRequest>({ body } as never),
    res as never,
    jest.fn((err?: unknown) => {
      if (err) throw err;
    }),
  );
  return res;
};

beforeEach(() => {
  findMany.mockReset();
  sessionCreate.mockReset();
  sessionCreate.mockResolvedValue({ id: 'sess-1' });
});

describe('login — tenant resolution from credentials (L052)', () => {
  it('logs in with NO tenant hints — the web app regression', async () => {
    const u = userRow();
    findMany.mockResolvedValue([u]);

    const res = await callLogin({ email: 'admin@example.com', password: PASSWORD });

    expect((res.body as { user: { tenantId: string } }).user.tenantId).toBe('tenant-1');
    expect((res.body as { accessToken: string }).accessToken).toBeTruthy();
    expect((res.body as { refreshToken: string }).refreshToken).toBeTruthy();
    // Identity lookup is email-global (scoped by credentials, not a hint).
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: 'admin@example.com', isActive: true }),
      }),
    );
    expect(findMany.mock.calls[0][0].where.tenantId).toBeUndefined();
  });

  it('picks the right tenant when the email exists in two restaurants but only one password matches', async () => {
    const a = userRow({ id: 'u-a', tenantId: 'tenant-a' });
    const b = userRow({ id: 'u-b', tenantId: 'tenant-b', password: bcrypt.hashSync('OtherPass1', 4) });
    findMany.mockResolvedValue([a, b]);

    const res = await callLogin({ email: 'admin@example.com', password: PASSWORD });

    expect((res.body as { user: { tenantId: string } }).user.tenantId).toBe('tenant-a');
  });

  it('400 TENANT_AMBIGUOUS when credentials match accounts in multiple tenants', async () => {
    findMany.mockResolvedValue([
      userRow({ id: 'u-a', tenantId: 'tenant-a' }),
      userRow({ id: 'u-b', tenantId: 'tenant-b' }),
    ]);

    const res = await callLogin({ email: 'admin@example.com', password: PASSWORD });

    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('TENANT_AMBIGUOUS');
  });

  it('body tenantId pre-narrows the candidate search', async () => {
    const guid = '11111111-2222-3333-4444-555555555555';
    findMany.mockResolvedValue([userRow({ tenantId: guid })]);

    const res = await callLogin({
      email: 'admin@example.com',
      password: PASSWORD,
      tenantId: guid,
    });

    expect((res.body as { user: { tenantId: string } }).user.tenantId).toBe(guid);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: guid }),
      }),
    );
  });

  it('401 INVALID_CREDENTIALS when no account matches (uniform + timing-equalized)', async () => {
    findMany.mockResolvedValue([]);

    const res = await callLogin({ email: 'ghost@example.com', password: 'Whatever1' });

    expect(res.statusCode).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('401 when accounts exist but the password is wrong', async () => {
    findMany.mockResolvedValue([userRow()]);

    const res = await callLogin({ email: 'admin@example.com', password: 'WrongPass1' });

    expect(res.statusCode).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('inactive users are invisible to login', async () => {
    findMany.mockResolvedValue([]); // isActive:true filter excluded them upstream

    const res = await callLogin({ email: 'admin@example.com', password: PASSWORD });

    expect(res.statusCode).toBe(401);
    expect(sessionCreate).not.toHaveBeenCalled();
  });

  it('creates a login session on success', async () => {
    findMany.mockResolvedValue([userRow()]);

    await callLogin({ email: 'admin@example.com', password: PASSWORD });

    expect(sessionCreate).toHaveBeenCalledTimes(1);
    expect(sessionCreate.mock.calls[0][0].data.userId).toBe('u-1');
  });
});
