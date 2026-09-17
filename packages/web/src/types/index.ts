/**
 * Types matching the API contract exactly (see packages/api/src/controllers/auth.controller.ts).
 * NOTE: roles are UPPERCASE strings because Prisma enums serialize that way.
 */

export type UserRole = 'PLATFORM_ADMIN' | 'ADMIN' | 'MANAGER' | 'KITCHEN' | 'SERVER' | 'CUSTOMER';

/** Roles that work inside ONE tenant's dashboard shell. */
export const STAFF_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'KITCHEN', 'SERVER'];

/** Phase 5 S2.1 — cross-tenant operator role; never a tenant-shell role. */
export const PLATFORM_ROLES: UserRole[] = ['PLATFORM_ADMIN'];

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  emailVerified: boolean;
  /** Week 11.6 — exposed by GET /users/me and editable via PATCH /users/me. */
  phone?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  firstName: string;
  lastName: string;
  phone?: string;
  tenantId?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

/** Self-service password change for the signed-in user (PATCH /auth/password). */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/** Standard error envelope returned by the API error handler */
export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
