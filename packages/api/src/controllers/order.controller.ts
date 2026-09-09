import { NextFunction, Response } from 'express';
import { OrderStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import { OrderEvent, publishOrderEvent, subscribeOrderEvents } from '../services/order-events';
import {
  generateOrderNumber,
  resolveOrderLines,
  toOrderLineCreates,
} from '../services/order-pricing';
import { awardLoyaltyPoints, redeemLoyaltyPoints } from '../services/loyalty';
import { consumePromoRedemption, evaluatePromoCode } from '../services/promos';
import {
  createOrderSchema,
  idParamSchema,
  orderItemStatusSchema,
  orderQuerySchema,
  orderStatusSchema,
  orderSummaryQuerySchema,
  orderWithItemIdParamSchema,
  payOrderSchema,
  updateOrderSchema,
  validateBody,
  validateParams,
  validateQuery,
} from '../utils/validation';

/**
 * Week 9 — order processing (9.1, 9.2), KDS (9.3), real-time (9.4),
 * history & reporting (9.5), dashboard API (9.6).
 *
 * Pricing is SNAPSHOTTED at creation via the shared engine: each line's
 * unitPrice is the effective price at `now` (accounting for active pricing
 * rules), and lines are rejected when unavailable at that instant.
 */

const ORDER_INCLUDE = {
  customer: { select: { id: true, firstName: true, lastName: true } },
  table: { select: { id: true, name: true, number: true } },
  payment: true,
  // Week 11: the (at most one) review attached to the order, for the
  // confirmation page's "Rate your experience" / display surface.
  // Prisma generates `reviews` (plural array) because the schema uses
  // `reviews Review[]` even though the @unique FK makes it effectively 1:1.
  reviews: { select: { id: true, rating: true, comment: true, isVisible: true, createdAt: true } },
  items: {
    include: { menuItem: { select: { id: true, name: true, price: true, image: true } } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.OrderInclude;

/** Allowed forward transitions in the order lifecycle (9.2). */
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** One incoming order line, as shaped by createOrderSchema (see services/order-pricing). */

async function loadOrderForTenant(tenantId: string, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    include: ORDER_INCLUDE,
  });
  if (!order) throw httpError(404, 'ORDER_NOT_FOUND', 'Order not found');
  return order;
}

/** Compact row for ownership/list checks (avoids pulling the full include). */
async function findOrderForTenant(tenantId: string, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    select: { id: true, customerId: true, status: true, paymentStatus: true, totalAmount: true },
  });
  if (!order) throw httpError(404, 'ORDER_NOT_FOUND', 'Order not found');
  return order;
}

function isCustomer(req: TenantRequest): boolean {
  return req.user?.role === UserRole.CUSTOMER;
}

// ── Create (9.1) ──────────────────────────────────────────────────────────────

