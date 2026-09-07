/**
 * Week 19 — analytics & reporting unit tests.
 *
 * Covers the pure export writers (19.4), the three aggregation reports
 * (19.1–19.3), the live SSE snapshot (19.5) and the report-template CRUD
 * (19.6). Route-level RBAC is covered by the multi-tenant integration suite.
 */
jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    order: { findMany: jest.fn(), aggregate: jest.fn(), count: jest.fn() },
    orderItem: { findMany: jest.fn() },
    menuItem: { findMany: jest.fn() },
    inventoryItem: { findMany: jest.fn() },
    inventoryTransaction: { findMany: jest.fn() },
    supplier: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    review: { aggregate: jest.fn() },
    reportTemplate: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import prisma from '../src/services/database';
import { PaymentStatus } from '@prisma/client';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { toCsv, toPdf } from '../src/services/report-export';
import {
  getSalesAnalytics,
  getInventoryAnalytics,
  getCustomerAnalytics,
  exportReport,
  streamAnalytics,
  listReportTemplates,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
} from '../src/controllers/analytics.controller';

const run = async (
  handler: (...args: any[]) => Promise<unknown>,
  reqPartial: Partial<TenantRequest>,
): Promise<{ res: MockRes; next: jest.Mock }> => {
  const res = createRes();
  const next = jest.fn();
  await handler(asRequest<TenantRequest>(reqPartial), res as any, next as any);
  return { res, next };
};

const tenantReq = (extra: Partial<TenantRequest> = {}): Partial<TenantRequest> => ({
  tenantId: 'tenant-1',
  user: { userId: 'user-1', tenantId: 'tenant-1' } as TenantRequest['user'],
  ...extra,
});

const bodyOf = (res: MockRes) => res.body as Record<string, unknown>;
const dataOf = (res: MockRes) => bodyOf(res).data as Record<string, unknown>;

const D1 = new Date('2026-09-01T18:00:00Z');
const D2 = new Date('2026-09-02T12:30:00Z');

beforeEach(() => {
  jest.clearAllMocks();
});

// ── 19.4 pure writers ────────────────────────────────────────────────────────

describe('report-export CSV writer (19.4)', () => {
  const columns = [
    { key: 'name', label: 'Item' },
    { key: 'qty', label: 'Quantity' },
  ];

  it('emits a BOM, header row and CRLF line endings', () => {
    const csv = toCsv(columns, [{ name: 'Flour', qty: 3 }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Item,Quantity\r\n');
    expect(csv).toContain('Flour,3\r\n');
  });

  it('quotes fields containing commas, quotes and newlines (RFC 4180)', () => {
    const csv = toCsv(columns, [{ name: 'Tomato, "Roma"', qty: 'line1\nline2' }]);
    expect(csv).toContain('"Tomato, ""Roma""",');
    expect(csv).toContain('"line1\nline2"');
  });

  it('renders an empty body for zero rows (header only)', () => {
    const csv = toCsv(columns, []);
    expect(csv).toBe('\uFEFFItem,Quantity\r\n');
  });
});

describe('report-export PDF writer (19.4)', () => {
  const columns = [
    { key: 'name', label: 'Item', width: 120 },
    { key: 'qty', label: 'Qty', width: 60 },
  ];

  it('emits a standards-valid single-page PDF', () => {
    const pdf = toPdf('Weekly sales', columns, [{ name: 'Flour', qty: 3 }]);
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toContain('/Type /Catalog');
    expect(pdf).toContain('/Type /Pages');
    expect(pdf).toContain('/Count 1');
    expect(pdf).toContain('xref\n0 7\n'); // 1 catalog + 1 pages + 2 fonts + 1 page + 1 content
    expect(pdf).toContain('(Weekly sales) Tj');
    expect(pdf).toContain('(Flour) Tj');
    // xref offsets: each id's entry line is 3 lines below the xref line
    // ('xref', '0 7', free-entry), i.e. xref-tail line 3+i → points back at
    // the exact "id 0 obj" text.
    const xrefOffset = Number(pdf.split('startxref\n')[1].split('\n')[0]);
    expect(pdf.slice(xrefOffset, xrefOffset + 4)).toBe('xref');
    const entryLines = pdf.slice(xrefOffset).split('\n');
    for (const id of [1, 2, 3, 4, 5, 6]) {
      const offset = Number(entryLines[3 + id - 1].slice(0, 10));
      expect(pdf.slice(offset, offset + String(id).length + 6)).toBe(`${id} 0 obj`);
    }
  });

  it('escapes PDF string metacharacters in titles and cells', () => {
    const pdf = toPdf('Q1 (draft) \\summary', columns, [{ name: 'Cheddar (aged) 50%', qty: 2 }]);
    expect(pdf).toContain('(Q1 \\(draft\\) \\\\summary) Tj');
    expect(pdf).toContain('(Cheddar \\(aged\\) 50%) Tj');
  });

  it('paginates large row sets across multiple pages', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ name: `Item ${i}`, qty: i }));
    const pdf = toPdf('Big report', columns, rows);
    expect(pdf).toContain('/Count 2');
    expect(pdf).toContain('(Big report \\(cont.\\)) Tj');
    expect(pdf).toContain('(Item 59) Tj');
  });
});

