import api from '@/lib/api';
import type { GroupOrder, GroupOrderItem } from '@/types/advanced-ordering';

/** Week 20.2 — group ordering endpoints (packages/api/src/routes/group-orders.routes.ts). */
export const groupOrderService = {
  async createGroupOrder(): Promise<GroupOrder> {
    const { data } = await api.post<{ data: GroupOrder }>('/group-orders');
    return data.data;
  },

  async getMyGroupOrders(): Promise<GroupOrder[]> {
    const { data } = await api.get<{ data: GroupOrder[] }>('/group-orders/me');
    return data.data;
  },

  async getByCode(code: string): Promise<GroupOrder> {
    const { data } = await api.get<{ data: GroupOrder }>(`/group-orders/code/${encodeURIComponent(code)}`);
    return data.data;
  },

  async addItem(groupId: string, line: { menuItemId: string; quantity: number; specialInstructions?: string | null }): Promise<GroupOrderItem> {
    const { data } = await api.post<{ data: GroupOrderItem }>(`/group-orders/${groupId}/items`, line);
    return data.data;
  },

  async removeItem(groupId: string, itemId: string): Promise<void> {
    await api.delete(`/group-orders/${groupId}/items/${itemId}`);
  },

  async convert(groupId: string): Promise<GroupOrder> {
    const { data } = await api.post<{ data: GroupOrder }>(`/group-orders/${groupId}/convert`);
    return data.data;
  },

  async cancel(groupId: string): Promise<GroupOrder> {
    const { data } = await api.post<{ data: GroupOrder }>(`/group-orders/${groupId}/cancel`);
    return data.data;
  },
};
