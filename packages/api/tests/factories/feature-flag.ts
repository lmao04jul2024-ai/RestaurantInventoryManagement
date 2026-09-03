import type { Prisma } from '@prisma/client';

/** Column-complete FeatureFlag row for the Week 14 controller/middleware specs. */
export const makeFeatureFlagRow = (
  over: Partial<Prisma.FeatureFlagGetPayload<object>> = {},
) => ({
  id: 'flag-1',
  name: 'customer_reviews',
  description: 'Enable customers to rate and review completed orders',
  isEnabled: true,
  metadata: {},
  createdAt: new Date('2026-02-16T09:00:00.000Z'),
  updatedAt: new Date('2026-02-16T09:00:00.000Z'),
  ...over,
});