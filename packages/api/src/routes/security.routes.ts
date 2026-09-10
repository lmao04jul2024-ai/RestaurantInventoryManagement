import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requireRole } from '../middleware/rbac';
import { getSecurityEvents, getSecurityHealth } from '../controllers/security.controller';

/**
 * Week 22.6 — security monitoring (ADMIN only). Read surfaces feed ops
 * dashboards; all events come from the immutable audit trail (`security:*`).
 */
const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/events', requireRole(UserRole.ADMIN), getSecurityEvents);
router.get('/health', requireRole(UserRole.ADMIN), getSecurityHealth);

export default router;