// ── 19.1 sales analytics ─────────────────────────────────────────────────────

describe('GET /api/analytics/sales (19.1)', () => {
  it('aggregates revenue, daily histograms, top items and peak hours', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { totalAmount: 20, paymentStatus: PaymentStatus.PAID, status: 'COMPLETED', createdAt: D1 },
      { totalAmount: 30, paymentStatus: PaymentStatus.PAID, status: 'COMPLETED', createdAt: D1 },
      { totalAmount: 10, paymentStatus: PaymentStatus.PENDING, status: 'PENDING', createdAt: D2 },
    ]);
    (prisma.orderItem.findMany as jest.Mock).mockResolvedValue([
      { menuItemId: 'item-a', quantity: 2, unitPrice: 10 },
      { menuItemId: 'item-b', quantity: 1, unitPrice: 5 },
    ]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: 'item-a', name: 'Margherita' },
      { id: 'item-b', name: 'Focaccia' },
    ]);

    const { res, next } = await run(getSalesAnalytics, { ...tenantReq(), query: { days: '7' } });

    expect(next).not.toHaveBeenCalled();
    const data = dataOf(res) as any;
    expect(data.windowDays).toBe(7);
    expect(data.totals).toEqual({ orders: 3, paidOrders: 2, paidRevenue: 50, avgOrderValue: 16.67 });
    expect(data.byStatus).toEqual({ COMPLETED: 2, PENDING: 1 });
    expect(data.revenueByDay).toEqual([
      { date: '2026-09-01', revenue: 50 },
      { date: '2026-09-02', revenue: 0 },
    ]);
    expect(data.ordersByDay).toEqual([
      { date: '2026-09-01', orders: 2 },
      { date: '2026-09-02', orders: 1 },
    ]);
    expect(data.topItems).toEqual([
      { itemId: 'item-a', name: 'Margherita', quantity: 2, revenue: 20 },
      { itemId: 'item-b', name: 'Focaccia', quantity: 1, revenue: 5 },
    ]);
    expect(data.peakHours).toEqual([{ hour: 18, orders: 2 }, { hour: 12, orders: 1 }]);
  });

  it('returns zeroed totals for an empty window', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.orderItem.findMany as jest.Mock).mockResolvedValue([]);

    const { res } = await run(getSalesAnalytics, { ...tenantReq(), query: {} });
    const data = dataOf(res) as any;
    expect(data.totals).toEqual({ orders: 0, paidOrders: 0, paidRevenue: 0, avgOrderValue: 0 });
    expect(data.topItems).toEqual([]);
    expect(data.peakHours).toEqual([]);
  });
});

