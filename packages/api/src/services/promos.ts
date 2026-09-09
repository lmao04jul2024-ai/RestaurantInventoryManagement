import { PromoType } from '@prisma/client';
import prisma from './database';

/**
 * Week 20.4 — promotional code economics (single source of truth).
 *
 * A code is usable when it is active, inside its [startsAt, endsAt] window,
 * has redemptions left, and the order subtotal clears minSubtotal.
 * PERCENT discounts multiply the subtotal; FIXED discounts subtract.
 */

export interface PromoEvaluation {
  valid: boolean;
  message: string;
  discount: number;
}

export async function evaluatePromoCode(
  tenantId: string,
  rawCode: string,
  subtotal: number,
  now: Date = new Date(),
): Promise<PromoEvaluation & { promo: { id: string; type: PromoType; value: number } | null }> {
  const code = rawCode.trim().toUpperCase();
  const promo = await prisma.promoCode.findFirst({ where: { tenantId, code } });
  if (!promo || !promo.isActive) {
    return { valid: false, message: 'Unknown or inactive promo code', discount: 0, promo: null };
  }
  if (promo.startsAt && promo.startsAt > now) {
    return { valid: false, message: 'This promo code is not active yet', discount: 0, promo: null };
  }
  if (promo.endsAt && promo.endsAt <= now) {
    return { valid: false, message: 'This promo code has expired', discount: 0, promo: null };
  }
  if (promo.maxRedemptions != null && promo.redeemedCount >= promo.maxRedemptions) {
    return { valid: false, message: 'This promo code has reached its redemption limit', discount: 0, promo: null };
  }
  if (promo.minSubtotal != null && subtotal < promo.minSubtotal) {
    return { valid: false, message: `Requires a subtotal of at least $${promo.minSubtotal.toFixed(2)}`, discount: 0, promo: null };
  }

  const discount =
    promo.type === PromoType.PERCENT
      ? Math.round(subtotal * (promo.value / 100) * 100) / 100
      : Math.min(promo.value, subtotal);
  return { valid: true, message: 'Promo code applied', discount, promo };
}

export async function consumePromoRedemption(promoId: string): Promise<void> {
  await prisma.promoCode.update({
    where: { id: promoId },
    data: { redeemedCount: { increment: 1 } },
  });
}