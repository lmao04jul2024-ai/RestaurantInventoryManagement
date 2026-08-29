jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import api from '@/lib/api';
import { orderService } from '@/services/order.service';

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;
const apiPatch = api.patch as jest.Mock;

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

  it('fetches the kitchen queue from /orders/kitchen/queue', async () => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 'order-1', status: 'CONFIRMED' }] } });

    const queue = await orderService.kitchenQueue();

    expect(apiGet).toHaveBeenCalledWith('/orders/kitchen/queue');
    expect(queue[0]).toMatchObject({ status: 'CONFIRMED' });
  });

  it('fetches the dashboard summary from /orders/report/summary', async () => {
    apiGet.mockResolvedValue({
      data: { data: { windowDays: 7, totalOrders: 4, countsByStatus: {}, paidRevenue: 80, averageOrderValue: 20 } },
    });

    const summary = await orderService.orderSummary({ days: 7 });

    expect(apiGet).toHaveBeenCalledWith('/orders/report/summary', { params: { days: 7 } });
    expect(summary.paidRevenue).toBe(80);
  });
});
