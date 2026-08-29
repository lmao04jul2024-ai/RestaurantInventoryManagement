'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { orderService } from '@/services/order.service';
import type {
  CreateOrderPayload,
  OrderListQuery,
  OrderStatus,
  OrderStatusPayload,
  PayOrderPayload,
  UpdateOrderPayload,
} from '@/types/order';

// ── Queries ───────────────────────────────────────────────────────────────────

export function useOrders(query: OrderListQuery = {}) {
  return useQuery({
    queryKey: ['orders', query],
    queryFn: () => orderService.listOrders(query),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () => orderService.getOrder(id!),
    enabled: !!id,
  });
}

/**
 * Kitchen queue with 10s polling — the stopgap for the SSE stream until the
 * websocket gateway lands in a later phase (browser EventSource cannot attach
 * the Authorization header the API requires).
 */
export function useKitchenQueue(poll = true) {
  return useQuery({
    queryKey: ['kitchen-queue'],
    queryFn: orderService.kitchenQueue,
    refetchInterval: poll ? 10_000 : false,
    staleTime: 5_000,
  });
}

export function useOrderSummary(days = 7) {
  return useQuery({
    queryKey: ['order-summary', days],
    queryFn: () => orderService.orderSummary({ days }),
    staleTime: 30_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

const ORDER_KEYS = ['orders', 'kitchen-queue', 'order-summary'] as const;

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => orderService.createOrder(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDER_KEYS }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateOrderPayload }) =>
      orderService.updateOrder(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDER_KEYS }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      orderService.updateOrderStatus(id, { status } satisfies OrderStatusPayload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDER_KEYS }),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orderService.cancelOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDER_KEYS }),
  });
}

export function useUpdateOrderItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId, status }: { orderId: string; itemId: string; status: OrderStatus }) =>
      orderService.updateOrderItemStatus(orderId, itemId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDER_KEYS }),
  });
}

export function usePayOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PayOrderPayload }) =>
      orderService.payOrder(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDER_KEYS }),
  });
}
