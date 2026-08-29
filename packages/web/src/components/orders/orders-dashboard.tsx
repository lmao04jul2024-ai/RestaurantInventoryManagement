'use client';

import { useState } from 'react';
import Card from '@/components/ui/card';
import NewOrderPanel from '@/components/orders/new-order-panel';
import OrdersPanel from '@/components/orders/orders-panel';
import { useOrderSummary } from '@/hooks/use-orders';

const TABS = [
  { key: 'orders', label: 'Orders' },
  { key: 'new', label: 'New Order' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/** Week 9 — Order Processing dashboard (9.1–9.6). */
export default function OrdersDashboard() {
  const [tab, setTab] = useState<TabKey>('orders');
  const { data: summary } = useOrderSummary(7);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="mt-1 text-sm text-content-muted">
          Order taking, status workflow and payments — Week 9.
        </p>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-wide text-content-muted">Orders (7d)</p>
            <p className="mt-1 text-2xl font-bold">{summary.totalOrders}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-content-muted">Paid revenue (7d)</p>
            <p className="mt-1 text-2xl font-bold">${summary.paidRevenue.toFixed(2)}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-content-muted">Avg order value</p>
            <p className="mt-1 text-2xl font-bold">${summary.averageOrderValue.toFixed(2)}</p>
          </Card>
        </div>
      )}

      <div role="tablist" aria-label="Order sections" className="flex gap-1 border-b border-gray-100">
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
        {tab === 'orders' && <OrdersPanel />}
        {tab === 'new' && <NewOrderPanel />}
      </div>
    </div>
  );
}