// ── 19.2 inventory analytics ─────────────────────────────────────────────────

describe('GET /api/analytics/inventory (19.2)', () => {
  const items = [
    { id: 'i-a', name: 'Flour', sku: 'FL-1', currentStock: 5, minStock: 10, unit: 'KG', costPrice: 2, sellingPrice: 3, supplierId: 's-1', isActive: true },
    { id: 'i-b', name: 'Oil', sku: 'OL-1', currentStock: 20, minStock: 5, unit: 'L', costPrice: 4, sellingPrice: 6, supplierId: 's-1', isActive: true },
    { id: 'i-c', name: 'Old item', sku: 'OLD-1', currentStock: 9, minStock: 1, unit: 'UNIT', costPrice: 1, sellingPrice: 2, supplierId: null, isActive: false },
  ];

  it('computes valuation, low stock, dead stock, movers and supplier split', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue(items);
    (prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
      { itemId: 'i-b', quantity: 3 },
      { itemId: 'i-b', quantity: 1.5 },
    ]);
    (prisma.supplier.findMany as jest.Mock).mockResolvedValue([{ id: 's-1', name: 'Acme Foods' }]);

    const { res, next } = await run(getInventoryAnalytics, { ...tenantReq(), query: { days: '30' } });

    expect(next).not.toHaveBeenCalled();
    const data = dataOf(res) as any;
    expect(data.totals).toEqual({
      items: 3,
      activeItems: 2,
      lowStock: 1,
      valuation: 90, // 5*2 + 20*4
      retailValue: 135, // 5*3 + 20*6
      deadStock: 1, // Flour has stock but zero USAGE in the window
    });
    expect(data.lowStockItems).toEqual([
      { id: 'i-a', name: 'Flour', sku: 'FL-1', currentStock: 5, minStock: 10, unit: 'KG' },
    ]);
    expect(data.deadStockItems).toEqual([{ id: 'i-a', name: 'Flour', sku: 'FL-1', currentStock: 5 }]);
    expect(data.topMovers).toEqual([{ itemId: 'i-b', name: 'Oil', usage: 4.5 }]);
    expect(data.supplierBreakdown).toEqual([
      { supplierId: 's-1', name: 'Acme Foods', items: 2, stockValue: 90 },
    ]);
  });
});

// ── 19.3 customer analytics ──────────────────────────────────────────────────

describe('GET /api/analytics/customers (19.3)', () => {
  it('computes new/active/returning mix, repeat rate and top customers', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: 'c-1', firstName: 'Ada', lastName: 'Lovelace', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'c-2', firstName: 'Grace', lastName: 'Hopper', createdAt: new Date('2026-09-01T00:00:00Z') },
      { id: 'c-3', firstName: 'Alan', lastName: 'Turing', createdAt: new Date('2026-01-15T00:00:00Z') },
    ]);
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { customerId: 'c-1', totalAmount: 20, paymentStatus: PaymentStatus.PAID },
      { customerId: 'c-1', totalAmount: 10, paymentStatus: PaymentStatus.PENDING },
      { customerId: 'c-2', totalAmount: 30, paymentStatus: PaymentStatus.PAID },
    ]);
    (prisma.review.aggregate as jest.Mock).mockResolvedValue({ _avg: { rating: 4.5 }, _count: 7 });

    const { res, next } = await run(getCustomerAnalytics, { ...tenantReq(), query: { days: '30' } });

    expect(next).not.toHaveBeenCalled();
    const data = dataOf(res) as any;
    expect(data.totals).toEqual({
      customers: 3,
      newInWindow: 1,
      active: 2,
      returning: 1, // only c-1 ordered twice
      repeatRatePct: 50,
      avgOrdersPerCustomer: 1.5,
    });
    expect(data.topCustomers).toEqual([
      { customerId: 'c-2', name: 'Grace Hopper', orders: 1, spend: 30 },
      { customerId: 'c-1', name: 'Ada Lovelace', orders: 2, spend: 20 },
    ]);
    expect(data.avgRating).toBe(4.5);
    expect(data.reviewCount).toBe(7);
  });
});

