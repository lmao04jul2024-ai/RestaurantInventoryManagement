jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import api from '@/lib/api';
import { inventoryService } from '@/services/inventory.service';

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;
const apiPatch = api.patch as jest.Mock;
const apiDelete = api.delete as jest.Mock;

describe('inventoryService — Week 8 endpoint contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists items against /inventory/items and unwraps the envelope', async () => {
    apiGet.mockResolvedValue({ data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });

    const result = await inventoryService.listItems({ page: 1, limit: 50 });

    expect(apiGet).toHaveBeenCalledWith('/inventory/items', { params: { page: 1, limit: 50 } });
    expect(result.data).toEqual([]);
  });

  it('creates an item via POST /inventory/items', async () => {
    apiPost.mockResolvedValue({ data: { data: { id: 'item-1', sku: 'FL-1' } } });

    const item = await inventoryService.createItem({ name: 'Flour', sku: 'FL-1', minStock: 4 });

    expect(apiPost).toHaveBeenCalledWith('/inventory/items', { name: 'Flour', sku: 'FL-1', minStock: 4 });
    expect(item.id).toBe('item-1');
  });

  it('records stock movements via the item transactions endpoint', async () => {
    apiPost.mockResolvedValue({ data: { data: { transaction: { id: 'tx-1' }, currentStock: 12 } } });

    const result = await inventoryService.recordTransaction('item-1', {
      transactionType: 'RESTOCK',
      quantity: 2,
    });

    expect(apiPost).toHaveBeenCalledWith('/inventory/items/item-1/transactions', {
      transactionType: 'RESTOCK',
      quantity: 2,
    });
    expect(result.currentStock).toBe(12);
  });

  it('fetches low-stock alerts from the dedicated route', async () => {
    apiGet.mockResolvedValue({
      data: { data: [{ itemId: 'item-1', status: 'LOW', currentStock: 2, minStock: 4 }] },
    });

    const alerts = await inventoryService.getLowStockAlerts();

    expect(apiGet).toHaveBeenCalledWith('/inventory/alerts/low-stock');
    expect(alerts[0]).toMatchObject({ status: 'LOW' });
  });

  it('creates suppliers via POST /suppliers', async () => {
    apiPost.mockResolvedValue({ data: { data: { id: 'sup-1', name: 'Fresh Farms Co' } } });

    const supplier = await inventoryService.createSupplier({ name: 'Fresh Farms Co' });

    expect(apiPost).toHaveBeenCalledWith('/suppliers', { name: 'Fresh Farms Co' });
    expect(supplier.name).toBe('Fresh Farms Co');
  });

  it('submits purchase orders via POST /purchase-orders/:id/submit', async () => {
    apiPost.mockResolvedValue({ data: { data: { id: 'po-1', status: 'SUBMITTED' } } });

    const po = await inventoryService.submitPurchaseOrder('po-1');

    expect(apiPost).toHaveBeenCalledWith('/purchase-orders/po-1/submit');
    expect(po.status).toBe('SUBMITTED');
  });

  it('receives purchase orders via POST /purchase-orders/:id/receive', async () => {
    apiPost.mockResolvedValue({ data: { data: { id: 'po-1', status: 'PARTIALLY_RECEIVED' } } });

    const po = await inventoryService.receivePurchaseOrder('po-1', {
      items: [{ itemId: 'pol-1', quantity: 3 }],
    });

    expect(apiPost).toHaveBeenCalledWith('/purchase-orders/po-1/receive', {
      items: [{ itemId: 'pol-1', quantity: 3 }],
    });
    expect(po.status).toBe('PARTIALLY_RECEIVED');
  });

  it('deletes items via DELETE /inventory/items/:id', async () => {
    apiDelete.mockResolvedValue({});

    await inventoryService.deleteItem('item-1');

    expect(apiDelete).toHaveBeenCalledWith('/inventory/items/item-1');
  });

  it('updates suppliers via PATCH /suppliers/:id', async () => {
    apiPatch.mockResolvedValue({ data: { data: { id: 'sup-1', phone: '+123' } } });

    const supplier = await inventoryService.updateSupplier('sup-1', { phone: '+123' });

    expect(apiPatch).toHaveBeenCalledWith('/suppliers/sup-1', { phone: '+123' });
    expect(supplier.phone).toBe('+123');
  });
});