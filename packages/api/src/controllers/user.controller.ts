import { NextFunction, Response } from 'express';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { AuthRequest } from '../middleware/auth';
import { httpError, requireTenant } from '../utils/http-error';
import { idParamSchema, updateProfileSchema, validateBody, validateParams } from '../utils/validation';

/**
 * Week 11.6 — user profile management.
 * Customers manage their own profile (firstName, lastName, phone).
 */

function publicUser(user: {
  id: string; email: string; firstName: string; lastName: string;
  role: string; tenantId: string; phone: string | null; isActive: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenantId: user.tenantId,
    phone: user.phone,
    isActive: user.isActive,
  };
}

/** GET /api/users/me — current user's own profile */
export async function getMyProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) throw httpError(404, 'USER_NOT_FOUND', 'User not found');
    res.json({ data: publicUser(user) });
  } catch (e) {
    next(e);
  }
}

/** PATCH /api/users/me — update firstName, lastName, phone */
export async function updateMyProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });

    const data = validateBody(updateProfileSchema, req.body);

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data,
    });
    res.json({ data: publicUser(updated) });
  } catch (e) {
    next(e);
  }
}

/** GET /api/users/:id — staff look up a user within the resolved tenant */
export async function getUserById(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);

    const user = await prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) throw httpError(404, 'USER_NOT_FOUND', 'User not found');
    res.json({ data: publicUser(user) });
  } catch (e) {
    next(e);
  }
}