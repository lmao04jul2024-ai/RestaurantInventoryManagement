import api from '@/lib/api';
import { Pagination } from '@/types/menu';
import type {
  ConsumptionReportItem,
  CreatePurchaseOrderPayload,
  InventoryItem,
  InventoryItemListQuery,
  InventoryItemPayload,
  InventoryItemUpdatePayload,
  InventoryTransaction,
  LowStockAlert,
  PurchaseOrder,
  PurchaseOrderListQuery,
  ReceivePurchaseOrderPayload,
  StockTransactionPayload,
  Supplier,
  SupplierPayload,
  SupplierUpdatePayload,
  UpdatePurchaseOrderPayload,
  ValuationReportItem,
} from '@/types/inventory';

/**
 * Week 8 endpoints — all match packages/api/src/routes/{inventory,suppliers,purchase-orders}.routes.ts.
 * The shared axios client attaches Authorization + X-Tenant-ID automatically.
 */
export const inventoryService = {
  // ── Items ────────────────────────────────────────────────────────────────────
  async listItems(
    query: InventoryItemListQuery = {},
  ): Promise<{ data: InventoryItem[]; pagination: Pagination }> {
    const { data } = await api.get<{ data: InventoryItem[]; pagination: Pagination }>(
      '/inventory/items',
      { params: query },
    );
    return data;
  },

  async getItem(id: string): Promise<InventoryItem> {
    const { data } = await api.get<{ data: InventoryItem }>(`/inventory/items/${id}`);
    return data.data;
  },

  async createItem(payload: InventoryItemPayload): Promise<InventoryItem> {
    const { data } = await api.post<{ data: InventoryItem }>('/inventory/items', payload);
    return data.data;
  },

  async updateItem(id: string, payload: InventoryItemUpdatePayload): Promise<InventoryItem> {
    const { data } = await api.patch<{ data: InventoryItem }>(`/inventory/items/${id}`, payload);
    return data.data;
  },

  async deleteItem(id: string): Promise<void> {
    await api.delete(`/inventory/items/${id}`);
  },

  // ── Stock movements ──────────────────────────────────────────────────────────
  async recordTransaction(itemId: string, payload: StockTransactionPayload) {
    const { data } = await api.post<{ data: { transaction: InventoryTransaction; currentStock: number } }>(
      `/inventory/items/${itemId}/transactions`,
      payload,
    );
    return data.data;
  },

  async listTransactions(
    itemId: string,
    query: { type?: string; page?: number; limit?: number } = {},
  ): Promise<{ data: InventoryTransaction[]; pagination: Pagination }> {
    const { data } = await api.get<{ data: InventoryTransaction[]; pagination: Pagination }>(
      `/inventory/items/${itemId}/transactions`,
      { params: query },
    );
    return data;
  },

  // ── Monitoring & reports ─────────────────────────────────────────────────────
  async getLowStockAlerts(): Promise<LowStockAlert[]> {
    const { data } = await api.get<{ data: LowStockAlert[] }>('/inventory/alerts/low-stock');
    return data.data;
  },

  async getValuationReport(): Promise<{
    totalValue: number;
    itemCount: number;
    items: ValuationReportItem[];
  }> {
    const { data } = await api.get<{ data: { totalValue: number; itemCount: number; items: ValuationReportItem[] } }>(
      '/inventory/reports/valuation',
    );
    return data.data;
  },

  async getConsumptionReport(): Promise<{
    from: string;
    to: string;
    items: ConsumptionReportItem[];
  }> {
    const { data } = await api.get<{
      data: { from: string; to: string; items: ConsumptionReportItem[] };
    }>('/inventory/reports/consumption');
    return data.data;
  },

  // ── Suppliers ────────────────────────────────────────────────────────────────
  async listSuppliers(): Promise<Supplier[]> {
    const { data } = await api.get<{ data: Supplier[] }>('/suppliers');
    return data.data;
  },

  async createSupplier(payload: SupplierPayload): Promise<Supplier> {
    const { data } = await api.post<{ data: Supplier }>('/suppliers', payload);
    return data.data;
  },

  async updateSupplier(id: string, payload: SupplierUpdatePayload): Promise<Supplier> {
    const { data } = await api.patch<{ data: Supplier }>(`/suppliers/${id}`, payload);
    return data.data;
  },

  async deleteSupplier(id: string): Promise<void> {
    await api.delete(`/suppliers/${id}`);
  },

  // ── Purchase orders ──────────────────────────────────────────────────────────
  async listPurchaseOrders(
    query: PurchaseOrderListQuery = {},
  ): Promise<{ data: PurchaseOrder[]; pagination: Pagination }> {
    const { data } = await api.get<{ data: PurchaseOrder[]; pagination: Pagination }>(
      '/purchase-orders',
      { params: query },
    );
    return data;
  },

  async getPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const { data } = await api.get<{ data: PurchaseOrder }>(`/purchase-orders/${id}`);
    return data.data;
  },

  async createPurchaseOrder(payload: CreatePurchaseOrderPayload): Promise<PurchaseOrder> {
    const { data } = await api.post<{ data: PurchaseOrder }>('/purchase-orders', payload);
    return data.data;
  },

  async updatePurchaseOrder(id: string, payload: UpdatePurchaseOrderPayload): Promise<PurchaseOrder> {
    const { data } = await api.patch<{ data: PurchaseOrder }>(`/purchase-orders/${id}`, payload);
    return data.data;
  },

  async submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const { data } = await api.post<{ data: PurchaseOrder }>(`/purchase-orders/${id}/submit`);
    return data.data;
  },

  async cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const { data } = await api.post<{ data: PurchaseOrder }>(`/purchase-orders/${id}/cancel`);
    return data.data;
  },

  async receivePurchaseOrder(id: string, payload: ReceivePurchaseOrderPayload): Promise<PurchaseOrder> {
    const { data } = await api.post<{ data: PurchaseOrder }>(`/purchase-orders/${id}/receive`, payload);
    return data.data;
  },

  async deletePurchaseOrder(id: string): Promise<void> {
    await api.delete(`/purchase-orders/${id}`);
  },
};