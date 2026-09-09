/**
 * Week 20 — advanced ordering features (20.1–20.6) unit tests.
 *
 * Covers scheduled ordering bounds, group-order lifecycle, loyalty accrual &
 * redemption (flag-gated), promo-code economics, recommendation shaping, and
 * recurring-order run-due. Order lifecycle happy paths stay in order.spec;
 * route RBAC gates are covered by the multi-tenant integration suite.
 */
jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    user: { findFirst: jest.fn() },
    table: { findFirst: jest.fn() },
    menuItem: { findMany: jest.fn() },
    order: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
    orderItem: { groupBy: jest.fn() },
    payment: { upsert: jest.fn() },
    loyaltyEntry: { aggregate: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    promoCode: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    groupOrder: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    groupOrderItem: { create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    recurringOrder: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import prisma from '../src/services/database';
import { PaymentStatus, OrderStatus, GroupOrderStatus } from '@prisma/client';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { createOrder, payOrder } from '../src/controllers/order.controller';
import {
  createGroupOrder,
  getGroupByCode,
  addGroupItem,
  convertGroupOrder,
  cancelGroupOrder,
  removeGroupItem,
} from '../src/controllers/group-order.controller';
import { getMyLoyalty } from '../src/controllers/loyalty.controller';
import {
  validatePromo,
} from '../src/controllers/promo.controller';
import { getRecommendations } from '../src/controllers/recommendation.controller';
import {
  createRecurring,
  runDueRecurring,
} from '../src/controllers/recurring.controller';
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
  user: { userId: 'user-1', tenantId: 'tenant-1', email: 'c@x.com' } as TenantRequest['user'],
  tenantFeatures: { loyalty_program: true },
  ...extra,
});

const bodyOf = (res: MockRes) => res.body as Record<string, unknown>;
const dataOf = (res: MockRes) => bodyOf(res).data;

const uid = (n: number | string) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** The shared pricing resolver reads menu items through prisma.menuItem.findMany. */
function mockMenuItems(rows: Array<Record<string, unknown>> = []) {
  (prisma.menuItem.findMany as jest.Mock).mockResolvedValue(
    rows.length
      ? rows
      : [
          {
            id: uid(1),
            name: 'Margherita',
            price: 10,
            pricingRules: [],
            availabilityWindows: [],
            isAvailable: true,
          },
        ],
  );
}

/** Composite order row as ORDER_INCLUDE resolves it (items + payment + reviews). */
function orderRow(over: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'ORD-20260904-ABCD',
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    totalAmount: 20,
    taxAmount: 0,
    discountAmount: 0,
    tableNumber: null,
    specialRequests: null,
    scheduledFor: null,
    customerId: 'user-1',
    tenantId: 'tenant-1',
    tableId: null,
    createdAt: new Date('2026-09-04T10:00:00Z'),
    updatedAt: new Date('2026-09-04T10:00:00Z'),
    completedAt: null,
    customer: { id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' },
    table: null,
    payment: null,
    reviews: [],
    items: [
      { id: 'li-1', menuItemId: uid(1), quantity: 2, unitPrice: 10, specialInstructions: null, status: OrderStatus.PENDING },
    ],
    ...over,
  };
}

describe('20.1 — scheduled ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMenuItems();
  });

  it('persists scheduledFor when it is a valid future window (15min–30d)', async () => {
    const inAnHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    (prisma.$transaction as jest.Mock).mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        const result = await (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
        return result;
      }
      return Promise.all(arg as Promise<unknown>[]);
    });
    (prisma.order.create as jest.Mock).mockResolvedValue(orderRow({ scheduledFor: new Date(inAnHour) }));
    (prisma.order.findUniqueOrThrow as jest.Mock).mockResolvedValue(orderRow({ scheduledFor: new Date(inAnHour) }));

    const { next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 2 }], scheduledFor: inAnHour },
    });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scheduledFor: expect.any(Date) }),
      }),
    );
  });

  it('rejects a schedule inside 15 minutes', async () => {
    const tooSoon = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 1 }], scheduledFor: tooSoon },
    });
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'SCHEDULE_TOO_SOON', statusCode: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalledWith(expect.any(Function));
  });

  it('rejects a schedule beyond 30 days', async () => {
    const tooFar = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString();
    const { next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 1 }], scheduledFor: tooFar },
    });
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'SCHEDULE_TOO_FAR', statusCode: 400 });
  });
});

