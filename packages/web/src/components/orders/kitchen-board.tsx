'use client';

import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api';
import { useKitchenQueue, useUpdateOrderItemStatus } from '@/hooks/use-orders';
import type { Order, OrderItem, OrderStatus } from '@/types/order';

/** Next KDS stage for a line. */
const NEXT_ITEM_ACTION: Partial<Record<OrderStatus, { label: string; status: OrderStatus }>> = {
  PENDING: { label: 'Start', status: 'PREPARING' },
  PREPARING: { label: 'Done', status: 'READY' },
};

/**
 * Week 9 — kitchen display (9.3). Live queue of accepted orders with
 * per-line progression; refreshes by polling every 10s.
 */
export default function KitchenBoard() {
  const { data, isLoading, isError, dataUpdatedAt } = useKitchenQueue();
  const orders = data ?? [];
  const moveItem = useUpdateOrderItemStatus();
  const error = moveItem.error ? getApiErrorMessage(moveItem.error) : null;

  const advance = (order: Order, item: OrderItem) => {
    const next = NEXT_ITEM_ACTION[item.status];
    if (!next) return;
    moveItem.mutate({ orderId: order.id, itemId: item.id, status: next.status });
  };

  const ageMinutes = (iso: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Kitchen queue</h2>
        <span className="text-xs text-content-muted">
          Auto-refreshes every 10s · updated {new Date(dataUpdatedAt).toLocaleTimeString()}
        </span>
      </div>

      {isError && <Alert tone="error" title="Could not load the kitchen queue">Check the API connection.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {isLoading && <p className="text-sm text-content-muted">Loading queue…</p>}

      {!isLoading && orders.length === 0 && (
        <Card>
          <p className="text-sm text-content-muted">All caught up — no orders in the queue. 🎉</p>
        </Card>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => (
          <li key={order.id}>
            <Card className={ageMinutes(order.createdAt) >= 15 ? 'border-red-300' : undefined}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-content-muted">{order.orderNumber}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    ageMinutes(order.createdAt) >= 15 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {ageMinutes(order.createdAt)}m
                </span>
              </div>

              <ul className="mt-3 space-y-2">
                {order.items.map((item) => {
                  const next = NEXT_ITEM_ACTION[item.status];
                  return (
                    <li key={item.id} className="rounded border border-gray-100 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium">
                          {item.quantity}× {item.menuItem?.name ?? 'item'}
                        </p>
                        {next ? (
                          <Button
                            size="sm"
                            variant={item.status === 'PREPARING' ? 'secondary' : 'primary'}
                            onClick={() => advance(order, item)}
                            disabled={moveItem.isPending}
                          >
                            {next.label}
                          </Button>
                        ) : (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Ready
                          </span>
                        )}
                      </div>
                      {item.specialInstructions && (
                        <p className="mt-1 text-xs italic text-amber-700">“{item.specialInstructions}”</p>
                      )}
                    </li>
                  );
                })}
              </ul>

              {order.specialRequests && (
                <p className="mt-3 text-xs text-content-muted">Order note: {order.specialRequests}</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
