import api from '@/lib/api';
import { Pagination } from '@/types/menu';
import type {
  CreateOrderPayload,
  KitchenQueuePayload,
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

  async kitchenQueue(): Promise<KitchenQueuePayload> {
    const { data } = await api.get<{ data: KitchenQueuePayload }>('/orders/kitchen/queue');
    return data.data;
  },

  async orderSummary(query: { days?: number } = {}): Promise<KitchenSummary> {
    const { data } = await api.get<{ data: KitchenSummary }>('/orders/report/summary', {
      params: query,
    });
    return data.data;
  },
};

export type { OrderItem };