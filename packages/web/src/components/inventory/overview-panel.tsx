'use client';

import Alert from '@/components/ui/alert';
import Card from '@/components/ui/card';
import { useConsumptionReport, useLowStockAlerts, useValuationReport } from '@/hooks/use-inventory';

/** Week 8 — overview: low-stock alerts (8.2), valuation & consumption (8.6). */
export default function OverviewPanel() {
  const alerts = useLowStockAlerts();
  const valuation = useValuationReport();
  const consumption = useConsumptionReport();

  const alertRows = alerts.data ?? [];
  const lowCount = alertRows.filter((a) => a.status === 'LOW').length;
  const outCount = alertRows.filter((a) => a.status === 'OUT_OF_STOCK').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-content-muted">Low-stock alerts</p>
          <p className="mt-1 text-3xl font-bold">
            {lowCount + outCount}
            <span className="ml-2 text-sm font-medium text-content-muted">items need reordering</span>
          </p>
        </Card>
        <Card>
          <p className="text-sm text-content-muted">Stock valuation</p>
          <p className="mt-1 text-3xl font-bold">
            {valuation.isLoading ? '…' : `$${valuation.data?.totalValue.toFixed(2) ?? '0.00'}`}
            <span className="ml-2 text-sm font-medium text-content-muted">
              {valuation.data?.itemCount ?? 0} active items
            </span>
          </p>
        </Card>
        <Card>
          <p className="text-sm text-content-muted">Usage tracked (30d)</p>
          <p className="mt-1 text-3xl font-bold">
            {consumption.isLoading ? '…' : `${consumption.data?.items.length ?? 0}`}
            <span className="ml-2 text-sm font-medium text-content-muted">items consumed</span>
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Reorder list</h2>
        <p className="mt-0.5 text-sm text-content-muted">
          Active items at or below their minimum stock level (8.2).
        </p>

        {alerts.isLoading && <p className="mt-3 text-sm text-content-muted">Loading alerts…</p>}
        {alertRows.length === 0 && !alerts.isLoading && (
          <div className="mt-3"><Alert tone="success" title="All stocked up">No items below their minimum stock.</Alert></div>
        )}

        {alertRows.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-50">
            {alertRows.map((a) => (
              <li key={a.itemId} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    {a.name}{' '}
                    <span className="text-xs text-content-muted">{a.sku}</span>
                  </p>
                  <p className="text-xs text-content-muted">
                    {a.currentStock} {a.unit} on hand · min {a.minStock} · supplier {a.supplierName ?? '—'}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    a.status === 'OUT_OF_STOCK' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {a.status.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Consumption leaders</h2>
        <p className="mt-0.5 text-sm text-content-muted">Most-used items over the last 30 days (USAGE transactions).</p>
        {consumption.data && consumption.data.items.length > 0 ? (
          <ul className="mt-4 divide-y divide-gray-50">
            {consumption.data.items.slice(0, 5).map((c) => (
              <li key={c.item.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{c.item.name}</p>
                  <p className="text-xs text-content-muted">{c.item.sku}</p>
                </div>
                <span className="text-content-muted">{c.totalUsed} {c.item.unit} used</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-content-muted">
            {consumption.isLoading ? 'Loading…' : 'No USAGE transactions recorded yet.'}
          </p>
        )}
      </Card>
    </div>
  );
}