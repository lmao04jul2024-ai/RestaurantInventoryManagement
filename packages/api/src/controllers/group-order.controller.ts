import { NextFunction, Response } from 'express';
import { GroupOrderStatus, Prisma } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import {
  groupOrderCodeParamSchema,
  groupOrderItemSchema,
  idParamSchema,
  validateBody,
  validateParams,
} from '../utils/validation';
import { GROUP_TTL_MS, isGroupExpired, uniqueGroupCode } from '../services/group-orders';
import {
  generateOrderNumber,
  resolveOrderLines,
  toOrderLineCreates,
} from '../services/order-pricing';

function customerOnly(req: TenantRequest): string {
  const customerId = req.user?.userId;
  if (!customerId) throw httpError(401, 'UNAUTHENTICATED', 'Authentication required');
  return customerId;
}

const GROUP_INCLUDE = {
  host: { select: { id: true, firstName: true, lastName: true } },
  items: {
    include: {
      participant: { select: { id: true, firstName: true, lastName: true } },
      menuItem: { select: { id: true, name: true, price: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.GroupOrderInclude;

// (legacy duplicate removed)
async function loadGroupForTenant(tenantId: string, id: string) {
  const group = await prisma.groupOrder.findFirst({ where: { id, tenantId }, include: GROUP_INCLUDE });
  if (!group) throw httpError(404, 'GROUP_NOT_FOUND', 'Group order not found');
  return group;
}

async function loadGroupByCode(tenantId: string, code: string) {
  const group = await prisma.groupOrder.findFirst({ where: { tenantId, code }, include: GROUP_INCLUDE });
  if (!group) throw httpError(404, 'GROUP_NOT_FOUND', 'Group order not found');
  return group;
}

export async function createGroupOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const customerId = customerOnly(req);
    const code = await uniqueGroupCode(tenantId);
    const group = await prisma.groupOrder.create({
      data: { code, hostCustomerId: customerId, tenantId, expiresAt: new Date(Date.now() + GROUP_TTL_MS) },
      include: GROUP_INCLUDE,
    });
    res.status(201).json({ data: group });
  } catch (e) {
    next(e);
  }
}

export async function listMyGroupOrders(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const customerId = customerOnly(req);
    const groups = await prisma.groupOrder.findMany({
      where: { tenantId, hostCustomerId: customerId },
      include: GROUP_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: groups });
  } catch (e) {
    next(e);
  }
}

export async function getGroupByCode(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { code } = validateParams(groupOrderCodeParamSchema, req.params);
    const group = await loadGroupByCode(tenantId, code.toUpperCase());
    res.json({ data: group });
  } catch (e) {
    next(e);
  }
}

export async function addGroupItem(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const data = validateBody(groupOrderItemSchema, req.body);
    const participantId = customerOnly(req);

    const group = await loadGroupForTenant(tenantId, id);
    if (group.status !== GroupOrderStatus.OPEN) {
      throw httpError(409, 'GROUP_CLOSED', 'This group order is no longer accepting items');
    }

    const quote = await resolveOrderLines(tenantId, [
      { menuItemId: data.menuItemId, quantity: data.quantity },
    ]);
    const item = await prisma.groupOrderItem.create({
      data: {
        groupOrderId: group.id,
        participantId,
        menuItemId: quote.lines[0].menuItemId,
        quantity: quote.lines[0].quantity,
        specialInstructions: data.specialInstructions,
      },
    });

    res.status(201).json({ data: item });
  } catch (e) {
    next(e);
  }
}

export async function removeGroupItem(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const params = req.params as Record<string, string>;
    const { itemId } = validateParams(idParamSchema, { ...params, id: params.itemId } as never);
    const customerId = customerOnly(req);

    const group = await loadGroupForTenant(tenantId, id);
    if (group.status !== GroupOrderStatus.OPEN) {
      throw httpError(409, 'GROUP_CLOSED', 'This group order is no longer accepting items');
    }

    const line = await prisma.groupOrderItem.findFirst({ where: { id: itemId, groupOrderId: group.id } });
    if (!line) throw httpError(404, 'GROUP_ITEM_NOT_FOUND', 'Group order item not found');
    if (line.participantId !== customerId && group.hostCustomerId !== customerId) {
      throw httpError(403, 'GROUP_ITEM_FORBIDDEN', 'Only the participant or the host can remove this item');
    }

    await prisma.groupOrderItem.delete({ where: { id: line.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

export async function convertGroupOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const customerId = customerOnly(req);

    const group = await loadGroupForTenant(tenantId, id);
    if (group.status !== GroupOrderStatus.OPEN) {
      throw httpError(409, 'GROUP_CLOSED', 'This group order has already been converted or cancelled');
    }
    if (group.hostCustomerId !== customerId) {
      throw httpError(403, 'GROUP_HOST_ONLY', 'Only the host can convert the group into an order');
    }
    if (isGroupExpired(group)) {
      throw httpError(409, 'GROUP_EXPIRED', 'This group order has expired');
    }

    const lines = group.items.map((i) => ({
      menuItemId: i.menuItemId,
      quantity: i.quantity,
      specialInstructions: i.specialInstructions,
    }));
    const quote = await resolveOrderLines(tenantId, lines);
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          tenantId,
          customerId: group.hostCustomerId,
          totalAmount: quote.subtotal,
          items: { create: toOrderLineCreates(quote) },
        },
      });
      await tx.groupOrder.update({ where: { id: group.id }, data: { status: GroupOrderStatus.CONVERTED } });
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { customer: true, items: true } });
    });

    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
}

export async function cancelGroupOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const customerId = customerOnly(req);

    const group = await loadGroupForTenant(tenantId, id);
    if (group.hostCustomerId !== customerId) {
      throw httpError(403, 'GROUP_HOST_ONLY', 'Only the host can cancel the group');
    }

    const updated = await prisma.groupOrder.update({
      where: { id: group.id },
      data: { status: GroupOrderStatus.CANCELLED },
      include: GROUP_INCLUDE,
    });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}
