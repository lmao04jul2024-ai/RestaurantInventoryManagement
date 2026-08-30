import { activeOrders, diffOrderStatuses } from '@/components/shop/order-notifications';
import type { Order, OrderStatus } from '@/types/order';

const order = (id: string, status: OrderStatus, orderNumber = `R-${id}`): Order => ({
  id,
  orderNumber,
  status,
  paymentStatus: 'PAID',
  totalAmount: 10,
  taxAmount: 0,
  discountAmount: 0,
  tableNumber: null,
  specialRequests: null,
  customerId: 'c1',
  tenantId: 't1',
  tableId: null,
  createdAt: '2026-08-30T10:00:00Z',
  updatedAt: '2026-08-30T10:00:00Z',
  completedAt: null,
  items: [],
});

describe('order notifications — Week 11.2 diff logic', () => {
  it('activeOrders keeps only in-progress tickets', () => {
    const orders = [
      order('1', 'PENDING'),
      order('2', 'PREPARING'),
      order('3', 'COMPLETED'),
      order('4', 'CANCELLED'),
      order('5', 'READY'),
    ];

    expect(activeOrders(orders).map((o) => o.id)).toEqual(['1', '2', '5']);
  });

  it('raises a toast for an order never seen before', () => {
    const toasts = diffOrderStatuses({}, [order('1', 'CONFIRMED')]);

    expect(toasts).toEqual([
      { id: '1:CONFIRMED', orderId: '1', orderNumber: 'R-1', status: 'CONFIRMED' },
    ]);
  });

  it('is silent when nothing changed', () => {
    const seen = { '1': 'PREPARING' as OrderStatus };
    expect(diffOrderStatuses(seen, [order('1', 'PREPARING')])).toEqual([]);
  });

  it('raises exactly one toast per status advance', () => {
    const seen = { '1': 'CONFIRMED' as OrderStatus, '2': 'PENDING' as OrderStatus };
    const toasts = diffOrderStatuses(seen, [order('1', 'PREPARING'), order('2', 'PENDING')]);

    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ orderId: '1', status: 'PREPARING' });
  });

  it('never notifies about orders that finished between polls', () => {
    const seen = { '1': 'READY' as OrderStatus };
    expect(diffOrderStatuses(seen, [order('1', 'COMPLETED')])).toEqual([]);
  });
});