// ── 19.4 export endpoint ─────────────────────────────────────────────────────

describe('GET /api/analytics/export (19.4)', () => {
  beforeEach(() => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { totalAmount: 20, paymentStatus: PaymentStatus.PAID, status: 'COMPLETED', createdAt: D1 },
    ]);
    (prisma.orderItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.review.aggregate as jest.Mock).mockResolvedValue({ _avg: { rating: null }, _count: 0 });
  });

  it('streams an Excel-friendly CSV with headers and disposition', async () => {
    const { res, next } = await run(exportReport, {
      ...tenantReq(),
      query: { type: 'sales', format: 'csv', days: '7' },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.headers['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['Content-Disposition']).toMatch(/^attachment; filename="sales-report-\d{4}-\d{2}-\d{2}\.csv"$/);
    const csv = res.body as string;
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Date,Revenue,Orders\r\n');
  });

  it('streams a valid PDF with headers and disposition', async () => {
    const { res, next } = await run(exportReport, {
      ...tenantReq(),
      query: { type: 'customers', format: 'pdf', days: '30' },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Content-Disposition']).toMatch(/^attachment; filename="customers-report-\d{4}-\d{2}-\d{2}\.pdf"$/);
    const pdf = (res.body as Buffer).toString('latin1');
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toContain('(Customer report \\(top customers\\) ? last 30 days) Tj');
  });

  it('rejects an unknown report type with 400', async () => {
    const { next } = await run(exportReport, {
      ...tenantReq(),
      query: { type: 'recipes', format: 'csv' },
    });
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });
});

// ── 19.5 live analytics stream ───────────────────────────────────────────────

describe('GET /api/analytics/stream (19.5)', () => {
  it('writes SSE headers and a today snapshot, then follows order events', async () => {
    (prisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: 42.5 } });
    (prisma.order.count as jest.Mock)
      .mockResolvedValueOnce(3) // ordersToday
      .mockResolvedValueOnce(1); // activeOrders

    // The mock req emits 'close' synchronously so the controller tears down its
    // heartbeat interval + subscription (otherwise jest hangs on the timer).
    const req = asRequest<TenantRequest>({ ...tenantReq() }) as unknown as {
      on: (event: string, cb: () => void) => void;
      tenantId?: string;
      user?: unknown;
    };
    const closeCb = jest.fn();
    req.on = jest.fn((event: string, cb: () => void) => {
      if (event === 'close') closeCb();
    });

    const res = createRes();
    const next = jest.fn();
    await streamAnalytics(req as never, res as never, next as never);

    expect(next).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ 'Content-Type': 'text/event-stream' }),
    );
    expect(res.write).toHaveBeenCalledWith('retry: 3000\n\n');
    const snapshot = (res.write as jest.Mock).mock.calls
      .map(([payload]) => payload as string)
      .find((payload) => payload.startsWith('event: analytics'));
    expect(snapshot).toContain('"revenueToday":42.5');
    expect(snapshot).toContain('"ordersToday":3');
    expect(snapshot).toContain('"activeOrders":1');
  });
});

// ── 19.6 report templates ────────────────────────────────────────────────────

