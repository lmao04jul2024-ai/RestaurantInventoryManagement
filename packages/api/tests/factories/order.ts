import type { Prisma } from '@prisma/client';

const ISO = '2026-02-16T09:00:00.000Z';

/** Column-complete rows for Week-9 order fixtures (ORDER_INCLUDE-shaped). */
export const makeMenuRow = (
  over: Partial<Prisma.MenuItemGetPayload<{ include: { pricingRules: true; availabilityWindows: true } }>> = {},
) => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Burger',
  description: null,
  price: 10,
  image: null,
  preparationTime: 12,
  calories: null,
  protein: null,
  carbs: null,
  fat: null,
  isAvailable: true,
  isVegetarian: false,
  isVegan: false,
  isGlutenFree: false,
  categoryId: 'cat-1',
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  pricingRules: [],
  availabilityWindows: [],
  ...over,
});

export const makeOrderItemRow = (
  over: Partial<Prisma.OrderItemGetPayload<{ include: { menuItem: true } }>> = {},
) => ({
  id: 'oi-1',
  orderId: 'order-1',
  menuItemId: '00000000-0000-4000-8000-000000000001',
  quantity: 2,
  unitPrice: 10,
  specialInstructions: null,
  status: 'PENDING' as const,
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  menuItem: { id: '00000000-0000-4000-8000-000000000001', name: 'Burger', price: 10, image: null },
  ...over,
});

export const makeOrderRow = (
  over: Partial<Prisma.OrderGetPayload<{ include: { customer: true; table: true; payment: true; items: { include: { menuItem: true } } } }>> = {},
) => ({
  id: 'order-1',
  orderNumber: 'ORD-20260216-TEST',
  status: 'PENDING' as const,
  paymentStatus: 'PENDING' as const,
  totalAmount: 20,
  taxAmount: 0,
  discountAmount: 0,
  tableNumber: null,
  specialRequests: null,
  customerId: 'user-2',
  tenantId: 'tenant-1',
  tableId: null,
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  completedAt: null,
  customer: { id: 'user-2', firstName: 'Cara', lastName: 'Client' },
  table: null,
  payment: null,
  items: [makeOrderItemRow()],
  ...over,
});