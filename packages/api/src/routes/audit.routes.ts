import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requireRole } from '../middleware/rbac';
import { getAuditLogs } from '../controllers/staff.controller';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// 16.6 — the immutable audit trail is read-only and ADMIN-gated.
router.get('/', requireRole(UserRole.ADMIN), getAuditLogs);

export default router;
