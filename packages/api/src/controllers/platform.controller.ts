import { NextFunction, Response } from 'express';
import prisma from '../services/database';
import { AuthRequest } from '../middleware/auth';
import { httpError } from '../utils/http-error';
import { platformListQuerySchema, platformTenantUpdateSchema, validateBody, validateQuery } from '../utils/validation';
import { writeAuditLog, listAuditLogs } from '../services/audit';

/**
 * Phase 5 S2.2/S2.3 — platform (super-admin) API.
 *
 * The ONLY cross-tenant surface. Every route is guarded by
 * requirePlatformAdmin (PLATFORM_ADMIN role) and NEVER passes through
 * resolveTenant — there is deliberately no tenant context here, so the
 * Week-15 row-level guard pass-throughs apply and every query scopes itself
 * EXPLICITLY by the tenant id from the route/validated payload.
 *
 * Manual-billing model: plan / subscriptionStatus / seatsLimit / isActive are
 * operator-only commercial state; every mutation writes an immutable AuditLog
 * row (action `platform:tenant.updated`, tenantId = the AFFECTED tenant) so
 * billing disputes settle against our own records.
 */

function platformActor(req: AuthRequest): string {
  if (!req.user) throw httpError(401, 'UNAUTHENTICATED', 'Authentication required');
  return req.user.userId;
}

/** S2.4 — how many recent operator changes the console shows per tenant. */
const HISTORY_LIMIT = 10;

async function auditPlatformChange(
  req: AuthRequest,
  tenantId: string,
  changes: Record<string, unknown>,
): Promise<void> {
  await writeAuditLog({
    tenantId, // audit rows live in the AFFECTED tenant's scope
    actorId: platformActor(req),
    action: 'platform:tenant.updated',
    targetType: 'Tenant',
    targetId: tenantId,
    metadata: { changes, surface: 'platform' },
  });
}

/** GET /api/platform/tenants?page&limit&search — list + usage summary. */
export async function listPlatformTenants(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, search } = validateQuery(platformListQuerySchema, req.query);
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, tenants] = await prisma.$transaction([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          plan: true,
          subscriptionStatus: true,
          seatsLimit: true,
          isActive: true,
          createdAt: true,
          _count: { select: { users: true, orders: true, menus: true, inventory: true } },
        },
      }),
    ]);

    res.json({ data: tenants, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/platform/tenants/:tenantId — detail + usage + change history.
 *
 * S2.4 — `recentChanges` is this tenant's operator-change trail (the immutable
 * `platform:tenant.updated` audit rows written by updatePlatformTenant), newest
 * first, so the console can answer "who changed the plan, and when" directly
 * from our own records (manual billing disputes never need an external ledger).
 */
/**
 * S3.4 — operator attention list (GET /api/platform/attention).
 *
 * The operator's manual-billing queue: every workspace that currently needs a
 * human decision, with machine-readable reasons. A workspace lands here when:
 *
 *  - it is suspended (isActive=false)          → SUSPENDED
 *  - its subscription is PAST_DUE / CANCELLED  → PAST_DUE / CANCELLED
 *  - it is still a running TRIAL within the    → TRIAL_ENDING
 *    warning window before expiry
 *  - its TRIAL has run past TRIAL_LENGTH_DAYS  → TRIAL_EXPIRED
 *
 * Trial timing is derived from `createdAt` (no separate schema field): the
 * workspace is "born" the day it signed up. Reasons are computed server-side
 * so the console banner and any future notification job agree on one truth.
 */

const TRIAL_LENGTH_DAYS = 30;
const TRIAL_WARNING_DAYS = 7;
const DAY_MS = 86_400_000;

export async function listAttentionTenants(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        OR: [
          { isActive: false },
          { subscriptionStatus: { in: ['PAST_DUE', 'CANCELLED'] } },
          { plan: 'TRIAL', subscriptionStatus: 'TRIAL' },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        plan: true,
        subscriptionStatus: true,
        seatsLimit: true,
        isActive: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    });

    const now = Date.now();
    const data = tenants
      .map((t) => {
        const reasons: string[] = [];
        if (!t.isActive) reasons.push('SUSPENDED');
        if (t.subscriptionStatus === 'PAST_DUE') reasons.push('PAST_DUE');
        if (t.subscriptionStatus === 'CANCELLED') reasons.push('CANCELLED');
        if (t.plan === 'TRIAL' && t.subscriptionStatus === 'TRIAL') {
          const ageDays = Math.floor((now - t.createdAt.getTime()) / DAY_MS);
          if (ageDays >= TRIAL_LENGTH_DAYS) reasons.push('TRIAL_EXPIRED');
          else if (ageDays >= TRIAL_LENGTH_DAYS - TRIAL_WARNING_DAYS) reasons.push('TRIAL_ENDING');
        }
        return { ...t, reasons };
      })
      .filter((t) => t.reasons.length > 0);

    res.json({ data, total: data.length });
  } catch (e) {
    next(e);
  }
}


