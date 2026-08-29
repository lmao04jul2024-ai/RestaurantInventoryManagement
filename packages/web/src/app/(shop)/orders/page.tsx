'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PaymentBadge, StatusBadge } from '@/components/orders/order-badges';
import { formatPrice } from '@/lib/menu-ui';
import { useOrders } from '@/hooks/use-orders';
import type { OrderStatus } from '@/types/order';

const STATUS_FILTERS: Array<{ value?: OrderStatus; label: string }> = [
  { label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY', label: 'Ready' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** Deterministic UTC rendering avoids server/client locale drift during hydration. */
function formatWhen(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ') + ' UTC';
}

/**
 * Week 10 (10.6) — the customer's order history. The API narrows CUSTOMER
 * listings to their own orders, so no extra scoping params are needed.
 */
export default function CustomerOrdersPage() {
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const { data, isLoading } = useOrders(status ? { status } : {});
  const orders = data?.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-bold text-content-default">My orders</h1>
      <p className="mt-1 text-sm text-content-muted">Your tickets at this restaurant.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              status === f.value
                ? 'bg-primary-600 text-white'
                : 'border border-gray-200 bg-surface text-content-muted hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <span
            aria-hidden
            className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"
          />
          <span className="sr-only">Loading orders…</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-sm text-content-muted">No orders here yet.</p>
          <Link
            href="/menu"
            className="mt-4 inline-block rounded bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            Browse the menu
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex items-center justify-between gap-3 rounded-card border border-gray-100 bg-surface p-4 shadow-card transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-content-default">{order.orderNumber}</p>
                  <p className="mt-0.5 text-xs text-content-muted">{formatWhen(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={order.status} />
                  <PaymentBadge status={order.paymentStatus} />
                  <span className="ml-1 font-semibold text-primary-700">
                    {formatPrice(order.totalAmount)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}