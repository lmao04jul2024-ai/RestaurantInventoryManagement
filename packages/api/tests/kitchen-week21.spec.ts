jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    order: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      groupBy: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    tenant: { findFirst: jest.fn(), update: jest.fn() },
    menuItem: { findMany: jest.fn() },
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => Promise<unknown>)(require('../src/services/database').default);
      return Promise.all(arg as Promise<unknown>[]);
    }),
  },
}));

jest.mock('../src/services/order-events', () => ({
  __esModule: true,
  publishOrderEvent: jest.fn(),
  subscribeOrderEvents: jest.fn(() => jest.fn()),
}));

jest.mock('../src/services/audit', () => ({
  __esModule: true,
  writeAuditLog: jest.fn(() => Promise.resolve(undefined)),
}));

import prisma from '../src/services/database';
import { publishOrderEvent } from '../src/services/order-events';
import { writeAuditLog } from '../src/services/audit';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import {
  assignOrderStaff,
  unassignOrderStaff,
  kitchenAnalytics,
  getKitchenSettings,
  updateKitchenSettings,
  kitchenQueue,
  createOrder,
} from '../src/controllers/order.controller';

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

const bodyOf = (res: MockRes) => res.body as Record<string, unknown>;
const dataOf = (res: MockRes) => bodyOf(res).data as Record<string, unknown>;
const minsAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);

const orderRow = (over: Record<string, unknown> = {}) => ({
  id: uid(9), orderNumber: 'ORD-1', status: 'CONFIRMED', paymentStatus: 'PENDING',
  totalAmount: 20, discountAmount: 0, taxAmount: 0, tenantId: 'tenant-1', customerId: 'user-2',
  assignedToId: null, preparationStartedAt: null, readyAt: null, completedAt: null,
  scheduledFor: null, ...over,
});

const kitchenSettingsRow = (kitchen: Record<string, unknown>) => ({ settings: { kitchen } });

describe('21.2 — staff assignment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('assigns a staff member to an active ticket and returns the decorated order', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(orderRow());
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: uid(2), firstName: 'Ana', lastName: 'Lee' });
    (prisma.order.update as jest.Mock).mockResolvedValue(
      orderRow({ assignedToId: uid(2), assignee: { id: uid(2), firstName: 'Ana', lastName: 'Lee' } }),
    );

    const { res, next } = await run(assignOrderStaff, {
      ...tenantReq(),
      params: { id: uid(9) },
      body: { staffId: uid(2) },
    });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: uid(9) }, data: { assignee: { connect: { id: uid(2) } } } }),
    );
    expect(publishOrderEvent).toHaveBeenCalledWith('tenant-1', { type: 'order:updated', orderId: uid(9), status: 'CONFIRMED' });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'order:assign', targetId: uid(9) }));
    expect(dataOf(res)).toMatchObject({ assignedStaff: { id: uid(2), name: 'Ana Lee' } });
  });

  it('rejects assignment on a closed order (409 ORDER_CLOSED)', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(orderRow({ status: 'COMPLETED' }));

    const { next } = await run(assignOrderStaff, {
      ...tenantReq(),
      params: { id: uid(9) },
      body: { staffId: uid(2) },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'ORDER_CLOSED', statusCode: 409 });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('rejects a staff id that is not an active staff member of the tenant (404)', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(orderRow());
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    const { next } = await run(assignOrderStaff, {
      ...tenantReq(),
      params: { id: uid(9) },
      body: { staffId: uid(2) },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'STAFF_NOT_FOUND', statusCode: 404 });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: { not: 'CUSTOMER' } }) }),
    );
  });

  it('unassigns staff and reports assignedStaff null', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(orderRow({ assignedToId: uid(2) }));
    (prisma.order.update as jest.Mock).mockResolvedValue(orderRow({ assignedToId: null }));

    const { res, next } = await run(unassignOrderStaff, {
      ...tenantReq(),
      params: { id: uid(9) },
    });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assignee: { disconnect: true } } }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'order:unassign' }));
    expect(dataOf(res)).toMatchObject({ assignedStaff: null });
  });

  it('refuses unassigning an order that has no assignee (409)', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(orderRow({ assignedToId: null }));

    const { next } = await run(unassignOrderStaff, { ...tenantReq(), params: { id: uid(9) } });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'ORDER_NOT_ASSIGNED', statusCode: 409 });
  });
});

