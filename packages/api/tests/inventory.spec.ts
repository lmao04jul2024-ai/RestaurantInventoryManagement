jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    inventoryItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      // Prisma field reference target for same-row stock comparisons (lowStock filter)
      fields: { minStock: 'minStock' },
    },
    inventoryTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    supplier: { findFirst: jest.fn(), findMany: jest.fn() },
    purchaseOrderItem: { count: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import prisma from '../src/services/database';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { makeItemRow } from './factories/inventory';

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

const item = () => makeItemRow({ id: uid(1), currentStock: 10 });

describe('inventory item listing & guards (8.1)', () => {
  const { createInventoryItem } = require('../src/controllers/inventory.controller');

  beforeEach(() => jest.clearAllMocks());

  it('paginates with a tenant-scoped where and the pagination envelope', async () => {
    const { listInventoryItems } = require('../src/controllers/inventory.controller');
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.count as jest.Mock).mockResolvedValue(25);

    const { res } = await run(listInventoryItems, tenantReq({ query: { page: '2', limit: '10' } }));

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' }, skip: 10, take: 10 }),
    );
    expect(bodyOf(res)).toMatchObject({
      pagination: { page: 2, limit: 10, total: 25, totalPages: 3 },
    });
  });

  it('lowStock filter compares currentStock to minStock via the field reference', async () => {
    const { listInventoryItems } = require('../src/controllers/inventory.controller');
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.count as jest.Mock).mockResolvedValue(0);

    await run(listInventoryItems, tenantReq({ query: { lowStock: 'true' } }));

    const where = (prisma.inventoryItem.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.currentStock).toEqual({ lte: 'minStock' });
  });

  it('rejects a duplicate SKU with 409 before creating', async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: uid(9) });

    const { next } = await run(createInventoryItem, {
      ...tenantReq(),
      body: { name: 'Flour', sku: 'FL-1', minStock: 5 },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'SKU_DUPLICATE', statusCode: 409 });
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });

  it('rejects maxStock below minStock before persistence', async () => {
    const { next } = await run(createInventoryItem, {
      ...tenantReq(),
      body: { name: 'Flour', sku: 'FL-1', minStock: 10, maxStock: 5 },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'MAX_STOCK_BELOW_MIN', statusCode: 400 });
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });
});

describe('inventory item create/update guards (8.1)', () => {
  const { createInventoryItem, updateInventoryItem, deleteInventoryItem } = require(
    '../src/controllers/inventory.controller',
  );

  beforeEach(() => jest.clearAllMocks());

  it('validates the supplier belongs to the tenant', async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue(null);

    const { next } = await run(createInventoryItem, {
      ...tenantReq(),
      body: { name: 'Flour', sku: 'FL-1', minStock: 5, supplierId: uid(2) },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'SUPPLIER_NOT_FOUND', statusCode: 404 });
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });

  it('creates an item scoped to the tenant with Joi defaults applied', async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.inventoryItem.create as jest.Mock).mockResolvedValue(item());

    const { res } = await run(createInventoryItem, {
      ...tenantReq(),
      body: { name: 'Flour', sku: 'FL-1', minStock: 5 },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        currentStock: 0,
        unit: 'UNIT',
        isActive: true,
      }),
    });
    expect(bodyOf(res).data).toMatchObject({ id: uid(1) });
  });

  it('blocks an SKU change that collides with another item', async () => {
    (prisma.inventoryItem.findFirst as jest.Mock)
      .mockResolvedValueOnce(item()) // load existing
      .mockResolvedValueOnce({ id: uid(9) }); // SKU clash

    const { next } = await run(updateInventoryItem, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { sku: 'FL-2' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'SKU_DUPLICATE', statusCode: 409 });
    expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
  });

  it('refuses deletion when stock history exists', async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(item());
    (prisma.inventoryTransaction.count as jest.Mock).mockResolvedValue(3);
    (prisma.purchaseOrderItem.count as jest.Mock).mockResolvedValue(0);

    const { next } = await run(deleteInventoryItem, {
      ...tenantReq(),
      params: { id: uid(1) },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'ITEM_IN_USE', statusCode: 409 });
    expect(prisma.inventoryItem.delete).not.toHaveBeenCalled();
  });

  it('deletes an item with no history', async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(item());
    (prisma.inventoryTransaction.count as jest.Mock).mockResolvedValue(0);
    (prisma.purchaseOrderItem.count as jest.Mock).mockResolvedValue(0);
    (prisma.inventoryItem.delete as jest.Mock).mockResolvedValue(item());

    const { res } = await run(deleteInventoryItem, { ...tenantReq(), params: { id: uid(1) } });

    expect(res.statusCode).toBe(204);
    expect(prisma.inventoryItem.delete).toHaveBeenCalledWith({ where: { id: uid(1) } });
  });
});

