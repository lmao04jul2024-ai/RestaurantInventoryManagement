import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import {
  createGroupOrder,
  listMyGroupOrders,
  getGroupByCode,
  addGroupItem,
  removeGroupItem,
  convertGroupOrder,
  cancelGroupOrder,
} from '../controllers/group-order.controller';

const router = Router();
// Week 20.2 — group ordering is a customer-self-service surface (CUSTOMER /
// any authenticated member of the tenant may create or join groups).
router.use(authenticate);
router.use(resolveTenant);

router.post('/', createGroupOrder);
router.get('/me', listMyGroupOrders);
router.get('/code/:code', getGroupByCode);
router.post('/:id/items', addGroupItem);
router.delete('/:id/items/:itemId', removeGroupItem);
router.post('/:id/convert', convertGroupOrder);
router.post('/:id/cancel', cancelGroupOrder);

export default router;
