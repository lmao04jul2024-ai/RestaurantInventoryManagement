import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requireRoleOrHigher } from '../middleware/rbac';
import {
  validatePromo,
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} from '../controllers/promo.controller';

const router = Router();
// Week 20.4 — validation is open to any authenticated member (customers
// preview discounts at checkout); code management is MANAGER+.
router.use(authenticate);
router.use(resolveTenant);

router.post('/validate', validatePromo);
router.get('/', requireRoleOrHigher(UserRole.MANAGER), listPromoCodes);
router.post('/', requireRoleOrHigher(UserRole.MANAGER), createPromoCode);
router.patch('/:id', requireRoleOrHigher(UserRole.MANAGER), updatePromoCode);
router.delete('/:id', requireRoleOrHigher(UserRole.MANAGER), deletePromoCode);

export default router;
