import type { Prisma } from '@prisma/client';

const ISO = '2026-02-02T12:00:00.000Z';

/** Column-complete Prisma row shapes with Week-7 menu relations available. */
export const makeMenuRow = (over: Partial<Prisma.MenuGetPayload<object>> = {}) => ({
  id: 'menu-1',
  name: 'Main Menu',
  description: null,
  isActive: true,
  tenantId: 'tenant-1',
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  ...over,
});

export const makeCategoryRow = (
  over: Partial<Prisma.CategoryGetPayload<{ include: { _count?: true } }>> = {},
) => ({
  id: 'cat-1',
  name: 'Starters',
  description: null,
  icon: null,
  sortOrder: 0,
  isActive: true,
  menuId: 'menu-1',
  parentId: null,
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  ...over,
});

export const makeMenuItemRow = (
  over: Partial<Prisma.MenuItemGetPayload<{ include: typeof ITEM_INCLUDE_SHAPE }>> = {},
) => ({
  id: 'item-1',
  name: 'Bruschetta',
  description: 'Grilled bread with tomatoes',
  price: 9.5,
  image: null,
  preparationTime: 8,
  calories: 240,
  protein: 6,
  carbs: 30,
  fat: 9,
  isAvailable: true,
  isVegetarian: true,
  isVegan: false,
  isGlutenFree: false,
  categoryId: 'cat-1',
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  category: { id: 'cat-1', name: 'Starters', menuId: 'menu-1' },
  pricingRules: [],
  availabilityWindows: [],
  ...over,
});

export const makeRuleRow = (
  over: Partial<Prisma.MenuPricingRuleGetPayload<object>> = {},
) => ({
  id: 'rule-1',
  menuItemId: 'item-1',
  adjustmentType: 'PERCENT_DISCOUNT' as const,
  amount: 20,
  name: 'Happy hour',
  daysOfWeek: [],
  startTime: '15:00',
  endTime: '17:00',
  priority: 0,
  isActive: true,
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  ...over,
});

export const makeWindowRow = (
  over: Partial<Prisma.MenuItemAvailabilityWindowGetPayload<object>> = {},
) => ({
  id: 'win-1',
  menuItemId: 'item-1',
  name: 'Lunch only',
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '11:00',
  endTime: '14:00',
  isActive: true,
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  ...over,
});

export const ITEM_INCLUDE_SHAPE = {
  category: true,
  pricingRules: true,
  availabilityWindows: true,
} as const;
