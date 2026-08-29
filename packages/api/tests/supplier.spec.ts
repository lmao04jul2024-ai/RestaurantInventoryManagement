jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    supplier: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inventoryItem: { count: jest.fn(), findMany: jest.fn() },
    purchaseOrder: { count: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import prisma from '../src/services/database';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { makeSupplierRow } from './factories/inventory';

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

const supplier = () => makeSupplierRow({ id: uid(1) });
describe('supplier reading & search (8.3)', () => {
  const { listSuppliers, listSupplierItems } = require('../src/controllers/supplier.controller');

  beforeEach(() => jest.clearAllMocks());

  it('lists suppliers tenant-scoped with relation counts', async () => {
    const row = supplier();
    (prisma.supplier.findMany as jest.Mock).mockResolvedValue([
      { ...row, _count: { inventory: 2, purchaseOrders: 1 } },
    ]);

    const { res } = await run(listSuppliers, tenantReq({ query: {} }));

    expect(prisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
    expect(bodyOf(res).data).toHaveLength(1);
  });

  it('searches q case-insensitively across name and contactName', async () => {
    (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

    await run(listSuppliers, tenantReq({ query: { q: 'farm' } }));

    const args = (prisma.supplier.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.OR).toEqual([
      { name: { contains: 'farm', mode: 'insensitive' } },
      { contactName: { contains: 'farm', mode: 'insensitive' } },
    ]);
  });

  it('lists items for a supplier only when the supplier belongs to the tenant', async () => {
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue(null);

    const { next } = await run(listSupplierItems, {
      ...tenantReq(),
      params: { id: uid(2) },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'SUPPLIER_NOT_FOUND', statusCode: 404 });
  });
});

describe('supplier writes (8.3)', () => {
  const { createSupplier, updateSupplier, deleteSupplier } = require('../src/controllers/supplier.controller');

  beforeEach(() => jest.clearAllMocks());

  it('creates a supplier scoped to the tenant', async () => {
    (prisma.supplier.create as jest.Mock).mockResolvedValue(supplier());

    const { res } = await run(createSupplier, {
      ...tenantReq(),
      body: { name: 'Fresh Farms Co' },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.supplier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-1', isActive: true }),
    });
  });

  it('rejects a blank supplier name', async () => {
    const { next } = await run(createSupplier, {
      ...tenantReq(),
      body: { name: '   ' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(prisma.supplier.create).not.toHaveBeenCalled();
  });

  it('updates only suppliers in the same tenant', async () => {
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue(null);

    const { next } = await run(updateSupplier, {
      ...tenantReq(),
      params: { id: uid(9) },
      body: { name: 'Other Co' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'SUPPLIER_NOT_FOUND', statusCode: 404 });
    expect(prisma.supplier.update).not.toHaveBeenCalled();
  });

  it('refuses deletion when inventory items or POs reference the supplier', async () => {
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue(supplier());
    (prisma.inventoryItem.count as jest.Mock).mockResolvedValue(3);
    (prisma.purchaseOrder.count as jest.Mock).mockResolvedValue(0);

    const { next } = await run(deleteSupplier, {
      ...tenantReq(),
      params: { id: uid(1) },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'SUPPLIER_IN_USE', statusCode: 409 });
    expect(prisma.supplier.delete).not.toHaveBeenCalled();
  });

  it('deletes a supplier with no references', async () => {
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue(supplier());
    (prisma.inventoryItem.count as jest.Mock).mockResolvedValue(0);
    (prisma.purchaseOrder.count as jest.Mock).mockResolvedValue(0);
    (prisma.supplier.delete as jest.Mock).mockResolvedValue(supplier());

    const { res } = await run(deleteSupplier, {
      ...tenantReq(),
      params: { id: uid(1) },
    });

    expect(res.statusCode).toBe(204);
    expect(prisma.supplier.delete).toHaveBeenCalledWith({ where: { id: uid(1) } });
  });
});