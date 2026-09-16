import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  listInventoryItems,
  createInventoryItem,
  importInventoryItems,
  getInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  recordStockTransaction,
  listTransactions,
  getLowStockAlerts,
  getValuationReport,
  getConsumptionReport,
} from '../controllers/inventory.controller';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requirePermission, requireRoleOrHigher } from '../middleware/rbac';

const router = Router();

// Authenticated staff identity; tenant scopes every query. Kitchen can read
// stock and record movements; structural changes (items CRUD) are MANAGER+.
router.use(authenticate);
router.use(resolveTenant);

// Alerts & reports — literal prefixes declared before /items/:id so they can't be shadowed
router.get('/alerts/low-stock', requirePermission('inventory:read'), getLowStockAlerts);
router.get('/reports/valuation', requirePermission('inventory:read'), getValuationReport);
router.get('/reports/consumption', requirePermission('inventory:read'), getConsumptionReport);

// Inventory items
router.get('/items', requirePermission('inventory:read'), listInventoryItems);
router.post('/items', requireRoleOrHigher(UserRole.MANAGER), createInventoryItem);
// S3.1 — CSV batch import MUST precede /items/:id or "import" binds as an id.
router.post('/items/import', requireRoleOrHigher(UserRole.MANAGER), importInventoryItems);
router.get('/items/:id/transactions', requirePermission('inventory:read'), listTransactions);
router.post(
  '/items/:id/transactions',
  requirePermission('inventory:update:stock'),
  recordStockTransaction,
);
router.get('/items/:id', requirePermission('inventory:read'), getInventoryItem);
router.patch('/items/:id', requireRoleOrHigher(UserRole.MANAGER), updateInventoryItem);
router.delete('/items/:id', requireRoleOrHigher(UserRole.MANAGER), deleteInventoryItem);

export default router;