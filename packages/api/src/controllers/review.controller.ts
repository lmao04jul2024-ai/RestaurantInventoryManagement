import { NextFunction, Response } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import {
  createReviewSchema,
  idParamSchema,
  reviewQuerySchema,
  reviewVisibilitySchema,
  validateBody,
  validateParams,
  validateQuery,
} from '../utils/validation';

/**
 * Week 11 — reviews & ratings (11.3/11.4). A review belongs to one COMPLETED
 * order (schema-unique orderId); customers review their own tickets, staff
 * (review:read / review:moderate) browse and moderate visibility.
 */

const REVIEW_INCLUDE = {
  order: { select: { id: true, orderNumber: true } },
  customer: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ReviewInclude;

function isCustomer(req: TenantRequest): boolean {
  return req.user?.role === UserRole.CUSTOMER;
}

// ── Create (11.3) ─────────────────────────────────────────────────────────────

export async function createReview(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const data = validateBody(createReviewSchema, req.body);

    const order = await prisma.order.findFirst({
      where: { id: data.orderId, tenantId },
      select: { id: true, customerId: true, status: true },
    });
    // Foreign orders stay hidden behind 404 (same convention as order detail).
    if (!order || (isCustomer(req) && order.customerId !== req.user!.userId)) {
      throw httpError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }
    if (order.status !== 'COMPLETED') {
      throw httpError(409, 'ORDER_NOT_COMPLETED', 'Orders can be reviewed once completed');
    }

    const existing = await prisma.review.findFirst({
      where: { orderId: order.id },
      select: { id: true },
    });
    if (existing) {
      throw httpError(409, 'REVIEW_EXISTS', 'This order has already been reviewed');
    }

    const review = await prisma.review.create({
      data: {
        orderId: order.id,
        tenantId,
        // Customers always review as themselves; staff file on behalf of the
        // ticket's customer.
        customerId: isCustomer(req) ? req.user!.userId : order.customerId,
        rating: data.rating,
        comment: data.comment ?? null,
      },
      include: REVIEW_INCLUDE,
    });

    res.status(201).json({ data: review });
  } catch (e) {
    next(e);
  }
}

// ── Customer history (11.5) ───────────────────────────────────────────────────

export async function listMyReviews(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const q = validateQuery(reviewQuerySchema, req.query);

    const where: Prisma.ReviewWhereInput = { tenantId, customerId: req.user!.userId };
    if (q.rating) where.rating = q.rating;
    if (q.isVisible !== undefined) where.isVisible = q.isVisible;

    const [rows, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.review.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    });
  } catch (e) {
    next(e);
  }
}

// ── Staff moderation (11.4) ───────────────────────────────────────────────────

export async function listReviews(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const q = validateQuery(reviewQuerySchema, req.query);

    const where: Prisma.ReviewWhereInput = { tenantId };
    if (q.rating) where.rating = q.rating;
    if (q.isVisible !== undefined) where.isVisible = q.isVisible;

    const [rows, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.review.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    });
  } catch (e) {
    next(e);
  }
}

export async function setReviewVisibility(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const { isVisible } = validateBody(reviewVisibilitySchema, req.body);

    const review = await prisma.review.findFirst({ where: { id, tenantId } });
    if (!review) throw httpError(404, 'REVIEW_NOT_FOUND', 'Review not found');

    const updated = await prisma.review.update({
      where: { id },
      data: { isVisible },
      include: REVIEW_INCLUDE,
    });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deleteReview(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);

    const review = await prisma.review.findFirst({ where: { id, tenantId } });
    if (!review) throw httpError(404, 'REVIEW_NOT_FOUND', 'Review not found');

    await prisma.review.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}