describe('20.2 — group ordering', () => {
  const GROUP = {
    id: uid(1),
    code: 'A1B2C3',
    status: GroupOrderStatus.OPEN,
    hostCustomerId: 'user-1',
    tenantId: 'tenant-1',
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    createdAt: new Date('2026-09-04T10:00:00Z'),
    updatedAt: new Date('2026-09-04T10:00:00Z'),
    host: { id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' },
    items: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMenuItems();
  });

  it('creates a group and returns it with a 6-char code', async () => {
    (prisma.groupOrder.create as jest.Mock).mockResolvedValue(GROUP);
    const { res, next } = await run(createGroupOrder, tenantReq());
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect((dataOf(res) as { code: string }).code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('looks a group up by its shareable code', async () => {
    (prisma.groupOrder.findFirst as jest.Mock).mockResolvedValue(GROUP);
    const { res, next } = await run(getGroupByCode, { ...tenantReq(), params: { code: 'a1b2c3' } });
    expect(next).not.toHaveBeenCalled();
    expect(prisma.groupOrder.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', code: 'A1B2C3' },
      include: expect.anything(),
    });
    expect((dataOf(res) as { id: string }).id).toBe(uid(1));
  });

  it('lets any member add an item (menu validated + priced at snapshot)', async () => {
    (prisma.groupOrder.findFirst as jest.Mock).mockResolvedValue(GROUP);
    (prisma.groupOrderItem.create as jest.Mock).mockResolvedValue({ id: uid(2), groupOrderId: uid(1), participantId: 'user-1' });

    const { next } = await run(addGroupItem, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { menuItemId: uid(1), quantity: 2 },
    });
    expect(next).not.toHaveBeenCalled();
    expect(prisma.groupOrderItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ groupOrderId: uid(1), participantId: 'user-1', quantity: 2 }),
      }),
    );
  });

  it('rejects adding to a closed group', async () => {
    (prisma.groupOrder.findFirst as jest.Mock).mockResolvedValue({ ...GROUP, status: GroupOrderStatus.CONVERTED });
    const { next } = await run(addGroupItem, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { menuItemId: uid(1), quantity: 1 },
    });
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'GROUP_CLOSED', statusCode: 409 });
  });

  it('only the host may convert; conversion creates a real order and flips status', async () => {
    // Use a group that actually has items so conversion exercises the pricing path.
    const groupWithItems = {
      ...GROUP,
      items: [
        { id: uid(2), menuItemId: uid(1), participantId: 'user-1', quantity: 2, specialInstructions: null },
        { id: uid(3), menuItemId: uid(2), participantId: 'user-1', quantity: 1, specialInstructions: null },
      ],
    };
    (prisma.groupOrder.findFirst as jest.Mock).mockResolvedValue(groupWithItems);
    mockMenuItems([
      { id: uid(1), name: 'Margherita', price: 10, image: null, pricingRules: [], availabilityWindows: [], isAvailable: true },
      { id: uid(2), name: 'Pepperoni', price: 12, image: null, pricingRules: [], availabilityWindows: [], isAvailable: true },
    ]);
    (prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-9', orderNumber: 'ORD-9' });
    (prisma.groupOrder.update as jest.Mock).mockResolvedValue({ ...GROUP, status: GroupOrderStatus.CONVERTED });
    (prisma.order.findUniqueOrThrow as jest.Mock).mockResolvedValue(orderRow({}) as never);
    (prisma.$transaction as jest.Mock).mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      return Promise.all(arg as Promise<unknown>[]);
    });

    const foreignHost = await run(convertGroupOrder, {
      ...tenantReq({ user: { userId: 'other-user', tenantId: 'tenant-1' } as TenantRequest['user'] }),
      params: { id: uid(1) },
    });
    expect(foreignHost.next.mock.calls[0][0]).toMatchObject({ code: 'GROUP_HOST_ONLY', statusCode: 403 });

    (prisma.groupOrder.findFirst as jest.Mock).mockResolvedValue(GROUP);
    const ok = await run(convertGroupOrder, { ...tenantReq(), params: { id: uid(1) } });
    expect(ok.next).not.toHaveBeenCalled();
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'user-1' }) }),
    );
    expect(prisma.groupOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: GroupOrderStatus.CONVERTED } }),
    );
  });

  it('host can cancel; non-host cannot', async () => {
    (prisma.groupOrder.findFirst as jest.Mock).mockResolvedValue(GROUP);
    const ok = await run(cancelGroupOrder, { ...tenantReq(), params: { id: uid(1) } });
    expect(ok.next).not.toHaveBeenCalled();
    expect(prisma.groupOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: GroupOrderStatus.CANCELLED } }),
    );

    (prisma.groupOrder.findFirst as jest.Mock).mockResolvedValue(GROUP);
    const foreign = await run(cancelGroupOrder, {
      ...tenantReq({ user: { userId: 'other', tenantId: 'tenant-1' } as TenantRequest['user'] }),
      params: { id: uid(1) },
    });
    expect(foreign.next.mock.calls[0][0]).toMatchObject({ code: 'GROUP_HOST_ONLY', statusCode: 403 });
  });

  it('participant or host may remove a line; others are forbidden', async () => {
    (prisma.groupOrder.findFirst as jest.Mock).mockResolvedValue(GROUP);
    (prisma.groupOrderItem.findFirst as jest.Mock).mockResolvedValue({ id: uid(2), participantId: 'user-2' });

    const ok = await run(removeGroupItem, {
      ...tenantReq({ user: { userId: 'user-3', tenantId: 'tenant-1', email: 'c@x.com' } as TenantRequest['user'] }),
      params: { id: uid(1), itemId: uid(2) },
    });
    expect(ok.next.mock.calls[0][0]).toMatchObject({ code: 'GROUP_ITEM_FORBIDDEN', statusCode: 403 });

    (prisma.groupOrderItem.findFirst as jest.Mock).mockResolvedValue({ id: uid(2), participantId: 'user-1' });
    await run(removeGroupItem, {
      ...tenantReq(),
      params: { id: uid(1), itemId: uid(2) },
    });
    expect(prisma.groupOrderItem.delete).toHaveBeenCalledWith({ where: { id: uid(2) } });
  });
});

