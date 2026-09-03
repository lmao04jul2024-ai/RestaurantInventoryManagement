import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requireAnyPermission, requirePermission, requireRoleOrHigher } from '../middleware/rbac';
import { attachFeatureFlags, requireFeature } from '../middleware/feature-flag';
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

// Effective feature map → gate needs the tenant's override state.
router.use(attachFeatureFlags);

// 11.3 — customer creates a review for their own COMPLETED order.
// Week 14 — route protection: a restaurant can disable customer reviews by
// turning off the `customer_reviews` flag (tenant override or global default).
router.post(
  '/',
  requireFeature('customer_reviews'),
  requireAnyPermission('review:create:own', 'review:moderate'),
  createReview,
);

// 11.5 — customer views their own reviews.
router.get('/me', requirePermission('review:read:own'), listMyReviews);

// 11.4 — staff moderation endpoints.
router.get('/', requireAnyPermission('review:read', 'review:moderate'), listReviews);
router.patch('/:id/visibility', requirePermission('review:moderate'), setReviewVisibility);

// 11.4 — staff deletes a review.
router.delete('/:id', requireRoleOrHigher(UserRole.MANAGER), deleteReview);

export default router;