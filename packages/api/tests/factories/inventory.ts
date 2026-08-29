import type { Prisma } from '@prisma/client';

const ISO = '2026-02-16T09:00:00.000Z';

/** Column-complete Prisma row shapes with Week-8 inventory relations available. */
export const makeSupplierRow = (over: Partial<Prisma.SupplierGetPayload<object>> = {}) => ({
  id: 'sup-1',
  name: 'Fresh Farms Co',
  contactName: 'Ana Reyes',
  email: 'ana@farms.test',
  phone: '+15550001',
  address: '1 Farm Road',
  isActive: true,
  tenantId: 'tenant-1',
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  ...over,
});

export const makeItemRow = (
  over: Partial<Prisma.InventoryItemGetPayload<{ include: { supplier: true } }>> = {},
) => ({
  id: 'item-1',
  name: 'Flour',
  sku: 'FL-1',
  currentStock: 10,
  minStock: 4,
  maxStock: 50,
  unit: 'KG',
  costPrice: 2,
  sellingPrice: null,
  supplierId: 'sup-1',
  isActive: true,
  lastRestockedAt: new Date(ISO),
  tenantId: 'tenant-1',
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  supplier: { id: 'sup-1', name: 'Fresh Farms Co' },
  ...over,
});

export const makeTransactionRow = (
  over: Partial<Prisma.InventoryTransactionGetPayload<object>> = {},
) => ({
  id: 'tx-1',
  itemId: 'item-1',
  transactionType: 'USAGE' as const,
  quantity: 2,
  unitCost: null,
  reference: null,
  notes: null,
  performedBy: 'user-1',
  tenantId: 'tenant-1',
  createdAt: new Date(ISO),
  ...over,
});

export const makePoRow = (over: Partial<Prisma.PurchaseOrderGetPayload<object>> = {}) => ({
  id: 'po-1',
  orderNumber: 'PO-20260216-ABCD',
  supplierId: 'sup-1',
  status: 'DRAFT' as const,
  expectedAt: null,
  receivedAt: null,
  notes: null,
  tenantId: 'tenant-1',
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  ...over,
});

export const makePoItemRow = (
  over: Partial<Prisma.PurchaseOrderItemGetPayload<object>> = {},
) => ({
  id: 'pol-1',
  purchaseOrderId: 'po-1',
  inventoryItemId: 'item-1',
  quantityOrdered: 5,
  quantityReceived: 0,
  unitCost: 2,
  createdAt: new Date(ISO),
  ...over,
});