import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import { createStaff, listStaff, updateStaff } from '../controllers/staff.controller';

const router = Router();

// Staff management operates on the resolved tenant's users.
router.use(authenticate);
router.use(resolveTenant);

// 16.5 — directory is viewable by MANAGER+; mutations need staff:manage
// (ADMIN + MANAGER). Role changes additionally require ADMIN — enforced in
// the controller, since the same PATCH endpoint carries profile edits.
router.get('/', requirePermission('staff:read'), listStaff);
router.post('/', requirePermission('staff:manage'), createStaff);
router.patch('/:id', requirePermission('staff:manage'), updateStaff);

export default router;
