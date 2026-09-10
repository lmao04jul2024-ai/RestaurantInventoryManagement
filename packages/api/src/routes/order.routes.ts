import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  createOrder,
  listOrders,
  getOrder,
  updateOrder,
  updateOrderStatus,
  cancelOrder,
  updateOrderItemStatus,
  payOrder,
  kitchenQueue,
  kitchenAnalytics,
  getKitchenSettings,
  updateKitchenSettings,
  assignOrderStaff,
  unassignOrderStaff,
  orderSummary,
  streamOrderEvents,
} from '../controllers/order.controller';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requireAnyPermission, requirePermission, requireRoleOrHigher } from '../middleware/rbac';

const router = Router();

// Every tenant member may read orders; CUSTOMER rows are narrowed to their own
// inside the controller. Mutations require staff (SERVER and above); the status
// and KDS-line endpoints key off the `order:update:status` permission so KITCHEN
// staff qualify without holding broader order rights. Payment collection is
// staff (`order:create`) — plus CUSTOMERs self-settling their own tickets
// (`order:create:own`) through the simulated gateway (Week 10).
router.use(authenticate);
router.use(resolveTenant);

router.get('/', requireAnyPermission('order:read', 'order:read:own'), listOrders);
router.post('/', requireAnyPermission('order:create', 'order:create:own'), createOrder);

// Sub-actions before /:id-like patterns for legibility.
router.get('/kitchen', requirePermission('order:read'), kitchenQueue);
// Week 21.3/21.4/21.5 — prep analytics + kitchen knobs (writes are MANAGER+).
router.get('/kitchen/analytics', requirePermission('order:read'), kitchenAnalytics);
router.get('/kitchen/settings', requirePermission('order:read'), getKitchenSettings);
router.patch('/kitchen/settings', requireRoleOrHigher(UserRole.MANAGER), updateKitchenSettings);
router.get('/reports/summary', requireRoleOrHigher(UserRole.MANAGER), orderSummary);
router.get('/stream', requirePermission('order:read'), streamOrderEvents);

router.get('/:id', requireAnyPermission('order:read', 'order:read:own'), getOrder);
router.patch('/:id', requireRoleOrHigher(UserRole.SERVER), updateOrder);
router.patch('/:id/status', requirePermission('order:update:status'), updateOrderStatus);
// Week 21.2 — staff assignment (kitchen+ via the `order:assign` permission).
router.post('/:id/assign', requirePermission('order:assign'), assignOrderStaff);
router.delete('/:id/assign', requirePermission('order:assign'), unassignOrderStaff);
router.post('/:id/cancel', requireRoleOrHigher(UserRole.SERVER), cancelOrder);
router.patch('/:id/items/:itemId/status', requirePermission('order:update:status'), updateOrderItemStatus);
router.post('/:id/pay', requireAnyPermission('order:create', 'order:create:own'), payOrder);

export default router;