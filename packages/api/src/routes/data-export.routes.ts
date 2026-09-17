import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { exportTenantData } from '../controllers/data-export.controller';

/**
 * S3.2 — tenant data export (churn-safety).
 *
 * Authenticated + tenant-scoped; the export is always keyed on the JWT's
 * tenant, so a member of workspace A can never pull workspace B's data through
 * this surface (the tenant-scoped Prisma client enforces the same isolation).
 */
const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', exportTenantData);

export default router;