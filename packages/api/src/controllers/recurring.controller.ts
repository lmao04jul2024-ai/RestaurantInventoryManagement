import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import {
  idParamSchema,
  recurringOrderCreateSchema,
  recurringOrderUpdateSchema,
  validateBody,
  validateParams,
} from '../utils/validation';
import { resolveOrderLines, toOrderLineCreates, generateOrderNumber } from '../services/order-pricing';

/**
 * Week 20.6 — recurring (subscription) orders.
 *
 * Customers manage their own baskets; a MANAGER+ (cron-friendly) endpoint
 * spawns real orders for every due subscription. `nextRunAt` advances by the
 * recurrence interval so a single daily job drives WEEKLY/BIWEEKLY/MONTHLY.
 *
 * Recurring runs intentionally ignore availability windows (a subscription
 * is a standing intent) — the created order re-checks availability via the
 * shared resolver at spawn time and is rejected with the item name if the
 * kitchen can't currently produce it.
 */
const MS_DAY = 24 * 60 * 60 * 1000;
const RECURRENCE_MS = { WEEKLY: 7 * MS_DAY, BIWEEKLY: 14 * MS_DAY, MONTHLY: 30 * MS_DAY } as const;

function advanceNextRun(rec: string, from: Date): Date {
  const ms = RECURRENCE_MS[rec as keyof typeof RECURRENCE_MS] ?? 7 * MS_DAY;
  return new Date(from.getTime() + ms);
}

export async function listMyRecurring(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const customerId = req.user?.userId;
    if (!customerId) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const rows = await prisma.recurringOrder.findMany({
      where: { tenantId, customerId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
}

export async function createRecurring(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const customerId = req.user?.userId;
    if (!customerId) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const data = validateBody(recurringOrderCreateSchema, req.body);

    // Validate items before persisting the subscription.
    await resolveOrderLines(
      tenantId,
      data.items.map((i: { menuItemId: string; quantity: number }) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
    );

    const nextRunAt = data.startAt ? new Date(data.startAt) : new Date();
    const created = await prisma.recurringOrder.create({
      data: { customerId, recurrence: data.recurrence, items: data.items as unknown as Prisma.InputJsonValue, nextRunAt, tenantId },
    });
    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
}

export async function updateRecurring(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const customerId = req.user?.userId;
    if (!customerId) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const { id } = validateParams(idParamSchema, req.params);
    const data = validateBody(recurringOrderUpdateSchema, req.body);

    const existing = await prisma.recurringOrder.findFirst({ where: { id, tenantId } });
    if (!existing || existing.customerId !== customerId) {
      throw httpError(404, 'RECURRING_NOT_FOUND', 'Recurring order not found');
    }
    if (data.items) {
      await resolveOrderLines(
        tenantId,
        data.items.map((i: { menuItemId: string; quantity: number }) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
      );
    }
    const updateData = {
      ...(data.recurrence ? { recurrence: data.recurrence } : {}),
      ...(data.items ? { items: data.items as unknown as Prisma.InputJsonValue } : {}),
      ...(data.nextRunAt ? { nextRunAt: new Date(data.nextRunAt) } : {}),
      ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
    };
    const updated = await prisma.recurringOrder.update({ where: { id: existing.id }, data: updateData });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deleteRecurring(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const customerId = req.user?.userId;
    if (!customerId) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const { id } = validateParams(idParamSchema, req.params);
    const existing = await prisma.recurringOrder.findFirst({ where: { id, tenantId } });
    if (!existing || existing.customerId !== customerId) {
      throw httpError(404, 'RECURRING_NOT_FOUND', 'Recurring order not found');
    }
    await prisma.recurringOrder.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

/** MANAGER+ — spawn real orders for every due, active subscription. */
export async function runDueRecurring(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const now = new Date();
    const due = await prisma.recurringOrder.findMany({
      where: { tenantId, isActive: true, nextRunAt: { lte: now } },
    });

    const spawned: Array<{ recurringOrderId: string; orderId: string; orderNumber: string; totalAmount: number }> = [];
    const failed: Array<{ recurringOrderId: string; reason: string }> = [];

    for (const sub of due) {
      try {
        const lines = (sub.items as unknown as Array<{ menuItemId: string; quantity: number; specialInstructions?: string | null }>) ?? [];
        const quote = await resolveOrderLines(
          tenantId,
          lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
        );
        const created = await prisma.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            tenantId,
            customerId: sub.customerId,
            totalAmount: quote.subtotal,
            items: { create: toOrderLineCreates(quote) },
          },
        });
        await prisma.recurringOrder.update({
          where: { id: sub.id },
          data: { lastRunAt: now, nextRunAt: advanceNextRun(sub.recurrence, now) },
        });
        spawned.push({ recurringOrderId: sub.id, orderId: created.id, orderNumber: created.orderNumber, totalAmount: created.totalAmount });
      } catch (e) {
        failed.push({ recurringOrderId: sub.id, reason: (e as Error).message });
      }
    }

    res.json({ data: { spawned, failed, processed: due.length } });
  } catch (e) {
    next(e);
  }
}
