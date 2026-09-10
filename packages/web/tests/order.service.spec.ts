jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import api from '@/lib/api';
import { orderService } from '@/services/order.service';

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;
const apiPatch = api.patch as jest.Mock;
const apiDelete = api.delete as jest.Mock;

describe('orderService — Week 9 endpoint contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates orders via POST /orders', async () => {
    apiPost.mockResolvedValue({ data: { data: { id: 'order-1', orderNumber: 'ORD-1' } } });

    const order = await orderService.createOrder({
      items: [{ menuItemId: 'menu-1', quantity: 2 }],
    });

    expect(apiPost).toHaveBeenCalledWith('/orders', {
      items: [{ menuItemId: 'menu-1', quantity: 2 }],
    });
    expect(order.orderNumber).toBe('ORD-1');
  });

  it('lists orders with query params and unwraps the envelope', async () => {
    apiGet.mockResolvedValue({ data: { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } } });

    const result = await orderService.listOrders({ status: 'PENDING', page: 1, limit: 50 });

    expect(apiGet).toHaveBeenCalledWith('/orders', {
      params: { status: 'PENDING', page: 1, limit: 50 },
    });
    expect(result.data).toEqual([]);
  });

  it('advances status via PATCH /orders/:id/status', async () => {
    apiPatch.mockResolvedValue({ data: { data: { id: 'order-1', status: 'CONFIRMED' } } });

    const order = await orderService.updateOrderStatus('order-1', { status: 'CONFIRMED' });

    expect(apiPatch).toHaveBeenCalledWith('/orders/order-1/status', { status: 'CONFIRMED' });
    expect(order.status).toBe('CONFIRMED');
  });

  it('moves a KDS line via PATCH /orders/:id/items/:itemId/status', async () => {
    apiPatch.mockResolvedValue({ data: { data: { id: 'order-1', status: 'READY' } } });

    await orderService.updateOrderItemStatus('order-1', 'line-1', { status: 'READY' });

    expect(apiPatch).toHaveBeenCalledWith('/orders/order-1/items/line-1/status', { status: 'READY' });
  });

  it('cancels via POST /orders/:id/cancel', async () => {
    apiPost.mockResolvedValue({ data: { data: { id: 'order-1', status: 'CANCELLED' } } });

    const order = await orderService.cancelOrder('order-1');

    expect(apiPost).toHaveBeenCalledWith('/orders/order-1/cancel');
    expect(order.status).toBe('CANCELLED');
  });

  it('collects payment via POST /orders/:id/pay', async () => {
    apiPost.mockResolvedValue({ data: { data: { id: 'order-1', paymentStatus: 'PAID' } } });

    const order = await orderService.payOrder('order-1', { method: 'CARD' });

    expect(apiPost).toHaveBeenCalledWith('/orders/order-1/pay', { method: 'CARD' });
    expect(order.paymentStatus).toBe('PAID');
  });

  it('passes the self-service transactionId through to the pay endpoint (10.4)', async () => {
    apiPost.mockResolvedValue({ data: { data: { id: 'order-1', paymentStatus: 'PAID' } } });

    await orderService.payOrder('order-1', { method: 'ONLINE', transactionId: 'SIM-ABC123' });

    expect(apiPost).toHaveBeenCalledWith('/orders/order-1/pay', {
      method: 'ONLINE',
      transactionId: 'SIM-ABC123',
    });
  });

  it('fetches the kitchen queue from /orders/kitchen (Week 21 path fix)', async () => {
    apiGet.mockResolvedValue({
      data: { data: { live: [{ id: 'order-1', status: 'CONFIRMED' }], scheduled: [] } },
    });

    const queue = await orderService.kitchenQueue();

    expect(apiGet).toHaveBeenCalledWith('/orders/kitchen');
    expect(queue).toMatchObject({ live: [{ status: 'CONFIRMED' }], scheduled: [] });
  });

  it('fetches the dashboard summary from /orders/reports/summary (Week 21 path fix)', async () => {
    apiGet.mockResolvedValue({
      data: { data: { windowDays: 7, totalOrders: 4, countsByStatus: {}, paidRevenue: 80, averageOrderValue: 20 } },
    });

    const summary = await orderService.orderSummary({ days: 7 });

    expect(apiGet).toHaveBeenCalledWith('/orders/reports/summary', { params: { days: 7 } });
    expect(summary.paidRevenue).toBe(80);
  });

  // ── Week 21 — kitchen & fulfillment hardening ──────────────────────────────

  it('assigns a staff member via POST /orders/:id/assign (21.2)', async () => {
    apiPost.mockResolvedValue({ data: { data: { id: 'order-1', assignedStaff: { id: 'staff-1', name: 'Ana Lee' } } } });

    const order = await orderService.assignStaff('order-1', { staffId: 'staff-1' });

    expect(apiPost).toHaveBeenCalledWith('/orders/order-1/assign', { staffId: 'staff-1' });
    expect(order.assignedStaff).toMatchObject({ name: 'Ana Lee' });
  });

  it('unassigns via DELETE /orders/:id/assign (21.2)', async () => {
    apiDelete.mockResolvedValue({ data: { data: { id: 'order-1', assignedStaff: null } } });

    const order = await orderService.unassignStaff('order-1');

    expect(apiDelete).toHaveBeenCalledWith('/orders/order-1/assign');
    expect(order.assignedStaff).toBeNull();
  });

  it('fetches prep analytics from /orders/kitchen/analytics (21.3/21.4)', async () => {
    apiGet.mockResolvedValue({
      data: {
        data: {
          windowDays: 1, completedCount: 3, avgPrepMinutes: 15.33,
          prepTimeTargetMinutes: 15, targetMetPct: 67, throughputPerHour: 0.13, countsByStatus: {},
        },
      },
    });

    const analytics = await orderService.kitchenAnalytics({ days: 1 });

    expect(apiGet).toHaveBeenCalledWith('/orders/kitchen/analytics', { params: { days: 1 } });
    expect(analytics.avgPrepMinutes).toBeCloseTo(15.33, 2);
    expect(analytics.targetMetPct).toBe(67);
  });

  it('reads and patches kitchen settings (21.4/21.5)', async () => {
    apiGet.mockResolvedValue({ data: { data: { prepTimeTargetMinutes: 15, capacity: 20 } } });
    apiPatch.mockResolvedValue({ data: { data: { prepTimeTargetMinutes: 12, capacity: 20 } } });

    const before = await orderService.getKitchenSettings();
    expect(apiGet).toHaveBeenCalledWith('/orders/kitchen/settings');
    expect(before).toMatchObject({ capacity: 20 });

    const after = await orderService.updateKitchenSettings({ prepTimeTargetMinutes: 12 });
    expect(apiPatch).toHaveBeenCalledWith('/orders/kitchen/settings', { prepTimeTargetMinutes: 12 });
    expect(after.prepTimeTargetMinutes).toBe(12);
  });
});
