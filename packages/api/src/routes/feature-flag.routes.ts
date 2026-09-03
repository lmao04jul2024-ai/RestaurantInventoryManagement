import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import { attachFeatureFlags } from '../middleware/feature-flag';
import {
  listFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  getFeatureConfig,
  updateFeatureConfig,
} from '../controllers/feature-flag.controller';

const router = Router();

// Every flag operation resolves the tenant scope first and materializes the
// effective map (handlers/gates read req.featureFlags).
router.use(authenticate);
router.use(resolveTenant);
router.use(attachFeatureFlags);

// Global registry management — MANAGER+ only.
router.get('/', requirePermission('feature-flag:read'), listFeatureFlags);
router.post('/', requirePermission('feature-flag:manage'), createFeatureFlag);
router.patch('/:id', requirePermission('feature-flag:manage'), updateFeatureFlag);
router.delete('/:id', requirePermission('feature-flag:manage'), deleteFeatureFlag);

// Tenant-level configuration: the effective map is safe for any authenticated
// user (customers consume it in the shop); writing overrides stays MANAGER+.
// Literal `/config` is declared before `/:id` so it never matches a flag id.
router.get('/config', getFeatureConfig);
router.patch('/config', requirePermission('feature-flag:manage'), updateFeatureConfig);

export default router;