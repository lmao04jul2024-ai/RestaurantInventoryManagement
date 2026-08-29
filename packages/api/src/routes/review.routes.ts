import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requireAnyPermission, requirePermission, requireRoleOrHigher } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import {
  createReview,
  listMyReviews,
  listReviews,
  setReviewVisibility,
  deleteReview,
} from '../controllers/review.controller';

const router = Router();

// All review endpoints require authentication + tenant context.
router.use(authenticate);
router.use(resolveTenant);

// 11.3 — customer creates a review for their own COMPLETED order.
router.post('/', requireAnyPermission('review:create:own', 'review:moderate'), createReview);

// 11.5 — customer views their own reviews.
router.get('/me', requirePermission('review:read:own'), listMyReviews);

// 11.4 — staff moderation endpoints.
router.get('/', requireAnyPermission('review:read', 'review:moderate'), listReviews);
router.patch('/:id/visibility', requirePermission('review:moderate'), setReviewVisibility);

// 11.4 — staff deletes a review.
router.delete('/:id', requireRoleOrHigher(UserRole.MANAGER), deleteReview);

export default router;