describe('20.3 — loyalty', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accrues 1pt per $1 inside payOrder when the flag is on (fail-open on error)', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: uid(1),
      customerId: 'user-1',
      tenantId: 'tenant-1',
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      totalAmount: 42,
    });
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(orderRow({ totalAmount: 42 }) as never);

    const { next } = await run(payOrder, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { method: 'CARD' },
    });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.loyaltyEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ points: 42, customerId: 'user-1', orderId: uid(1) }),
      }),
    );
  });

  it('skips accrual when the loyalty flag is off', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1', customerId: 'user-1', status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING, totalAmount: 42,
    });
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(orderRow({}) as never);

    await run(payOrder, {
      ...tenantReq({ tenantFeatures: {} }),
      params: { id: 'order-1' },
      body: { method: 'CARD' },
    });

    expect(prisma.loyaltyEntry.create).not.toHaveBeenCalled();
  });

  it('redeems points at createOrder (100 per $1), capping at the subtotal', async () => {
    // subtotal = 2 × $10 = $20 → 2000 points → $20 discount → capped at subtotal → total $0.
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: uid(1), name: 'Margherita', price: 10, pricingRules: [], availabilityWindows: [], isAvailable: true },
    ]);
    (prisma.loyaltyEntry.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: 5000 } });
    (prisma.order.create as jest.Mock).mockResolvedValue(orderRow({ discountAmount: 20, totalAmount: 0 }));
    (prisma.order.findUniqueOrThrow as jest.Mock).mockResolvedValue(orderRow({ discountAmount: 20, totalAmount: 0 }) as never);

    const { res, next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 2 }], loyaltyPoints: 2000 },
    });

    expect(next).not.toHaveBeenCalled();
    const order = (dataOf(res) as { totalAmount: number }).totalAmount;
    expect(order).toBe(0);
    const createCall = (prisma.order.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data).toMatchObject({ discountAmount: 20, totalAmount: 0 });
  });

  it('rejects an insufficient balance (409 INSUFFICIENT_LOYALTY)', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: uid(1), name: 'Margherita', price: 10, pricingRules: [], availabilityWindows: [], isAvailable: true },
    ]);
    (prisma.loyaltyEntry.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: 5 } });

    const { next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 1 }], loyaltyPoints: 100 },
    });
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'INSUFFICIENT_LOYALTY', statusCode: 409 });
  });

  it('GET /me returns the balance and recent ledger', async () => {
    (prisma.loyaltyEntry.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: 137 } });
    (prisma.loyaltyEntry.findMany as jest.Mock).mockResolvedValue([
      { id: 'l1', points: 42, reason: 'accrual:order:x', orderId: 'o1', createdAt: new Date() },
    ]);

    const { res, next } = await run(getMyLoyalty, tenantReq());
    expect(next).not.toHaveBeenCalled();
    expect(dataOf(res)).toMatchObject({ balance: 137 });
  });
});

