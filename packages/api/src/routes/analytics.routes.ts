import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requirePermission, requireRoleOrHigher } from '../middleware/rbac';
import {
  getSalesAnalytics,
  getInventoryAnalytics,
  getCustomerAnalytics,
  exportReport,
  streamAnalytics,
  listReportTemplates,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
} from '../controllers/analytics.controller';

const router = Router();

// Week 19 — analytics are a staff/management surface. `analytics:read` sits in
// the MANAGER role matrix (ADMIN holds '*'); template writes are MANAGER+.
router.use(authenticate);
router.use(resolveTenant);
router.use(requirePermission('analytics:read'));

router.get('/sales', getSalesAnalytics);
router.get('/inventory', getInventoryAnalytics);
router.get('/customers', getCustomerAnalytics);
router.get('/export', exportReport);
router.get('/stream', streamAnalytics);

// Literal `/templates` paths are declared before any `/:id`-style routes.
router.get('/templates', listReportTemplates);
router.post('/templates', requireRoleOrHigher(UserRole.MANAGER), createReportTemplate);
router.patch('/templates/:id', requireRoleOrHigher(UserRole.MANAGER), updateReportTemplate);
router.delete('/templates/:id', requireRoleOrHigher(UserRole.MANAGER), deleteReportTemplate);

export default router;