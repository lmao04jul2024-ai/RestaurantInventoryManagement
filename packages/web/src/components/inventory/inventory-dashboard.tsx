'use client';

import { useState } from 'react';
import ItemsPanel from '@/components/inventory/items-panel';
import OverviewPanel from '@/components/inventory/overview-panel';
import PurchaseOrdersPanel from '@/components/inventory/purchase-orders-panel';
import SuppliersPanel from '@/components/inventory/suppliers-panel';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'items', label: 'Items' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'purchase-orders', label: 'Purchase Orders' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/** Week 8 — Inventory Management dashboard (8.1–8.6). */
export default function InventoryDashboard() {
  const [tab, setTab] = useState<TabKey>('overview');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory management</h1>
        <p className="mt-1 text-sm text-content-muted">
          Stock levels, suppliers, purchase orders and reordering — Week 8.
        </p>
      </div>

      <div role="tablist" aria-label="Inventory sections" className="flex gap-1 border-b border-gray-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-content-muted hover:text-content-default'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'overview' && <OverviewPanel />}
        {tab === 'items' && <ItemsPanel />}
        {tab === 'suppliers' && <SuppliersPanel />}
        {tab === 'purchase-orders' && <PurchaseOrdersPanel />}
      </div>
    </div>
  );
}