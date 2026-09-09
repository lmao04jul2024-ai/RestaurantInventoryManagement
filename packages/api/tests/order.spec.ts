jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    order: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    orderItem: {
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    menuItem: { findMany: jest.fn() },
    user: { findFirst: jest.fn() },
    table: { findFirst: jest.fn() },
    payment: { upsert: jest.fn() },
    // Both transaction shapes: array (parallel ops) and interactive (tx => ...).
    $transaction: jest.fn(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops as Promise<unknown>[]);
      return (ops as (tx: unknown) => unknown)(require('../src/services/database').default);
    }),
  },
}));

jest.mock('../src/services/order-events', () => ({
  __esModule: true,
  publishOrderEvent: jest.fn(),
  subscribeOrderEvents: jest.fn(() => jest.fn()),
}));

import prisma from '../src/services/database';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { makeMenuRow, makeOrderRow } from './factories/order';
import { publishOrderEvent, subscribeOrderEvents } from '../src/services/order-events';

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
  user: { userId: 'user-1', tenantId: 'tenant-1' } as TenantRequest['user'],
  ...extra,
});

const oid = uid(9);
const iid = uid(3);

const bodyOf = (res: MockRes) => res.body as Record<string, unknown>;

const menu = () => makeMenuRow({ id: uid(1) });

describe('order create (9.1)', () => {
  const { createOrder } = require('../src/controllers/order.controller');

  beforeEach(() => jest.clearAllMocks());

  it('snapshots effective prices per line and creates with items atomically', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      menu(),
      makeMenuRow({ id: uid(2), name: 'Fries', price: 4, pricingRules: [
        { id: 'rule-1', isActive: true, adjustmentType: 'FIXED_PRICE', amount: 3, priority: 1, daysOfWeek: [], startTime: null, endTime: null, name: null, menuItemId: uid(2), createdAt: new Date('2026-02-16T09:00:00.000Z'), updatedAt: new Date('2026-02-16T09:00:00.000Z') },
      ] }),
    ]);
    (prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-1' });
    (prisma.order.findUniqueOrThrow as jest.Mock).mockResolvedValue(makeOrderRow({ id: 'order-1' }));

    const { res, next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 2 }, { menuItemId: uid(2), quantity: 1 }] },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    const created = (prisma.order.create as jest.Mock).mock.calls[0][0].data;
    // Line 1 at base price (no rules); line 2 snaps to the always-on fixed price rule.
    expect(created.items.create).toEqual([
      { menuItemId: uid(1), quantity: 2, specialInstructions: undefined, unitPrice: 10 },
      { menuItemId: uid(2), quantity: 1, specialInstructions: undefined, unitPrice: 3 },
    ]);
    expect(created.totalAmount).toBe(23);
    expect(created.customerId).toBe('user-1');
    expect(publishOrderEvent).toHaveBeenCalledWith('tenant-1', { type: 'order:created', orderId: 'order-1', status: 'PENDING' });
    expect(bodyOf(res)).toMatchObject({ data: { id: 'order-1' } });
  });

  it('rejects lines referencing another tenant’s menu with 404', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);

    const { next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 1 }] },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'MENU_ITEM_NOT_FOUND', statusCode: 404 });
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('rejects items unavailable at the current instant with 409', async () => {
    // Window 00:00–00:00 (start<=end → [0,0)) matches no instant of any day.
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      makeMenuRow({ id: uid(1), availabilityWindows: [{ id: 'w1', isActive: true, daysOfWeek: [], startTime: '00:00', endTime: '00:00', name: null, menuItemId: uid(1), createdAt: new Date('2026-02-16T09:00:00.000Z'), updatedAt: new Date('2026-02-16T09:00:00.000Z') }] }),
    ]);

    const { next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 1 }] },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'ITEM_UNAVAILABLE', statusCode: 409 });
    expect(next.mock.calls[0][0].message).toContain('Burger');
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('validates a staff-named customer lives in the tenant', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    const { next } = await run(createOrder, {
      ...tenantReq(),
      body: { customerId: uid(5), items: [{ menuItemId: uid(1), quantity: 1 }] },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'CUSTOMER_NOT_FOUND', statusCode: 404 });
  });

  it('forces CUSTOMER role orders to their own userId without a lookup', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([menu()]);
    (prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-1' });
    (prisma.order.findUniqueOrThrow as jest.Mock).mockResolvedValue(makeOrderRow());

    await run(createOrder, {
      ...tenantReq({ user: { userId: 'user-1', tenantId: 'tenant-1', role: 'CUSTOMER' } as TenantRequest['user'] }),
      body: { customerId: uid(5), items: [{ menuItemId: uid(1), quantity: 1 }] },
    });

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect((prisma.order.create as jest.Mock).mock.calls[0][0].data.customerId).toBe('user-1');
  });
});

