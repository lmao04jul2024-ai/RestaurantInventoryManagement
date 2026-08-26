/**
 * Types matching the API contract exactly (see packages/api/src/controllers/auth.controller.ts).
 * NOTE: roles are UPPERCASE strings because Prisma enums serialize that way.
 */

export type UserRole = 'ADMIN' | 'MANAGER' | 'KITCHEN' | 'SERVER' | 'CUSTOMER';

export const STAFF_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'KITCHEN', 'SERVER'];

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  emailVerified: boolean;
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

/** Standard error envelope returned by the API error handler */
export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