describe('20.4 — promo codes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('validates a PERCENT code against the subtotal', async () => {
    (prisma.promoCode.findFirst as jest.Mock).mockResolvedValue({
      id: 'pc1', code: 'SAVE10', type: 'PERCENT', value: 10,
      minSubtotal: null, maxRedemptions: null, redeemedCount: 0,
      startsAt: null, endsAt: null, isActive: true,
    });

    const { res, next } = await run(validatePromo, {
      ...tenantReq(),
      body: { code: 'SAVE10', subtotal: 50 },
    });
    expect(next).not.toHaveBeenCalled();
    expect(dataOf(res)).toMatchObject({ valid: true, discount: 5, message: 'Promo code applied' });
  });

  it('reports an expired code as invalid', async () => {
    (prisma.promoCode.findFirst as jest.Mock).mockResolvedValue({
      id: 'pc1', code: 'OLD', type: 'PERCENT', value: 10,
      minSubtotal: null, maxRedemptions: null, redeemedCount: 0,
      startsAt: null, endsAt: new Date(Date.now() - 1000), isActive: true,
    });

    const { res } = await run(validatePromo, { ...tenantReq(), body: { code: 'OLD', subtotal: 50 } });
    expect(dataOf(res)).toMatchObject({ valid: false, message: 'This promo code has expired' });
  });

  it('counts a redemption once the order exists; percent discount applied', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: uid(1), name: 'Margherita', price: 10, pricingRules: [], availabilityWindows: [], isAvailable: true },
    ]);
    (prisma.promoCode.findFirst as jest.Mock).mockResolvedValue({
      id: 'pc1', code: 'SAVE10', type: 'PERCENT', value: 10,
      minSubtotal: null, maxRedemptions: null, redeemedCount: 0,
      startsAt: null, endsAt: null, isActive: true,
    });
    (prisma.order.create as jest.Mock).mockResolvedValue(orderRow({ discountAmount: 2, totalAmount: 18 }));
    (prisma.order.findUniqueOrThrow as jest.Mock).mockResolvedValue(orderRow({ discountAmount: 2, totalAmount: 18 }) as never);

    await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 2 }], promoCode: 'SAVE10' },
    });

    expect(prisma.promoCode.update).toHaveBeenCalledWith({
      where: { id: 'pc1' },
      data: { redeemedCount: { increment: 1 } },
    });
    const createCall = (prisma.order.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.totalAmount).toBe(18);
    expect(createCall.data.discountAmount).toBe(2);
  });

  it('rejects an unknown code at check-out with 400 PROMO_INVALID', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: uid(1), name: 'Margherita', price: 10, pricingRules: [], availabilityWindows: [], isAvailable: true },
    ]);
    (prisma.promoCode.findFirst as jest.Mock).mockResolvedValue(null);

    const { next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 1 }], promoCode: 'NOPE' },
    });
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'PROMO_INVALID', statusCode: 400 });
    expect(prisma.order.create).not.toHaveBeenCalled();
  });
});

