import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import { computeEffectivePrice, isMenuItemAvailableNow } from '@restaurant/shared';
import {
  availabilityToggleSchema,
  availabilityWindowSchema,
  createMenuItemSchema,
  effectiveAtQuerySchema,
  idParamSchema,
  itemWithRuleIdParamSchema,
  itemWithWindowIdParamSchema,
  menuItemQuerySchema,
  pricingRuleSchema,
  updateAvailabilityWindowSchema,
  updateMenuItemSchema,
  updatePricingRuleSchema,
  validateBody,
  validateParams,
  validateQuery,
} from '../utils/validation';

/**
 * Menu item endpoints: CRUD, images & nutrition (7.3), search/filtering (7.5),
 * availability & pricing rules with live preview (7.6).
 */

const ITEM_INCLUDE: Prisma.MenuItemInclude = {
  category: { select: { id: true, name: true, menuId: true } },
  pricingRules: { orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] },
  availabilityWindows: { orderBy: { createdAt: 'asc' } },
};

/** MenuItem has no tenantId column — isolation flows through category → menu. */
const itemTenantScope = (tenantId: string) => ({ category: { menu: { tenantId } } });

async function loadScopedItem(tenantId: string, id: string, include = ITEM_INCLUDE) {
  const item = await prisma.menuItem.findFirst({
    where: { id, ...itemTenantScope(tenantId) },
    include,
  });
  if (!item) throw httpError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
  return item;
}

/** Expands a category into its subtree ids so subcategory items surface in filters. */
async function collectDescendantCategoryIds(tenantId: string, rootId: string): Promise<string[]> {
  const ids = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0 && ids.length < 500) {
    const children = await prisma.category.findMany({
      where: { parentId: { in: frontier }, menu: { tenantId } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((cid) => !ids.includes(cid));
    ids.push(...frontier);
  }
  return ids;
}

const SORTS: Record<string, object> = {
  newest: { createdAt: 'desc' },
  name: { name: 'asc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
};

export async function listMenuItems(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const query = validateQuery(menuItemQuerySchema, req.query);

    const where: Record<string, unknown> = { ...itemTenantScope(tenantId) };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.categoryId) {
      // Include subcategories so filtering a parent shows everything beneath it.
      where.categoryId = {
        in: await collectDescendantCategoryIds(tenantId, query.categoryId),
      };
    }
    if (query.available !== undefined) where.isAvailable = query.available;
    if (query.vegetarian !== undefined) where.isVegetarian = query.vegetarian;
    if (query.vegan !== undefined) where.isVegan = query.vegan;
    if (query.glutenFree !== undefined) where.isGlutenFree = query.glutenFree;

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        orderBy: SORTS[query.sort] ?? SORTS.newest,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: ITEM_INCLUDE,
      }),
      prisma.menuItem.count({ where }),
    ]);

    res.json({
      data: items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (e) {
    next(e);
  }
}

async function loadOwnedCategory(tenantId: string, categoryId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, menu: { tenantId } },
    select: { id: true },
  });
  if (!category) throw httpError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
}

export async function createMenuItem(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const data = validateBody(createMenuItemSchema, req.body);
    await loadOwnedCategory(tenantId, data.categoryId);

    const created = await prisma.menuItem.create({ data, include: ITEM_INCLUDE });
    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
}

export async function getMenuItem(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const item = await loadScopedItem(tenantId, id);
    res.json({ data: item });
  } catch (e) {
    next(e);
  }
}

export async function updateMenuItem(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    await loadScopedItem(tenantId, id);

    const data = validateBody(updateMenuItemSchema, req.body);
    if (data.categoryId !== undefined && data.categoryId !== null) {
      // Re-parenting must target a category of this tenant (any menu is allowed).
      await loadOwnedCategory(tenantId, data.categoryId);
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data,
      include: ITEM_INCLUDE,
    });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function updateItemAvailability(
  req: TenantRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    await loadScopedItem(tenantId, id);

    const { isAvailable } = validateBody(availabilityToggleSchema, req.body);
    const updated = await prisma.menuItem.update({
      where: { id },
      data: { isAvailable },
      include: ITEM_INCLUDE,
    });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deleteMenuItem(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    await loadScopedItem(tenantId, id);

    const orderCount = await prisma.orderItem.count({ where: { menuItemId: id } });
    if (orderCount > 0) {
      throw httpError(
        409,
        'ITEM_HAS_ORDERS',
        'This item has order history — mark it unavailable instead of deleting it',
      );
    }

    // Pricing rules & availability windows cascade via onDelete: Cascade.
    await prisma.menuItem.delete({ where: { id } });
    res.json({ message: 'Menu item deleted' });
  } catch (e) {
    next(e);
  }
}