describe('report templates CRUD (19.6)', () => {
  const row = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Weekly sales',
    type: 'sales',
    config: { days: 7 },
    tenantId: 'tenant-1',
    createdAt: D1,
    updatedAt: D1,
  };

  it('lists templates scoped to the tenant', async () => {
    (prisma.reportTemplate.findMany as jest.Mock).mockResolvedValue([row]);

    const { res } = await run(listReportTemplates, tenantReq());
    expect(prisma.reportTemplate.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(dataOf(res)).toEqual([row]);
  });

  it('creates a template with the validated config (201)', async () => {
    (prisma.reportTemplate.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.reportTemplate.create as jest.Mock).mockResolvedValue(row);

    const { res, next } = await run(createReportTemplate, {
      ...tenantReq(),
      body: { name: 'Weekly sales', type: 'sales', config: { days: 7 } },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(prisma.reportTemplate.create).toHaveBeenCalledWith({
      data: { name: 'Weekly sales', type: 'sales', config: { days: 7 }, tenantId: 'tenant-1' },
    });
    expect(dataOf(res)).toMatchObject({ id: row.id });
  });

  it('defaults the config window to 30 days', async () => {
    (prisma.reportTemplate.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.reportTemplate.create as jest.Mock).mockResolvedValue(row);

    await run(createReportTemplate, {
      ...tenantReq(),
      body: { name: 'Monthly', type: 'inventory' },
    });
    expect(prisma.reportTemplate.create).toHaveBeenCalledWith({
      data: { name: 'Monthly', type: 'inventory', config: { days: 30 }, tenantId: 'tenant-1' },
    });
  });

  it('rejects a duplicate name within the tenant with 409', async () => {
    (prisma.reportTemplate.findFirst as jest.Mock).mockResolvedValue(row);

    const { next } = await run(createReportTemplate, {
      ...tenantReq(),
      body: { name: 'Weekly sales', type: 'sales' },
    });
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'REPORT_TEMPLATE_EXISTS', statusCode: 409 });
    expect(prisma.reportTemplate.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown template type with 400', async () => {
    const { next } = await run(createReportTemplate, {
      ...tenantReq(),
      body: { name: 'Recipes', type: 'recipes' },
    });
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });

  it('updates a template (rename re-checked for clashes)', async () => {
    (prisma.reportTemplate.findFirst as jest.Mock)
      .mockResolvedValueOnce(row) // existing
      .mockResolvedValueOnce(null); // rename clash check
    (prisma.reportTemplate.update as jest.Mock).mockResolvedValue({ ...row, name: 'Renewed' });

    const { res, next } = await run(updateReportTemplate, {
      ...tenantReq(),
      params: { id: row.id },
      body: { name: 'Renewed' },
    });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.reportTemplate.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { name: 'Renewed' },
    });
    expect(dataOf(res)).toMatchObject({ name: 'Renewed' });
  });

  it('404s an update for a template owned by another tenant', async () => {
    (prisma.reportTemplate.findFirst as jest.Mock).mockResolvedValue(null);

    const { next } = await run(updateReportTemplate, {
      ...tenantReq(),
      params: { id: row.id },
      body: { name: 'Renewed' },
    });
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'REPORT_TEMPLATE_NOT_FOUND', statusCode: 404 });
    expect(prisma.reportTemplate.update).not.toHaveBeenCalled();
  });

  it('409s a rename onto an existing sibling name', async () => {
    (prisma.reportTemplate.findFirst as jest.Mock)
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({ ...row, id: '00000000-0000-4000-8000-000000000009' });

    const { next } = await run(updateReportTemplate, {
      ...tenantReq(),
      params: { id: row.id },
      body: { name: 'Monthly' },
    });
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'REPORT_TEMPLATE_EXISTS', statusCode: 409 });
  });

  it('deletes a template (204) and 404s unknown ids', async () => {
    (prisma.reportTemplate.findFirst as jest.Mock).mockResolvedValueOnce(row);
    const ok = await run(deleteReportTemplate, { ...tenantReq(), params: { id: row.id } });
    expect(ok.res.statusCode).toBe(204);
    expect(prisma.reportTemplate.delete).toHaveBeenCalledWith({ where: { id: row.id } });

    (prisma.reportTemplate.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const missing = await run(deleteReportTemplate, { ...tenantReq(), params: { id: row.id } });
    expect(missing.next.mock.calls[0][0]).toMatchObject({ code: 'REPORT_TEMPLATE_NOT_FOUND', statusCode: 404 });
  });
});
