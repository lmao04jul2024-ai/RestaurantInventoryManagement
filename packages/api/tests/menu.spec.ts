jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    menu: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    category: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    menuItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    menuPricingRule: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    menuItemAvailabilityWindow: { findUnique: jest.fn(), create: jest.fn() },
    orderItem: { count: jest.fn() },
  },
}));

import prisma from '../src/services/database';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { makeCategoryRow, makeRuleRow, makeWindowRow } from './factories/menu';

/** Joi uuid validation requires real-shaped identifiers in params/bodies. */
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const run = async (
  handler: (...args: any[]) => Promise<unknown>,
  reqPartial: Partial<TenantRequest>,
): Promise<{ res: MockRes; next: jest.Mock }> => {
  const res = createRes();
  const next = jest.fn();
  await handler(asRequest<TenantRequest>(reqPartial), res as any, next as any);
  return { res, next };
};

const tenantReq = (extra: Partial<TenantRequest> = {}): Partial<TenantRequest> => ({
  tenantId: 'tenant-1',
  ...extra,
});

describe('listMenuItems — search, filters, pagination (7.5)', () => {
  const { listMenuItems } = require('../src/controllers/menu-item.controller');

  it('scopes every query through category → menu.tenantId and paginates', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.menuItem.count as jest.Mock).mockResolvedValue(25);

    const { res } = await run(listMenuItems, tenantReq({ query: { page: '2', limit: '10' } }));

    expect(prisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { category: { menu: { tenantId: 'tenant-1' } } },
        skip: 10,
        take: 10,
      }),
    );
    expect(res.body).toMatchObject({
      pagination: { page: 2, limit: 10, total: 25, totalPages: 3 },
    });
  });

  it('searches q case-insensitively across name and description', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.menuItem.count as jest.Mock).mockResolvedValue(0);

    await run(listMenuItems, tenantReq({ query: { q: 'Veg' } }));

    expect((prisma.menuItem.findMany as jest.Mock).mock.calls[0][0].where.OR).toEqual([
      { name: { contains: 'Veg', mode: 'insensitive' } },
      { description: { contains: 'Veg', mode: 'insensitive' } },
    ]);
  });

  it('maps boolean filters onto the schema columns', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.menuItem.count as jest.Mock).mockResolvedValue(0);

    await run(
      listMenuItems,
      tenantReq({ query: { vegan: 'true', available: 'false', sort: 'price_desc' } }),
    );

    const where = (prisma.menuItem.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.isVegan).toBe(true);
    expect(where.isAvailable).toBe(false);
    expect((prisma.menuItem.findMany as jest.Mock).mock.calls[0][0].orderBy).toEqual({
      price: 'desc',
    });
  });

  it('expands a category filter into its subtree so subcategory items surface', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.menuItem.count as jest.Mock).mockResolvedValue(0);
    // First pass finds children of the root; second pass finds none.
    (prisma.category.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'child-cat' }])
      .mockResolvedValueOnce([]);

    await run(listMenuItems, tenantReq({ query: { categoryId: uid(42) } }));

    const where = (prisma.menuItem.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.categoryId.in).toEqual([uid(42), 'child-cat']);
  });
});

describe('categories — subcategory support (7.2)', () => {
  const { listCategories, createCategory, deleteCategory } = require('../src/controllers/menu.controller');

  it('assembles parent/children into a tree for the requested menu', async () => {
    (prisma.menu.findFirst as jest.Mock).mockResolvedValue({ id: 'menu-1' });
    const parent = makeCategoryRow({ id: 'cat-parent', parentId: null });
    const child = makeCategoryRow({ id: 'cat-child', parentId: 'cat-parent' });
    (prisma.category.findMany as jest.Mock).mockResolvedValue([parent, child]);

    const { res } = await run(listCategories, tenantReq({ params: { menuId: uid(1) } }));

    expect(bodyOf(res).data).toHaveLength(1);
    expect(bodyOf(res).data[0].children.map((c: { id: string }) => c.id)).toEqual([
      'cat-child',
    ]);
  });

  it('rejects a subcategory whose parent lives under a different menu', async () => {
    (prisma.menu.findFirst as jest.Mock).mockResolvedValue({ id: 'menu-1' });
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(null); // parent lookup misses

    const { next } = await run(createCategory, {
      ...tenantReq(),
      params: { menuId: uid(1) },
      body: { name: 'Cold drinks', parentId: uid(9) },
    });

    const err = next.mock.calls[0][0];
    expect(err.code).toBe('CATEGORY_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('blocks deleting a category that still has subcategories', async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue({
      ...makeCategoryRow({ id: 'cat-1' }),
      _count: { items: 0, children: 2 },
    });

    const { next } = await run(deleteCategory, tenantReq({ params: { id: uid(3) } }));

    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'CATEGORY_HAS_CHILDREN',
      statusCode: 409,
    });
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });
});

