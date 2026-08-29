import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  listPurchaseOrders,
  createPurchaseOrder,
  getPurchaseOrder,
  updatePurchaseOrder,
  submitPurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  deletePurchaseOrder,
} from '../controllers/purchase-order.controller';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requireRoleOrHigher } from '../middleware/rbac';

const router = Router();

// Purchasing is management-only: the whole router requires MANAGER or higher.
router.use(authenticate);
router.use(resolveTenant);
router.use(requireRoleOrHigher(UserRole.MANAGER));

router.get('/', listPurchaseOrders);
router.post('/', createPurchaseOrder);

// Lifecycle actions before /:id-like patterns; Express matches in order anyway,
// but keeping sub-actions grouped makes the lifecycle legible.
router.get('/:id', getPurchaseOrder);
router.patch('/:id', updatePurchaseOrder);
router.post('/:id/submit', submitPurchaseOrder);
router.post('/:id/cancel', cancelPurchaseOrder);
router.post('/:id/receive', receivePurchaseOrder);
router.delete('/:id', deletePurchaseOrder);

export default router;