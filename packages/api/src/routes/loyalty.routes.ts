import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { getMyLoyalty } from '../controllers/loyalty.controller';

const router = Router();
// Week 20.3 — loyalty is read-only self-service (accrual/redemption are
// woven into the order lifecycle).
router.use(authenticate);
router.use(resolveTenant);

router.get('/me', getMyLoyalty);

export default router;