export async function getPlatformTenant(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = String(req.params.tenantId ?? '');
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { _count: { select: { users: true, orders: true, menus: true, inventory: true, suppliers: true } } },
    });
    if (!tenant) throw httpError(404, 'TENANT_NOT_FOUND', 'Tenant not found');

    // Explicit tenantId — this surface has no tenant context, so the audit
    // read scopes itself by the AFFECTED tenant from the route.
    const history = await listAuditLogs({
      tenantId,
      action: 'platform:tenant.updated',
      limit: HISTORY_LIMIT,
    });

    const seatsUsed = tenant._count.users;
    res.json({
      data: {
        ...tenant,
        billing: { seatsUsed, seatsLimit: tenant.seatsLimit },
        recentChanges: history.data,
      },
    });
  } catch (e) {
    next(e);
  }
}

/**
 * PATCH /api/platform/tenants/:tenantId — operator-only commercial state.
 * Body: { plan?, subscriptionStatus?, seatsLimit?, isActive? } — audited.
 * Only CHANGED fields are recorded; a no-op patch writes nothing.
 */
export async function updatePlatformTenant(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = String(req.params.tenantId ?? '');
    const data = validateBody(platformTenantUpdateSchema, req.body);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw httpError(404, 'TENANT_NOT_FOUND', 'Tenant not found');

    // Seats may only GROW past current usage implicitly — lowering below the
    // current user count is rejected with 409 so billing state stays coherent.
    if (data.seatsLimit !== undefined && data.seatsLimit < tenant.seatsLimit) {
      const users = await prisma.user.count({ where: { tenantId } });
      if (data.seatsLimit < users) {
        throw httpError(409, 'SEATS_BELOW_USAGE', `Cannot lower seatsLimit to ${data.seatsLimit}: ${users} users exist`);
      }
    }

    const changes: Record<string, unknown> = {};
    const updateData: Record<string, unknown> = {};
    for (const key of ['plan', 'subscriptionStatus', 'seatsLimit', 'isActive'] as const) {
      const value = data[key];
      if (value === undefined) continue;
      if (tenant[key as keyof typeof tenant] !== value) {
        changes[key] = { from: tenant[key as keyof typeof tenant], to: value };
      }
      updateData[key] = value;
    }

    // No-op patch: nothing CHANGED (a provided value equal to the current one
    // is not a change) → persist nothing, audit nothing. The response keeps
    // the GET detail shape so the console can swap it straight into its cache.
    if (Object.keys(changes).length === 0) {
      const history = await listAuditLogs({
        tenantId,
        action: 'platform:tenant.updated',
        limit: HISTORY_LIMIT,
      });
      const seatsUsed = await prisma.user.count({ where: { tenantId } });
      return res.json({
        data: {
          ...tenant,
          billing: { seatsUsed, seatsLimit: tenant.seatsLimit },
          recentChanges: history.data,
        },
      });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      include: { _count: { select: { users: true, orders: true, menus: true, inventory: true, suppliers: true } } },
    });
    await auditPlatformChange(req, tenantId, changes);

    // Re-read the operator change trail so the response keeps the GET detail
    // shape — the console swaps this payload straight into its cache.
    const history = await listAuditLogs({
      tenantId,
      action: 'platform:tenant.updated',
      limit: HISTORY_LIMIT,
    });

    res.json({
      data: {
        ...updated,
        billing: { seatsUsed: updated._count.users, seatsLimit: updated.seatsLimit },
        recentChanges: history.data,
      },
    });
  } catch (e) {
    next(e);
  }
}
