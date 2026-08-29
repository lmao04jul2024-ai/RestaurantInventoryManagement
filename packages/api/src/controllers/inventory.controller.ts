import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import {
  consumptionQuerySchema,
  createInventoryItemSchema,
  idParamSchema,
  inventoryItemQuerySchema,
  stockTransactionSchema,
  transactionQuerySchema,
  updateInventoryItemSchema,
  validateBody,
  validateParams,
  validateQuery,
} from '../utils/validation';

/**
 * Week 8 — inventory tracking (8.1), stock monitoring & alerts (8.2),
 * reporting (8.6). Suppliers (8.3) and purchase orders (8.5) live in
 * supplier.controller.ts / purchase-order.controller.ts.
 *
 * Stock-movement semantics (InventoryTransaction.transactionType):
 *   RESTOCK / RETURN → currentStock += quantity
 *   USAGE            → currentStock -= quantity (rejected if it would go negative)
 *   ADJUSTMENT       → currentStock  = quantity   (absolute stock-take level)
 */

const ITEM_INCLUDE: Prisma.InventoryItemInclude = { supplier: { select: { id: true, name: true } } };

const SORTS: Record<string, Prisma.InventoryItemOrderByWithRelationInput> = {
  name: { name: 'asc' },
  stock_asc: { currentStock: 'asc' },
  stock_desc: { currentStock: 'desc' },
  newest: { createdAt: 'desc' },
};

async function loadItemForTenant(tenantId: string, id: string) {
  const item = await prisma.inventoryItem.findFirst({ where: { id, tenantId } });
  if (!item) throw httpError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Inventory item not found');
  return item;
}

async function assertSupplierInTenant(tenantId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId }, select: { id: true } });
  if (!supplier) throw httpError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
}

/** Cross-field stock bounds (Joi can't express max >= min cleanly across optionals). */
function assertStockBounds(minStock: number, maxStock: number | null | undefined) {
  if (maxStock != null && maxStock < minStock) {
    throw httpError(400, 'MAX_STOCK_BELOW_MIN', 'maxStock must be greater than or equal to minStock');
  }
}

async function assertSkuAvailable(tenantId: string, sku: string, excludeId?: string) {
  const clash = await prisma.inventoryItem.findFirst({
    where: { tenantId, sku, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) throw httpError(409, 'SKU_DUPLICATE', `SKU "${sku}" already exists for this tenant`);
}

// ── Items (8.1) ───────────────────────────────────────────────────────────────

export async function listInventoryItems(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const q = validateQuery(inventoryItemQuerySchema, req.query);

    const where: Prisma.InventoryItemWhereInput = { tenantId };
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { sku: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (q.supplierId) where.supplierId = q.supplierId;
    if (q.isActive !== undefined) where.isActive = q.isActive;
    if (q.lowStock) {
      // Same-row comparison via Prisma field reference (currentStock <= minStock).
      where.currentStock = { lte: prisma.inventoryItem.fields.minStock };
    }

    const [rows, total] = await prisma.$transaction([
      prisma.inventoryItem.findMany({
        where,
        include: ITEM_INCLUDE,
        orderBy: SORTS[q.sort] ?? SORTS.newest,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    });
  } catch (e) {
    next(e);
  }
}

export async function createInventoryItem(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const data = validateBody(createInventoryItemSchema, req.body);
    assertStockBounds(data.minStock, data.maxStock);
    await assertSkuAvailable(tenantId, data.sku);
    if (data.supplierId) await assertSupplierInTenant(tenantId, data.supplierId);

    const item = await prisma.inventoryItem.create({ data: { ...data, tenantId } });
    res.status(201).json({ data: item });
  } catch (e) {
    next(e);
  }
}

export async function getInventoryItem(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const item = await prisma.inventoryItem.findFirst({
      where: { id, tenantId },
      include: ITEM_INCLUDE,
    });
    if (!item) throw httpError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Inventory item not found');
    res.json({ data: item });
  } catch (e) {
    next(e);
  }
}

export async function updateInventoryItem(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const existing = await loadItemForTenant(tenantId, id);
    const data = validateBody(updateInventoryItemSchema, req.body);

    assertStockBounds(
      data.minStock ?? existing.minStock,
      data.maxStock !== undefined ? data.maxStock : existing.maxStock,
    );
    if (data.sku && data.sku !== existing.sku) await assertSkuAvailable(tenantId, data.sku, id);
    if (data.supplierId) await assertSupplierInTenant(tenantId, data.supplierId);

    const item = await prisma.inventoryItem.update({ where: { id }, data });
    res.json({ data: item });
  } catch (e) {
    next(e);
  }
}

export async function deleteInventoryItem(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    await loadItemForTenant(tenantId, id);

    const [txCount, poItemCount] = await prisma.$transaction([
      prisma.inventoryTransaction.count({ where: { itemId: id } }),
      prisma.purchaseOrderItem.count({ where: { inventoryItemId: id } }),
    ]);
    if (txCount > 0 || poItemCount > 0) {
      throw httpError(
        409,
        'ITEM_IN_USE',
        'Item has stock transactions or purchase-order lines; deactivate it instead of deleting',
      );
    }

    await prisma.inventoryItem.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

// ── Stock movements (8.1) ─────────────────────────────────────────────────────

export async function recordStockTransaction(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const item = await loadItemForTenant(tenantId, id);
    const data = validateBody(stockTransactionSchema, req.body);

    let newStock: number;
    switch (data.transactionType) {
      case 'RESTOCK':
      case 'RETURN':
        newStock = item.currentStock + data.quantity;
        break;
      case 'USAGE':
        newStock = item.currentStock - data.quantity;
        if (newStock < 0) {
          throw httpError(
            409,
            'INSUFFICIENT_STOCK',
            `Usage of ${data.quantity} exceeds current stock of ${item.currentStock}`,
          );
        }
        break;
      case 'ADJUSTMENT':
        newStock = data.quantity; // absolute stock-take level
        break;
      default:
        throw httpError(400, 'INVALID_TRANSACTION_TYPE', `Unsupported transaction type`);
    }

    const now = new Date();
    const [transaction] = await prisma.$transaction([
      prisma.inventoryTransaction.create({
        data: {
          itemId: id,
          transactionType: data.transactionType,
          quantity: data.quantity,
          unitCost: data.unitCost,
          reference: data.reference,
          notes: data.notes,
          performedBy: req.user?.userId ?? null,
          tenantId,
        },
      }),
      prisma.inventoryItem.update({
        where: { id },
        data: {
          currentStock: newStock,
          // RESTOCK refreshes the restock stamp; a known unit cost updates cost basis.
          ...(data.transactionType === 'RESTOCK'
            ? { lastRestockedAt: now, ...(data.unitCost != null ? { costPrice: data.unitCost } : {}) }
            : {}),
        },
      }),
    ]);

    res.status(201).json({ data: { transaction, currentStock: newStock } });
  } catch (e) {
    next(e);
  }
}

export async function listTransactions(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    await loadItemForTenant(tenantId, id);
    const q = validateQuery(transactionQuerySchema, req.query);

    const where: Prisma.InventoryTransactionWhereInput = { itemId: id };
    if (q.type) where.transactionType = q.type;
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: q.from } : {}),
        ...(q.to ? { lte: q.to } : {}),
      };
    }

    const [rows, total] = await prisma.$transaction([
      prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    });
  } catch (e) {
    next(e);
  }
}

