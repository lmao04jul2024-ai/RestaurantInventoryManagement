import { Router } from 'express';
import {
  listMenus,
  createMenu,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/menu.controller';
import {
  listMenuItems,
  createMenuItem,
  getMenuItem,
  updateMenuItem,
  updateItemAvailability,
  deleteMenuItem,
  getEffectivePrice,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  createAvailabilityWindow,
  updateAvailabilityWindow,
  deleteAvailabilityWindow,
} from '../controllers/menu-item.controller';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requirePermission, requireRoleOrHigher } from '../middleware/rbac';
import { UserRole } from '@prisma/client';

const router = Router();

// Every menu operation requires an authenticated staff/customer identity whose
// tenant scopes every query; writes additionally require MANAGER-or-higher.
router.use(authenticate);
router.use(resolveTenant);

// Menus
router.get('/', requirePermission('menu:read'), listMenus);
router.post('/', requireRoleOrHigher(UserRole.MANAGER), createMenu);

// Literal segments first so they never shadow :menuId params
router.get('/items', requirePermission('menu:read'), listMenuItems);
router.post('/items', requireRoleOrHigher(UserRole.MANAGER), createMenuItem);
router.get('/items/:id/effective', requirePermission('menu:read'), getEffectivePrice);
router.get('/items/:id', requirePermission('menu:read'), getMenuItem);
router.patch('/items/:id', requireRoleOrHigher(UserRole.MANAGER), updateMenuItem);
router.patch(
  '/items/:id/availability',
  requireRoleOrHigher(UserRole.MANAGER),
  updateItemAvailability,
);
router.delete('/items/:id', requireRoleOrHigher(UserRole.MANAGER), deleteMenuItem);

// Pricing rules & availability windows live under their item
router.post(
  '/items/:id/pricing-rules',
  requireRoleOrHigher(UserRole.MANAGER),
  createPricingRule,
);
router.patch(
  '/items/:id/pricing-rules/:ruleId',
  requireRoleOrHigher(UserRole.MANAGER),
  updatePricingRule,
);
router.delete(
  '/items/:id/pricing-rules/:ruleId',
  requireRoleOrHigher(UserRole.MANAGER),
  deletePricingRule,
);
router.post(
  '/items/:id/availability-windows',
  requireRoleOrHigher(UserRole.MANAGER),
  createAvailabilityWindow,
);
router.patch(
  '/items/:id/availability-windows/:windowId',
  requireRoleOrHigher(UserRole.MANAGER),
  updateAvailabilityWindow,
);
router.delete(
  '/items/:id/availability-windows/:windowId',
  requireRoleOrHigher(UserRole.MANAGER),
  deleteAvailabilityWindow,
);

// Categories (scoped to a menu)
router.get('/:menuId/categories', requirePermission('menu:read'), listCategories);
router.post('/:menuId/categories', requireRoleOrHigher(UserRole.MANAGER), createCategory);
router.patch('/categories/:id', requireRoleOrHigher(UserRole.MANAGER), updateCategory);
router.delete('/categories/:id', requireRoleOrHigher(UserRole.MANAGER), deleteCategory);

export default router;