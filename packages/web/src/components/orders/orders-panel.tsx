'use client';

import { useState } from 'react';
import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api';
import { useCancelOrder, useOrders, usePayOrder, useUpdateOrderStatus } from '@/hooks/use-orders';
import { PaymentBadge, StatusBadge } from '@/components/orders/order-badges';
import type { Order, OrderStatus } from '@/types/order';

/** Next legal stage per row, keyed by current status. */
const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; status: OrderStatus }>> = {
  PENDING: { label: 'Confirm', status: 'CONFIRMED' },
  CONFIRMED: { label: 'Start preparing', status: 'PREPARING' },
  PREPARING: { label: 'Mark ready', status: 'READY' },
  READY: { label: 'Complete', status: 'COMPLETED' },
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY', label: 'Ready' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** Week 9 — order list with lifecycle actions (9.2) and payment (9.4). */
export default function OrdersPanel() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading, isError } = useOrders({
    ...(statusFilter ? { status: statusFilter as OrderStatus } : {}),
    limit: 50,
  });
  const orders = data?.data ?? [];

  const advance = useUpdateOrderStatus();
  const cancel = useCancelOrder();
  const pay = usePayOrder();
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Orders</h2>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {isError && <Alert tone="error" title="Could not load orders">Check the API connection.</Alert>}
      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
      {isLoading && <p className="mt-4 text-sm text-content-muted">Loading orders…</p>}

      {!isLoading && orders.length === 0 && (
        <p className="mt-4 text-sm text-content-muted">No orders yet — create one from the New Order tab.</p>
      )}

      <ul className="mt-4 divide-y divide-gray-100">
        {orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            busy={advance.isPending || cancel.isPending || pay.isPending}
            onAdvance={() =>
              run(() =>
                advance.mutateAsync({
                  id: order.id,
                  status: NEXT_ACTION[order.status]!.status,
                }),
              )
            }
            onCancel={() => run(() => cancel.mutateAsync(order.id))}
            onPay={() => run(() => pay.mutateAsync({ id: order.id, payload: { method: 'CARD' } }))}
          />
        ))}
      </ul>
    </Card>
  );
}

function OrderRow({
  order,
  busy,
  onAdvance,
  onCancel,
  onPay,
}: {
  order: Order;
  busy: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  onPay: () => void;
}) {
  const next = NEXT_ACTION[order.status];
  const cancellable = order.status === 'PENDING' || order.status === 'CONFIRMED';

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-content-muted">{order.orderNumber}</span>
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
        <p className="mt-1 truncate text-sm text-content-muted">
          {order.items
            .map((i) => `${i.quantity}× ${i.menuItem?.name ?? 'item'}`)
            .join(', ') || 'No lines'}
          {order.tableNumber ? ` · Table ${order.tableNumber}` : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold">${order.totalAmount.toFixed(2)}</span>
        {next && (
          <Button size="sm" onClick={onAdvance} disabled={busy}>
            {next.label}
          </Button>
        )}
        {order.paymentStatus === 'PENDING' && order.status !== 'CANCELLED' && (
          <Button size="sm" variant="secondary" onClick={onPay} disabled={busy}>
            Collect ${order.totalAmount.toFixed(2)}
          </Button>
        )}
        {cancellable && (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </li>
  );
}
