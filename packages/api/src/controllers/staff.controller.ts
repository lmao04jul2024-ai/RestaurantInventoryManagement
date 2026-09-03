import { NextFunction, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma, UserRole } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import {
  auditLogQuerySchema,
  createStaffSchema,
  staffListQuerySchema,
  updateStaffSchema,
  validateBody,
  validateQuery,
} from '../utils/validation';
import { OVERRIDEABLE_ROLES } from '../middleware/rbac';
import { writeAuditLog, listAuditLogs } from '../services/audit';
import { normalizeOverrides } from '../services/feature-flags';

/**
 * Week 16 — staff management & audit surface.
 *
 * GET    /api/staff          → tenant staff directory (staff:read, MANAGER+)
 * POST   /api/staff          → create a staff user (staff:manage, ADMIN/MANAGER)
 * PATCH  /api/staff/:id      → profile / role / overrides (staff:manage; role change = ADMIN only)
 * GET    /api/audit-logs     → immutable audit trail (ADMIN only)
 *
 * Invariants enforced here:
 *   • ADMIN accounts are never created/edited/demoted through this API.
 *   • A user may not change their own role.
 *   • Role changes are ADMIN-only; profile & overrides are staff:manage.
 *   • Overrides are only valid for OVERRIDEABLE_ROLES (custom roles in Phase 4).
 * Every mutation lands in AuditLog — append-only, one row per change.
 */

/** Staff rows are never returned with credentials. */
const STAFF_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  permissionOverrides: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type StaffRow = Prisma.UserGetPayload<{ select: typeof STAFF_SELECT }>;

function sanitize(row: StaffRow) {
  return {
    ...row,
    permissionOverrides: normalizeOverrides(row.permissionOverrides),
  };
}

// ── 16.5 — staff directory ────────────────────────────────────────────────────

export async function listStaff(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const query = validateQuery(staffListQuerySchema, req.query);

    const where: Prisma.UserWhereInput = {
      tenantId,
      ...(query.role ? { role: query.role } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' as const } },
              { firstName: { contains: query.q, mode: 'insensitive' as const } },
              { lastName: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: STAFF_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    res.json({ data: rows.map(sanitize), meta: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) || 1 } });
  } catch (error) {
    next(error);
  }
}

// ── 16.5 — staff creation ─────────────────────────────────────────────────────

export async function createStaff(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const actor = req.user;
    if (!actor) throw httpError(401, 'UNAUTHENTICATED', 'Authentication required');

    const data = validateBody(createStaffSchema, req.body);

    const existing = await prisma.user.findFirst({ where: { email: data.email }, select: { id: true } });
    if (existing) throw httpError(409, 'EMAIL_TAKEN', 'A user with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role as UserRole,
        tenantId,
      },
      select: STAFF_SELECT,
    });

    await writeAuditLog({
      tenantId,
      actorId: actor.userId,
      action: 'staff.created',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    res.status(201).json({ data: sanitize(user) });
  } catch (error) {
    next(error);
  }
}

// ── 16.5 — profile / role / overrides update ─────────────────────────────────

export async function updateStaff(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const actor = req.user;
    if (!actor) throw httpError(401, 'UNAUTHENTICATED', 'Authentication required');

    // L017 — `.pattern()` sub-schemas defeat Joi inference; pin the payload type.
    const data = validateBody<{
      firstName?: string;
      lastName?: string;
      role?: string;
      permissionOverrides?: Record<string, boolean | null> | null;
    }>(updateStaffSchema, req.body);
    const target = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId },
      select: STAFF_SELECT,
    });
    if (!target) throw httpError(404, 'STAFF_NOT_FOUND', 'Staff member not found');
    if (target.role === 'ADMIN') {
      throw httpError(403, 'CANNOT_MODIFY_ADMIN', 'Admin accounts are managed outside the staff API');
    }
    if (data.role && target.id === actor.userId) {
      throw httpError(403, 'CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role');
    }
    if (data.role && actor.role !== 'ADMIN') {
      throw httpError(403, 'ROLE_CHANGE_REQUIRES_ADMIN', 'Only admins can change staff roles');
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.role !== undefined) updateData.role = data.role as UserRole;

    const overridesProvided = Object.prototype.hasOwnProperty.call(data, 'permissionOverrides');
    let overridesChanged: { from: Record<string, boolean>; to: Record<string, boolean> | null } | undefined;
    if (overridesProvided) {
      if (!OVERRIDEABLE_ROLES.includes(target.role as UserRole)) {
        throw httpError(400, 'OVERRIDES_NOT_ALLOWED', `Role ${target.role} cannot hold permission overrides`);
      }
      const before = normalizeOverrides(target.permissionOverrides);
      if (data.permissionOverrides === null) {
        updateData.permissionOverrides = Prisma.DbNull;
        overridesChanged = { from: before, to: null };
      } else if (data.permissionOverrides) {
        const merged: Record<string, boolean> = { ...before };
        for (const [permission, value] of Object.entries(data.permissionOverrides)) {
          if (value === null) delete merged[permission];
          else merged[permission] = value;
        }
        updateData.permissionOverrides = merged as Prisma.InputJsonValue;
        overridesChanged = { from: before, to: merged };
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: updateData,
      select: STAFF_SELECT,
    });

    await writeAuditLog({
      tenantId,
      actorId: actor.userId,
      action: 'staff.updated',
      targetType: 'User',
      targetId: updated.id,
      metadata: {
        role: data.role ? { from: target.role, to: updated.role } : undefined,
        profile: {
          firstName: data.firstName !== undefined,
          lastName: data.lastName !== undefined,
        },
        overrides: overridesChanged,
      },
    });

    res.json({ data: sanitize(updated) });
  } catch (error) {
    next(error);
  }
}

// ── 16.6 — audit trail read model ────────────────────────────────────────────

export async function getAuditLogs(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const query = validateQuery(auditLogQuerySchema, req.query);
    const result = await listAuditLogs({ tenantId, ...query });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

