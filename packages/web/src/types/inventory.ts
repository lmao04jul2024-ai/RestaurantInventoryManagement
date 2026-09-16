/**
 * Inventory domain types mirroring the Week-8 API contract
 * (see packages/api/src/controllers/{inventory,supplier,purchase-order}.controller.ts).
 */

export type InventoryUnit = 'KG' | 'G' | 'L' | 'ML' | 'UNIT' | 'BOX';
export type TransactionType = 'RESTOCK' | 'USAGE' | 'ADJUSTMENT' | 'RETURN';
export type PurchaseOrderStatus = 'DRAFT' | 'SUBMITTED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { inventory: number; purchaseOrders: number };
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStock: number;
  maxStock: number | null;
  unit: InventoryUnit;
  costPrice: number | null;
  sellingPrice: number | null;
  supplierId: string | null;
  isActive: boolean;
  lastRestockedAt: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Pick<Supplier, 'id' | 'name'> | null;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  transactionType: TransactionType;
  quantity: number;
  unitCost: number | null;
  reference: string | null;
  notes: string | null;
  performedBy: string | null;
  tenantId: string;
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  inventoryItemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number | null;
  inventoryItem?: Pick<InventoryItem, 'id' | 'name' | 'sku' | 'unit'>;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  expectedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Pick<Supplier, 'id' | 'name' | 'email' | 'phone'> | null;
  items?: PurchaseOrderItem[];
  _count?: { items: number };
}

export interface LowStockAlert {
  itemId: string;
  name: string;
  sku: string;
  unit: InventoryUnit;
  currentStock: number;
  minStock: number;
  supplierId: string | null;
  supplierName: string | null;
  status: 'LOW' | 'OUT_OF_STOCK';
}

export interface ValuationReportItem {
  id: string;
  name: string;
  sku: string;
  unit: InventoryUnit;
  currentStock: number;
  costPrice: number | null;
  unitValue: number;
}

export interface ConsumptionReportItem {
  item: Pick<InventoryItem, 'id' | 'name' | 'sku' | 'unit'>;
  totalUsed: number;
}

export interface InventoryItemListQuery {
  q?: string;
  supplierId?: string;
  lowStock?: boolean;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sort?: 'name' | 'stock_asc' | 'stock_desc' | 'newest';
}

export interface PurchaseOrderListQuery {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  page?: number;
  limit?: number;
}

export interface InventoryItemPayload {
  name: string;
  sku: string;
  currentStock?: number;
  minStock: number;
  maxStock?: number | null;
  unit?: InventoryUnit;
  costPrice?: number | null;
  sellingPrice?: number | null;
  supplierId?: string | null;
  isActive?: boolean;
}

export type InventoryItemUpdatePayload = Partial<InventoryItemPayload>;

export interface InventoryImportRowError {
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface InventoryImportWarning {
  row: number;
  code: string;
  message: string;
}

export interface InventoryImportPayload {
  /** Raw CSV text (first line is the header row). */
  data: string;
  /** Preview-only: validate and count, don't write anything. */
  dryRun?: boolean;
}

export interface InventoryImportResult {
  total: number;
  created: number;
  skipped: number;
  dryRun: boolean;
  errors: InventoryImportRowError[];
  warnings: InventoryImportWarning[];
}

export interface StockTransactionPayload {
  transactionType: TransactionType;
  quantity: number;
  unitCost?: number | null;
  reference?: string | null;
  notes?: string | null;
}

export interface SupplierPayload {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export type SupplierUpdatePayload = Partial<SupplierPayload>;

export interface PurchaseOrderLine {
  inventoryItemId: string;
  quantityOrdered: number;
  unitCost?: number | null;
}

export interface CreatePurchaseOrderPayload {
  supplierId: string;
  orderNumber?: string;
  expectedAt?: string | null;
  notes?: string | null;
  items: PurchaseOrderLine[];
}

export type UpdatePurchaseOrderPayload = Partial<Omit<CreatePurchaseOrderPayload, 'items'>> & {
  items?: PurchaseOrderLine[];
};

export interface ReceivePurchaseOrderPayload {
  items: Array<{ itemId: string; quantity: number; unitCost?: number | null }>;
}