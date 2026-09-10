import api from '@/lib/api';
import { Pagination } from '@/types/menu';
import type {
  AssignedOrder,
  AssignStaffPayload,
  CreateOrderPayload,
  KitchenAnalytics,
  KitchenQueueResponse,
  KitchenSettings,
  KitchenSummary,
  Order,
  OrderItem,
  OrderListQuery,
  OrderStatusPayload,
  PayOrderPayload,
  UpdateOrderPayload,
} from '@/types/order';

/**
 * Week 9 endpoints — all match packages/api/src/routes/order.routes.ts.
 * The shared axios client attaches Authorization + X-Tenant-ID automatically.
 */
export const orderService = {
  async createOrder(payload: CreateOrderPayload): Promise<Order> {
    const { data } = await api.post<{ data: Order }>('/orders', payload);
    return data.data;
  },

  async listOrders(
    query: OrderListQuery = {},
  ): Promise<{ data: Order[]; pagination: Pagination }> {
    const { data } = await api.get<{ data: Order[]; pagination: Pagination }>('/orders', {
      params: query,
    });
    return data;
  },

  async getOrder(id: string): Promise<Order> {
    const { data } = await api.get<{ data: Order }>(`/orders/${id}`);
    return data.data;
  },

  async updateOrder(id: string, payload: UpdateOrderPayload): Promise<Order> {
    const { data } = await api.patch<{ data: Order }>(`/orders/${id}`, payload);
    return data.data;
  },

  async updateOrderStatus(id: string, payload: OrderStatusPayload): Promise<Order> {
    const { data } = await api.patch<{ data: Order }>(`/orders/${id}/status`, payload);
    return data.data;
  },

  async cancelOrder(id: string): Promise<Order> {
    const { data } = await api.post<{ data: Order }>(`/orders/${id}/cancel`);
    return data.data;
  },

  async updateOrderItemStatus(
    id: string,
    itemId: string,
    payload: OrderStatusPayload,
  ): Promise<Order> {
    const { data } = await api.patch<{ data: Order }>(`/orders/${id}/items/${itemId}/status`, payload);
    return data.data;
  },

  async payOrder(id: string, payload: PayOrderPayload): Promise<Order> {
    const { data } = await api.post<{ data: Order }>(`/orders/${id}/pay`, payload);
    return data.data;
  },

  // Week 21 — the queue is always the live/scheduled split shape.
  async kitchenQueue(): Promise<KitchenQueueResponse> {
    const { data } = await api.get<{ data: KitchenQueueResponse }>('/orders/kitchen');
    return data.data;
  },

  async orderSummary(query: { days?: number } = {}): Promise<KitchenSummary> {
    const { data } = await api.get<{ data: KitchenSummary }>('/orders/reports/summary', {
      params: query,
    });
    return data.data;
  },

  // ── Week 21 — kitchen & fulfillment hardening ──────────────────────────────

  /** Week 21.2 — kitchen+ assigns a staff member to a ticket. */
  async assignStaff(id: string, payload: AssignStaffPayload): Promise<AssignedOrder> {
    const { data } = await api.post<{ data: AssignedOrder }>(`/orders/${id}/assign`, payload);
    return data.data;
  },

  /** Week 21.2 — kitchen+ clears the assignment. */
  async unassignStaff(id: string): Promise<AssignedOrder> {
    const { data } = await api.delete<{ data: AssignedOrder }>(`/orders/${id}/assign`);
    return data.data;
  },

  /** Week 21.3/21.4 — prep-time analytics for the kitchen window. */
  async kitchenAnalytics(query: { days?: number } = {}): Promise<KitchenAnalytics> {
    const { data } = await api.get<{ data: KitchenAnalytics }>('/orders/kitchen/analytics', {
      params: query,
    });
    return data.data;
  },

  /** Week 21.4/21.5 — read the effective kitchen settings. */
  async getKitchenSettings(): Promise<KitchenSettings> {
    const { data } = await api.get<{ data: KitchenSettings }>('/orders/kitchen/settings');
    return data.data;
  },

  /** Week 21.4/21.5 — MANAGER+ merge of kitchen settings. */
  async updateKitchenSettings(payload: Partial<KitchenSettings>): Promise<KitchenSettings> {
    const { data } = await api.patch<{ data: KitchenSettings }>('/orders/kitchen/settings', payload);
    return data.data;
  },
};

export type { OrderItem };