describe('stock transactions (8.1) & monitoring (8.2)', () => {
  const {
    recordStockTransaction,
    getLowStockAlerts,
    getValuationReport,
    getConsumptionReport,
  } = require('../src/controllers/inventory.controller');

  beforeEach(() => jest.clearAllMocks());

  it('RESTOCK increments stock and stamps lastRestockedAt atomically', async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(item());
    (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'tx-new' });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({ ...item(), currentStock: 13 });

    const { res } = await run(recordStockTransaction, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { transactionType: 'RESTOCK', quantity: 3 },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ itemId: uid(1), tenantId: 'tenant-1', performedBy: 'user-1' }),
      }),
    );
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: uid(1) },
      data: expect.objectContaining({ currentStock: 13 }),
    });
    expect(bodyOf(res).data).toMatchObject({ currentStock: 13 });
  });

  it('rejects USAGE that exceeds current stock with 409', async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(item());

    const { next } = await run(recordStockTransaction, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { transactionType: 'USAGE', quantity: 99 },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'INSUFFICIENT_STOCK', statusCode: 409 });
    expect(prisma.inventoryTransaction.create).not.toHaveBeenCalled();
    expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
  });

  it('ADJUSTMENT sets an absolute stock-take level', async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(item());
    (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'tx-adj' });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({ ...item(), currentStock: 7 });

    await run(recordStockTransaction, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { transactionType: 'ADJUSTMENT', quantity: 7 },
    });

    expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: uid(1) },
      data: expect.objectContaining({ currentStock: 7 }),
    });
  });

  it('reports only active items at/below their minStock with status labels', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      makeItemRow({ id: uid(1), currentStock: 2, minStock: 4 }),
      makeItemRow({ id: uid(2), currentStock: 0, minStock: 4 }),
    ]);

    const { res } = await run(getLowStockAlerts, tenantReq());

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', isActive: true }),
      }),
    );
    const alerts = bodyOf(res).data as Array<Record<string, unknown>>;
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toMatchObject({ status: 'LOW' });
    expect(alerts[1]).toMatchObject({ status: 'OUT_OF_STOCK' });
  });

  it('sums valuation across active items', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      { id: uid(1), currentStock: 10, costPrice: 2 },
      { id: uid(2), currentStock: 5, costPrice: null },
    ]);

    const { res } = await run(getValuationReport, tenantReq());

    expect(bodyOf(res).data).toMatchObject({ itemCount: 2, totalValue: 20 });
  });

  it('groups USAGE transactions per item for the consumption report', async () => {
    (prisma.inventoryTransaction.groupBy as jest.Mock).mockResolvedValue([
      { itemId: uid(1), _sum: { quantity: 12 } },
    ]);
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      { id: uid(1), name: 'Flour', sku: 'FL-1', unit: 'KG' },
    ]);

    const { res } = await run(getConsumptionReport, tenantReq({ query: {} }));

    const items = (bodyOf(res).data as { items: Array<Record<string, unknown>> }).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ totalUsed: 12 });
  });

  it('lists transactions scoped to the item with pagination', async () => {
    const { listTransactions } = require('../src/controllers/inventory.controller');
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(item());
    (prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryTransaction.count as jest.Mock).mockResolvedValue(8);

    const { res } = await run(listTransactions, tenantReq({ query: { page: '1', limit: '5' }, params: { id: uid(1) } }));

    expect(prisma.inventoryTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { itemId: uid(1) }, skip: 0, take: 5 }),
    );
    expect(bodyOf(res)).toMatchObject({
      pagination: { page: 1, limit: 5, total: 8, totalPages: 2 },
    });
  });

