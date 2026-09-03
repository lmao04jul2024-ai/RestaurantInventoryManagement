import type { Prisma } from '@prisma/client';

const ISO = '2026-02-16T09:00:00.000Z';

/** Full Tenant row incl. Week 15 config/billing fields. */
export const makeTenantProfileRow = (
  over: Partial<Prisma.TenantGetPayload<object>> = {},
) => ({
  id: 'tenant-1',
  name: 'Demo Restaurant',
  slug: 'demo-restaurant',
  email: 'demo@restaurant.com',
  phone: '+1234567890',
  address: '123 Restaurant St',
  timezone: 'America/New_York',
  currency: 'USD',
  taxRate: 8.875,
  operatingHours: { monday: { open: '09:00', close: '22:00' } },
  plan: 'PRO',
  subscriptionStatus: 'ACTIVE',
  seatsLimit: 25,
  theme: {},
  features: {},
  isActive: true,
  createdAt: new Date(ISO),
  updatedAt: new Date(ISO),
  ...over,
});