import { NextFunction, Response } from 'express';
import { PaymentStatus, UserRole } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import {
  analyticsExportQuerySchema,
  analyticsQuerySchema,
  idParamSchema,
  reportTemplateCreateSchema,
  reportTemplateUpdateSchema,
  validateBody,
  validateParams,
  validateQuery,
} from '../utils/validation';
import { subscribeOrderEvents } from '../services/order-events';
import { toCsv, toPdf, type ExportColumn } from '../services/report-export';

/**
 * Week 19 — Analytics & Reporting (19.1–19.6).
 *
 * All endpoints are tenant-scoped via `resolveTenant` (the request's
 * AsyncLocalStorage context also auto-scopes every Prisma read through the
 * Week 15 data-access guard). Read routes require `analytics:read` (MANAGER
 * matrix + ADMIN '*'); template writes are MANAGER+.
 *
 * 19.5 note: the roadmap says "WebSockets"; this repo already standardizes on
 * SSE for real-time push (order stream — single-process EventEmitter that a
 * Redis adapter can replace without changing call sites). The analytics
 * stream reuses that channel rather than introducing a second push transport.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] as const;

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

const displayName = (u?: { firstName: string; lastName: string } | null): string =>
  u ? `${u.firstName} ${u.lastName}`.trim() : 'Unknown';

// ── Report builders (shared by JSON endpoints and the 19.4 exporter) ─────────

interface SalesReport {
  windowDays: number;
  totals: { orders: number; paidOrders: number; paidRevenue: number; avgOrderValue: number };
  byStatus: Record<string, number>;
  revenueByDay: Array<{ date: string; revenue: number }>;
  ordersByDay: Array<{ date: string; orders: number }>;
  topItems: Array<{ itemId: string; name: string; quantity: number; revenue: number }>;
  peakHours: Array<{ hour: number; orders: number }>;
}

async function buildSalesReport(tenantId: string, days: number): Promise<SalesReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: { tenantId, createdAt: { gte: since } },
    select: { totalAmount: true, paymentStatus: true, status: true, createdAt: true },
  });

  const paid = orders.filter((o) => o.paymentStatus === PaymentStatus.PAID);
  const paidRevenue = round2(paid.reduce((sum, o) => sum + o.totalAmount, 0));

  const byDay = new Map<string, { revenue: number; orders: number }>();
  const hours = new Array<number>(24).fill(0);
  for (const order of orders) {
    const key = dayKey(order.createdAt);
    const bucket = byDay.get(key) ?? { revenue: 0, orders: 0 };
    bucket.orders += 1;
    if (order.paymentStatus === PaymentStatus.PAID) bucket.revenue += order.totalAmount;
    byDay.set(key, bucket);
    hours[order.createdAt.getUTCHours()] += 1;
  }

  const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  // Top items by quantity (+ their revenue) over the window.
  const orderItems = await prisma.orderItem.findMany({
    where: { order: { tenantId, createdAt: { gte: since } } },
    select: { menuItemId: true, quantity: true, unitPrice: true },
  });
  const itemAgg = new Map<string, { quantity: number; revenue: number }>();
  for (const item of orderItems) {
    const agg = itemAgg.get(item.menuItemId) ?? { quantity: 0, revenue: 0 };
    agg.quantity += item.quantity;
    agg.revenue += item.quantity * item.unitPrice;
    itemAgg.set(item.menuItemId, agg);
  }
  const top = [...itemAgg.entries()].sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 5);
  const itemRows = top.length
    ? await prisma.menuItem.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(itemRows.map((r) => [r.id, r.name]));

  return {
    windowDays: days,
    totals: {
      orders: orders.length,
      paidOrders: paid.length,
      paidRevenue,
      avgOrderValue: orders.length > 0 ? round2(paidRevenue / orders.length) : 0,
    },
    byStatus,
    revenueByDay: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, revenue: round2(v.revenue) })),
    ordersByDay: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, orders: v.orders })),
    topItems: top.map(([itemId, agg]) => ({
      itemId,
      name: nameOf.get(itemId) ?? 'Unknown item',
      quantity: agg.quantity,
      revenue: round2(agg.revenue),
    })),
    peakHours: hours
      .map((count, hour) => ({ hour, orders: count }))
      .filter((h) => h.orders > 0)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5),
  };
}

interface InventoryReport {
  windowDays: number;
  totals: { items: number; activeItems: number; lowStock: number; valuation: number; retailValue: number; deadStock: number };
  lowStockItems: Array<{ id: string; name: string; sku: string; currentStock: number; minStock: number; unit: string }>;
  deadStockItems: Array<{ id: string; name: string; sku: string; currentStock: number }>;
  topMovers: Array<{ itemId: string; name: string; usage: number }>;
  supplierBreakdown: Array<{ supplierId: string; name: string; items: number; stockValue: number }>;
}

async function buildInventoryReport(tenantId: string, days: number): Promise<InventoryReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const items = await prisma.inventoryItem.findMany({ where: { tenantId } });
  const active = items.filter((i) => i.isActive);
  const lowStockItems = active.filter((i) => i.currentStock <= i.minStock);

  const usageTx = await prisma.inventoryTransaction.findMany({
    where: { tenantId, transactionType: 'USAGE', createdAt: { gte: since } },
    select: { itemId: true, quantity: true },
  });
  const usageByItem = new Map<string, number>();
  for (const tx of usageTx) {
    usageByItem.set(tx.itemId, (usageByItem.get(tx.itemId) ?? 0) + tx.quantity);
  }

  const suppliers = await prisma.supplier.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const supplierBreakdown = suppliers.map((s) => {
    const owned = active.filter((i) => i.supplierId === s.id);
    return {
      supplierId: s.id,
      name: s.name,
      items: owned.length,
      stockValue: round2(owned.reduce((sum, i) => sum + i.currentStock * (i.costPrice ?? 0), 0)),
    };
  });

  const nameOf = new Map(items.map((i) => [i.id, i.name]));
  const topMovers = [...usageByItem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([itemId, usage]) => ({ itemId, name: nameOf.get(itemId) ?? 'Unknown item', usage: round2(usage) }));

  return {
    windowDays: days,
    totals: {
      items: items.length,
      activeItems: active.length,
      lowStock: lowStockItems.length,
      valuation: round2(active.reduce((sum, i) => sum + i.currentStock * (i.costPrice ?? 0), 0)),
      retailValue: round2(active.reduce((sum, i) => sum + i.currentStock * (i.sellingPrice ?? 0), 0)),
      deadStock: active.filter((i) => i.currentStock > 0 && !usageByItem.has(i.id)).length,
    },
    lowStockItems: lowStockItems.map((i) => ({
      id: i.id, name: i.name, sku: i.sku, currentStock: i.currentStock, minStock: i.minStock, unit: i.unit,
    })),
    deadStockItems: active
      .filter((i) => i.currentStock > 0 && !usageByItem.has(i.id))
      .map((i) => ({ id: i.id, name: i.name, sku: i.sku, currentStock: i.currentStock })),
    topMovers,
    supplierBreakdown,
  };
}

interface CustomerReport {
  windowDays: number;
  totals: {
    customers: number; newInWindow: number; active: number; returning: number;
    repeatRatePct: number; avgOrdersPerCustomer: number;
  };
  topCustomers: Array<{ customerId: string; name: string; orders: number; spend: number }>;
  avgRating: number;
  reviewCount: number;
}

async function buildCustomerReport(tenantId: string, days: number): Promise<CustomerReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [customers, orders, reviews] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: UserRole.CUSTOMER },
      select: { id: true, firstName: true, lastName: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { customerId: true, totalAmount: true, paymentStatus: true },
    }),
    prisma.review.aggregate({
      where: { tenantId, createdAt: { gte: since } },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  const byCustomer = new Map<string, { orders: number; spend: number }>();
  for (const order of orders) {
    const agg = byCustomer.get(order.customerId) ?? { orders: 0, spend: 0 };
    agg.orders += 1;
    if (order.paymentStatus === PaymentStatus.PAID) agg.spend += order.totalAmount;
    byCustomer.set(order.customerId, agg);
  }

  const active = byCustomer.size;
  const returning = [...byCustomer.values()].filter((v) => v.orders > 1).length;
  const nameOf = new Map(customers.map((c) => [c.id, displayName(c)]));
  const topCustomers = [...byCustomer.entries()]
    .sort((a, b) => b[1].spend - a[1].spend)
    .slice(0, 5)
    .map(([customerId, agg]) => ({
      customerId,
      name: nameOf.get(customerId) ?? 'Unknown customer',
      orders: agg.orders,
      spend: round2(agg.spend),
    }));

  return {
    windowDays: days,
    totals: {
      customers: customers.length,
      newInWindow: customers.filter((c) => c.createdAt >= since).length,
      active,
      returning,
      repeatRatePct: active > 0 ? round2((returning / active) * 100) : 0,
      avgOrdersPerCustomer: active > 0 ? round2(orders.length / active) : 0,
    },
    topCustomers,
    avgRating: round2(reviews._avg.rating ?? 0),
    reviewCount: reviews._count,
  };
}

// ── 19.1–19.3 JSON endpoints ─────────────────────────────────────────────────

export async function getSalesAnalytics(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { days } = validateQuery(analyticsQuerySchema, req.query);
    res.json({ data: await buildSalesReport(tenantId, days) });
  } catch (e) {
    next(e);
  }
}

export async function getInventoryAnalytics(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { days } = validateQuery(analyticsQuerySchema, req.query);
    res.json({ data: await buildInventoryReport(tenantId, days) });
  } catch (e) {
    next(e);
  }
}

export async function getCustomerAnalytics(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { days } = validateQuery(analyticsQuerySchema, req.query);
    res.json({ data: await buildCustomerReport(tenantId, days) });
  } catch (e) {
    next(e);
  }
}

// ── 19.4 Exports (CSV for Excel, PDF) ────────────────────────────────────────

const REPORT_COLUMNS: Record<
  string,
  { columns: ExportColumn[]; rows: (data: never) => Array<Record<string, unknown>> }
> = {
  sales: {
    columns: [
      { key: 'date', label: 'Date', width: 80 },
      { key: 'revenue', label: 'Revenue', width: 80 },
      { key: 'orders', label: 'Orders', width: 60 },
    ],
    rows: ((data: SalesReport) =>
      data.revenueByDay.map((d) => ({
        date: d.date,
        revenue: d.revenue,
        orders: data.ordersByDay.find((o) => o.date === d.date)?.orders ?? 0,
      }))) as never,
  },
  inventory: {
    columns: [
      { key: 'name', label: 'Item', width: 130 },
      { key: 'sku', label: 'SKU', width: 70 },
      { key: 'currentStock', label: 'Stock', width: 60 },
      { key: 'minStock', label: 'Min', width: 50 },
      { key: 'unit', label: 'Unit', width: 50 },
    ],
    rows: ((data: InventoryReport) => data.lowStockItems) as never,
  },
  customers: {
    columns: [
      { key: 'name', label: 'Customer', width: 130 },
      { key: 'orders', label: 'Orders', width: 60 },
      { key: 'spend', label: 'Spend', width: 80 },
    ],
    rows: ((data: CustomerReport) => data.topCustomers) as never,
  },
};

export async function exportReport(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { type, format, days } = validateQuery(analyticsExportQuerySchema, req.query);

    let title: string;
    let columns: ExportColumn[];
    let rows: Array<Record<string, unknown>>;
    if (type === 'sales') {
      const data = await buildSalesReport(tenantId, days);
      title = `Sales report — last ${days} days`;
      columns = REPORT_COLUMNS.sales.columns;
      rows = REPORT_COLUMNS.sales.rows(data as never);
    } else if (type === 'inventory') {
      const data = await buildInventoryReport(tenantId, days);
      title = `Inventory report (low stock) — last ${days} days`;
      columns = REPORT_COLUMNS.inventory.columns;
      rows = REPORT_COLUMNS.inventory.rows(data as never);
    } else {
      const data = await buildCustomerReport(tenantId, days);
      title = `Customer report (top customers) — last ${days} days`;
      columns = REPORT_COLUMNS.customers.columns;
      rows = REPORT_COLUMNS.customers.rows(data as never);
    }

    const stamp = dayKey(new Date());
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${stamp}.pdf"`);
      res.send(Buffer.from(toPdf(title, columns, rows), 'latin1'));
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${stamp}.csv"`);
      res.send(toCsv(columns, rows));
    }
  } catch (e) {
    next(e);
  }
}

// ── 19.5 Live analytics stream (SSE — same transport as the order stream) ────

export async function streamAnalytics(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');

    let inFlight = false;
    const sendSnapshot = async (): Promise<void> => {
      if (inFlight) return; // coalesce bursts of order events
      inFlight = true;
      try {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const [paidToday, ordersToday, activeOrders] = await Promise.all([
          prisma.order.aggregate({
            where: { tenantId, paymentStatus: PaymentStatus.PAID, createdAt: { gte: startOfDay } },
            _sum: { totalAmount: true },
          }),
          prisma.order.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
          prisma.order.count({ where: { tenantId, status: { in: [...ACTIVE_STATUSES] } } }),
        ]);
        res.write(
          `event: analytics\ndata: ${JSON.stringify({
            revenueToday: round2(paidToday._sum.totalAmount ?? 0),
            ordersToday,
            activeOrders,
          })}\n\n`,
        );
      } catch {
        // Transient read error: keep the stream alive; the next event retries.
      } finally {
        inFlight = false;
      }
    };

    await sendSnapshot();
    const unsubscribe = subscribeOrderEvents(tenantId, () => {
      void sendSnapshot();
    });

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (e) {
    next(e);
  }
}

// ── 19.6 Report templates (saved report configurations) ──────────────────────

export async function listReportTemplates(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const templates = await prisma.reportTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: templates });
  } catch (e) {
    next(e);
  }
}

export async function createReportTemplate(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const data = validateBody(reportTemplateCreateSchema, req.body);

    const clash = await prisma.reportTemplate.findFirst({ where: { tenantId, name: data.name } });
    if (clash) throw httpError(409, 'REPORT_TEMPLATE_EXISTS', `A template named "${data.name}" already exists`);

    const created = await prisma.reportTemplate.create({ data: { ...data, tenantId } });
    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
}

export async function updateReportTemplate(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const data = validateBody(reportTemplateUpdateSchema, req.body);

    const existing = await prisma.reportTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) throw httpError(404, 'REPORT_TEMPLATE_NOT_FOUND', 'Report template not found');

    if (data.name && data.name !== existing.name) {
      const clash = await prisma.reportTemplate.findFirst({ where: { tenantId, name: data.name } });
      if (clash) throw httpError(409, 'REPORT_TEMPLATE_EXISTS', `A template named "${data.name}" already exists`);
    }

    const updated = await prisma.reportTemplate.update({ where: { id: existing.id }, data });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deleteReportTemplate(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);

    const existing = await prisma.reportTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) throw httpError(404, 'REPORT_TEMPLATE_NOT_FOUND', 'Report template not found');

    await prisma.reportTemplate.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}
