jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

import prisma from '../src/services/database';
import type { AuthRequest } from '../src/middleware/auth';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { UserRole } from '@prisma/client';

/**
 * Week 11.6 — profile self-service (GET/PATCH /users/me) + staff lookup.
 * Controllers are exercised directly (mock-express doubles, prisma mocked).
 */

const run = async (
  handler: (...args: any[]) => Promise<unknown>,
  reqPartial: Partial<AuthRequest>,
): Promise<{ res: MockRes; next: jest.Mock }> => {
  const res = createRes();
  const next = jest.fn();
  await handler(asRequest<AuthRequest>(reqPartial), res as any, next as any);
  return { res, next };
};

const authReq = (userId: string, extra: Partial<AuthRequest> = {}): Partial<AuthRequest> => ({
  user: { userId, tenantId: 'tenant-1', role: UserRole.CUSTOMER } as AuthRequest['user'],
  ...extra,
});

const dbUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'customer@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: UserRole.CUSTOMER,
  tenantId: 'tenant-1',
  phone: null,
  isActive: true,
  passwordHash: 'super-secret',
  ...overrides,
});

const bodyOf = (res: MockRes) => res.body as Record<string, unknown>;

describe('GET /users/me (11.6)', () => {
  const { getMyProfile } = require('../src/controllers/user.controller');

  beforeEach(() => jest.clearAllMocks());

  it('returns the sanitized profile (no password hash)', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(dbUser());

    const { res, next } = await run(getMyProfile, authReq('user-1'));

    expect(next).not.toHaveBeenCalled();
    const data = bodyOf(res).data as Record<string, unknown>;
    expect(data.email).toBe('customer@example.com');
    expect(data).not.toHaveProperty('passwordHash');
  });

  it('401s without an authenticated user', async () => {
    const { res, next } = await run(getMyProfile, {});

    expect(res.status).toHaveBeenCalledWith(401);
    expect(bodyOf(res).error).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(next).not.toHaveBeenCalled();
  });

  it('404s when the account no longer exists', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const { next } = await run(getMyProfile, authReq('ghost'));

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'USER_NOT_FOUND', statusCode: 404 }),
    );
  });
});

describe('PATCH /users/me (11.6)', () => {
  const { updateMyProfile } = require('../src/controllers/user.controller');

  beforeEach(() => jest.clearAllMocks());

  it('updates names and phone and returns the sanitized profile', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue(
      dbUser({ firstName: 'Ada', lastName: 'King', phone: '+15550001111' }),
    );

    const { res, next } = await run(updateMyProfile, {
      ...authReq('user-1'),
      body: { firstName: 'Ada', lastName: 'King', phone: '+15550001111' },
    });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { firstName: 'Ada', lastName: 'King', phone: '+15550001111' },
    });
    const data = bodyOf(res).data as Record<string, unknown>;
    expect(data.lastName).toBe('King');
    expect(data).not.toHaveProperty('passwordHash');
  });

  it('normalizes surrounding whitespace via the Joi schema', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue(dbUser({ firstName: 'Grace' }));

    await run(updateMyProfile, {
      ...authReq('user-1'),
      body: { firstName: '  Grace  ' },
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { firstName: 'Grace' },
    });
  });

  it('rejects an empty body (min 1 field)', async () => {
    const { next } = await run(updateMyProfile, { ...authReq('user-1'), body: {} });

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects phone numbers longer than 20 chars', async () => {
    const { next } = await run(updateMyProfile, {
      ...authReq('user-1'),
      body: { phone: '1'.repeat(21) },
    });

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('401s without an authenticated user', async () => {
    const { res } = await run(updateMyProfile, { body: { firstName: 'X' } });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('GET /users/:id — staff lookup', () => {
  const { getUserById } = require('../src/controllers/user.controller');

  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  beforeEach(() => jest.clearAllMocks());

  it('returns a user scoped to the resolved tenant', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(dbUser());

    const { res, next } = await run(getUserById, {
      ...authReq('staff-1'),
      tenantId: 'tenant-1',
      params: { id: uuid(7) },
    } as Partial<AuthRequest>);

    expect(next).not.toHaveBeenCalled();
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: uuid(7), tenantId: 'tenant-1' },
    });
    expect((bodyOf(res).data as Record<string, unknown>).id).toBe('user-1');
  });

  it('404s for users outside the tenant', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    const { next } = await run(getUserById, {
      ...authReq('staff-1'),
      tenantId: 'tenant-1',
      params: { id: uuid(8) },
    } as Partial<AuthRequest>);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'USER_NOT_FOUND', statusCode: 404 }),
    );
  });
});

