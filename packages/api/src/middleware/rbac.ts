import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthRequest } from './auth';

/** Week 16.5 — request shape once resolveTenant has attached per-user overrides. */
export interface OverrideAwareRequest extends AuthRequest {
  permissionOverrides?: Record<string, boolean> | null;
}

/**
 * Role hierarchy - higher number = more privileges
 * Used for hierarchical checks like requireRole('manager') which allows admin too
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.CUSTOMER]: 1,
  [UserRole.SERVER]: 2,
  [UserRole.KITCHEN]: 2,
  [UserRole.MANAGER]: 3,
  [UserRole.ADMIN]: 4,
  // S2.1 — platform operator outranks tenant ADMIN, but is not part of the
  // tenant role ladder: requireRoleOrHigher(ADMIN) must NOT admit them into
  // tenant surfaces (resolveTenant rejects the role outright).
  [UserRole.PLATFORM_ADMIN]: 5,
};

/**
 * RBAC middleware factory - allows ONLY the exact roles listed
 * Usage: router.get('/admin-only', requireRole(UserRole.ADMIN), handler)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required before role check',
        },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN_ROLE',
          message: `Requires one of roles: ${roles.join(', ')}`,
        },
      });
    }

    next();
  };
}

/**
 * Permission-based middleware — passes when the user holds ANY of the listed
 * permissions (e.g. CUSTOMER's granular `order:create:own` vs staff `order:create`).
 */
export function requireAnyPermission(...permissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required before permission check',
        },
      });
    }

    const overrides = (req as OverrideAwareRequest).permissionOverrides ?? undefined;
    if (!permissions.some((permission) => hasPermissionWithOverrides(req.user!.role, permission, overrides))) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN_PERMISSION',
          message: `Missing one of required permissions: ${permissions.join(', ')}`,
        },
      });
    }

    next();
  };
}

/**
 * RBAC middleware factory - allows the given role AND any higher-privilege roles
 * Usage: router.put('/menus/:id', requireRoleOrHigher(UserRole.MANAGER), handler)
 */
export function requireRoleOrHigher(minimumRole: UserRole) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required before role check',
        },
      });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole];

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN_ROLE',
          message: `Requires ${minimumRole} or higher`,
        },
      });
    }

    next();
  };
}

/**
 * S2.1 — platform-operator guard for the super-admin surface (/api/platform/*).
 * Distinct from tenant ADMIN by ROLE, not by permission matrix: only the
 * PLATFORM_ADMIN role passes. Mount AFTER authenticate.
 */
export function requirePlatformAdmin() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required before role check',
        },
      });
    }

    if (req.user.role !== UserRole.PLATFORM_ADMIN) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN_ROLE',
          message: 'This surface is restricted to platform administrators',
        },
      });
    }

    next();
  };
}

/**
 * Permission matrix for feature-level access control
 * Maps role -> list of allowed permissions
 */
export const PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.CUSTOMER]: ['menu:read', 'order:create:own', 'order:read:own', 'review:create:own', 'review:read:own'],
  [UserRole.SERVER]: [
    'menu:read',
    'order:create',
    'order:read',
    'order:update:status',
    'table:read',
  ],
  [UserRole.KITCHEN]: [
    'menu:read',
    'order:read',
    'order:update:status',
    'order:assign',
    'inventory:read',
    'inventory:update:stock',
  ],
  [UserRole.MANAGER]: [
    'menu:*',
    'order:*',
    'inventory:*',
    'supplier:*',
    'review:read',
    'review:moderate',
    'analytics:read',
    'staff:read',
    'staff:manage',
    'feature-flag:read',
    'feature-flag:manage',
  ],
  [UserRole.ADMIN]: ['*'], // Full access (within one tenant)
  // S2.1 — platform operator: cross-tenant surface only. It never flows through
  // resolveTenant/tenant permission checks, so this entry exists so the matrix
  // lookup cannot crash; the platform routes guard with requirePlatformAdmin.
  [UserRole.PLATFORM_ADMIN]: ['*'],
};

function hasPermission(userRole: UserRole, required: string): boolean {
  const granted = PERMISSIONS[userRole] ?? [];
  const [domain] = required.split(':');
  return (
    granted.includes('*') ||
    granted.includes(`${domain}:*`) ||
    granted.includes(required)
  );
}

// ── Week 16.5: per-user permission overrides ─────────────────────────────────

/** Roles that may hold per-user permission overrides (custom roles land in Phase 4). */
export const OVERRIDEABLE_ROLES: UserRole[] = ['MANAGER', 'KITCHEN', 'SERVER'];

/** Seeded default staffing per restaurant; onboarding copies this into User rows. */
export const DEFAULT_STAFF_ROLES: UserRole[] = ['MANAGER', 'KITCHEN', 'SERVER'];

/**
 * Role-matrix check extended with per-user overrides (Week 16.5):
 *   1. an explicit `false` override denies, even when the role grants it
 *   2. an explicit `true` override grants, even when the role lacks it
 *   3. no override for the permission → pure matrix lookup (backwards compatible)
 */
export function hasPermissionWithOverrides(
  userRole: UserRole,
  required: string,
  overrides?: Record<string, boolean> | null,
): boolean {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, required)) {
    return overrides[required] === true;
  }
  return hasPermission(userRole, required);
}

/**
 * Permission-based middleware (fine-grained)
 * Usage: router.get('/inventory', requirePermission('inventory:read'), handler)
 *
 * Week 16.5 — override-aware: when `resolveTenant` attached the caller's
 * `permissionOverrides`, an explicit `false` denies even role-granted
 * permissions and an explicit `true` grants beyond the role. Without overrides
 * the check falls back to the pure role matrix (backwards compatible).
 */
export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required before permission check',
        },
      });
    }

    const overrides = (req as OverrideAwareRequest).permissionOverrides ?? undefined;
    if (!hasPermissionWithOverrides(req.user.role, permission, overrides)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN_PERMISSION',
          message: `Missing required permission: ${permission}`,
        },
      });
    }

    next();
  };
}
