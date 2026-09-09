import prisma from './database';
import { httpError } from '../utils/http-error';

/**
 * Week 20.3 — loyalty program economics (single source of truth).
 *
 * Accrual: 1 point per $1 paid. Redemption: 100 points = $1 off.
 * Balances are a signed ledger (LoyaltyEntry.points); the balance of a
 * customer is the sum of their entries. Tenant config for these constants is
 * a later (Week 23+) feature — they're exported constants on purpose.
 */
export const LOYALTY_POINTS_PER_DOLLAR = 1;
export const LOYALTY_POINTS_PER_DISCOUNT_DOLLAR = 100;

/** Sums a customer's ledger into a balance. */
export async function loyaltyBalance(tenantId: string, customerId: string): Promise<number> {
  const agg = await prisma.loyaltyEntry.aggregate({
    where: { tenantId, customerId },
    _sum: { points: true },
  });
  return agg._sum.points ?? 0;
}

/**
 * Awards accrual points for a paid amount (call inside the payment write
 * path, gated on the tenant's `loyalty_program` flag by the caller).
 * Returns the points awarded (0 for sub-$1 amounts).
 */
export async function awardLoyaltyPoints(
  tenantId: string,
  customerId: string,
  orderId: string,
  paidAmount: number,
): Promise<number> {
  const points = Math.floor(paidAmount * LOYALTY_POINTS_PER_DOLLAR);
  if (points <= 0) return 0;
  await prisma.loyaltyEntry.create({
    data: {
      tenantId,
      customerId,
      orderId,
      points,
      reason: `accrual:order:${orderId}`,
    },
  });
  return points;
}

/**
 * Validates a redemption request and computes the discount. Throws 409 when
 * the balance is insufficient; caps the discount at the subtotal so the
 * ticket can never go negative.
 */
export async function redeemLoyaltyPoints(
  tenantId: string,
  customerId: string,
  requestedPoints: number,
  subtotal: number,
): Promise<{ points: number; discount: number }> {
  if (!Number.isInteger(requestedPoints) || requestedPoints <= 0) {
    throw httpError(400, 'VALIDATION_ERROR', 'loyaltyPoints must be a positive integer');
  }
  const balance = await loyaltyBalance(tenantId, customerId);
  if (requestedPoints > balance) {
    throw httpError(409, 'INSUFFICIENT_LOYALTY', `Insufficient loyalty balance (have ${balance}, want ${requestedPoints})`);
  }
  const maxDiscount = Math.round(subtotal * 100) / 100;
  const requestedDiscount = Math.round((requestedPoints / LOYALTY_POINTS_PER_DISCOUNT_DOLLAR) * 100) / 100;
  const discount = Math.min(requestedDiscount, maxDiscount);
  const points = Math.min(requestedPoints, Math.round(discount * LOYALTY_POINTS_PER_DISCOUNT_DOLLAR));
  return { points, discount };
}