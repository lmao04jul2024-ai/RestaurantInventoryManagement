'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Week 10 — client-side shopping cart (10.2), persisted to localStorage so a
 * refresh or accidental navigation keeps the diner's ticket. Prices shown are
 * the menu's current price; the API re-snapshots effective prices at creation
 * time, so the checkout total is always confirmed server-side.
 */
export interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  specialInstructions: string | null;
}

/** A cart line is identified by its item PLUS its customization notes. */
export function cartLineKey(menuItemId: string, specialInstructions: string | null): string {
  return `${menuItemId}::${specialInstructions?.trim() ?? ''}`;
}

const MAX_QTY = 99;

function mergeLine(lines: CartLine[], incoming: CartLine): CartLine[] {
  const key = cartLineKey(incoming.menuItemId, incoming.specialInstructions);
  const existing = lines.find((l) => cartLineKey(l.menuItemId, l.specialInstructions) === key);
  if (!existing) return [...lines, incoming];
  return lines.map((l) =>
    l === existing ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + incoming.quantity) } : l,
  );
}

interface CartState {
  lines: CartLine[];
  addLine: (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => void;
  updateQuantity: (menuItemId: string, specialInstructions: string | null, quantity: number) => void;
  removeLine: (menuItemId: string, specialInstructions: string | null) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      addLine: (line) =>
        set((state) => ({
          lines: mergeLine(state.lines, {
            ...line,
            // Normalize so every stored line carries the field (persist-friendly).
            specialInstructions: line.specialInstructions ?? null,
            quantity: Math.min(MAX_QTY, Math.max(1, line.quantity ?? 1)),
          }),
        })),

      updateQuantity: (menuItemId, specialInstructions, quantity) =>
        set((state) => {
          const key = cartLineKey(menuItemId, specialInstructions);
          if (quantity <= 0) {
            return {
              lines: state.lines.filter(
                (l) => cartLineKey(l.menuItemId, l.specialInstructions) !== key,
              ),
            };
          }
          return {
            lines: state.lines.map((l) =>
              cartLineKey(l.menuItemId, l.specialInstructions) === key
                ? { ...l, quantity: Math.min(MAX_QTY, quantity) }
                : l,
            ),
          };
        }),

      removeLine: (menuItemId, specialInstructions) =>
        set((state) => ({
          lines: state.lines.filter(
            (l) =>
              cartLineKey(l.menuItemId, l.specialInstructions) !==
              cartLineKey(menuItemId, specialInstructions),
          ),
        })),

      clear: () => set({ lines: [] }),
    }),
    { name: 'rms-cart', storage: createJSONStorage(() => localStorage) },
  ),
);

// ── Pure selectors (unit-testable without the store) ──────────────────────────

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Sum of line totals, cent-rounded to dodge float drift. */
export function cartSubtotal(lines: CartLine[]): number {
  return (
    Math.round(lines.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100) / 100
  );
}