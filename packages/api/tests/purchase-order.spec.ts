jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    purchaseOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    purchaseOrderItem: {
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    inventoryItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    inventoryTransaction: { create: jest.fn() },
    supplier: { findFirst: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import prisma from '../src/services/database';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { makePoRow, makePoItemRow } from './factories/inventory';

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

const po = (over: Record<string, unknown> = {}) => makePoRow({ id: uid(1), ...over });
describe('purchase order CRUD & lifecycle (8.5)', () => {
  const {
    createPurchaseOrder,
    updatePurchaseOrder,
    submitPurchaseOrder,
    cancelPurchaseOrder,
    deletePurchaseOrder,
  } = require('../src/controllers/purchase-order.controller');

  beforeEach(() => jest.clearAllMocks());

  it('creates a DRAFT PO with an auto-generated order number', async () => {
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue({ id: uid(4) });
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([{ id: uid(5) }, { id: uid(6) }]);
    (prisma.purchaseOrder.create as jest.Mock).mockResolvedValue(po());

    const { res } = await run(createPurchaseOrder, {
      ...tenantReq(),
      body: {
        supplierId: uid(4),
        items: [
          { inventoryItemId: uid(5), quantityOrdered: 5 },
          { inventoryItemId: uid(6), quantityOrdered: 3, unitCost: 2.5 },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const createArgs = (prisma.purchaseOrder.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data).toMatchObject({ tenantId: 'tenant-1', supplierId: uid(4) });
    expect(createArgs.data.orderNumber).toMatch(/^PO-\d{8}-/);
    expect(createArgs.data.items.create).toHaveLength(2);
  });

  it('rejects duplicate PO lines referencing the same item', async () => {
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue({ id: uid(4) });

    const { next } = await run(createPurchaseOrder, {
      ...tenantReq(),
      body: {
        supplierId: uid(4),
        items: [
          { inventoryItemId: uid(5), quantityOrdered: 5 },
          { inventoryItemId: uid(5), quantityOrdered: 3 },
        ],
      },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'DUPLICATE_PO_LINES', statusCode: 400 });
    expect(prisma.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it('rejects lines for items outside the tenant', async () => {
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue({ id: uid(4) });
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([{ id: uid(5) }]); // only 1 of 2

    const { next } = await run(createPurchaseOrder, {
      ...tenantReq(),
      body: {
        supplierId: uid(4),
        items: [
          { inventoryItemId: uid(5), quantityOrdered: 5 },
          { inventoryItemId: uid(6), quantityOrdered: 3 },
        ],
      },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'INVENTORY_ITEM_NOT_FOUND', statusCode: 404 });
    expect(prisma.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it('only DRAFT POs are editable', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(po({ status: 'SUBMITTED' }));

    const { next } = await run(updatePurchaseOrder, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { notes: 'updated' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'PO_NOT_EDITABLE', statusCode: 409 });
    expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it('submits only DRAFT POs', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(po({ status: 'SUBMITTED' }));

    const { next } = await run(submitPurchaseOrder, {
      ...tenantReq(),
      params: { id: uid(1) },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'INVALID_PO_TRANSITION', statusCode: 409 });
  });

  it('submitting a DRAFT flips it to SUBMITTED', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(po({ status: 'DRAFT' }));
    (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue(po({ status: 'SUBMITTED' }));

    const { res } = await run(submitPurchaseOrder, { ...tenantReq(), params: { id: uid(1) } });

    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SUBMITTED' } }),
    );
    expect(bodyOf(res).data).toMatchObject({ status: 'SUBMITTED' });
  });

  it('cancels DRAFT or SUBMITTED POs but never RECEIVED ones', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(po({ status: 'RECEIVED' }));

    const { next } = await run(cancelPurchaseOrder, {
      ...tenantReq(),
      params: { id: uid(1) },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'INVALID_PO_TRANSITION', statusCode: 409 });
    expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it('deletes only DRAFT POs, removing lines atomically', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(po({ status: 'DRAFT' }));

    const { res } = await run(deletePurchaseOrder, {
      ...tenantReq(),
      params: { id: uid(1) },
    });

    expect(res.statusCode).toBe(204);
    expect(prisma.purchaseOrderItem.deleteMany).toHaveBeenCalledWith({
      where: { purchaseOrderId: uid(1) },
    });
    expect(prisma.purchaseOrder.delete).toHaveBeenCalledWith({ where: { id: uid(1) } });
  });
});
describe('purchase order receiving (8.5)', () => {
  const { receivePurchaseOrder } = require('../src/controllers/purchase-order.controller');

  beforeEach(() => jest.clearAllMocks());

  const submittedPo = po({ status: 'SUBMITTED' });

  it('rejects receiving a PO that is not SUBMITTED or PARTIALLY_RECEIVED', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(po({ status: 'DRAFT' }));

    const { next } = await run(receivePurchaseOrder, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { items: [{ itemId: uid(2), quantity: 2 }] },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'PO_NOT_RECEIVABLE', statusCode: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a receipt line that does not belong to the PO', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(submittedPo);
    (prisma.purchaseOrderItem.findMany as jest.Mock).mockResolvedValue([poLine()]);

    const { next } = await run(receivePurchaseOrder, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { items: [{ itemId: uid(9), quantity: 1 }] }, // uid(9) not in the PO
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'PO_ITEM_NOT_FOUND', statusCode: 404 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects over-receiving beyond the ordered quantity', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(submittedPo);
    (prisma.purchaseOrderItem.findMany as jest.Mock).mockResolvedValue([
      poLine({ quantityOrdered: 5, quantityReceived: 0 }),
    ]);

    const { next } = await run(receivePurchaseOrder, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { items: [{ itemId: uid(2), quantity: 6 }] },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'OVER_RECEIPT', statusCode: 409 });
  });

  it('partial receipt marks the PO PARTIALLY_RECEIVED and restocks atomically', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(submittedPo);
    (prisma.purchaseOrderItem.findMany as jest.Mock).mockResolvedValue([
      poLine({ quantityOrdered: 5, quantityReceived: 0 }),
    ]);
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({});
    (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({});
    (prisma.purchaseOrderItem.update as jest.Mock).mockResolvedValue({});
    (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue(po({ status: 'PARTIALLY_RECEIVED' }));
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(submittedPo)
      .mockResolvedValueOnce({ ...submittedPo, status: 'PARTIALLY_RECEIVED' });

    const { res } = await run(receivePurchaseOrder, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { items: [{ itemId: uid(2), quantity: 2 }] },
    });

    // Four writes ride one transaction: PO line, RESTOCK tx, item stock, PO status.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionType: 'RESTOCK',
          quantity: 2,
          reference: 'PO-20260216-ABCD',
          tenantId: 'tenant-1',
        }),
      }),
    );
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStock: { increment: 2 } }),
      }),
    );
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PARTIALLY_RECEIVED' }),
      }),
    );
  });

  it('full receipt marks the PO RECEIVED and stamps receivedAt', async () => {
    (prisma.purchaseOrder.findFirst as jest.Mock)
      .mockResolvedValueOnce(submittedPo)
      .mockResolvedValueOnce({ ...submittedPo, status: 'RECEIVED' });
    (prisma.purchaseOrderItem.findMany as jest.Mock).mockResolvedValue([
      poLine({ quantityOrdered: 5, quantityReceived: 0 }),
    ]);
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({});
    (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({});
    (prisma.purchaseOrderItem.update as jest.Mock).mockResolvedValue({});
    (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue(po({ status: 'RECEIVED' }));

    const { res } = await run(receivePurchaseOrder, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { items: [{ itemId: uid(2), quantity: 5 }] },
    });

    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RECEIVED',
          receivedAt: expect.any(Date),
        }),
      }),
    );
  });
});
const poLine = (over: Record<string, unknown> = {}) => makePoItemRow({ id: uid(2), ...over });