describe('21.3/21.6 — kitchen queue enrichment & status filter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('decorates rows with assignedStaff, prepElapsedMinutes, and prepTargetMet', async () => {
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(kitchenSettingsRow({ prepTimeTargetMinutes: 15, capacity: 20 }));
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      orderRow({ id: 'o-live', preparationStartedAt: minsAgo(8), readyAt: null, assignee: { id: uid(2), firstName: 'Ana', lastName: 'Lee' } }),
      orderRow({ id: 'o-done', status: 'READY', preparationStartedAt: minsAgo(30), readyAt: minsAgo(2), assignee: null }),
      orderRow({ id: 'o-sched', scheduledFor: new Date(Date.now() + 3_600_000), preparationStartedAt: null, readyAt: null }),
    ]);

    const { res, next } = await run(kitchenQueue, tenantReq());

    expect(next).not.toHaveBeenCalled();
    const data = dataOf(res) as { live: Array<Record<string, unknown>>; scheduled: Array<Record<string, unknown>> };
    expect(data.live).toHaveLength(2);
    expect(data.live[0]).toMatchObject({ id: 'o-live', assignedStaff: { id: uid(2), name: 'Ana Lee' }, prepElapsedMinutes: 8, prepTargetMet: null });
    // 28 min prep > the 15 min target → prepTargetMet false.
    expect(data.live[1]).toMatchObject({ id: 'o-done', assignedStaff: null, prepTargetMet: false });
    expect(data.live[1].prepElapsedMinutes).toBeGreaterThanOrEqual(27);
    // Scheduled tickets are decorated too but kept out of the live queue.
    expect(data.scheduled).toHaveLength(1);
    expect(data.scheduled[0]).toMatchObject({ id: 'o-sched', prepElapsedMinutes: null, prepTargetMet: null });
  });

  it('narrowing ?status= overrides the default live stages in the where clause', async () => {
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(kitchenSettingsRow({}));
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

    await run(kitchenQueue, tenantReq({ query: { status: 'READY' } }));

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1', status: { in: ['READY'] } } }),
    );
  });

  it('rejects an unknown ?status= with 400', async () => {
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(kitchenSettingsRow({}));

    const { next } = await run(kitchenQueue, tenantReq({ query: { status: 'TELEPORTED' } }));

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
  });
});

describe('21.3 — kitchen prep analytics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('computes avg prep, target-met share, throughput, and per-status counts', async () => {
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(kitchenSettingsRow({ prepTimeTargetMinutes: 15, capacity: 20 }));
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { preparationStartedAt: minsAgo(60 + 10), readyAt: minsAgo(60) },   // 10 min → met
      { preparationStartedAt: minsAgo(60 + 22), readyAt: minsAgo(60) },   // 22 min → missed
      { preparationStartedAt: minsAgo(60 + 14), readyAt: minsAgo(60) },   // 14 min → met
    ]);
    (prisma.order.groupBy as jest.Mock).mockResolvedValue([
      { status: 'COMPLETED', _count: 3 },
      { status: 'PENDING', _count: 1 },
    ]);

    const { res, next } = await run(kitchenAnalytics, tenantReq({ query: { days: '1' } }));

    expect(next).not.toHaveBeenCalled();
    const data = dataOf(res) as Record<string, unknown>;
    expect(data).toMatchObject({
      windowDays: 1,
      completedCount: 3,
      avgPrepMinutes: 15.33,
      prepTimeTargetMinutes: 15,
      targetMetPct: 67,
      countsByStatus: { COMPLETED: 3, PENDING: 1 },
    });
    // Throughput = 3 tickets / 24 h.
    expect(data.throughputPerHour).toBeCloseTo(0.13, 1);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'COMPLETED', preparationStartedAt: { not: null } }) }),
    );
  });

  it('reports zeros for an empty window instead of NaN', async () => {
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(kitchenSettingsRow({}));
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.order.groupBy as jest.Mock).mockResolvedValue([]);

    const { res, next } = await run(kitchenAnalytics, tenantReq({ query: {} }));

    expect(next).not.toHaveBeenCalled();
    expect(dataOf(res)).toMatchObject({
      completedCount: 0,
      avgPrepMinutes: 0,
      targetMetPct: 0,
      prepTimeTargetMinutes: 15,
      countsByStatus: {},
    });
  });
});

