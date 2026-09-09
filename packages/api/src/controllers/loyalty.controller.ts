import { NextFunction, Response } from 'express';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { requireTenant } from '../utils/http-error';
import { loyaltyBalance } from '../services/loyalty';

/**
 * Week 20.3 — loyalty endpoints.
 *
 * GET /api/loyalty/me → balance + recent ledger for the authenticated user.
 * Creates/redemptions are woven into createOrder/payOrder (see order.controller),
 * so this surface stays read-only (fail-open accrual, transactional redemptions).
 */
export async function getMyLoyalty(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const customerId = req.user?.userId;
    if (!customerId) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }

    const balance = await loyaltyBalance(tenantId, customerId);
    const history = await prisma.loyaltyEntry.findMany({
      where: { tenantId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ data: { balance, history } });
  } catch (e) {
    next(e);
  }
}