describe('menu items — CRUD & guards (7.1, 7.3)', () => {
  const {
    createMenuItem,
    getMenuItem,
    updateItemAvailability,
    deleteMenuItem,
  } = require('../src/controllers/menu-item.controller');

  it('creates an item after verifying the category belongs to the tenant', async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue({ id: 'cat-1' });
    (prisma.menuItem.create as jest.Mock).mockImplementation(async ({ data }) => ({
      ...data,
      id: 'new-item',
      category: { id: data.categoryId, name: 'Starters', menuId: 'menu-1' },
      pricingRules: [],
      availabilityWindows: [],
    }));

    const { res } = await run(createMenuItem, {
      ...tenantReq(),
      body: { name: 'Soup', price: 6.5, categoryId: uid(11) },
    });

    expect(res.statusCode).toBe(201);
    const createArg = (prisma.menuItem.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data.isAvailable).toBe(true); // default applied via validation layer
    expect(createArg.include).toBeDefined();
  });

  it('refuses items in a category owned by another tenant (no leak)', async () => {
    (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);

    const { next } = await run(createMenuItem, {
      ...tenantReq(),
      body: { name: 'Soup', price: 6.5, categoryId: uid(99) },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'CATEGORY_NOT_FOUND', statusCode: 404 });
    expect(prisma.menuItem.create).not.toHaveBeenCalled();
  });

  it('404s cross-tenant item reads instead of revealing existence', async () => {
    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(null);

    const { next } = await run(getMenuItem, tenantReq({ params: { id: uid(7) } }));

    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'MENU_ITEM_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('availability toggle flips only the isAvailable column', async () => {
    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue({ id: 'item-1' });
    (prisma.menuItem.update as jest.Mock).mockResolvedValue({ id: 'item-1', isAvailable: false });

    await run(updateItemAvailability, {
      ...tenantReq(),
      params: { id: uid(7) },
      body: { isAvailable: false },
    });

    expect((prisma.menuItem.update as jest.Mock).mock.calls[0][0]).toMatchObject({
      where: { id: uid(7) },
      data: { isAvailable: false },
    });
  });

  it('blocks deleting items with order history and suggests the soft path', async () => {
    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue({ id: 'item-1' });
    (prisma.orderItem.count as jest.Mock).mockResolvedValue(3);

    const { next } = await run(deleteMenuItem, tenantReq({ params: { id: uid(7) } }));

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'ITEM_HAS_ORDERS', statusCode: 409 });
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it('deletes cleanly when no orders reference the item', async () => {
    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue({ id: 'item-1' });
    (prisma.orderItem.count as jest.Mock).mockResolvedValue(0);
    (prisma.menuItem.delete as jest.Mock).mockResolvedValue({});

    const { res } = await run(deleteMenuItem, tenantReq({ params: { id: uid(7) } }));

    expect(prisma.menuItem.delete).toHaveBeenCalledWith({ where: { id: uid(7) } });
    expect(res.body).toMatchObject({ message: 'Menu item deleted' });
  });
});

/** Builds an ISO instant whose LOCAL wall time matches the fixture intent. */
const isoAt = (day: number, hour: number, minute = 0): string =>
  new Date(2026, 1, day, hour, minute).toISOString();