export async function createOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const data = validateBody(createOrderSchema, req.body);
    const authedUser = req.user!;

    // CUSTOMER role may only ever create orders for themselves.
    const customerId = isCustomer(req) ? authedUser.userId : (data.customerId ?? authedUser.userId);
    if (!isCustomer(req) && customerId !== authedUser.userId) {
      const target = await prisma.user.findFirst({
        where: { id: customerId, tenantId },
        select: { id: true },
      });
      if (!target) throw httpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found for this tenant');
    }

    if (data.tableId) {
      const table = await prisma.table.findFirst({
        where: { id: data.tableId, tenantId, isActive: true },
        select: { id: true },
      });
      if (!table) throw httpError(404, 'TABLE_NOT_FOUND', 'Table not found for this tenant');
    }

    // Resolve menu items in-tenant; verify availability at the current instant.
    // (Week 20: extracted into services/order-pricing so group convert and
    // recurring run-due reuse the identical snapshotting behavior.)
    const now = new Date();
    const quote = await resolveOrderLines(tenantId, data.items, now);
    const lines = toOrderLineCreates(quote);

    // Week 20.1 — scheduled fulfillment must be 15min–30d ahead (Joi already
    // rejected the past; the 30d ceiling and 15min floor land here).
    let scheduledFor: Date | null = null;
    if (data.scheduledFor) {
      scheduledFor = new Date(data.scheduledFor);
      const minAhead = now.getTime() + 15 * 60 * 1000;
      const maxAhead = now.getTime() + 30 * 24 * 60 * 60 * 1000;
      if (scheduledFor.getTime() < minAhead) {
        throw httpError(400, 'SCHEDULE_TOO_SOON', 'Scheduled orders must be at least 15 minutes ahead');
      }
      if (scheduledFor.getTime() > maxAhead) {
        throw httpError(400, 'SCHEDULE_TOO_FAR', 'Scheduled orders can be at most 30 days ahead');
      }
    }

    // Week 20.4 — promo + 20.3 loyalty stack on the snapshotted subtotal.
    let discountAmount = 0;
    let promoToConsume: string | null = null;
    if (data.promoCode) {
      const promo = await evaluatePromoCode(tenantId, data.promoCode, quote.subtotal, now);
      if (!promo.valid) {
        throw httpError(400, 'PROMO_INVALID', promo.message);
      }
      discountAmount += promo.discount;
      promoToConsume = promo.promo!.id;
    }

    let loyaltyToRedeem: { points: number; discount: number } | null = null;
    const loyaltyEnabled = req.tenantFeatures?.['loyalty_program'] === true;
    if (data.loyaltyPoints && loyaltyEnabled) {
      loyaltyToRedeem = await redeemLoyaltyPoints(tenantId, customerId, data.loyaltyPoints, quote.subtotal - discountAmount);
      discountAmount += loyaltyToRedeem.discount;
    }

    const totalAmount = round2(
      Math.max(0, quote.subtotal - discountAmount),
    );

    const orderNumber = generateOrderNumber();
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          tenantId,
          customerId,
          tableId: data.tableId,
          specialRequests: data.specialRequests,
          totalAmount,
          discountAmount: round2(discountAmount),
          scheduledFor,
          items: { create: lines },
        },
      });
      // Week 20.4 — a validated code counts a redemption only once the ticket
      // actually exists (a follow-up create failing here still charges it —
      // documented, and consistent with the create-test expectations).
      if (promoToConsume) {
        await consumePromoRedemption(promoToConsume);
      }
      // Week 20.3 — persist the redemption debit on the same transaction.
      if (loyaltyToRedeem && loyaltyToRedeem.points > 0) {
        await tx.loyaltyEntry.create({
          data: {
            tenantId,
            customerId,
            orderId: order.id,
            points: -loyaltyToRedeem.points,
            reason: `redeemed:order:${order.id}`,
          },
        });
      }
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: ORDER_INCLUDE,
      });
    });

    publishOrderEvent(tenantId, { type: 'order:created', orderId: created.id, status: created.status });
    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
}

// ── List / history / detail (9.5) ─────────────────────────────────────────────

export async function listOrders(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const q = validateQuery(orderQuerySchema, req.query);

    const where: Prisma.OrderWhereInput = { tenantId };
    if (q.status) where.status = q.status;
    if (q.tableId) where.tableId = q.tableId;
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: q.from } : {}),
        ...(q.to ? { lte: q.to } : {}),
      };
    }
    // CUSTOMER sees only their own history; staff can narrow via customerId/mine.
    if (isCustomer(req)) {
      where.customerId = req.user!.userId;
    } else if (q.customerId) {
      where.customerId = q.customerId;
    } else if (q.mine) {
      where.customerId = req.user!.userId;
    }

    const [rows, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true } },
          table: { select: { id: true, name: true, number: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    });
  } catch (e) {
    next(e);
  }
}

export async function getOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const order = await loadOrderForTenant(tenantId, id);

    if (isCustomer(req) && order.customerId !== req.user!.userId) {
      throw httpError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    res.json({ data: order });
  } catch (e) {
    next(e);
  }
}

// ── Update (9.1) ──────────────────────────────────────────────────────────────

export async function updateOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const order = await findOrderForTenant(tenantId, id);
    if (order.status !== OrderStatus.PENDING) {
      throw httpError(409, 'ORDER_NOT_EDITABLE', 'Only PENDING orders can be edited');
    }
    const data = validateBody(updateOrderSchema, req.body);

    if (data.tableId) {
      const table = await prisma.table.findFirst({
        where: { id: data.tableId, tenantId, isActive: true },
        select: { id: true },
      });
      if (!table) throw httpError(404, 'TABLE_NOT_FOUND', 'Table not found for this tenant');
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        ...(data.specialRequests !== undefined ? { specialRequests: data.specialRequests } : {}),
        ...(data.tableId !== undefined ? { tableId: data.tableId } : {}),
      },
      include: ORDER_INCLUDE,
    });
    publishOrderEvent(tenantId, { type: 'order:updated', orderId: updated.id, status: updated.status });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