describe('CSV inventory import (S3.1)', () => {
  const { importInventoryItems } = require('../src/controllers/inventory.controller');

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no in-tenant SKU clashes, one known supplier.
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.supplier.findMany as jest.Mock).mockResolvedValue([{ id: 'sup-1', name: 'Fresh Farms Co' }]);
    (prisma.inventoryItem.createMany as jest.Mock).mockResolvedValue({ count: 2 });
  });

  const csv = (lines: string[]) => lines.join('\n');

  it('imports valid rows in one createMany, resolving suppliers and scoping to the tenant', async () => {
    const data = csv([
      'name,sku,currentStock,minStock,unit,supplier',
      'Flour,FL-1,10,4,KG,Fresh Farms Co',
      'Sugar,SU-1,5,2,KG,Unknown Vendor',
    ]);

    const { res } = await run(importInventoryItems, tenantReq({ body: { data } }));

    expect(res.statusCode).toBe(201);
    expect(bodyOf(res).data).toMatchObject({ total: 2, created: 2, skipped: 0, dryRun: false });
    const args = (prisma.inventoryItem.createMany as jest.Mock).mock.calls[0][0];
    expect(args.skipDuplicates).toBe(false);
    expect(args.data).toHaveLength(2);
    expect(args.data[0]).toMatchObject({ sku: 'FL-1', supplierId: 'sup-1', tenantId: 'tenant-1', isActive: true });
    // Unknown supplier → created unlinked, flagged as a warning (not an error).
    expect(args.data[1]).toMatchObject({ sku: 'SU-1', supplierId: null });
    const warnings = (bodyOf(res).data as { warnings: { row: number; code: string }[] }).warnings;
    expect(warnings).toEqual([{ row: 3, code: 'SUPPLIER_UNKNOWN', message: expect.any(String) }]);
  });

  it('dryRun validates without writing anything', async () => {
    const data = csv(['name,sku,minStock', 'Flour,FL-1,4']);

    const { res } = await run(importInventoryItems, tenantReq({ body: { data, dryRun: true } }));

    expect(bodyOf(res).data).toMatchObject({ total: 1, created: 0, skipped: 0, dryRun: true });
    expect(prisma.inventoryItem.createMany).not.toHaveBeenCalled();
  });

  it('reports per-row errors without failing the batch (invalid row + in-file SKU duplicate)', async () => {
    (prisma.inventoryItem.createMany as jest.Mock).mockResolvedValue({ count: 1 });
    const data = csv([
      'name,sku,minStock',
      'Flour,FL-1,4',
      ',BAD-1,2', // missing name
      'More Flour,FL-1,3', // duplicate SKU in file
    ]);

    const { res } = await run(importInventoryItems, tenantReq({ body: { data } }));

    expect(bodyOf(res).data).toMatchObject({ total: 3, created: 1, skipped: 2 });
    const errors = (bodyOf(res).data as { errors: { row: number; code: string }[] }).errors;
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 3, code: 'IMPORT_ROW_INVALID' }),
        expect.objectContaining({ row: 4, field: 'sku', code: 'SKU_DUPLICATE' }),
      ]),
    );
  });

  it('rejects in-tenant SKU clashes per-row instead of overwriting', async () => {
    (prisma.inventoryItem.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([{ sku: 'FL-1' }]);
    const data = csv(['name,sku,minStock', 'Flour,FL-1,4']);

    const { res } = await run(importInventoryItems, tenantReq({ body: { data } }));

    expect(bodyOf(res).data).toMatchObject({ total: 1, created: 0, skipped: 1 });
    expect(prisma.inventoryItem.createMany).not.toHaveBeenCalled();
    const errors = (bodyOf(res).data as { errors: { row: number; code: string }[] }).errors;
    expect(errors).toEqual([expect.objectContaining({ row: 2, field: 'sku', code: 'SKU_DUPLICATE' })]);
  });

  it('400s a header-only CSV as IMPORT_EMPTY', async () => {
    const { next } = await run(importInventoryItems, tenantReq({ body: { data: 'name,sku,minStock' } }));

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400, code: 'IMPORT_EMPTY' });
  });

  it('400s a CSV whose header matches no known column as IMPORT_NO_COLUMNS', async () => {
    const { next } = await run(
      importInventoryItems,
      tenantReq({ body: { data: 'foo,bar\n1,2' } }),
    );

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400, code: 'IMPORT_NO_COLUMNS' });
  });
});

});