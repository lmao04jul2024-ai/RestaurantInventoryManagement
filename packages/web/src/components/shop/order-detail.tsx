'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import { StatusBadge, PaymentBadge } from '@/components/orders/order-badges';
import { formatPrice } from '@/lib/menu-ui';
import { getApiErrorMessage } from '@/lib/api';
import { useOrder, usePayOrder, isOrderActive } from '@/hooks/use-orders';
import { useIsFeatureEnabled } from '@/hooks/use-feature-flags';
import type { OrderStatus } from '@/types/order';
import ReviewForm from '@/components/shop/review-form';

const TIMELINE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];

function formatWhen(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') + ' UTC' : '—';
}

/**
 * Week 10 (10.5) + Week 11.1 — order confirmation & real-time tracking.
 * Polls every 5s while the ticket is active (PENDING→READY), goes fully idle
 * once COMPLETED/CANCELLED. Shows a Live pill and per-line kitchen status.
 */
export default function OrderDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const justPlaced = params.get('placed') === '1';
  const payFailed = params.get('payFailed') === '1';

  const { data: order, isLoading } = useOrder(id, (o) =>
    !o || isOrderActive(o.status) ? 5_000 : false,
  );
  const pay = usePayOrder();
  // Week 14 — restaurant can switch off customer reviews via the flag system.
  const reviewsEnabled = useIsFeatureEnabled('customer_reviews');

  if (isLoading || !order) {
    return (
      <div className="flex justify-center py-16">
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"
        />
        <span className="sr-only">Loading order…</span>
      </div>
    );
  }

  const timelineIndex = TIMELINE.indexOf(order.status);
  const canPay = order.paymentStatus === 'PENDING' && order.status !== 'CANCELLED';

  const payNow = async () => {
    try {
      await pay.mutateAsync({ id: order.id, payload: { method: 'CARD' } });
    } catch (err) {
      // Surface inline; the button stays available for a retry.
      window.alert(getApiErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:px-8">
      {justPlaced && (
        <Alert tone="success">
          🎉 Order placed! The kitchen has your ticket{payFailed ? ' — but payment needs another try.' : '.'}
        </Alert>
      )}
      {payFailed && !justPlaced && (
        <Alert tone="warning">Payment could not be completed — use Pay now below.</Alert>
      )}
      {order.status === 'CANCELLED' && (
        <Alert tone="error">This order was cancelled. Contact staff if this looks wrong.</Alert>
      )}

      {/* Status timeline */}
      {order.status !== 'CANCELLED' && (
        <ol className="mt-6 flex items-center" aria-label="Order progress">
          {TIMELINE.map((step, i) => {
            const done = timelineIndex >= i;
            const current = timelineIndex === i;
            return (
              <li key={step} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center">
                  <span
                    aria-current={current ? 'step' : undefined}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      done ? 'bg-primary-600 text-on-primary' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span
                    className={`mt-1 text-[10px] font-medium uppercase tracking-wide ${
                      done ? 'text-primary-700' : 'text-gray-400'
                    }`}
                  >
                    {step}
                  </span>
                </div>
                {i < TIMELINE.length - 1 && (
                  <span
                    aria-hidden
                    className={`mx-1 mb-4 h-0.5 flex-1 ${timelineIndex > i ? 'bg-primary-600' : 'bg-gray-200'}`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Receipt */}
      <div className="print-area mt-6 rounded-card border border-gray-100 bg-surface p-6 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-content-default">{order.orderNumber}</h1>
            <p className="text-xs text-content-muted">Placed {formatWhen(order.createdAt)}</p>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
            {isOrderActive(order.status) && (
              <span
                className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium text-green-700"
                aria-label="Tracking live"
              >
                <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                Live
              </span>
            )}
          </div>
        </div>

        <ul className="mt-4 divide-y divide-gray-100">
          {order.items.map((item) => (
            <li key={item.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-content-default">
                  {item.quantity} × {item.menuItem?.name ?? 'Item'}
                </span>
                <span className="text-sm font-semibold text-content-default">
                  {formatPrice(item.unitPrice * item.quantity)}
                </span>
              </div>
              <p className="text-xs text-content-muted">
                {formatPrice(item.unitPrice)} each
                {item.specialInstructions ? ` · ${item.specialInstructions}` : ''}
                {/* Week 11.1 — per-line kitchen progress on active tickets */}
                {isOrderActive(order.status) && (
                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-content-muted">
                    {item.status.toLowerCase()}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-3 border-t border-gray-200 pt-3">
          <div className="flex justify-between font-bold text-content-default">
            <span>Total</span>
            <span>{formatPrice(order.totalAmount)}</span>
          </div>
        </div>

        {order.specialRequests && (
          <p className="mt-3 text-sm text-content-muted">
            <span className="font-medium text-content-default">Requests:</span>{' '}
            {order.specialRequests}
          </p>
        )}

        <div className="mt-4 rounded border border-dashed border-gray-200 p-3 text-xs text-content-muted">
          <p>
            Payment:{' '}
            {order.payment
              ? `${order.payment.method} · ${order.payment.status}${
                  order.payment.transactionId ? ` · ref ${order.payment.transactionId}` : ''
                } · ${formatWhen(order.payment.paidAt)}`
              : 'Not paid yet'}
          </p>
          {order.completedAt && <p className="mt-1">Completed {formatWhen(order.completedAt)}</p>}
        </div>
      </div>

      {/* Actions (hidden on the printed receipt) */}
      <div className="mt-6 flex flex-wrap gap-2 print:hidden">
        {canPay && (
          <Button onClick={payNow} isLoading={pay.isPending} disabled={pay.isPending}>
            Pay now · {formatPrice(order.totalAmount)}
          </Button>
        )}
        <Button variant="outline" onClick={() => window.print()}>
          🖨️ Print receipt
        </Button>
        <Link
          href="/menu"
          className="inline-flex items-center rounded px-4 py-2.5 text-sm font-medium text-primary-600 hover:underline"
        >
          Order more →
        </Link>
      </div>

      {/* Week 11.3 — review/rate after completion (gated by 'customer_reviews' flag) */}
      {reviewsEnabled && order.status === 'COMPLETED' && (
        <ReviewForm
          orderId={order.id}
          existing={order.reviews?.[0] ?? null}
        />
      )}

      {/* Print stylesheet: only the receipt card survives printing. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; inset: 0; box-shadow: none; }
        }
      `}</style>
    </div>
  );
}