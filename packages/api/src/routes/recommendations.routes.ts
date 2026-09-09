import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { getRecommendations } from '../controllers/recommendation.controller';

const router = Router();
// Week 20.5 — personalized menu recommendations for the signed-in diner.
router.use(authenticate);
router.use(resolveTenant);

router.get('/', getRecommendations);

export default router;
