import { NextFunction, Response } from 'express';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import {
  idParamSchema,
  promoCodeCreateSchema,
  promoCodeUpdateSchema,
  promoValidateSchema,
  validateBody,
  validateParams,
} from '../utils/validation';
import { evaluatePromoCode } from '../services/promos';

/**
 * Week 20.4 — promotional codes.
 *
 * POST /api/promo-codes/validate — customer-side preview (any authenticated
 * user); CRUD is MANAGER+ (enforced at the router).
 */
export async function validatePromo(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { code, subtotal } = validateBody(promoValidateSchema, req.body);
    const result = await evaluatePromoCode(tenantId, code, subtotal);
    res.json({ data: { valid: result.valid, message: result.message, discount: result.discount } });
  } catch (e) {
    next(e);
  }
}

export async function listPromoCodes(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const promos = await prisma.promoCode.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    res.json({ data: promos });
  } catch (e) {
    next(e);
  }
}

export async function createPromoCode(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const data = validateBody(promoCodeCreateSchema, req.body);

    const clash = await prisma.promoCode.findFirst({ where: { tenantId, code: data.code } });
    if (clash) throw httpError(409, 'PROMO_CODE_EXISTS', `Code "${data.code}" already exists`);

    const created = await prisma.promoCode.create({ data: { ...data, tenantId } });
    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
}

export async function updatePromoCode(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const data = validateBody(promoCodeUpdateSchema, req.body);

    const existing = await prisma.promoCode.findFirst({ where: { id, tenantId } });
    if (!existing) throw httpError(404, 'PROMO_CODE_NOT_FOUND', 'Promo code not found');

    if (data.code && data.code !== existing.code) {
      const clash = await prisma.promoCode.findFirst({ where: { tenantId, code: data.code } });
      if (clash) throw httpError(409, 'PROMO_CODE_EXISTS', `Code "${data.code}" already exists`);
    }

    const updated = await prisma.promoCode.update({ where: { id: existing.id }, data });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deletePromoCode(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);

    const existing = await prisma.promoCode.findFirst({ where: { id, tenantId } });
    if (!existing) throw httpError(404, 'PROMO_CODE_NOT_FOUND', 'Promo code not found');

    await prisma.promoCode.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}