describe('order list & detail (9.5)', () => {
  const { listOrders, getOrder } = require('../src/controllers/order.controller');

  beforeEach(() => jest.clearAllMocks());

  it('paginates tenant orders with the pagination envelope', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.order.count as jest.Mock).mockResolvedValue(21);

    const { res } = await run(listOrders, tenantReq({ query: { page: '2', limit: '10' } }));

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' }, skip: 10, take: 10 }),
    );
    expect(bodyOf(res)).toMatchObject({ pagination: { page: 2, limit: 10, total: 21, totalPages: 3 } });
  });

  it('narrows CUSTOMER listing to their own history regardless of query', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.order.count as jest.Mock).mockResolvedValue(0);

    await run(listOrders, tenantReq({ user: { userId: 'user-1', tenantId: 'tenant-1', role: 'CUSTOMER' } as TenantRequest['user'], query: {} }));

    const where = (prisma.order.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where).toMatchObject({ tenantId: 'tenant-1', customerId: 'user-1' });
  });

  it('hides other customers’ orders from CUSTOMER role with 404', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(makeOrderRow({ customerId: 'user-2' }));

    const { next } = await run(getOrder, {
      ...tenantReq({ user: { userId: 'user-1', tenantId: 'tenant-1', role: 'CUSTOMER' } as TenantRequest['user'] }),
      params: { id: oid },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
  });
});

describe('order update & cancel (9.1/9.2)', () => {
  const { updateOrder, cancelOrder } = require('../src/controllers/order.controller');

  beforeEach(() => jest.clearAllMocks());

  it('only allows editing PENDING orders', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'user-2', status: 'CONFIRMED', paymentStatus: 'PENDING', totalAmount: 20,
    });

    const { next } = await run(updateOrder, {
      ...tenantReq(),
      params: { id: oid },
      body: { specialRequests: 'no onions' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'ORDER_NOT_EDITABLE', statusCode: 409 });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('patches specialRequests/tableId on a PENDING order', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'user-2', status: 'PENDING', paymentStatus: 'PENDING', totalAmount: 20,
    });
    (prisma.order.update as jest.Mock).mockResolvedValue(makeOrderRow());

    const { res } = await run(updateOrder, {
      ...tenantReq(),
      params: { id: oid },
      body: { specialRequests: 'no onions' },
    });

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: oid }, data: { specialRequests: 'no onions' } }),
    );
    expect(bodyOf(res)).toMatchObject({ data: { id: 'order-1' } });
  });

  it('refuses cancelling past CONFIRMED', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'user-2', status: 'PREPARING', paymentStatus: 'PENDING', totalAmount: 20,
    });

    const { next } = await run(cancelOrder, tenantReq({ params: { id: oid } }));

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'INVALID_ORDER_TRANSITION', statusCode: 409 });
  });
});

