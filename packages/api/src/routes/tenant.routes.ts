import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requireRoleOrHigher } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import {
  onboardTenant,
  getMyTenant,
  updateMyTenant,
  getTenantAnalytics,
} from '../controllers/tenant.controller';

const router = Router();

// 15.4 — PUBLIC onboarding: creates a new tenant + its ADMIN + a default menu.
// No resolveTenant here — there is no tenant to resolve before one exists.
router.post('/', onboardTenant);

// Self-service tenant API — requires an authenticated, tenant-resolved request.
router.use(authenticate);
router.use(resolveTenant);

router.get('/me', getMyTenant);
router.patch('/me', requireRoleOrHigher(UserRole.MANAGER), updateMyTenant);
router.get('/me/analytics', requireRoleOrHigher(UserRole.MANAGER), getTenantAnalytics);

export default router;