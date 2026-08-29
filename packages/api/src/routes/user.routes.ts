import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import {
  getMyProfile,
  updateMyProfile,
  getUserById,
} from '../controllers/user.controller';

const router = Router();

// Profile self-service (customer & staff alike)
router.use(authenticate);
router.use(resolveTenant);

router.get('/me', getMyProfile);
router.patch('/me', updateMyProfile);

// Staff: look up another user within the tenant
router.get('/:id', requirePermission('staff:read'), getUserById);

export default router;