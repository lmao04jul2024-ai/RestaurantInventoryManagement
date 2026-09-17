import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/rbac';
import {
  listPlatformTenants,
  getPlatformTenant,
  updatePlatformTenant,
  listAttentionTenants,
} from '../controllers/platform.controller';

/**
 * Phase 5 S2.2 — platform (super-admin) routes.
 *
 * Mounted at /api/platform. authenticate → requirePlatformAdmin; NO
 * resolveTenant (this surface is deliberately tenant-context-free — every
 * query scopes itself explicitly and mutations are audit-logged).
 */
const router = Router();

router.use(authenticate);
router.use(requirePlatformAdmin());

router.get('/tenants', listPlatformTenants);
router.get('/attention', listAttentionTenants);
router.get('/tenants/:tenantId', getPlatformTenant);
router.patch('/tenants/:tenantId', updatePlatformTenant);

export default router;