// ── Live pricing / availability preview (7.6) ─────────────────────────────────

export async function getEffectivePrice(
  req: TenantRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const query = validateQuery(effectiveAtQuerySchema, req.query);
    const at = query.at ?? new Date();

    const item = await loadScopedItem(tenantId, id);
    const price = computeEffectivePrice(item.price, item.pricingRules, at);
    const orderableNow = isMenuItemAvailableNow(item, item.availabilityWindows, at);

    res.json({
      data: {
        basePrice: price.basePrice,
        effectivePrice: price.effectivePrice,
        discountAmount: price.discountAmount,
        appliedRuleIds: price.appliedRuleIds,
        orderableNow,
      },
    });
  } catch (e) {
    next(e);
  }
}

// ── Pricing rules ─────────────────────────────────────────────────────────────

async function loadOwnedRule(itemId: string, ruleId: string) {
  const rule = await prisma.menuPricingRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.menuItemId !== itemId) {
    throw httpError(404, 'PRICING_RULE_NOT_FOUND', 'Pricing rule not found');
  }
  return rule;
}

export async function createPricingRule(
  req: TenantRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    await loadScopedItem(tenantId, id);

    const data = validateBody(pricingRuleSchema, req.body);
    const created = await prisma.menuPricingRule.create({ data: { ...data, menuItemId: id } });
    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
}

export async function updatePricingRule(
  req: TenantRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const params = validateParams(itemWithRuleIdParamSchema, req.params);
    const item = await prisma.menuItem.findFirst({
      where: { id: params.id, ...itemTenantScope(tenantId) },
      select: { id: true },
    });
    if (!item) throw httpError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    await loadOwnedRule(item.id, params.ruleId);

    const data = validateBody(updatePricingRuleSchema, req.body);
    const updated = await prisma.menuPricingRule.update({
      where: { id: params.ruleId },
      data,
    });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deletePricingRule(
  req: TenantRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const params = validateParams(itemWithRuleIdParamSchema, req.params);
    const item = await prisma.menuItem.findFirst({
      where: { id: params.id, ...itemTenantScope(tenantId) },
      select: { id: true },
    });
    if (!item) throw httpError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    await loadOwnedRule(item.id, params.ruleId);

    await prisma.menuPricingRule.delete({ where: { id: params.ruleId } });
    res.json({ message: 'Pricing rule deleted' });
  } catch (e) {
    next(e);
  }
}

// ── Availability windows ──────────────────────────────────────────────────────

async function loadOwnedWindow(itemId: string, windowId: string) {
  const window = await prisma.menuItemAvailabilityWindow.findUnique({
    where: { id: windowId },
  });
  if (!window || window.menuItemId !== itemId) {
    throw httpError(404, 'AVAILABILITY_WINDOW_NOT_FOUND', 'Availability window not found');
  }
  return window;
}

export async function createAvailabilityWindow(
  req: TenantRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    await loadScopedItem(tenantId, id);

    const data = validateBody(availabilityWindowSchema, req.body);
    const created = await prisma.menuItemAvailabilityWindow.create({
      data: { ...data, menuItemId: id },
    });
    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
}

export async function updateAvailabilityWindow(
  req: TenantRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const params = validateParams(itemWithWindowIdParamSchema, req.params);
    const item = await prisma.menuItem.findFirst({
      where: { id: params.id, ...itemTenantScope(tenantId) },
      select: { id: true },
    });
    if (!item) throw httpError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    await loadOwnedWindow(item.id, params.windowId);

    const data = validateBody(updateAvailabilityWindowSchema, req.body);
    const updated = await prisma.menuItemAvailabilityWindow.update({
      where: { id: params.windowId },
      data,
    });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deleteAvailabilityWindow(
  req: TenantRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const params = validateParams(itemWithWindowIdParamSchema, req.params);
    const item = await prisma.menuItem.findFirst({
      where: { id: params.id, ...itemTenantScope(tenantId) },
      select: { id: true },
    });
    if (!item) throw httpError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    await loadOwnedWindow(item.id, params.windowId);

    await prisma.menuItemAvailabilityWindow.delete({ where: { id: params.windowId } });
    res.json({ message: 'Availability window deleted' });
  } catch (e) {
    next(e);
  }
}


