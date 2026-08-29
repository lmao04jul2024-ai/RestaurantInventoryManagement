'use client';

import { useState } from 'react';
import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import { getApiErrorMessage } from '@/lib/api';
import { useCreateSupplier, useDeleteSupplier, useSuppliers } from '@/hooks/use-inventory';

/** Week 8 — supplier registry (8.3): read/write and reference-guarded deletes. */
export default function SuppliersPanel() {
  const { data: suppliers = [], isLoading, isError } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Supplier name is required');
      return;
    }
    try {
      await createSupplier.mutateAsync({ name: name.trim(), contactName: contactName.trim() || null, phone: phone.trim() || null });
      setName('');
      setContactName('');
      setPhone('');
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleDelete = async (id: string, supplierName: string) => {
    if (!window.confirm(`Delete supplier "${supplierName}"? This fails if it has items or purchase orders.`)) return;
    try {
      await deleteSupplier.mutateAsync(id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Suppliers</h2>
      </div>

      {isError && <Alert tone="error" title="Could not load suppliers">Check the API connection.</Alert>}
      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

      <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Input label="Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fresh Farms Co" />
        <Input label="Contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Ana Reyes" />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+15550001" />
        <div className="flex items-end">
          <Button type="submit" isLoading={createSupplier.isPending}>Add</Button>
        </div>
      </form>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-content-muted">
            <tr>
              <th className="pb-2 pr-4 font-semibold">Name</th>
              <th className="pb-2 pr-4 font-semibold">Contact</th>
              <th className="pb-2 pr-4 font-semibold">Phone</th>
              <th className="pb-2 pr-4 font-semibold">Items / POs</th>
              <th className="pb-2 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && <tr><td className="py-4 text-content-muted">Loading suppliers…</td></tr>}
            {!isLoading && suppliers.length === 0 && (
              <tr><td className="py-4 text-content-muted">No suppliers yet — add one above.</td></tr>
            )}
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td className="py-3 pr-4 font-medium">{s.name}</td>
                <td className="py-3 pr-4 text-content-muted">{s.contactName ?? '—'}</td>
                <td className="py-3 pr-4 text-content-muted">{s.phone ?? '—'}</td>
                <td className="py-3 pr-4 text-content-muted">
                  {s._count?.inventory} / {s._count?.purchaseOrders}
                </td>
                <td className="py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deleteSupplier.isPending}
                    onClick={() => handleDelete(s.id, s.name)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}