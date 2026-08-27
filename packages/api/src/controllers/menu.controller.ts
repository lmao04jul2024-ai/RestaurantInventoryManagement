import { NextFunction, Response } from 'express';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import {
  createCategorySchema,
  createMenuSchema,
  idParamSchema,
  menuIdParamSchema,
  updateCategorySchema,
  validateBody,
  validateParams,
} from '../utils/validation';

/** Menu & category endpoints (7.1 lists, 7.2 categories/subcategories). */
/** Item endpoints incl. rules/live-preview live in menu-item.controller.ts. */

/** Where-fragment constraining menu-owned entities (category/menu) to a tenant. */
export const menuScope = (tenantId: string) => ({ menu: { tenantId } });

// ── Menus ──────────────────────────────────────────────────────────────────────

export async function listMenus(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const menus = await prisma.menu.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: menus });
  } catch (e) {
    next(e);
  }
}

export async function createMenu(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const data = validateBody(createMenuSchema, req.body);
    const menu = await prisma.menu.create({ data: { ...data, tenantId } });
    res.status(201).json({ data: menu });
  } catch (e) {
    next(e);
  }
}

// ── Categories & subcategories ────────────────────────────────────────────────

async function loadMenuForTenant(tenantId: string, menuId: string) {
  const menu = await prisma.menu.findFirst({
    where: { id: menuId, tenantId },
    select: { id: true },
  });
  if (!menu) throw httpError(404, 'MENU_NOT_FOUND', 'Menu not found');
  return menu;
}

export async function listCategories(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { menuId } = validateParams(menuIdParamSchema, req.params);
    await loadMenuForTenant(tenantId, menuId);

    const rows = await prisma.category.findMany({
      where: { menuId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Assemble a nested tree client-side friendly: roots carry children[].
    type Node = (typeof rows)[number] & { children: Node[] };
    const byId = new Map<string, Node>(rows.map((r) => [r.id, { ...r, children: [] }]));
    const roots: Node[] = [];
    for (const row of rows) {
      const node = byId.get(row.id);
      if (!node) continue;
      const parent = row.parentId ? byId.get(row.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }

    res.json({ data: roots });
  } catch (e) {
    next(e);
  }
}

async function loadScopedCategory(tenantId: string, id: string) {
  const existing = await prisma.category.findFirst({
    where: { id, ...menuScope(tenantId) },
    select: { id: true, menuId: true },
  });
  if (!existing) throw httpError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  return existing;
}

export async function createCategory(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { menuId } = validateParams(menuIdParamSchema, req.params);
    await loadMenuForTenant(tenantId, menuId);

    const data = validateBody(createCategorySchema, req.body);
    if (data.parentId) {
      const parent = await prisma.category.findFirst({
        where: { id: data.parentId, menuId },
        select: { id: true },
      });
      if (!parent) {
        throw httpError(
          404,
          'CATEGORY_NOT_FOUND',
          'Parent category must be an existing category of this menu',
        );
      }
    }

    const created = await prisma.category.create({ data: { ...data, menuId } });
    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
}

export async function updateCategory(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const existing = await loadScopedCategory(tenantId, id);

    const data = validateBody(updateCategorySchema, req.body);
    if (data.parentId) {
      if (data.parentId === existing.id) {
        throw httpError(400, 'CATEGORY_PARENT_SELF', 'A category cannot be its own parent');
      }
      // Walk UP from the requested parent — landing back on `existing` = cycle.
      let cursor: string | undefined = data.parentId;
      for (let hops = 0; cursor && hops < 64; hops += 1) {
        if (cursor === existing.id) {
          throw httpError(
            400,
            'CATEGORY_CYCLE',
            'Cannot move a category under one of its own descendants',
          );
        }
        const step = await prisma.category.findFirst({
          where: { id: cursor, menuId: existing.menuId },
          select: { parentId: true },
        });
        if (!step) {
          throw httpError(
            404,
            'CATEGORY_NOT_FOUND',
            'Parent category must be an existing category of this menu',
          );
        }
        cursor = step.parentId ?? undefined;
      }
    }

    const updated = await prisma.category.update({ where: { id }, data });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deleteCategory(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const existing = await prisma.category.findFirst({
      where: { id, ...menuScope(tenantId) },
      include: { _count: { select: { items: true, children: true } } },
    });
    if (!existing) throw httpError(404, 'CATEGORY_NOT_FOUND', 'Category not found');

    if (existing._count.children > 0) {
      throw httpError(
        409,
        'CATEGORY_HAS_CHILDREN',
        'Delete or reassign subcategories before deleting this category',
      );
    }
    if (existing._count.items > 0) {
      throw httpError(
        409,
        'CATEGORY_NOT_EMPTY',
        'Move or remove its menu items before deleting this category',
      );
    }

    await prisma.category.delete({ where: { id } });
    res.json({ message: 'Category deleted' });
  } catch (e) {
    next(e);
  }
}