describe('21.4/21.5 — kitchen settings (target & capacity)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns effective settings, filling defaults for absent values', async () => {
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({ settings: {} });

    const { res, next } = await run(getKitchenSettings, tenantReq());

    expect(next).not.toHaveBeenCalled();
    expect(dataOf(res)).toEqual({ prepTimeTargetMinutes: 15, capacity: 20 });
  });

  it('merges a partial patch into Tenant.settings.kitchen and returns the merged result', async () => {
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(kitchenSettingsRow({ prepTimeTargetMinutes: 15, capacity: 20 }));
    (prisma.tenant.update as jest.Mock).mockResolvedValue({});

    const { res, next } = await run(updateKitchenSettings, {
      ...tenantReq(),
      body: { prepTimeTargetMinutes: 12 },
    });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { settings: { kitchen: { prepTimeTargetMinutes: 12, capacity: 20 } } } }),
    );
    expect(dataOf(res)).toEqual({ prepTimeTargetMinutes: 12, capacity: 20 });
  });

  it('rejects out-of-range values with 400', async () => {
    const { next } = await run(updateKitchenSettings, { ...tenantReq(), body: { capacity: 5000 } });

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});

describe('21.5 — capacity soft cap at order creation', () => {
  beforeEach(() => jest.clearAllMocks());

  const menuRow = { id: uid(1), name: 'Margherita', price: 10, pricingRules: [], availabilityWindows: [], isAvailable: true };

  it('refuses a new ticket with 429 KITCHEN_AT_CAPACITY and Retry-After when the queue is full', async () => {
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(kitchenSettingsRow({ prepTimeTargetMinutes: 15, capacity: 2 }));
    (prisma.order.count as jest.Mock).mockResolvedValue(2);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([menuRow]);

    const { res, next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 1 }] },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'KITCHEN_AT_CAPACITY', statusCode: 429 });
    expect(res.headers['Retry-After']).toBe('60');
    expect(prisma.order.create).not.toHaveBeenCalled();
    // Capacity check happens before menu resolution.
    expect(prisma.menuItem.findMany).not.toHaveBeenCalled();
  });

  it('lets orders through when the active count is below capacity', async () => {
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(kitchenSettingsRow({ prepTimeTargetMinutes: 15, capacity: 5 }));
    (prisma.order.count as jest.Mock).mockResolvedValue(2);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([menuRow]);
    (prisma.$transaction as jest.Mock).mockImplementation(async (arg: unknown) =>
      (arg as (tx: unknown) => Promise<unknown>)(prisma));
    (prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-new', orderNumber: 'ORD-N', totalAmount: 10 });
    (prisma.order.findUniqueOrThrow as jest.Mock).mockResolvedValue(orderRow({ id: 'order-new', totalAmount: 10 }) as never);

    const { res, next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 1 }] },
    });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.order.create).toHaveBeenCalled();
    expect(dataOf(res)).toMatchObject({ id: 'order-new' });
  });

  it('skips the guard entirely when capacity is 0 (disabled)', async () => {
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(kitchenSettingsRow({ prepTimeTargetMinutes: 15, capacity: 0 }));
    (prisma.order.count as jest.Mock).mockResolvedValue(999);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([menuRow]);
    (prisma.$transaction as jest.Mock).mockImplementation(async (arg: unknown) =>
      (arg as (tx: unknown) => Promise<unknown>)(prisma));
    (prisma.order.create as jest.Mock).mockResolvedValue({ id: 'order-free', orderNumber: 'ORD-F', totalAmount: 10 });
    (prisma.order.findUniqueOrThrow as jest.Mock).mockResolvedValue(orderRow({ id: 'order-free', totalAmount: 10 }) as never);

    const { next } = await run(createOrder, {
      ...tenantReq(),
      body: { items: [{ menuItemId: uid(1), quantity: 1 }] },
    });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.order.count).not.toHaveBeenCalled();
  });
});