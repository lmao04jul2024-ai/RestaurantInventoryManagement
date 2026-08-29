'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import DietaryBadges from '@/components/shop/dietary-badges';
import { formatPrice } from '@/lib/menu-ui';
import { useCartStore } from '@/store/cart.store';
import type { MenuItem } from '@/types/menu';

/**
 * Week 10 (10.3): quantity + per-line special instructions before the item
 * lands in the cart. The API caps instructions at 300 chars per line.
 */
export default function ItemCustomizer({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const addLine = useCartStore((s) => s.addLine);
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState('');

  const add = () => {
    addLine({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity,
      specialInstructions: instructions.trim() || null,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Customize ${item.name}`}
        className="mt-8 w-full max-w-md rounded-card bg-surface p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-content-default">{item.name}</h2>
            <p className="text-sm text-content-muted">{formatPrice(item.price)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-content-muted hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {item.description && (
          <p className="mt-2 text-sm text-content-muted">{item.description}</p>
        )}
        <div className="mt-2">
          <DietaryBadges item={item} />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="text-sm font-medium text-content-default">Quantity</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-8 w-8 rounded border border-gray-300 text-content-default hover:bg-gray-50"
            >
              −
            </button>
            <span aria-live="polite" className="w-8 text-center text-sm font-semibold">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="h-8 w-8 rounded border border-gray-300 text-content-default hover:bg-gray-50"
            >
              +
            </button>
          </div>
        </div>

        <label htmlFor="item-instructions" className="mt-5 block text-sm font-medium text-content-default">
          Special instructions
        </label>
        <textarea
          id="item-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="e.g. no onions, extra spicy"
          className="mt-1.5 block w-full rounded border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <p className="mt-1 text-xs text-content-muted">{instructions.length}/300</p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={add}>
            Add to cart · {formatPrice(item.price * quantity)}
          </Button>
        </div>
      </div>
    </div>
  );
}