// ── Monitoring & alerts (8.2) ─────────────────────────────────────────────────

export async function getLowStockAlerts(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const rows = await prisma.inventoryItem.findMany({
      where: {
        tenantId,
        isActive: true,
        currentStock: { lte: prisma.inventoryItem.fields.minStock },
      },
      include: ITEM_INCLUDE,
      orderBy: { currentStock: 'asc' },
    });

    const alerts = rows.map((item) => ({
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      currentStock: item.currentStock,
      minStock: item.minStock,
      supplierId: item.supplierId,
      supplierName: item.supplier?.name ?? null,
      status: item.currentStock <= 0 ? 'OUT_OF_STOCK' : 'LOW',
    }));

    res.json({ data: alerts });
  } catch (e) {
    next(e);
  }
}

// ── Reporting (8.6) ───────────────────────────────────────────────────────────

export async function getValuationReport(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const rows = await prisma.inventoryItem.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, sku: true, unit: true, currentStock: true, costPrice: true },
      orderBy: { name: 'asc' },
    });

    const items = rows.map((r) => ({
      ...r,
      unitValue: (r.costPrice ?? 0) * r.currentStock,
    }));
    const totalValue = items.reduce((sum, r) => sum + r.unitValue, 0);

    res.json({ data: { totalValue, itemCount: items.length, items } });
  } catch (e) {
    next(e);
  }
}

export async function getConsumptionReport(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const q = validateQuery(consumptionQuerySchema, req.query);
    const to = q.to ?? new Date();
    const from = q.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const grouped = await prisma.inventoryTransaction.groupBy({
      by: ['itemId'],
      where: { tenantId, transactionType: 'USAGE', createdAt: { gte: from, lte: to } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
    });

    const itemIds = grouped.map((g) => g.itemId);
    const items = itemIds.length
      ? await prisma.inventoryItem.findMany({
          where: { id: { in: itemIds }, tenantId },
          select: { id: true, name: true, sku: true, unit: true },
        })
      : [];
    const byId = new Map(items.map((i) => [i.id, i]));

    const data = grouped
      .map((g) => ({
        item: byId.get(g.itemId) ?? { id: g.itemId, name: 'Unknown', sku: null, unit: null },
        totalUsed: g._sum.quantity ?? 0,
      }))
      .filter((r) => r.item.name !== 'Unknown');

    res.json({ data: { from, to, items: data } });
  } catch (e) {
    next(e);
  }
}