describe('order status workflow (9.2)', () => {
  const { updateOrderStatus } = require('../src/controllers/order.controller');

  const compact = (over: Record<string, unknown> = {}) => ({
    id: 'order-1', customerId: 'user-2', status: 'PENDING', paymentStatus: 'PENDING', totalAmount: 20, ...over,
  });

  beforeEach(() => jest.clearAllMocks());

  it('advances PENDING → CONFIRMED and publishes the event', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(compact());
    (prisma.order.update as jest.Mock).mockResolvedValue(makeOrderRow({ status: 'CONFIRMED' }));

    const { res } = await run(updateOrderStatus, {
      ...tenantReq(),
      params: { id: oid },
      body: { status: 'CONFIRMED' },
    });

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: oid }, data: { status: 'CONFIRMED' } }),
    );
    expect(publishOrderEvent).toHaveBeenCalledWith('tenant-1', { type: 'order:updated', orderId: 'order-1', status: 'CONFIRMED' });
    expect(bodyOf(res)).toMatchObject({ data: { status: 'CONFIRMED' } });
  });

  it('stamps completedAt when an order completes', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(compact({ status: 'READY' }));
    (prisma.order.update as jest.Mock).mockResolvedValue(makeOrderRow({ status: 'COMPLETED' }));

    await run(updateOrderStatus, {
      ...tenantReq(),
      params: { id: oid },
      body: { status: 'COMPLETED' },
    });

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }) }),
    );
  });

  it('rejects skipping lifecycle stages with 409', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(compact());

    const { next } = await run(updateOrderStatus, {
      ...tenantReq(),
      params: { id: oid },
      body: { status: 'COMPLETED' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'INVALID_ORDER_TRANSITION', statusCode: 409 });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('blocks progress on a FAILED payment except cancellation', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(compact({ status: 'CONFIRMED', paymentStatus: 'FAILED' }));

    const { next } = await run(updateOrderStatus, {
      ...tenantReq(),
      params: { id: oid },
      body: { status: 'PREPARING' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'PAYMENT_FAILED', statusCode: 409 });
  });
});

describe('KDS per-line progression (9.3)', () => {
  const { updateOrderItemStatus } = require('../src/controllers/order.controller');

  beforeEach(() => jest.clearAllMocks());

  it('moves a line PENDING → PREPARING and publishes the item event', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'user-2', status: 'CONFIRMED', paymentStatus: 'PENDING', totalAmount: 20,
    });
    (prisma.orderItem.findFirst as jest.Mock).mockResolvedValue({ id: 'oi-1', status: 'PENDING', quantity: 2 });
    (prisma.orderItem.update as jest.Mock).mockResolvedValue({});
    (prisma.order.findFirst as jest.Mock).mockResolvedValueOnce(makeOrderRow());

    const { res } = await run(updateOrderItemStatus, {
      ...tenantReq(),
      params: { id: oid, itemId: iid },
      body: { status: 'PREPARING' },
    });

    expect(prisma.orderItem.update).toHaveBeenCalledWith({ where: { id: iid }, data: { status: 'PREPARING' } });
    expect(publishOrderEvent).toHaveBeenCalledWith('tenant-1', {
      type: 'order:item:updated', orderId: oid, itemId: iid, status: 'PREPARING',
    });
    expect(bodyOf(res)).toMatchObject({ data: { id: 'order-1' } });
  });

  it('rejects backwards or skipping line moves with 409', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'user-2', status: 'CONFIRMED', paymentStatus: 'PENDING', totalAmount: 20,
    });
    (prisma.orderItem.findFirst as jest.Mock).mockResolvedValue({ id: 'oi-1', status: 'PENDING', quantity: 2 });

    const { next } = await run(updateOrderItemStatus, {
      ...tenantReq(),
      params: { id: oid, itemId: iid },
      body: { status: 'READY' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'INVALID_ITEM_TRANSITION', statusCode: 409 });
    expect(prisma.orderItem.update).not.toHaveBeenCalled();
  });

  it('flips the order to READY once every line is READY', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'user-2', status: 'PREPARING', paymentStatus: 'PENDING', totalAmount: 20,
    });
    (prisma.orderItem.findFirst as jest.Mock).mockResolvedValue({ id: 'oi-2', status: 'PREPARING', quantity: 1 });
    (prisma.orderItem.update as jest.Mock).mockResolvedValue({});
    (prisma.orderItem.count as jest.Mock)
      .mockResolvedValueOnce(0) // lines not yet READY
      .mockResolvedValueOnce(2); // total lines
    (prisma.order.update as jest.Mock).mockResolvedValue(makeOrderRow({ status: 'READY' }));

    const { res } = await run(updateOrderItemStatus, {
      ...tenantReq(),
      params: { id: oid, itemId: iid },
      body: { status: 'READY' },
    });

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: oid }, data: { status: 'READY' } }),
    );
    expect(publishOrderEvent).toHaveBeenCalledWith('tenant-1', { type: 'order:updated', orderId: oid, status: 'READY' });
    expect(bodyOf(res)).toMatchObject({ data: { status: 'READY' } });
  });

  it('refuses line progress on closed orders', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'user-2', status: 'COMPLETED', paymentStatus: 'PAID', totalAmount: 20,
    });

    const { next } = await run(updateOrderItemStatus, {
      ...tenantReq(),
      params: { id: oid, itemId: iid },
      body: { status: 'PREPARING' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'ORDER_CLOSED', statusCode: 409 });
  });
});

