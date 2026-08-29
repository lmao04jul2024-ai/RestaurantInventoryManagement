'use client';

import { useState } from 'react';
import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api';
import { useCreateOrder } from '@/hooks/use-orders';
import { useMenuItems } from '@/hooks/use-menu';
import type { MenuItem } from '@/types/menu';

interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions: string;
}

/** Week 9 — order taking (9.1): build a ticket from the menu and submit it. */
export default function NewOrderPanel() {
  const { data, isLoading } = useMenuItems({ available: true, limit: 100 });
  const menuItems = data?.data ?? [];

  const createOrder = useCreateOrder();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [placedNumber, setPlacedNumber] = useState<string | null>(null);

  const addToCart = (item: MenuItem) => {
    setError(null);
    setPlacedNumber(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, specialInstructions: '' },
      ];
    });
  };

  const setQuantity = (menuItemId: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.menuItemId !== menuItemId)
        : prev.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity } : l)),
    );
  };

  const setInstructions = (menuItemId: string, specialInstructions: string) => {
    setCart((prev) =>
      prev.map((l) => (l.menuItemId === menuItemId ? { ...l, specialInstructions } : l)),
    );
  };

  const total = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const submit = async () => {
    setError(null);
    if (cart.length === 0) {
      setError('Add at least one item to the ticket');
      return;
    }
    try {
      const order = await createOrder.mutateAsync({
        items: cart.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          ...(l.specialInstructions ? { specialInstructions: l.specialInstructions } : {}),
        })),
      });
      setCart([]);
      setPlacedNumber(order.orderNumber);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <h2 className="font-semibold">Menu</h2>
        {isLoading && <p className="mt-4 text-sm text-content-muted">Loading menu…</p>}
        {!isLoading && menuItems.length === 0 && (
          <p className="mt-4 text-sm text-content-muted">No available menu items — add some in Menu management.</p>
        )}
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {menuItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded border border-gray-100 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-content-muted">${item.price.toFixed(2)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => addToCart(item)}>
                + Add
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Ticket</h2>
        {placedNumber && (
          <div className="mt-3">
            <Alert tone="success" title={`Order ${placedNumber} placed`}>
              It is now in the kitchen queue once confirmed.
            </Alert>
          </div>
        )}
        {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

        {cart.length === 0 ? (
          <p className="mt-4 text-sm text-content-muted">Tap items on the left to build the ticket.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {cart.map((line) => (
              <li key={line.menuItemId} className="rounded border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{line.name}</p>
                  <span className="text-sm font-semibold">
                    ${(line.price * line.quantity).toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" variant="outline" aria-label={`Decrease ${line.name}`} onClick={() => setQuantity(line.menuItemId, line.quantity - 1)}>−</Button>
                  <span aria-live="polite" className="min-w-6 text-center text-sm">{line.quantity}</span>
                  <Button size="sm" variant="outline" aria-label={`Increase ${line.name}`} onClick={() => setQuantity(line.menuItemId, line.quantity + 1)}>+</Button>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setQuantity(line.menuItemId, 0)}>
                    Remove
                  </Button>
                </div>
                <input
                  value={line.specialInstructions}
                  onChange={(e) => setInstructions(line.menuItemId, e.target.value)}
                  placeholder="Special instructions (optional)"
                  aria-label={`Special instructions for ${line.name}`}
                  className="mt-2 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-sm text-content-muted">Total</span>
          <span className="text-lg font-bold">${total.toFixed(2)}</span>
        </div>
        <Button
          className="mt-3 w-full"
          onClick={submit}
          isLoading={createOrder.isPending}
          disabled={cart.length === 0}
        >
          Place order
        </Button>
      </Card>
    </div>
  );
}
