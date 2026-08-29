'use client';

import { useState } from 'react';
import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import { getApiErrorMessage } from '@/lib/api';
import {
  useCreateItem,
  useDeleteItem,
  useItems,
  useRecordTransaction,
  useSuppliers,
} from '@/hooks/use-inventory';
import type { InventoryItem } from '@/types/inventory';

/** Week 8 — items CRUD (8.1), stock movements (8.1), low-stock badge (8.2). */
export default function ItemsPanel() {
  const { data, isLoading, isError } = useItems({ limit: 50 });
  const items = data?.data ?? [];
  const { data: suppliers = [] } = useSuppliers();
  const createItem = useCreateItem();
  const deleteItem = useDeleteItem();
  const recordTransaction = useRecordTransaction();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [minStock, setMinStock] = useState('0');
  const [costPrice, setCostPrice] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currentValue = (i: InventoryItem) => (i.costPrice ?? 0) * i.currentStock;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !sku.trim()) {
      setError('Name and SKU are required');
      return;
    }
    try {
      await createItem.mutateAsync({
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        minStock: Number(minStock),
        costPrice: costPrice ? Number(costPrice) : null,
        supplierId: supplierId || null,
      });
      setName('');
      setSku('');
      setMinStock('0');
      setCostPrice('');
      setSupplierId('');
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleMove = async (item: InventoryItem, type: 'RESTOCK' | 'USAGE', qty: number) => {
    if (type === 'USAGE' && qty > item.currentStock) {
      setError(`Not enough stock: only ${item.currentStock} ${item.unit} available`);
      return;
    }
    try {
      await recordTransaction.mutateAsync({
        itemId: item.id,
        payload: { transactionType: type, quantity: qty },
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!window.confirm(`Delete item "${item.name}"? This is blocked when it has history — deactivate instead.`)) return;
    try {
      await deleteItem.mutateAsync(item.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Inventory items</h2>
      </div>

      {isError && <Alert tone="error" title="Could not load inventory">Check the API connection.</Alert>}
      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

      <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
        <Input label="Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Flour" />
        <Input label="SKU *" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="FL-001" />
        <Input label="Min stock" type="number" min="0" step="0.001" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
        <Input label="Cost price" type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="2.00" />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-content-default">Supplier</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="block w-full rounded border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <option value="">— none —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" isLoading={createItem.isPending}>Add</Button>
        </div>
      </form>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-content-muted">
            <tr>
              <th className="pb-2 pr-4 font-semibold">Item</th>
              <th className="pb-2 pr-4 font-semibold">Stock</th>
              <th className="pb-2 pr-4 font-semibold">Min</th>
              <th className="pb-2 pr-4 font-semibold">Value</th>
              <th className="pb-2 pr-4 font-semibold">Supplier</th>
              <th className="pb-2 pr-4 font-semibold">Actions</th>
              <th className="pb-2 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && <tr><td className="py-4 text-content-muted">Loading items…</td></tr>}
            {!isLoading && items.length === 0 && (
              <tr><td className="py-4 text-content-muted">No items yet — add one above.</td></tr>
            )}
            {items.map((item) => {
              const low = item.currentStock <= item.minStock;
              return (
                <tr key={item.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-content-muted">{item.sku}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        low ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${low ? 'bg-red-500' : 'bg-green-500'}`} />
                      {item.currentStock} {item.unit}
                    </span>
                    {item.currentStock <= 0 && (
                      <span className="ml-2 text-xs font-medium text-red-600">OUT OF STOCK</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-content-muted">{item.minStock}</td>
                  <td className="py-3 pr-4 text-content-muted">${currentValue(item).toFixed(2)}</td>
                  <td className="py-3 pr-4 text-content-muted">{item.supplier?.name ?? '—'}</td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-1.5">
                      <ActionButton
                        label={`+1 ${item.unit}`}
                        pending={recordTransaction.isPending}
                        onClick={() => handleMove(item, 'RESTOCK', 1)}
                      />
                      <ActionButton
                        label="Use 1"
                        pending={recordTransaction.isPending}
                        onClick={() => handleMove(item, 'USAGE', 1)}
                      />
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleteItem.isPending}
                      onClick={() => handleDelete(item)}
                    >
                      Delete
                    </Button>
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

function ActionButton({
  label,
  pending,
  onClick,
}: {
  label: string;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={onClick}>
      {label}
    </Button>
  );
}