type JsonBody = { data?: any; message?: string; [k: string]: any };
const bodyOf = (r: MockRes): JsonBody => r.body as JsonBody;

describe('pricing rules & effective preview (7.6)', () => {
  const { createPricingRule, updatePricingRule, getEffectivePrice } = require(
    '../src/controllers/menu-item.controller',
  );

  it('attaches rules to the path item after validating percent bounds', async () => {
    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue({ id: uid(7) });
    (prisma.menuPricingRule.create as jest.Mock).mockResolvedValue({ id: 'rule-new' });

    const { res } = await run(createPricingRule, {
      ...tenantReq(),
      params: { id: uid(7) },
      body: { adjustmentType: 'PERCENT_DISCOUNT', amount: 25 },
    });

    expect(res.statusCode).toBe(201);
    expect((prisma.menuPricingRule.create as jest.Mock).mock.calls[0][0].data).toMatchObject({
      adjustmentType: 'PERCENT_DISCOUNT',
      amount: 25,
      daysOfWeek: [],
      menuItemId: uid(7),
    });
  });

  it('rejects a >100% discount before touching persistence', async () => {
    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue({ id: uid(7) });

    const { next } = await run(createPricingRule, {
      ...tenantReq(),
      params: { id: uid(7) },
      body: { adjustmentType: 'PERCENT_DISCOUNT', amount: 150 },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(prisma.menuPricingRule.create).not.toHaveBeenCalled();
  });

  it('cannot mutate a rule anchored to another item', async () => {
    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue({ id: uid(7) });
    (prisma.menuPricingRule.findUnique as jest.Mock).mockResolvedValue({
      id: uid(99),
      menuItemId: 'some-other-item',
    });

    const { next } = await run(updatePricingRule, {
      ...tenantReq(),
      params: { id: uid(7), ruleId: uid(99) },
      body: { amount: 10 },
    });

    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'PRICING_RULE_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('effective price & orderability preview', () => {
  const { getEffectivePrice } = require('../src/controllers/menu-item.controller');

  const scopedItem = () => ({
    id: uid(7),
    price: 10,
    isAvailable: true,
    pricingRules: [
      makeRuleRow({
        id: 'rule-1',
        adjustmentType: 'FIXED_PRICE',
        amount: 7.5,
        startTime: null,
        endTime: null, // all-day rule so price applies at any tested instant
      }),
    ],
    availabilityWindows: [makeWindowRow()],
  });

  it('reports engine-computed price plus window-aware orderability at ?at=', async () => {
    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(scopedItem());

    // Monday noon → inside the weekday lunch window.
    const { res } = await run(getEffectivePrice, {
      ...tenantReq({ query: { at: isoAt(2, 12) } }), // Feb 2, 2026 = Monday
      params: { id: uid(7) },
    });

    expect(bodyOf(res).data).toMatchObject({
      basePrice: 10,
      effectivePrice: 7.5,
      discountAmount: 2.5,
      appliedRuleIds: ['rule-1'],
      orderableNow: true,
    });
  });

  it('orderability flips outside the window while pricing still resolves', async () => {
    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(scopedItem());

    // Monday 16:00 → lunch window has closed.
    const { res } = await run(getEffectivePrice, {
      ...tenantReq({ query: { at: isoAt(2, 16) } }),
      params: { id: uid(7) },
    });

    expect(bodyOf(res).data.orderableNow).toBe(false);
    expect(bodyOf(res).data.effectivePrice).toBe(7.5);
  });

  it('validates the ?at instant', async () => {
    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue({
      ...scopedItem(),
      pricingRules: [],
      availabilityWindows: [],
    });

    const good = await run(getEffectivePrice, {
      ...tenantReq({ query: { at: isoAt(3, 9, 30) } }),
      params: { id: uid(7) },
    });
    expect(bodyOf(good.res).data.effectivePrice).toBe(10);

    const bad = await run(getEffectivePrice, {
      ...tenantReq({ query: { at: 'not-a-date' } }),
      params: { id: uid(7) },
    });
    expect(bad.next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});



