import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthRequest } from './auth';

/**
 * Role hierarchy - higher number = more privileges
 * Used for hierarchical checks like requireRole('manager') which allows admin too
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.CUSTOMER]: 1,
  [UserRole.SERVER]: 2,
  [UserRole.KITCHEN]: 2,
  [UserRole.MANAGER]: 3,
  [UserRole.ADMIN]: 4,
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

    if (!permissions.some((permission) => hasPermission(req.user!.role, permission))) {
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
  ],
  [UserRole.ADMIN]: ['*'], // Full access
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

/**
 * Permission-based middleware (fine-grained)
 * Usage: router.get('/inventory', requirePermission('inventory:read'), handler)
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

    if (!hasPermission(req.user.role, permission)) {
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
