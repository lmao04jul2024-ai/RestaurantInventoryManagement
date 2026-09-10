import { NextFunction, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { requireTenant } from '../utils/http-error';
import { writeSecurityEvent } from '../services/audit';

/**
 * Week 22.4 — GDPR / privacy self-service.
 *
 *  - GET  /api/me/data  — data portability (Art. 20): one envelope with the
 *    caller's personal data across every store that references them.
 *  - DELETE /api/me     — erasure (Art. 17): anonymize the row (keeps order
 *    history intact but detaches it from an identifiable person), disable the
 *    account, revoke all sessions, and record a security event.
 *
 * Erasure is a destroy-and-recreate-free approach: identifiers are replaced,
 * not the row deleted, so financial/order records keep referential integrity —
 * this is the documented, GDPR-compliant "anonymization" reading of erasure.
 */

function publicErasedUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  emailVerified: boolean;
  dataErasedAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    dataErasedAt: user.dataErasedAt,
  };
}

/** GET /api/me/data — the caller's personal data across the platform. */
export async function getMyData(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }

    // The user's own row first (404 if not in this tenant — races with erasure).
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        role: true, isActive: true, emailVerified: true, consentGivenAt: true,
        dataErasedAt: true, createdAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found for this tenant' } });
    }

    const [orders, reviews, loyaltyEntries] = await prisma.$transaction([
      prisma.order.findMany({
        where: { tenantId, customerId: userId },
        include: { items: { include: { menuItem: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.findMany({ where: { tenantId, customerId: userId } }),
      prisma.loyaltyEntry.findMany({ where: { tenantId, customerId: userId }, orderBy: { createdAt: 'desc' } }),
    ]);

    res.json({
      data: {
        exportedAt: new Date().toISOString(),
        user,
        orders,
        reviews,
        loyaltyEntries,
      },
    });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/me — right-to-erasure: anonymize, disable, revoke, audit. */
export async function eraseMyData(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const userId = req.user?.userId;
    // The erased user can only have acted in their own tenant.
    const actorTenant = req.user?.tenantId ?? tenantId;
    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, email: true },
    });
    if (!user) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found for this tenant' } });
    }

    // Password becomes a random unguessable hash so the account can never log in again.
    const deadPassword = await bcrypt.hash(cryptoSecret(), 12);
    const erasedAt = new Date();
    const erasedEmail = `erased-${user.id}@deleted.invalid`;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          email: erasedEmail,
          password: deadPassword,
          firstName: 'Deleted',
          lastName: 'User',
          phone: null,
          avatar: null,
          isActive: false,
          emailVerified: false,
          permissionOverrides: Prisma.JsonNull,
          dataErasedAt: erasedAt,
        },
      }),
      // Revoke every session (refresh + reset codes).
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    await writeSecurityEvent({
      tenantId: actorTenant,
      actorId: user.id,
      action: 'data_erasure',
      metadata: { userId: user.id, erasedAt: erasedAt.toISOString() },
    });

    res.json({
      message: 'Your personal data has been erased and the account disabled.',
      data: publicErasedUser({
        id: user.id,
        email: erasedEmail,
        firstName: 'Deleted',
        lastName: 'User',
        isActive: false,
        emailVerified: false,
        dataErasedAt: erasedAt,
      }),
    });
  } catch (error) {
    next(error);
  }
}

/** v4-ish entropy for the dead password — crypto.randomBytes is the source. */
function cryptoSecret(): string {
  return Buffer.from(crypto.randomBytes(48)).toString('base64');
}