import api from '@/lib/api';
import type { Recurrence, RecurringOrder } from '@/types/advanced-ordering';

/** Week 20.6 — subscription orders (packages/api/src/routes/recurring-orders.routes.ts). */
export const recurringOrderService = {
  async listMy(): Promise<RecurringOrder[]> {
    const { data } = await api.get<{ data: RecurringOrder[] }>('/recurring-orders');
    return data.data;
  },

  async create(payload: { items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string | null }>; recurrence: Recurrence }): Promise<RecurringOrder> {
    const { data } = await api.post<{ data: RecurringOrder }>('/recurring-orders', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<RecurringOrder>): Promise<RecurringOrder> {
    const { data } = await api.patch<{ data: RecurringOrder }>(`/recurring-orders/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/recurring-orders/${id}`);
  },
};
