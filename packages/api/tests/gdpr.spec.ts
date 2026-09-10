jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    user: { findFirst: jest.fn(), update: jest.fn() },
    order: { findMany: jest.fn() },
    review: { findMany: jest.fn() },
    loyaltyEntry: { findMany: jest.fn() },
    session: { deleteMany: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

jest.mock('../src/services/audit', () => ({
  __esModule: true,
  writeSecurityEvent: jest.fn(() => Promise.resolve(undefined)),
  writeAuditLog: jest.fn(() => Promise.resolve(undefined)),
}));

import prisma from '../src/services/database';
import { writeSecurityEvent } from '../src/services/audit';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { getMyData, eraseMyData } from '../src/controllers/gdpr.controller';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const run = async (
  handler: (...args: any[]) => Promise<unknown>,
  reqPartial: Partial<TenantRequest>,
): Promise<{ res: MockRes; next: jest.Mock }> => {
  const res = createRes();
  const next = jest.fn();
  await handler(asRequest<TenantRequest>(reqPartial), res as any, next as any);
  return { res, next };
};

const me = (): Partial<TenantRequest> => ({
  tenantId: 'tenant-1',
  user: { userId: uid(7), tenantId: 'tenant-1', role: 'CUSTOMER', email: 'c@x.com' } as TenantRequest['user'],
});

const profile = {
  id: uid(7), email: 'c@x.com', firstName: 'Casey', lastName: 'Kim', phone: '555',
  role: 'CUSTOMER', isActive: true, emailVerified: false, consentGivenAt: new Date(),
  dataErasedAt: null, createdAt: new Date(),
};

describe('22.4 — GDPR: data portability (GET /api/me/data)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the caller personal data across orders, reviews, and loyalty entries', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(profile);
    (prisma.order.findMany as jest.Mock).mockResolvedValue([{ id: 'o1', totalAmount: 20 }]);
    (prisma.review.findMany as jest.Mock).mockResolvedValue([{ id: 'r1', rating: 5 }]);
    (prisma.loyaltyEntry.findMany as jest.Mock).mockResolvedValue([{ id: 'l1', points: 12 }]);

    const { res, next } = await run(getMyData, me());

    expect(next).not.toHaveBeenCalled();
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data.user).toMatchObject({ email: 'c@x.com' });
    expect(data.orders).toHaveLength(1);
    expect(data.reviews).toHaveLength(1);
    expect(data.loyaltyEntries).toHaveLength(1);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: uid(7), tenantId: 'tenant-1' } }),
    );
  });

  it('404s when the user is not in this tenant (post-erasure or cross-tenant attempt)', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    const { res, next } = await run(getMyData, me());

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('USER_NOT_FOUND');
  });
});

describe('22.4 — GDPR: erasure (DELETE /api/me)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('anonymizes the row, disables the account, revokes sessions, and audits', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: uid(7), email: 'c@x.com' });

    const { res, next } = await run(eraseMyData, me());

    expect(next).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: uid(7) },
      data: expect.objectContaining({
        email: expect.stringContaining('erased-'),
        firstName: 'Deleted',
        lastName: 'User',
        isActive: false,
        phone: null,
        dataErasedAt: expect.any(Date),
      }),
    });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: uid(7) } });
    expect(writeSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'data_erasure', tenantId: 'tenant-1' }),
    );
    const body = res.body as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({ isActive: false, dataErasedAt: expect.any(Date) });
  });

  it('never erases another tenant user (404)', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    const { res, next } = await run(eraseMyData, me());

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});