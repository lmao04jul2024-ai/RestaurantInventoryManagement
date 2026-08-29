import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  listSuppliers,
  createSupplier,
  getSupplier,
  updateSupplier,
  deleteSupplier,
  listSupplierItems,
} from '../controllers/supplier.controller';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requirePermission, requireRoleOrHigher } from '../middleware/rbac';

const router = Router();

// Supplier data is management territory (matrix: supplier:* is MANAGER+ only);
// reads use supplier:read so the check stays explicit even for higher roles.
router.use(authenticate);
router.use(resolveTenant);

router.get('/', requirePermission('supplier:read'), listSuppliers);
router.post('/', requireRoleOrHigher(UserRole.MANAGER), createSupplier);

// Literal segment before /:id so it is never shadowed
router.get('/:id/items', requirePermission('supplier:read'), listSupplierItems);
router.get('/:id', requirePermission('supplier:read'), getSupplier);
router.patch('/:id', requireRoleOrHigher(UserRole.MANAGER), updateSupplier);
router.delete('/:id', requireRoleOrHigher(UserRole.MANAGER), deleteSupplier);

export default router;