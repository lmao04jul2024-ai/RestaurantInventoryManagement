import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requireRoleOrHigher } from '../middleware/rbac';
import {
  listMyRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  runDueRecurring,
} from '../controllers/recurring.controller';

const router = Router();
// Week 20.6 — customers manage their own subscriptions; the run-due job is
// a MANAGER+ (or cron) surface.
router.use(authenticate);
router.use(resolveTenant);

router.get('/', listMyRecurring);
router.post('/', createRecurring);
router.patch('/:id', updateRecurring);
router.delete('/:id', deleteRecurring);
router.post('/run-due', requireRoleOrHigher(UserRole.MANAGER), runDueRecurring);

export default router;