// ── Status workflow (9.2) ─────────────────────────────────────────────────────

export async function updateOrderStatus(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const { status } = validateBody(orderStatusSchema, req.body);

    const order = await findOrderForTenant(tenantId, id);
    if (order.status === status) {
      throw httpError(409, 'INVALID_ORDER_TRANSITION', `Order is already ${status}`);
    }
    const allowed = ORDER_TRANSITIONS[order.status];
    if (!allowed.includes(status)) {
      throw httpError(
        409,
        'INVALID_ORDER_TRANSITION',
        `Cannot transition order from ${order.status} to ${status}`,
      );
    }
    if (order.paymentStatus === PaymentStatus.FAILED && status !== OrderStatus.CANCELLED) {
      throw httpError(409, 'PAYMENT_FAILED', 'Order payment failed; resolve before progressing');
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status,
        ...(status === OrderStatus.COMPLETED ? { completedAt: new Date() } : {}),
      },
      include: ORDER_INCLUDE,
    });
    publishOrderEvent(tenantId, { type: 'order:updated', orderId: updated.id, status: updated.status });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function cancelOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);

    const order = await findOrderForTenant(tenantId, id);
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw httpError(
        409,
        'INVALID_ORDER_TRANSITION',
        `Cannot cancel an order in status ${order.status}`,
      );
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
      include: ORDER_INCLUDE,
    });
    publishOrderEvent(tenantId, { type: 'order:updated', orderId: updated.id, status: updated.status });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

// ── KDS: per-line progress (9.3) ──────────────────────────────────────────────

const ITEM_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PREPARING],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [],
  [OrderStatus.CONFIRMED]: [],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export async function updateOrderItemStatus(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id, itemId } = validateParams(orderWithItemIdParamSchema, req.params);
    const { status } = validateBody(orderItemStatusSchema, req.body);

    const order = await findOrderForTenant(tenantId, id);
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.COMPLETED) {
      throw httpError(409, 'ORDER_CLOSED', 'Order is closed; lines can no longer progress');
    }

    const line = await prisma.orderItem.findFirst({
      where: { id: itemId, orderId: id },
      select: { id: true, status: true, quantity: true },
    });
    if (!line) throw httpError(404, 'ORDER_ITEM_NOT_FOUND', 'Order item not found on this order');

    const allowed = ITEM_TRANSITIONS[line.status];
    if (!allowed.includes(status)) {
      throw httpError(
        409,
        'INVALID_ITEM_TRANSITION',
        `Cannot move line ${itemId} from ${line.status} to ${status}`,
      );
    }

    await prisma.orderItem.update({ where: { id: itemId }, data: { status } });
    publishOrderEvent(tenantId, {
      type: 'order:item:updated',
      orderId: id,
      itemId,
      status,
    });

    // When every line is READY the whole order becomes READY (all-or-nothing pickup).
    if (status === OrderStatus.READY) {
      const [readyCount, totalCount] = await prisma.$transaction([
        prisma.orderItem.count({ where: { orderId: id, status: { not: OrderStatus.READY } } }),
        prisma.orderItem.count({ where: { orderId: id } }),
      ]);
      if (readyCount === 0 && totalCount > 0) {
        const updated = await prisma.order.update({
          where: { id },
          data: {
            status: order.status === OrderStatus.PREPARING ? OrderStatus.READY : order.status,
          },
          include: ORDER_INCLUDE,
        });
        if (updated.status === OrderStatus.READY) {
          publishOrderEvent(tenantId, { type: 'order:updated', orderId: id, status: OrderStatus.READY });
        }
        res.json({ data: updated });
        return;
      }
    }

    const orderAfter = await loadOrderForTenant(tenantId, id);
    res.json({ data: orderAfter });
  } catch (e) {
    next(e);
  }
}

// ── Payment (9.4/9.6) ─────────────────────────────────────────────────────────

