jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    review: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: { findFirst: jest.fn() },
    $transaction: jest.fn(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops as Promise<unknown>[]);
      return (ops as (tx: unknown) => unknown)(require('../src/services/database').default);
    }),
  },
}));

import prisma from '../src/services/database';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { UserRole } from '@prisma/client';

/** Joi uuid validation requires real-shaped identifiers in params/bodies. */
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

const tenantReq = (extra: Partial<TenantRequest> = {}): Partial<TenantRequest> => ({
  tenantId: 'tenant-1',
  user: { userId: 'user-1', tenantId: 'tenant-1', role: UserRole.MANAGER } as TenantRequest['user'],
  ...extra,
});

const customerReq = (userId: string): Partial<TenantRequest> =>
  tenantReq({
    user: { userId, tenantId: 'tenant-1', role: UserRole.CUSTOMER } as TenantRequest['user'],
  });

const bodyOf = (res: MockRes) => res.body as Record<string, unknown>;

const oid = uid(9);

describe('review create (11.3)', () => {
  const { createReview } = require('../src/controllers/review.controller');

  beforeEach(() => jest.clearAllMocks());

  it('creates a review on a COMPLETED order owned by the customer', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'cust-1', status: 'COMPLETED',
    });
    (prisma.review.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.review.create as jest.Mock).mockResolvedValue({
      id: 'rev-1', rating: 5, comment: 'Great!', orderId: 'order-1',
      customerId: 'cust-1', tenantId: 'tenant-1', isVisible: true,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const { res, next } = await run(createReview, {
      ...customerReq('cust-1'),
      body: { orderId: oid, rating: 5, comment: 'Great!' },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1', tenantId: 'tenant-1', customerId: 'cust-1',
          rating: 5, comment: 'Great!',
        }),
      }),
    );
    expect(bodyOf(res).data).toMatchObject({ rating: 5, comment: 'Great!' });
  });

  it('rejects review on a non-COMPLETED order with 409', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'cust-1', status: 'PREPARING',
    });

    const { next } = await run(createReview, {
      ...customerReq('cust-1'),
      body: { orderId: oid, rating: 5 },
    });

    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'ORDER_NOT_COMPLETED', statusCode: 409,
    });
    expect(prisma.review.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate review on the same order with 409', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'cust-1', status: 'COMPLETED',
    });
    (prisma.review.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

    const { next } = await run(createReview, {
      ...customerReq('cust-1'),
      body: { orderId: oid, rating: 4 },
    });

    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'REVIEW_EXISTS', statusCode: 409,
    });
    expect(prisma.review.create).not.toHaveBeenCalled();
  });

  it('hides another customer order behind 404', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'cust-2', status: 'COMPLETED',
    });

    const { next } = await run(createReview, {
      ...customerReq('cust-1'),
      body: { orderId: oid, rating: 5 },
    });

    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'ORDER_NOT_FOUND', statusCode: 404,
    });
    expect(prisma.review.create).not.toHaveBeenCalled();
  });

  it('staff can review on behalf of the customer', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'cust-1', status: 'COMPLETED',
    });
    (prisma.review.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.review.create as jest.Mock).mockResolvedValue({
      id: 'rev-1', rating: 4, comment: null, customerId: 'cust-1',
    });

    const { res } = await run(createReview, {
      ...tenantReq(),
      body: { orderId: oid, rating: 4, comment: null },
    });

    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerId: 'cust-1' }),
      }),
    );
    expect(bodyOf(res).data).toMatchObject({ rating: 4 });
  });

  it('rejects rating outside 1-5 with 400', async () => {
    const { next } = await run(createReview, {
      ...customerReq('cust-1'),
      body: { orderId: oid, rating: 6 },
    });

    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'VALIDATION_ERROR', statusCode: 400,
    });
    expect(prisma.review.create).not.toHaveBeenCalled();
  });
});

describe('review list & moderation (11.4/11.5)', () => {
  const { listMyReviews, listReviews, setReviewVisibility, deleteReview } =
    require('../src/controllers/review.controller');

  beforeEach(() => jest.clearAllMocks());

  it('customer sees only their own reviews', async () => {
    (prisma.review.findMany as jest.Mock).mockResolvedValue([{ id: 'rev-1', rating: 5 }]);
    (prisma.review.count as jest.Mock).mockResolvedValue(1);

    const { res } = await run(listMyReviews, { ...customerReq('cust-1'), query: {} });

    const call = (prisma.review.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).toEqual({ tenantId: 'tenant-1', customerId: 'cust-1' });
    expect(bodyOf(res).data).toHaveLength(1);
    expect(bodyOf(res).pagination).toMatchObject({ page: 1, total: 1 });
  });

  it('staff sees all reviews for the tenant', async () => {
    (prisma.review.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.review.count as jest.Mock).mockResolvedValue(0);

    const { res } = await run(listReviews, { ...tenantReq(), query: {} });

    const call = (prisma.review.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).toEqual({ tenantId: 'tenant-1' });
    expect(bodyOf(res).data).toEqual([]);
  });

  it('staff toggles review visibility', async () => {
    (prisma.review.findFirst as jest.Mock).mockResolvedValue({ id: uid(1) });
    (prisma.review.update as jest.Mock).mockResolvedValue({ id: uid(1), isVisible: false });

    const { res } = await run(setReviewVisibility, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { isVisible: false },
    });

    expect(prisma.review.update).toHaveBeenCalledWith({
      where: { id: uid(1) },
      data: { isVisible: false },
      include: expect.anything(),
    });
    expect(bodyOf(res).data).toMatchObject({ id: uid(1), isVisible: false });
  });

  it('returns 404 when toggling visibility on a non-existent review', async () => {
    (prisma.review.findFirst as jest.Mock).mockResolvedValue(null);

    const { next } = await run(setReviewVisibility, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { isVisible: true },
    });

    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'REVIEW_NOT_FOUND', statusCode: 404,
    });
    expect(prisma.review.update).not.toHaveBeenCalled();
  });

  it('staff deletes a review (204)', async () => {
    (prisma.review.findFirst as jest.Mock).mockResolvedValue({ id: uid(1) });

    const res = createRes() as MockRes & { end: jest.Mock };
    res.end = jest.fn();
    const next = jest.fn();
    await deleteReview(asRequest<TenantRequest>({ ...tenantReq(), params: { id: uid(1) } }), res as any, next as any);

    expect(prisma.review.delete).toHaveBeenCalledWith({ where: { id: uid(1) } });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});