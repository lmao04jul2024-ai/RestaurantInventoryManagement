import { NextFunction, Response } from 'express';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import {
  createPurchaseOrderSchema,
  idParamSchema,
  purchaseOrderQuerySchema,
  receivePurchaseOrderSchema,
  updatePurchaseOrderSchema,
  validateBody,
  validateParams,
  validateQuery,
} from '../utils/validation';

/**
 * Week 8 — purchase order management (8.5). Management-only (router gates MANAGER+).
 * Lifecycle: DRAFT → SUBMITTED → (PARTIALLY_RECEIVED ↔) RECEIVED; DRAFT/SUBMITTED → CANCELLED.
 * Receiving writes PO-line progress, RESTOCK transactions, and stock increments
 * atomically in a single prisma.$transaction.
 */

const PO_INCLUDE = {
  supplier: { select: { id: true, name: true, email: true, phone: true } },
  items: { include: { inventoryItem: { select: { id: true, name: true, sku: true, unit: true } } } },
} satisfies Prisma.PurchaseOrderInclude;

function generateOrderNumber(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PO-${day}-${rand}`;
}

async function loadPoForTenant(tenantId: string, id: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
  if (!po) throw httpError(404, 'PURCHASE_ORDER_NOT_FOUND', 'Purchase order not found');
  return po;
}

type PoLineInput = { inventoryItemId: string; quantityOrdered: number; unitCost?: number | null };

/** Validates PO lines: every item exists in-tenant, no duplicate lines. Returns the line data. */
async function resolvePoLines(tenantId: string, lines: Array<{ inventoryItemId: string; quantityOrdered: number; unitCost?: number | null }>) {
  const ids = lines.map((l) => l.inventoryItemId);
  if (new Set(ids).size !== ids.length) {
    throw httpError(400, 'DUPLICATE_PO_LINES', 'Purchase order lines must reference distinct inventory items');
  }
  const found = await prisma.inventoryItem.findMany({
    where: { id: { in: ids }, tenantId },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw httpError(404, 'INVENTORY_ITEM_NOT_FOUND', 'One or more inventory items do not exist for this tenant');
  }
  return lines;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listPurchaseOrders(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const q = validateQuery(purchaseOrderQuerySchema, req.query);

    const where: Prisma.PurchaseOrderWhereInput = { tenantId };
    if (q.status) where.status = q.status;
    if (q.supplierId) where.supplierId = q.supplierId;

    const [rows, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { inventoryItem: { select: { id: true, name: true, sku: true, unit: true } } } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    });
  } catch (e) {
    next(e);
  }
}

export async function createPurchaseOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const data = validateBody(createPurchaseOrderSchema, req.body);

    const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, tenantId }, select: { id: true } });
    if (!supplier) throw httpError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    await resolvePoLines(tenantId, data.items);

    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: data.supplierId,
        orderNumber: data.orderNumber ?? generateOrderNumber(),
        expectedAt: data.expectedAt,
        notes: data.notes,
        items: {
          create: data.items.map((l: PoLineInput) => ({
            inventoryItemId: l.inventoryItemId,
            quantityOrdered: l.quantityOrdered,
            unitCost: l.unitCost,
          })),
        },
      },
      include: PO_INCLUDE,
    });

    res.status(201).json({ data: po });
  } catch (e) {
    next(e);
  }
}

export async function getPurchaseOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const po = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: PO_INCLUDE,
    });
    if (!po) throw httpError(404, 'PURCHASE_ORDER_NOT_FOUND', 'Purchase order not found');
    res.json({ data: po });
  } catch (e) {
    next(e);
  }
}

export async function updatePurchaseOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const existing = await loadPoForTenant(tenantId, id);
    if (existing.status !== PurchaseOrderStatus.DRAFT) {
      throw httpError(409, 'PO_NOT_EDITABLE', 'Only DRAFT purchase orders can be edited');
    }
    const data = validateBody(updatePurchaseOrderSchema, req.body);

    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, tenantId }, select: { id: true } });
      if (!supplier) throw httpError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    }
    if (data.items) await resolvePoLines(tenantId, data.items);

    const po = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(data.supplierId ? { supplierId: data.supplierId } : {}),
        ...(data.expectedAt !== undefined ? { expectedAt: data.expectedAt } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.items
          ? {
              items: {
                deleteMany: {},
                create: data.items.map((l: PoLineInput) => ({
                  inventoryItemId: l.inventoryItemId,
                  quantityOrdered: l.quantityOrdered,
                  unitCost: l.unitCost,
                })),
              },
            }
          : {}),
      },
      include: PO_INCLUDE,
    });

    res.json({ data: po });
  } catch (e) {
    next(e);
  }
}

// ── Lifecycle: submit / cancel ────────────────────────────────────────────────

export async function submitPurchaseOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const existing = await loadPoForTenant(tenantId, id);
    if (existing.status !== PurchaseOrderStatus.DRAFT) {
      throw httpError(409, 'INVALID_PO_TRANSITION', `Cannot submit a purchase order in status ${existing.status}`);
    }

    const po = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SUBMITTED },
      include: PO_INCLUDE,
    });
    res.json({ data: po });
  } catch (e) {
    next(e);
  }
}

export async function cancelPurchaseOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const existing = await loadPoForTenant(tenantId, id);
    if (existing.status !== PurchaseOrderStatus.DRAFT && existing.status !== PurchaseOrderStatus.SUBMITTED) {
      throw httpError(409, 'INVALID_PO_TRANSITION', `Cannot cancel a purchase order in status ${existing.status}`);
    }

    const po = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CANCELLED },
      include: PO_INCLUDE,
    });
    res.json({ data: po });
  } catch (e) {
    next(e);
  }
}

// ── Receiving (8.5) ───────────────────────────────────────────────────────────

export async function receivePurchaseOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const po = await loadPoForTenant(tenantId, id);
    if (po.status !== PurchaseOrderStatus.SUBMITTED && po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      throw httpError(
        409,
        'PO_NOT_RECEIVABLE',
        `Only SUBMITTED or PARTIALLY_RECEIVED purchase orders can receive goods (status: ${po.status})`,
      );
    }
    const body = validateBody(receivePurchaseOrderSchema, req.body);

    const poItems = await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: id } });
    const poItemById = new Map(poItems.map((i) => [i.id, i]));

    const receivedThisRound = new Map<string, number>();
    for (const line of body.items) {
      if (receivedThisRound.has(line.itemId)) {
        throw httpError(400, 'DUPLICATE_RECEIPT_LINES', `Item line ${line.itemId} appears more than once`);
      }
      const poItem = poItemById.get(line.itemId);
      if (!poItem) {
        throw httpError(404, 'PO_ITEM_NOT_FOUND', `Line ${line.itemId} does not belong to this purchase order`);
      }
      const already = poItem.quantityReceived;
      if (already + line.quantity > poItem.quantityOrdered) {
        throw httpError(
          409,
          'OVER_RECEIPT',
          `Line ${line.itemId}: receiving ${line.quantity} would exceed ordered ${poItem.quantityOrdered} (already received ${already})`,
        );
      }
      receivedThisRound.set(line.itemId, line.quantity);
    }

    // Final per-line received levels determine the PO status after this receipt.
    const finalLines = poItems.map((poItem) => ({
      poItem,
      finalReceived: poItem.quantityReceived + (receivedThisRound.get(poItem.id) ?? 0),
    }));
    const allReceived = finalLines.every((l) => l.finalReceived >= l.poItem.quantityOrdered);
    const now = new Date();

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const line of body.items) {
      const poItem = poItemById.get(line.itemId)!;
      const unitCost = line.unitCost ?? poItem.unitCost;

      ops.push(
        prisma.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { quantityReceived: { increment: line.quantity } },
        }),
        prisma.inventoryTransaction.create({
          data: {
            itemId: poItem.inventoryItemId,
            transactionType: 'RESTOCK',
            quantity: line.quantity,
            unitCost,
            reference: po.orderNumber,
            notes: `Received against purchase order ${po.orderNumber}`,
            performedBy: req.user?.userId ?? null,
            tenantId,
          },
        }),
        prisma.inventoryItem.update({
          where: { id: poItem.inventoryItemId },
          data: {
            currentStock: { increment: line.quantity },
            lastRestockedAt: now,
            ...(unitCost != null ? { costPrice: unitCost } : {}),
          },
        }),
      );
    }
    ops.push(
      prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: allReceived ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED,
          ...(allReceived ? { receivedAt: now } : {}),
        },
      }),
    );

    await prisma.$transaction(ops);

    const updated = await prisma.purchaseOrder.findFirst({ where: { id, tenantId }, include: PO_INCLUDE });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deletePurchaseOrder(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const existing = await loadPoForTenant(tenantId, id);
    if (existing.status !== PurchaseOrderStatus.DRAFT) {
      throw httpError(409, 'PO_NOT_DELETABLE', 'Only DRAFT purchase orders can be deleted; cancel it instead');
    }

    await prisma.$transaction([
      prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } }),
      prisma.purchaseOrder.delete({ where: { id } }),
    ]);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}