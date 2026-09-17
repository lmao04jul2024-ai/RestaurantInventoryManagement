import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { getMyData, eraseMyData } from '../controllers/gdpr.controller';

/**
 * Week 22.4 — GDPR / privacy self-service (any authenticated user,
 * operating on their own data only; tenant scoping keeps tenants isolated).
 */
const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/data', getMyData);
router.delete('/', eraseMyData);

export default router;
