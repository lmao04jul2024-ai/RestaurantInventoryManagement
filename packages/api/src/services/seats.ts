import prisma from './database';
import { httpError } from '../utils/http-error';

/**
 * Phase 5 S2.5 — manual-billing seat accounting.
 *
 * seatsLimit is the operator-controlled commercial ceiling (managed via
 * /api/platform with audit logging). Every user creation/invite path must call
 * `enforceSeats` FIRST so a workspace can never exceed its paid seats.
 */
export const seatsService = {
  /** Current seatsUsed/seatsLimit for a tenant. */
  async usage(tenantId: string): Promise<{ seatsUsed: number; seatsLimit: number; remaining: number }> {
    const [seatsUsed, tenant] = await prisma.$transaction([
      prisma.user.count({ where: { tenantId } }),
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { seatsLimit: true } }),
    ]);
    const seatsLimit = tenant?.seatsLimit ?? 0;
    return { seatsUsed, seatsLimit, remaining: Math.max(0, seatsLimit - seatsUsed) };
  },

  /**
   * Throws 409 SEATS_LIMIT_REACHED when the tenant is at/over its limit.
   * `extra` = how many new users the caller is about to create (default 1).
   */
  async enforceSeats(tenantId: string, extra = 1): Promise<void> {
    const { seatsUsed, seatsLimit } = await seatsService.usage(tenantId);
    if (seatsUsed + extra > seatsLimit) {
      throw httpError(
        409,
        'SEATS_LIMIT_REACHED',
        `Plan seat limit reached (${seatsUsed}/${seatsLimit}). Ask the platform operator to raise your seat limit.`,
      );
    }
  },
};
