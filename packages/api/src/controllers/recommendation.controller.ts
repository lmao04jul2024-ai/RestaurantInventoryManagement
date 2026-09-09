import { NextFunction, Response } from 'express';
import { UserRole } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { requireTenant } from '../utils/http-error';

/**
 * Week 20.5 — personalized recommendations (read-only).
 *
 * `favorites`: the customer's most-rebought items across their ordering
 * history (quantity-ordered-weighted), that are still available now.
 * `popular`: tenant-wide bestsellers the customer has NOT yet ordered — the
 * "couldn't hurt to try" rail.
 *
 * Both lists are capped at 5; the shared availability helpers filter to
 * items whose `isAvailable` is currently true (time-window windows are
 * honored at order time, so we only pre-filter the global toggle here).
 */
async function availableItemFilter(): Promise<{ isAvailable: boolean }> {
  return { isAvailable: true };
}

export async function getRecommendations(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const customer = req.user;
    if (!customer) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }

    // The customer's ordered item ids + counts (their history).
    const history = customer.role === UserRole.CUSTOMER
      ? await prisma.order.findMany({
          where: { tenantId, customerId: customer.userId },
          select: { items: { select: { menuItemId: true, quantity: true } } },
        })
      : [];
    const historyCounts = new Map<string, number>();
    for (const order of history) {
      for (const line of order.items) {
        historyCounts.set(line.menuItemId, (historyCounts.get(line.menuItemId) ?? 0) + line.quantity);
      }
    }
    const triedIds = [...historyCounts.keys()];

    // Favorites: top 5 by quantity, still available.
    const favorites = [...historyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .filter(([id]) => triedIds.includes(id));
    const favRows = favorites.length
      ? await prisma.menuItem.findMany({
          where: { id: { in: favorites.map(([id]) => id) }, ...(await availableItemFilter()) },
          select: { id: true, name: true, price: true, image: true },
        })
      : [];

    // Popular tenant-wide: aggregate all order items' quantities, exclude tried, cap 5.
    const allItems = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: { order: { tenantId } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 50,
    });
    const popularIds = allItems
      .map((r) => r.menuItemId)
      .filter((id) => !triedIds.includes(id))
      .slice(0, 5);
    const popularRows = popularIds.length
      ? await prisma.menuItem.findMany({
          where: { id: { in: popularIds }, ...(await availableItemFilter()) },
          select: { id: true, name: true, price: true, image: true },
        })
      : [];

    const toRec = (rows: Array<{ id: string; name: string; price: number; image: string | null }>, reason: 'favorite' | 'popular') =>
      rows.map((r) => ({ itemId: r.id, name: r.name, price: r.price, image: r.image, reason }));

    res.json({
      data: {
        favorites: toRec(favRows, 'favorite'),
        popular: toRec(popularRows, 'popular'),
      },
    });
  } catch (e) {
    next(e);
  }
}