describe('payment collection (9.4/9.6)', () => {
  const { payOrder } = require('../src/controllers/order.controller');

  beforeEach(() => jest.clearAllMocks());

  it('records the payment, flips paymentStatus, and publishes order:paid', async () => {
    // Call 1: ownership lookup (unpaid); call 2: reload after payment.
    (prisma.order.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'order-1', customerId: 'user-2', status: 'READY', paymentStatus: 'PENDING', totalAmount: 20,
      })
      .mockResolvedValueOnce(makeOrderRow({ paymentStatus: 'PAID' }));
    (prisma.payment.upsert as jest.Mock).mockResolvedValue({});
    (prisma.order.update as jest.Mock).mockResolvedValue({});

    const { res } = await run(payOrder, {
      ...tenantReq(),
      params: { id: oid },
      body: { method: 'CARD' },
    });

    const upsert = (prisma.payment.upsert as jest.Mock).mock.calls[0][0];
    expect(upsert.where).toEqual({ orderId: oid });
    // Amount defaults to the snapshotted order total when not supplied.
    expect(upsert.create).toMatchObject({ amount: 20, method: 'CARD', status: 'PAID', paidAt: expect.any(Date) });
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: oid }, data: { paymentStatus: 'PAID' } });
    expect(publishOrderEvent).toHaveBeenCalledWith('tenant-1', { type: 'order:paid', orderId: oid });
    expect(bodyOf(res)).toMatchObject({ data: { paymentStatus: 'PAID' } });
  });

  it('refuses a second payment on an already-paid order', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'user-2', status: 'READY', paymentStatus: 'PAID', totalAmount: 20,
    });

    const { next } = await run(payOrder, {
      ...tenantReq(),
      params: { id: oid },
      body: { method: 'CASH' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'ORDER_ALREADY_PAID', statusCode: 409 });
    expect(prisma.payment.upsert).not.toHaveBeenCalled();
  });

  it('refuses collecting on a cancelled order', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'user-2', status: 'CANCELLED', paymentStatus: 'PENDING', totalAmount: 20,
    });

    const { next } = await run(payOrder, {
      ...tenantReq(),
      params: { id: oid },
      body: { method: 'CASH' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'ORDER_CANCELLED', statusCode: 409 });
  });
});

describe('customer self-service payment (10.4)', () => {
  const { payOrder } = require('../src/controllers/order.controller');

  const customerReq = (userId: string): Partial<TenantRequest> => ({
    ...tenantReq({
      user: { userId, tenantId: 'tenant-1', role: 'CUSTOMER' } as TenantRequest['user'],
    }),
  });

  beforeEach(() => jest.clearAllMocks());

  it('settles the customer’s own PENDING ticket, forcing the amount to the snapshotted total', async () => {
    // Call 1: ownership lookup (unpaid); call 2: reload after payment.
    (prisma.order.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'order-1',
        customerId: 'cust-1',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        totalAmount: 42.5,
      })
      .mockResolvedValueOnce(makeOrderRow({ paymentStatus: 'PAID' }));
    (prisma.payment.upsert as jest.Mock).mockResolvedValue({});
    (prisma.order.update as jest.Mock).mockResolvedValue({});

    const { res } = await run(payOrder, {
      ...customerReq('cust-1'),
      params: { id: oid },
      body: { method: 'CARD', amount: 1 }, // client-supplied amount must be overridden
    });

    const upsert = (prisma.payment.upsert as jest.Mock).mock.calls[0][0];
    expect(upsert.create).toMatchObject({
      amount: 42.5,
      method: 'CARD',
      status: 'PAID',
      paidAt: expect.any(Date),
    });
    expect(upsert.create.transactionId).toMatch(/^SIM-/);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: oid },
      data: { paymentStatus: 'PAID' },
    });
    expect(publishOrderEvent).toHaveBeenCalledWith('tenant-1', { type: 'order:paid', orderId: oid });
    expect(bodyOf(res)).toMatchObject({ data: { paymentStatus: 'PAID' } });
  });

  it('rejects CASH self-service with 400', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      totalAmount: 20,
    });

    const { next } = await run(payOrder, {
      ...customerReq('cust-1'),
      params: { id: oid },
      body: { method: 'CASH' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'CASH_NOT_SELF_SERVICE', statusCode: 400 });
    expect(prisma.payment.upsert).not.toHaveBeenCalled();
  });

  it('hides other customers’ orders behind 403', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1',
      customerId: 'cust-2',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      totalAmount: 20,
    });

    const { next } = await run(payOrder, {
      ...customerReq('cust-1'),
      params: { id: oid },
      body: { method: 'CARD' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'ORDER_FORBIDDEN', statusCode: 403 });
    expect(prisma.payment.upsert).not.toHaveBeenCalled();
  });
});

