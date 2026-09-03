import { NextFunction, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Prisma, UserRole } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import {
  onboardingSchema,
  tenantAnalyticsQuerySchema,
  updateTenantSchema,
  validateBody,
  validateQuery,
} from '../utils/validation';
import { createTenantWithAdmin } from '../services/tenant-onboarding';
import { signAccessToken, signRefreshToken } from '../services/jwt';

/**
 * Week 15 — multi-tenancy self-service.
 *
 * POST /api/tenants             → public onboarding (creates a new tenant).
 * GET/PATCH /api/tenants/me     → the RESOLVED tenant's profile & config.
 * GET /api/tenants/me/analytics → usage analytics + billing usage.
 *
 * Scope decision: this API is SELF-SERVICE. With ADMIN being the top role and
 * every tenant column scoped, there is no cross-tenant "super admin" surface;
 * platform-level tenant administration would need a role ABOVE ADMIN and a
 * non-tenant auth surface — out of scope, documented in the Review.
 */

const REFRESH_TOKEN_TTL_DAYS = 7;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Onboarding (15.4) ─────────────────────────────────────────────────────────

export async function onboardTenant(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const data = validateBody(onboardingSchema, req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);

    const { tenant, user } = await createTenantWithAdmin({
      restaurantName: data.restaurantName,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      passwordHash,
      timezone: data.timezone,
      currency: data.currency,
      taxRate: data.taxRate,
    });

    const accessToken = signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as UserRole,
      email: user.email,
    });
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    const refreshToken = signRefreshToken({ userId: user.id, tokenId: session.id });

    res.status(201).json({ user, tenant, accessToken, refreshToken });
  } catch (e) {
    next(e);
  }
}
// ── Profile & configuration (15.2 / 15.3) ─────────────────────────────────────

export async function getMyTenant(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw httpError(404, 'TENANT_NOT_FOUND', 'Tenant not found');

    const usersCount = await prisma.user.count({ where: { tenantId } });

    res.json({ data: { ...tenant, _count: { users: usersCount } } });
  } catch (e) {
    next(e);
  }
}

export async function updateMyTenant(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const data = validateBody(updateTenantSchema, req.body);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw httpError(404, 'TENANT_NOT_FOUND', 'Tenant not found');

    const updateData: Prisma.TenantUpdateInput = {};
    for (const key of [
      'name',
      'email',
      'phone',
      'address',
      'timezone',
      'currency',
      'taxRate',
      'operatingHours',
      'plan',
      'subscriptionStatus',
      'isActive',
    ] as const) {
      if (data[key] !== undefined) updateData[key] = data[key] as never;
    }

    const updated = await prisma.tenant.update({ where: { id: tenantId }, data: updateData });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}
// ── Usage analytics & billing (15.6) ──────────────────────────────────────────

export async function getTenantAnalytics(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { days } = validateQuery(tenantAnalyticsQuerySchema, req.query);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, subscriptionStatus: true, seatsLimit: true },
    });
    if (!tenant) throw httpError(404, 'TENANT_NOT_FOUND', 'Tenant not found');

    const [ordersTotal, ordersInWindow, activeOrders, paidAll, paidWindow, customersTotal, customersNew, menuItems, menuAvailable, lowStock, reviewsResult, seatsUsed] =
      await prisma.$transaction([
        prisma.order.count({ where: { tenantId } }),
        prisma.order.count({ where: { tenantId, createdAt: { gte: since } } }),
        prisma.order.count({
          where: { tenantId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] } },
        }),
        prisma.order.aggregate({
          where: { tenantId, paymentStatus: 'PAID' },
          _sum: { totalAmount: true },
        }),
        prisma.order.aggregate({
          where: { tenantId, paymentStatus: 'PAID', createdAt: { gte: since } },
          _sum: { totalAmount: true },
        }),
        prisma.user.count({ where: { tenantId, role: 'CUSTOMER' } }),
        prisma.user.count({ where: { tenantId, role: 'CUSTOMER', createdAt: { gte: since } } }),
        prisma.menuItem.count({ where: { category: { menu: { tenantId } } } }),
        prisma.menuItem.count({ where: { isAvailable: true, category: { menu: { tenantId } } } }),
        prisma.inventoryItem.count({
          where: { tenantId, currentStock: { lte: prisma.inventoryItem.fields.minStock } },
        }),
        prisma.review.aggregate({ where: { tenantId }, _avg: { rating: true }, _count: true }),
        prisma.user.count({ where: { tenantId } }),
      ]);

    res.json({
      data: {
        windowDays: days,
        orders: { total: ordersTotal, inWindow: ordersInWindow, active: activeOrders },
        revenue: {
          total: round2(paidAll._sum.totalAmount ?? 0),
          inWindow: round2(paidWindow._sum.totalAmount ?? 0),
        },
        customers: { total: customersTotal, newInWindow: customersNew },
        menu: { items: menuItems, available: menuAvailable },
        inventory: { lowStock },
        reviews: { total: reviewsResult._count, avgRating: round2(reviewsResult._avg.rating ?? 0) },
        billing: {
          plan: tenant.plan,
          subscriptionStatus: tenant.subscriptionStatus,
          seatsUsed,
          seatsLimit: tenant.seatsLimit,
        },
      },
    });
  } catch (e) {
    next(e);
  }
}
