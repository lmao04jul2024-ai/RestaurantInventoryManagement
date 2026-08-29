'use client';

import { useState } from 'react';
import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import { getApiErrorMessage } from '@/lib/api';
import {
  useCancelPurchaseOrder,
  useCreatePurchaseOrder,
  useItems,
  usePurchaseOrders,
  useReceivePurchaseOrder,
  useSubmitPurchaseOrder,
  useSuppliers,
} from '@/hooks/use-inventory';
import type { PurchaseOrder } from '@/types/inventory';

/** Week 8 — purchase order lifecycle (8.5): create, submit, cancel, receive. */
export default function PurchaseOrdersPanel() {
  const { data, isLoading, isError } = usePurchaseOrders({ limit: 50 });
  const orders = data?.data ?? [];
  const { data: suppliers = [] } = useSuppliers();
  const { data: itemsData } = useItems({ limit: 100 });
  const items = itemsData?.data ?? [];

  const createPo = useCreatePurchaseOrder();
  const submitPo = useSubmitPurchaseOrder();
  const cancelPo = useCancelPurchaseOrder();
  const receivePo = useReceivePurchaseOrder();

  // New-PO form
  const [supplierId, setSupplierId] = useState('');
  const [lineItemId, setLineItemId] = useState('');
  const [lineQty, setLineQty] = useState('1');
  const [lines, setLines] = useState<Array<{ inventoryItemId: string; quantityOrdered: number }>>([]);
  const [receiving, setReceiving] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const addLine = () => {
    setError(null);
    const qty = Number(lineQty);
    if (!lineItemId) {
      setError('Choose an inventory item first');
      return;
    }
    if (!qty || qty <= 0) {
      setError('Line quantity must be positive');
      return;
    }
    if (lines.some((l) => l.inventoryItemId === lineItemId)) {
      setError('That item is already on this order — pick another or adjust the quantity');
      return;
    }
    setLines((prev) => [...prev, { inventoryItemId: lineItemId, quantityOrdered: qty }]);
    setLineItemId('');
    setLineQty('1');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supplierId) {
      setError('Choose a supplier');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one item line');
      return;
    }
    try {
      await createPo.mutateAsync({ supplierId, items: lines });
      setSupplierId('');
      setLines([]);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? '(item)';

  const handleReceive = async (po: PurchaseOrder) => {
    const qty = receiving[po.id];
    if (!qty || Number(qty) <= 0) {
      setError('Enter a receive quantity on the line you want to receive against');
      return;
    }
    const line = po.items?.[0];
    if (!line) {
      setError('This order has no lines to receive');
      return;
    }
    try {
      await receivePo.mutateAsync({
        id: po.id,
        payload: { items: [{ itemId: line.id, quantity: Number(qty) }] },
      });
      setReceiving((prev) => ({ ...prev, [po.id]: '' }));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Purchase orders</h2>
      </div>

      {isError && <Alert tone="error" title="Could not load purchase orders">Check the API connection.</Alert>}
      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

      <form onSubmit={handleCreate} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-content-default">Supplier *</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="block w-full rounded border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              <option value="">— choose —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-content-default">Item</label>
            <select
              value={lineItemId}
              onChange={(e) => setLineItemId(e.target.value)}
              className="block w-full rounded border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              <option value="">— choose —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
              ))}
            </select>
          </div>
          <Input label="Qty" type="number" min="0" step="0.001" value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={addLine}>+ Add line</Button>
          </div>
        </div>

        {lines.length > 0 && (
          <ul className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
            {lines.map((l) => (
              <li key={l.inventoryItemId} className="flex items-center justify-between py-1">
                <span>{itemName(l.inventoryItemId)}</span>
                <span className="text-content-muted">qty {l.quantityOrdered}</span>
              </li>
            ))}
          </ul>
        )}

        <Button type="submit" isLoading={createPo.isPending}>Create purchase order (draft)</Button>
      </form>
<div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-content-muted">
            <tr>
              <th className="pb-2 pr-4 font-semibold">Order</th>
              <th className="pb-2 pr-4 font-semibold">Supplier</th>
              <th className="pb-2 pr-4 font-semibold">Status</th>
              <th className="pb-2 pr-4 font-semibold">Lines</th>
              <th className="pb-2 pr-4 font-semibold">Receive</th>
              <th className="pb-2 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && <tr><td className="py-4 text-content-muted">Loading orders…</td></tr>}
            {!isLoading && orders.length === 0 && (
              <tr><td className="py-4 text-content-muted">No purchase orders yet.</td></tr>
            )}
            {orders.map((po) => {
              const receivable = po.status === 'SUBMITTED' || po.status === 'PARTIALLY_RECEIVED';
              const line = po.items?.[0];
              return (
                <tr key={po.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium">{po.orderNumber}</p>
                    <p className="text-xs text-content-muted">{new Date(po.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="py-3 pr-4 text-content-muted">{po.supplier?.name ?? '—'}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="py-3 pr-4 text-content-muted">
                    {po._count?.items ?? po.items?.length ?? 0}
                  </td>
                  <td className="py-3 pr-4">
                    {receivable && line && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          className="w-20"
                          aria-label={`Receive quantity for ${po.orderNumber}`}
                          value={receiving[po.id] ?? ''}
                          onChange={(e) => setReceiving((prev) => ({ ...prev, [po.id]: e.target.value }))}
                          placeholder="qty"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={receivePo.isPending}
                          onClick={() => handleReceive(po)}
                        >
                          Receive
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {po.status === 'DRAFT' && (
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" disabled={submitPo.isPending} onClick={() => submitPo.mutate(po.id)}>
                          Submit
                        </Button>
                        <Button variant="ghost" size="sm" disabled={cancelPo.isPending} onClick={() => cancelPo.mutate(po.id)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                    {po.status === 'SUBMITTED' && (
                      <Button variant="ghost" size="sm" disabled={cancelPo.isPending} onClick={() => cancelPo.mutate(po.id)}>
                        Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: PurchaseOrder['status'] }) {
  const styles: Record<PurchaseOrder['status'], string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SUBMITTED: 'bg-blue-50 text-blue-700',
    PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-700',
    RECEIVED: 'bg-green-50 text-green-700',
    CANCELLED: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}