describe('20.5 — recommendations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns favorites (top rebuys, available) and popular (best sellers not yet tried)', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { items: [{ menuItemId: uid(1), quantity: 3 }, { menuItemId: 'item-2', quantity: 1 }] },
    ]);
    (prisma.menuItem.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: uid(1), name: 'Margherita', price: 10, image: null, pricingRules: [], availabilityWindows: [], isAvailable: true },
        { id: 'item-2', name: 'Pepperoni', price: 12, image: null, pricingRules: [], availabilityWindows: [], isAvailable: true },
      ])
      .mockResolvedValueOnce([{ id: 'item-3', name: 'Tiramisu', price: 6, image: null, pricingRules: [], availabilityWindows: [], isAvailable: true }]);
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([
      { menuItemId: uid(1) },
      { menuItemId: 'item-3' },
    ]);

    const { res, next } = await run(getRecommendations, {
      ...tenantReq({ user: { userId: 'user-1', tenantId: 'tenant-1', email: 'c@x.com', role: 'CUSTOMER' } as TenantRequest['user'] }),
    });
    expect(next).not.toHaveBeenCalled();
    const data = dataOf(res) as { favorites: Array<{ itemId: string }>; popular: Array<{ itemId: string }> };
    // Favorite is what the customer rebought most (item-1, qty 3); popular excludes
    // already-tried items (uid(1) + item-2), leaving only item-3.
    expect(data.favorites).toEqual([
      { itemId: uid(1), name: 'Margherita', price: 10, image: null, reason: 'favorite' },
      { itemId: 'item-2', name: 'Pepperoni', price: 12, image: null, reason: 'favorite' },
    ]);
    expect(data.popular).toEqual([{ itemId: 'item-3', name: 'Tiramisu', price: 6, image: null, reason: 'popular' }]);
  });
});

describe('20.6 — recurring orders', () => {
  const SUB = {
    id: uid(1), customerId: 'user-1', recurrence: 'WEEKLY',
    items: [{ menuItemId: uid(1), quantity: 2 }],
    nextRunAt: new Date(), lastRunAt: null, isActive: true, tenantId: 'tenant-1',
    createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockMenuItems();
  });

  it('creates a subscription after validating items', async () => {
    (prisma.recurringOrder.create as jest.Mock).mockResolvedValue(SUB);
    const { res, next } = await run(createRecurring, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 2 }], recurrence: 'WEEKLY' },
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(prisma.recurringOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'user-1', recurrence: 'WEEKLY' }) }),
    );
  });

  it('run-due spawns ordered quantity and advances nextRunAt, reporting failures', async () => {
    const due = [
      { ...SUB, id: uid(1), nextRunAt: new Date(Date.now() - 1000), recurrence: 'WEEKLY' },
      { ...SUB, id: uid(2), nextRunAt: new Date(Date.now() - 1000), recurrence: 'MONTHLY', items: [{ menuItemId: 'ghost', quantity: 1 }] },
    ];
    (prisma.recurringOrder.findMany as jest.Mock).mockResolvedValue(due);
    (prisma.recurringOrder.update as jest.Mock).mockResolvedValue(SUB);
    (prisma.order.create as jest.Mock).mockResolvedValueOnce({ id: 'order-run', orderNumber: 'ORD-RUN', totalAmount: 20, status: OrderStatus.PENDING });

    const { res, next } = await run(runDueRecurring, tenantReq());
    expect(next).not.toHaveBeenCalled();
    const data = dataOf(res) as { spawned: Array<{ recurringOrderId: string }>; failed: Array<{ recurringOrderId: string }> };
    expect(data.spawned.map((s) => s.recurringOrderId)).toEqual([uid(1)]);
    expect(data.failed.map((f) => f.recurringOrderId)).toEqual([uid(2)]);
    expect(prisma.recurringOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastRunAt: expect.any(Date), nextRunAt: expect.any(Date) }) }),
    );
  });
});