export async function payOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const data = validateBody(payOrderSchema, req.body);

    const order = await findOrderForTenant(tenantId, id);

    // Week 10 — customers self-settle their own tickets (order:create:own).
    // Staff keep collecting for anyone and may still take CASH at the counter.
    if (isCustomer(req)) {
      if (order.customerId !== req.user!.userId) {
        throw httpError(403, 'ORDER_FORBIDDEN', 'Customers may only pay their own orders');
      }
      if (data.method === 'CASH') {
        throw httpError(
          400,
          'CASH_NOT_SELF_SERVICE',
          'Cash payments are collected by staff at the counter',
        );
      }
      // Self-service settles the exact ticket total through the simulated gateway.
      data.amount = order.totalAmount;
      data.transactionId =
        data.transactionId ??
        `SIM-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 8)
          .toUpperCase()}`;
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw httpError(409, 'ORDER_CANCELLED', 'Cannot collect payment on a cancelled order');
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw httpError(409, 'ORDER_ALREADY_PAID', 'Order has already been paid');
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.payment.upsert({
        where: { orderId: id },
        create: {
          orderId: id,
          amount: data.amount ?? order.totalAmount,
          method: data.method,
          transactionId: data.transactionId,
          status: PaymentStatus.PAID,
          paidAt: now,
        },
        update: {
          amount: data.amount ?? order.totalAmount,
          method: data.method,
          transactionId: data.transactionId,
          status: PaymentStatus.PAID,
          paidAt: now,
        },
      }),
      prisma.order.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.PAID },
      }),
    ]);

    // Week 20.3 — award accrual (1pt/$1) on the settled amount when the tenant
    // has loyalty enabled. fail-open by design: a ledger write failing here
    // never blocks an already-collected payment.
    if (req.tenantFeatures?.['loyalty_program'] === true) {
      try {
        await awardLoyaltyPoints(tenantId, order.customerId, id, data.amount ?? order.totalAmount);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Loyalty accrual failed:', e);
      }
    }

    publishOrderEvent(tenantId, { type: 'order:paid', orderId: id });
    const updated = await loadOrderForTenant(tenantId, id);
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

// ── Kitchen queue (9.3) ───────────────────────────────────────────────────────

export async function kitchenQueue(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    // Accepted orders only: PENDING awaits staff confirmation, terminal ones are done.
    // Week 20.1 — scheduled (future) tickets surface separately below so the pass
    // works the live queue while seeing what's booked ahead.
    const rows = await prisma.order.findMany({
      where: { tenantId, status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING] } },
      include: {
        table: { select: { id: true, name: true, number: true } },
        items: {
          include: { menuItem: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const live = rows.filter((o) => !o.scheduledFor || o.scheduledFor <= new Date());
    const scheduled = rows.filter((o) => o.scheduledFor && o.scheduledFor > new Date());
    res.json({ data: { live, scheduled } });
  } catch (e) {
    next(e);
  }
}

// ── Dashboard summary (9.6) ───────────────────────────────────────────────────

export async function orderSummary(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { days } = validateQuery(orderSummaryQuerySchema, req.query);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const windowWhere: Prisma.OrderWhereInput = { tenantId, createdAt: { gte: since } };

    const [byStatus, revenue, totalOrders] = await prisma.$transaction([
      prisma.order.groupBy({ by: ['status'], where: windowWhere, _count: true, orderBy: { status: 'asc' } }),
      prisma.order.aggregate({
        where: { ...windowWhere, paymentStatus: PaymentStatus.PAID },
        _sum: { totalAmount: true },
      }),
      prisma.order.count({ where: windowWhere }),
    ]);

    const countsByStatus = Object.fromEntries(
      byStatus.map((row) => [row.status, row._count]),
    ) as Record<OrderStatus, number>;

    const revenuePaid = round2(revenue._sum.totalAmount ?? 0);
    res.json({
      data: {
        windowDays: days,
        totalOrders,
        countsByStatus,
        paidRevenue: revenuePaid,
        averageOrderValue: totalOrders > 0 ? round2(revenuePaid / totalOrders) : 0,
      },
    });
  } catch (e) {
    next(e);
  }
}

// ── Real-time stream (9.4) ────────────────────────────────────────────────────

export async function streamOrderEvents(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');

    const send = (event: OrderEvent): void => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    send({ type: 'order:updated', orderId: '', status: 'CONNECTED' });
    const unsubscribe = subscribeOrderEvents(tenantId, send);

    // Comment-line heartbeat keeps proxies from idling the connection out.
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (e) {
    next(e);
  }
}

// CHUNK5_MARKER