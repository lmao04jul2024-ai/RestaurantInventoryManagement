/**
 * Week 16 — staff management & audit-trail types mirroring the API contract
 * (packages/api/src/controllers/staff.controller.ts).
 */

import type { UserRole } from '@/types';

/** Roles provisionable through the staff API (ADMIN/CUSTOMER excluded — L018: reuse domain unions). */
export type StaffRole = Extract<UserRole, 'MANAGER' | 'KITCHEN' | 'SERVER'>;

export interface StaffMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  isActive: boolean;
  /** Normalized boolean map; explicit entries deny or grant beyond the role matrix. */
  permissionOverrides: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface StaffListResponse {
  data: StaffMember[];
  meta: PaginationMeta;
}

export interface StaffListParams {
  page?: number;
  limit?: number;
  role?: StaffRole | 'CUSTOMER';
  q?: string;
}

export interface CreateStaffPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
}

export interface UpdateStaffPayload {
  firstName?: string;
  lastName?: string;
  /** Role changes are ADMIN-only (enforced server-side). */
  role?: StaffRole;
  /** true/false set, null clears — merged server-side into the existing map. */
  permissionOverrides?: Record<string, boolean | null>;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  data: AuditLogEntry[];
  meta: PaginationMeta;
}

export interface AuditLogParams {
  page?: number;
  limit?: number;
  action?: string;
  targetType?: string;
  targetId?: string;
}
