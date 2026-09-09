import { Prisma } from '@prisma/client';
import { computeEffectivePrice, isMenuItemAvailableNow } from '@restaurant/shared';
import prisma from './database';
import { httpError } from '../utils/http-error';

/**
 * Week 20 — shared order-line resolution (extracted from createOrder so the
 * 20.2 group-order converter and the 20.6 recurring run-due reuse the exact
 * same behavior: menu resolution within the tenant, availability re-check at
 * `now`, and effective-price snapshotting via the shared pricing engine).
 */

export interface OrderLineInput {
  menuItemId: string;
  quantity: number;
  specialInstructions?: string | null;
}

export interface ResolvedLine {
  menuItemId: string;
  quantity: number;
  specialInstructions?: string | null;
  unitPrice: number;
}

export interface ResolvedQuote {
  lines: ResolvedLine[];
  subtotal: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Resolves, availability-checks and prices every line; throws 404/409 on bad lines. */
export async function resolveOrderLines(
  tenantId: string,
  inputs: OrderLineInput[],
  now: Date = new Date(),
): Promise<ResolvedQuote> {
  if (inputs.length === 0) return { subtotal: 0, lines: [] };
  const itemIds = inputs.map((l) => l.menuItemId);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: itemIds }, category: { menu: { tenantId } } },
    include: {
      pricingRules: { orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] },
      availabilityWindows: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (items.length !== itemIds.length) {
    throw httpError(404, 'MENU_ITEM_NOT_FOUND', 'One or more menu items do not exist for this tenant');
  }

  const itemById = new Map(items.map((i) => [i.id, i]));
  const unavailable = inputs.filter((l) => {
    const item = itemById.get(l.menuItemId)!;
    return !isMenuItemAvailableNow(item, item.availabilityWindows, now);
  });
  if (unavailable.length > 0) {
    const names = unavailable.map((l) => itemById.get(l.menuItemId)!.name).join(', ');
    throw httpError(409, 'ITEM_UNAVAILABLE', `Item(s) currently unavailable: ${names}`);
  }

  const lines: ResolvedLine[] = inputs.map((l) => {
    const item = itemById.get(l.menuItemId)!;
    const { effectivePrice } = computeEffectivePrice(item.price, item.pricingRules, now);
    return {
      menuItemId: l.menuItemId,
      quantity: l.quantity,
      specialInstructions: l.specialInstructions,
      unitPrice: effectivePrice,
    };
  });
  const subtotal = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  return { lines, subtotal };
}

export function generateOrderNumber(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${day}-${rand}`;
}

export type OrderLineCreateInput = Prisma.OrderItemUncheckedCreateWithoutOrderInput;

export function toOrderLineCreates(quote: ResolvedQuote): OrderLineCreateInput[] {
  return quote.lines.map((l) => ({
    menuItemId: l.menuItemId,
    quantity: l.quantity,
    specialInstructions: l.specialInstructions,
    unitPrice: l.unitPrice,
  }));
}