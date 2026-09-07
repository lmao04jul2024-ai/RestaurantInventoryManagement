'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import Alert from '@/components/ui/alert';
import Input from '@/components/ui/input';
import {
  useCustomerAnalytics,
  useCreateReportTemplate,
  useDeleteReportTemplate,
  useExportReport,
  useInventoryAnalytics,
  useReportTemplates,
  useSalesAnalytics,
} from '@/hooks/use-analytics';
import { getApiErrorMessage } from '@/lib/api';
import { downloadBlob } from '@/services/analytics.service';
import type { ReportType } from '@/types/analytics';

const WINDOWS = [7, 30, 90] as const;
type TabId = 'sales' | 'inventory' | 'customers' | 'reports';
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'sales', label: 'Sales' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'customers', label: 'Customers' },
  { id: 'reports', label: 'Reports' },
];

const SEGMENT =
  'rounded px-3 py-1.5 text-sm font-medium transition-colors aria-selected:bg-primary-50 aria-selected:text-primary-700';

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-content-default">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-content-muted">{sub}</p>}
    </Card>
  );
}

/** Week 19.1 — dependency-free SVG bar chart (no chart lib in the repo). */
function RevenueBars({ points }: { points: Array<{ date: string; revenue: number }> }) {
  const max = Math.max(...points.map((p) => p.revenue), 1);
  const W = 640;
  const H = 140;
  const gap = 4;
  const bw = Math.max(2, W / points.length - gap);
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Daily paid revenue"
        className="h-36 w-full"
        preserveAspectRatio="none"
      >
        {points.map((p, i) => {
          const h = Math.max(1, (p.revenue / max) * (H - 12));
          return (
            <rect
              key={p.date}
              x={i * (bw + gap)}
              y={H - h}
              width={bw}
              height={h}
              className="fill-primary-500"
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-content-muted">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function DayPicker({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div
      className="inline-flex rounded border border-gray-200 bg-surface-muted p-1"
      role="group"
      aria-label="Report window"
    >
      {WINDOWS.map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={days === w}
          onClick={() => onChange(w)}
          className={SEGMENT}
        >
          {w}d
        </button>
      ))}
    </div>
  );
}

function SalesTab({ days }: { days: number }) {
  const { data, isLoading, isError, error } = useSalesAnalytics(days);
  if (isLoading) return <p className="py-8 text-center text-sm text-content-muted">Loading sales…</p>;
  if (isError || !data) return <Alert tone="error" title="Could not load sales">{getApiErrorMessage(error)}</Alert>;

  const statuses = Object.entries(data.byStatus);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Orders" value={String(data.totals.orders)} />
        <Kpi label="Paid revenue" value={`$${data.totals.paidRevenue.toFixed(2)}`} sub={`${data.totals.paidOrders} paid`} />
        <Kpi label="Avg order value" value={`$${data.totals.avgOrderValue.toFixed(2)}`} />
      </div>
      <Card>
        <h2 className="font-semibold">Revenue by day</h2>
        <div className="mt-3"><RevenueBars points={data.revenueByDay} /></div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">By status</h2>
          <ul className="mt-2 space-y-1">
            {statuses.length === 0 && <li className="text-sm text-content-muted">No orders in window.</li>}
            {statuses.map(([status, count]) => (
              <li key={status} className="flex justify-between text-sm">
                <span className="text-content-muted">{status}</span>
                <span className="font-medium">{count}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Top items</h2>
          <ul className="mt-2 space-y-1">
            {data.topItems.length === 0 && <li className="text-sm text-content-muted">No items sold.</li>}
            {data.topItems.map((it) => (
              <li key={it.itemId} className="flex justify-between text-sm">
                <span className="text-content-default">{it.name}</span>
                <span className="font-medium">{it.quantity} × ${it.revenue.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {data.peakHours.length > 0 && (
        <Card>
          <h2 className="font-semibold">Peak hours</h2>
          <p className="mt-1 text-sm text-content-muted">
            {data.peakHours.map((p) => `${String(p.hour).padStart(2, '0')}:00 (${p.orders})`).join(' · ')}
          </p>
        </Card>
      )}
    </div>
  );
}

function InventoryTab({ days }: { days: number }) {
  const { data, isLoading, isError, error } = useInventoryAnalytics(days);
  if (isLoading) return <p className="py-8 text-center text-sm text-content-muted">Loading inventory…</p>;
  if (isError || !data) return <Alert tone="error" title="Could not load inventory">{getApiErrorMessage(error)}</Alert>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Items" value={String(data.totals.items)} sub={`${data.totals.activeItems} active`} />
        <Kpi label="Low stock" value={String(data.totals.lowStock)} />
        <Kpi label="Dead stock" value={String(data.totals.deadStock)} sub="no usage in window" />
        <Kpi label="Valuation (cost)" value={`$${data.totals.valuation.toFixed(2)}`} />
        <Kpi label="Retail value" value={`$${data.totals.retailValue.toFixed(2)}`} />
      </div>
      <Card>
        <h2 className="font-semibold">Low-stock items</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-content-muted">
              <th className="py-1 pr-2 font-medium">Item</th>
              <th className="py-1 pr-2 font-medium">SKU</th>
              <th className="py-1 pr-2 font-medium">Stock</th>
              <th className="py-1 font-medium">Min</th>
            </tr>
          </thead>
          <tbody>
            {data.lowStockItems.map((i) => (
              <tr key={i.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-2">{i.name}</td>
                <td className="py-1.5 pr-2 text-content-muted">{i.sku}</td>
                <td className="py-1.5 pr-2">{i.currentStock} {i.unit}</td>
                <td className="py-1.5">{i.minStock}</td>
              </tr>
            ))}
            {data.lowStockItems.length === 0 && (
              <tr><td colSpan={4} className="py-2 text-content-muted">All stocked.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Top movers (usage)</h2>
          <ul className="mt-2 space-y-1">
            {data.topMovers.map((m) => (
              <li key={m.itemId} className="flex justify-between text-sm">
                <span>{m.name}</span><span className="font-medium">{m.usage}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">By supplier</h2>
          <ul className="mt-2 space-y-1">
            {data.supplierBreakdown.map((s) => (
              <li key={s.supplierId} className="flex justify-between text-sm">
                <span>{s.name}</span><span className="font-medium">{s.items} · ${s.stockValue.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function CustomersTab({ days }: { days: number }) {
  const { data, isLoading, isError, error } = useCustomerAnalytics(days);
  if (isLoading) return <p className="py-8 text-center text-sm text-content-muted">Loading customers…</p>;
  if (isError || !data) return <Alert tone="error" title="Could not load customers">{getApiErrorMessage(error)}</Alert>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Customers" value={String(data.totals.customers)} sub={`${data.totals.newInWindow} new`} />
        <Kpi label="Active" value={String(data.totals.active)} sub={`${data.totals.returning} returning`} />
        <Kpi label="Repeat rate" value={`${data.totals.repeatRatePct}%`} />
        <Kpi label="Avg orders / customer" value={String(data.totals.avgOrdersPerCustomer)} />
        <Kpi label="Avg rating" value={`${data.avgRating} ★`} sub={`${data.reviewCount} reviews`} />
      </div>
      <Card>
        <h2 className="font-semibold">Top customers</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-content-muted">
              <th className="py-1 pr-2 font-medium">Customer</th>
              <th className="py-1 pr-2 font-medium">Orders</th>
              <th className="py-1 font-medium">Spend</th>
            </tr>
          </thead>
          <tbody>
            {data.topCustomers.map((c) => (
              <tr key={c.customerId} className="border-t border-gray-100">
                <td className="py-1.5 pr-2">{c.name}</td>
                <td className="py-1.5 pr-2">{c.orders}</td>
                <td className="py-1.5">${c.spend.toFixed(2)}</td>
              </tr>
            ))}
            {data.topCustomers.length === 0 && (
              <tr><td colSpan={3} className="py-2 text-content-muted">No customer activity.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const EXPORT_LABEL: Record<ReportType, string> = {
  sales: 'Sales',
  inventory: 'Inventory',
  customers: 'Customers',
};

function ReportsTab({ days }: { days: number }) {
  const { data: templates, isLoading: templatesLoading } = useReportTemplates();
  const createTemplate = useCreateReportTemplate();
  const deleteTemplate = useDeleteReportTemplate();
  const exportReport = useExportReport();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runExport = async (type: ReportType, format: 'csv' | 'pdf') => {
    setError(null);
    try {
      const blob = await exportReport.mutateAsync({ type, format, days });
      downloadBlob(blob, `${type}-report-${days}d.${format}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const saveTemplate = async () => {
    setError(null);
    try {
      await createTemplate.mutateAsync({ name: name.trim(), type: 'sales', config: { days } });
      setName('');
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert tone="error" title="Export failed">{error}</Alert>}
      <Card>
        <h2 className="font-semibold">Export ({days} days)</h2>
        <p className="mt-1 text-sm text-content-muted">CSV opens in Excel; PDF is a paginated report.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(EXPORT_LABEL) as ReportType[]).map((type) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span className="text-sm font-medium text-content-default">{EXPORT_LABEL[type]}</span>
              <Button size="sm" variant="outline" aria-label={`Export ${EXPORT_LABEL[type]} as CSV`} onClick={() => runExport(type, 'csv')}>
                CSV
              </Button>
              <Button size="sm" variant="outline" aria-label={`Export ${EXPORT_LABEL[type]} as PDF`} onClick={() => runExport(type, 'pdf')}>
                PDF
              </Button>
            </span>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Saved templates</h2>
        <p className="mt-1 text-sm text-content-muted">Save the current window as a reusable report.</p>
        <div className="mt-3 flex gap-2">
          <Input label="Template name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly wrap" />
          <div className="flex items-end">
            <Button onClick={saveTemplate} disabled={!name.trim()} isLoading={createTemplate.isPending}>
              Save
            </Button>
          </div>
        </div>
        <ul className="mt-3 space-y-1">
          {templatesLoading && <li className="text-sm text-content-muted">Loading…</li>}
          {templates?.map((t) => (
            <li key={t.id} className="flex items-center justify-between text-sm">
              <span>
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-content-muted">
                  {EXPORT_LABEL[t.type as ReportType]} · {t.config.days}d
                </span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => deleteTemplate.mutate(t.id)}>Delete</Button>
            </li>
          ))}
          {templates?.length === 0 && !templatesLoading && (
            <li className="text-sm text-content-muted">No saved templates yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

/** Week 19 — Analytics & Reporting console (19.1–19.6). */
export default function AnalyticsPage() {
  const [tab, setTab] = useState<TabId>('sales');
  const [days, setDays] = useState(30);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-sm text-content-muted">
            Sales, inventory &amp; customer trends — exportable to CSV/PDF.
          </p>
        </div>
        <DayPicker days={days} onChange={setDays} />
      </div>

      <div
        className="inline-flex rounded border border-gray-200 bg-surface-muted p-1"
        role="tablist"
        aria-label="Analytics reports"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={SEGMENT}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales' && <SalesTab days={days} />}
      {tab === 'inventory' && <InventoryTab days={days} />}
      {tab === 'customers' && <CustomersTab days={days} />}
      {tab === 'reports' && <ReportsTab days={days} />}
    </div>
  );
}
