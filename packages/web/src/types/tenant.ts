/**
 * Week 15 — tenant self-service types mirroring the API contract
 * (packages/api/src/controllers/tenant.controller.ts).
 */

import type { UserRole } from '@/types';

export interface OperatingHoursDay {
  open: string;
  close: string;
}

export type OperatingHours = Record<string, OperatingHoursDay>;

export type PlanTier = 'TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  taxRate: number;
  operatingHours: OperatingHours | null;
  plan: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  seatsLimit: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
}

export interface TenantUpdatePayload {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  timezone?: string;
  currency?: string;
  taxRate?: number;
  operatingHours?: OperatingHours | null;
  plan?: PlanTier;
  subscriptionStatus?: SubscriptionStatus;
  isActive?: boolean;
}

export interface OnboardingPayload {
  restaurantName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  timezone?: string;
  currency?: string;
  taxRate?: number;
}

export interface OnboardingResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: string;
    emailVerified: boolean;
  };
  tenant: { id: string; name: string; slug: string };
  accessToken: string;
  refreshToken: string;
}

export interface TenantAnalytics {
  windowDays: number;
  orders: { total: number; inWindow: number; active: number };
  revenue: { total: number; inWindow: number };
  customers: { total: number; newInWindow: number };
  menu: { items: number; available: number };
  inventory: { lowStock: number };
  reviews: { total: number; avgRating: number };
  billing: {
    plan: PlanTier;
    subscriptionStatus: SubscriptionStatus;
    seatsUsed: number;
    seatsLimit: number;
  };
}