describe('kitchen queue & dashboard summary (9.3/9.6)', () => {
  const { kitchenQueue, orderSummary } = require('../src/controllers/order.controller');

  beforeEach(() => jest.clearAllMocks());

  it('queues only accepted, still-active orders oldest first', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

    const { res } = await run(kitchenQueue, tenantReq());

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', status: { in: ['CONFIRMED', 'PREPARING'] } },
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(bodyOf(res)).toEqual({ data: { live: [], scheduled: [] } });
  });

  it('splits scheduled-future tickets out of the live queue', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { id: 'o-live', scheduledFor: null },
      { id: 'o-scheduled', scheduledFor: tomorrow },
    ]);

    const { res } = await run(kitchenQueue, tenantReq());

    const data = bodyOf(res).data as { live: unknown[]; scheduled: unknown[] };
    expect(data.live).toHaveLength(1);
    expect(data.scheduled).toHaveLength(1);
  });

  it('aggregates status counts, paid revenue, and average order value', async () => {
    (prisma.order.groupBy as jest.Mock).mockResolvedValue([
      { status: 'PENDING', _count: 2 },
      { status: 'COMPLETED', _count: 3 },
    ]);
    (prisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: 100 } });
    (prisma.order.count as jest.Mock).mockResolvedValue(5);

    const { res } = await run(orderSummary, tenantReq({ query: { days: '30' } }));

    expect(bodyOf(res)).toMatchObject({
      data: {
        windowDays: 30,
        totalOrders: 5,
        countsByStatus: { PENDING: 2, COMPLETED: 3 },
        paidRevenue: 100,
        averageOrderValue: 20,
      },
    });
  });

  it('reports zero revenue as a 0 average rather than NaN', async () => {
    (prisma.order.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: null } });
    (prisma.order.count as jest.Mock).mockResolvedValue(0);

    const { res } = await run(orderSummary, tenantReq({ query: {} }));

    expect(bodyOf(res)).toMatchObject({ data: { totalOrders: 0, paidRevenue: 0, averageOrderValue: 0 } });
  });
});

describe('real-time SSE stream (9.4)', () => {
  const { streamOrderEvents } = require('../src/controllers/order.controller');

  beforeEach(() => jest.clearAllMocks());

  it('writes SSE headers, subscribes per-tenant, and broadcasts events', async () => {
    const res = createRes() as MockRes & { writeHead: jest.Mock; write: jest.Mock };
    res.writeHead = jest.fn();
    res.write = jest.fn();
    const next = jest.fn();
    const req = asRequest<TenantRequest>({
      tenantId: 'tenant-1',
      user: { userId: 'user-1', tenantId: 'tenant-1' } as TenantRequest['user'],
      on: jest.fn(),
    });

    await streamOrderEvents(req, res as any, next as any);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'text/event-stream' }));
    expect(subscribeOrderEvents).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(req.on).toHaveBeenCalledWith('close', expect.any(Function));

    // Simulate a published event reaching this subscriber.
    const send = (subscribeOrderEvents as jest.Mock).mock.calls[0][1] as (e: unknown) => void;
    send({ type: 'order:created', orderId: 'order-9', status: 'PENDING' });
    expect(res.write).toHaveBeenCalledWith(
      'event: order:created\ndata: {"type":"order:created","orderId":"order-9","status":"PENDING"}\n\n',
    );
  });
});