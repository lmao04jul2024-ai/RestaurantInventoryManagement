'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { inventoryService } from '@/services/inventory.service';
import type {
  CreatePurchaseOrderPayload,
  InventoryImportPayload,
  InventoryItemPayload,
  InventoryItemUpdatePayload,
  PurchaseOrderStatus,
  ReceivePurchaseOrderPayload,
  StockTransactionPayload,
  SupplierPayload,
  SupplierUpdatePayload,
} from '@/types/inventory';

// ── Queries ───────────────────────────────────────────────────────────────────

export function useItems(query: { q?: string; lowStock?: boolean; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['items', query],
    queryFn: () => inventoryService.listItems(query),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useLowStockAlerts() {
  return useQuery({
    queryKey: ['low-stock'],
    queryFn: inventoryService.getLowStockAlerts,
    staleTime: 30_000,
  });
}

export function useValuationReport() {
  return useQuery({
    queryKey: ['valuation'],
    queryFn: inventoryService.getValuationReport,
    staleTime: 60_000,
  });
}

export function useConsumptionReport() {
  return useQuery({
    queryKey: ['consumption'],
    queryFn: inventoryService.getConsumptionReport,
    staleTime: 60_000,
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: inventoryService.listSuppliers,
    staleTime: 60_000,
  });
}

export function usePurchaseOrders(query: { status?: PurchaseOrderStatus; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['purchase-orders', query],
    queryFn: () => inventoryService.listPurchaseOrders(query),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

const INVENTORY_KEYS = ['items', 'low-stock', 'valuation', 'consumption'] as const;

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InventoryItemPayload) => inventoryService.createItem(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVENTORY_KEYS }),
  });
}

/**
 * Phase 5 S3.1 — CSV inventory import mutation. A successful import changes
 * derived inventory state (items list, low-stock, valuation), so it reuses the
 * same invalidation set as item creation.
 */
export function useImportItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InventoryImportPayload) => inventoryService.importItems(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVENTORY_KEYS }),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: InventoryItemUpdatePayload }) =>
      inventoryService.updateItem(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVENTORY_KEYS }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryService.deleteItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVENTORY_KEYS }),
  });
}

export function useRecordTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: StockTransactionPayload }) =>
      inventoryService.recordTransaction(itemId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVENTORY_KEYS }),
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SupplierPayload) => inventoryService.createSupplier(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SupplierUpdatePayload }) =>
      inventoryService.updateSupplier(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryService.deleteSupplier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePurchaseOrderPayload) => inventoryService.createPurchaseOrder(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });
}

export function useSubmitPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryService.submitPurchaseOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders', 'items', 'low-stock'] }),
  });
}

export function useCancelPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryService.cancelPurchaseOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });
}

export function useReceivePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReceivePurchaseOrderPayload }) =>
      inventoryService.receivePurchaseOrder(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders', 'items', 'low-stock'] }),
  });
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryService.deletePurchaseOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });
}