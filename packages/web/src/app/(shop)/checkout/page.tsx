'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/button';
import { formatPrice } from '@/lib/menu-ui';
import { getApiErrorMessage } from '@/lib/api';
import { useCreateOrder, usePayOrder } from '@/hooks/use-orders';
import { useCartStore, cartItemCount, cartSubtotal } from '@/store/cart.store';
import type { PaymentMethod } from '@/types/order';

/** CASH is staff-only at the counter (API rejects CASH_NOT_SELF_SERVICE). */
const SELF_SERVICE_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'CARD', label: '💳 Card' },
  { value: 'ONLINE', label: '🌐 Online wallet' },
];

/**
 * Week 10 (10.4) — cart review + placement. The order is created (price
 * snapshotting happens server-side) and immediately self-settled; on payment
 * failure the ticket still exists and the order page offers Pay now.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCartStore((s) => s.lines);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const clear = useCartStore((s) => s.clear);

  const [specialRequests, setSpecialRequests] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CARD');
  const [error, setError] = useState<string | null>(null);

  const createOrder = useCreateOrder();
  const payOrder = usePayOrder();

  const placing = createOrder.isPending || payOrder.isPending;
  const subtotal = cartSubtotal(lines);
  const count = cartItemCount(lines);

  const placeOrder = async () => {
    setError(null);
    let orderId: string | null = null;
    try {
      const order = await createOrder.mutateAsync({
        specialRequests: specialRequests.trim() || undefined,
        items: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          specialInstructions: l.specialInstructions,
        })),
      });
      orderId = order.id;
      const paid = await payOrder.mutateAsync({ id: order.id, payload: { method } });
      clear();
      router.replace(`/orders/${paid.id}?placed=1`);
    } catch (err) {
      if (orderId) {
        // Ticket exists — finish payment from the order page (Pay now).
        clear();
        router.replace(`/orders/${orderId}?placed=1&payFailed=1`);
        return;
      }
      setError(getApiErrorMessage(err));
    }
  };

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center lg:px-8">
        <p className="text-4xl" aria-hidden>🛒</p>
        <h1 className="mt-4 text-xl font-bold text-content-default">Your cart is empty</h1>
        <p className="mt-1 text-sm text-content-muted">Browse the menu and add something tasty.</p>
        <Link
          href="/menu"
          className="mt-6 inline-block rounded bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          Back to menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-bold text-content-default">Checkout</h1>
      <p className="mt-1 text-sm text-content-muted">
        {count} item{count === 1 ? '' : 's'} in your cart
      </p>

      {/* Cart lines */}
      <ul className="mt-6 space-y-3">
        {lines.map((line) => (
          <li
            key={`${line.menuItemId}::${line.specialInstructions ?? ''}`}
            className="flex items-center gap-4 rounded-card border border-gray-100 bg-surface p-4 shadow-card"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="truncate font-semibold text-content-default">{line.name}</h2>
                <span className="whitespace-nowrap font-semibold text-primary-700">
                  {formatPrice(line.price * line.quantity)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-content-muted">
                {formatPrice(line.price)} each
                {line.specialInstructions ? ` · ${line.specialInstructions}` : ''}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Decrease ${line.name} quantity`}
                  onClick={() =>
                    updateQuantity(line.menuItemId, line.specialInstructions, line.quantity - 1)
                  }
                  className="h-7 w-7 rounded border border-gray-300 hover:bg-gray-50"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                <button
                  type="button"
                  aria-label={`Increase ${line.name} quantity`}
                  onClick={() =>
                    updateQuantity(line.menuItemId, line.specialInstructions, line.quantity + 1)
                  }
                  className="h-7 w-7 rounded border border-gray-300 hover:bg-gray-50"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => removeLine(line.menuItemId, line.specialInstructions)}
                  className="ml-2 text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Order-level special requests (10.3) */}
      <label htmlFor="special-requests" className="mt-6 block text-sm font-medium text-content-default">
        Special requests for the whole order
      </label>
      <textarea
        id="special-requests"
        value={specialRequests}
        onChange={(e) => setSpecialRequests(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="e.g. birthday candle on the cake"
        className="mt-1.5 block w-full rounded border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
      />

      {/* Payment (10.4) */}
      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-content-default">Payment method</legend>
        <div className="mt-2 flex gap-2">
          {SELF_SERVICE_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={method === m.value}
              onClick={() => setMethod(m.value)}
              className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                method === m.value
                  ? 'bg-primary-600 text-white'
                  : 'border border-gray-200 bg-surface text-content-muted hover:bg-gray-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Totals + submit */}
      <div className="mt-6 rounded-card border border-gray-100 bg-surface p-4 shadow-card">
        <div className="flex justify-between text-sm text-content-muted">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between font-bold text-content-default">
          <span>Total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-content-muted">
          Effective prices are locked in when you place the order.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Button
          className="mt-4 w-full"
          size="lg"
          isLoading={placing}
          disabled={placing}
          onClick={placeOrder}
        >
          Place order & pay {formatPrice(subtotal)}
        </Button>
      </div>
    </div>
  );
}