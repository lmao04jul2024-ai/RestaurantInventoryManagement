/**
 * Phase 5 S2.2/S2.4 — types for the platform (super-admin) console, mirroring
 * packages/api/src/controllers/platform.controller.ts.
 *
 * Manual billing: this console is where the operator records commercial state
 * by hand (plan, subscription status, seat limit, workspace active). There is
 * no payment processor anywhere in the app — the audit trail is the ledger.
 */

import type { PlanTier, SubscriptionStatus } from '@/types/tenant';

export type { PlanTier, SubscriptionStatus };

/** Row shape from GET /api/platform/tenants. */
export interface PlatformTenantSummary {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  plan: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  seatsLimit: number;
  isActive: boolean;
  createdAt: string;
  _count?: { users: number; orders: number; menus: number; inventory: number };
}

export interface PlatformTenantBilling {
  seatsUsed: number;
  seatsLimit: number;
}

/** One `platform:tenant.updated` audit row (an operator change). */
export interface PlatformTenantChange {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: {
    surface?: string;
    changes?: Record<string, { from: unknown; to: unknown }>;
  } | null;
  createdAt: string;
}

/** Detail shape from GET /api/platform/tenants/:id. */
export interface PlatformTenantDetail extends PlatformTenantSummary {
  timezone: string;
  currency: string;
  taxRate: number;
  updatedAt: string;
  billing: PlatformTenantBilling;
  recentChanges: PlatformTenantChange[];
  _count?: {
    users: number;
    orders: number;
    menus: number;
    inventory: number;
    suppliers: number;
  };
}

/** Operator-only commercial state update (PATCH /api/platform/tenants/:id). */
export interface PlatformTenantUpdatePayload {
  plan?: PlanTier;
  subscriptionStatus?: SubscriptionStatus;
  seatsLimit?: number;
  isActive?: boolean;
}

export interface PlatformListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PlatformListResult {
  data: PlatformTenantSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** One row of the S3.4 operator attention queue (GET /api/platform/attention). */
export interface PlatformAttentionItem {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  plan: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  seatsLimit: number;
  isActive: boolean;
  createdAt: string;
  /** Machine-readable reason codes computed server-side. */
  reasons: string[];
  _count?: { users: number };
}