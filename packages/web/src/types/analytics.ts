/**
 * Week 19 — Analytics & Reporting API contracts (mirrors
 * packages/api/src/controllers/analytics.controller.ts). Union enums reuse the
 * domain unions (L018): report types/windows are literal unions, never widened
 * strings.
 */

export type ReportType = 'sales' | 'inventory' | 'customers';
export type ExportFormat = 'csv' | 'pdf';

export interface SalesAnalytics {
  windowDays: number;
  totals: { orders: number; paidOrders: number; paidRevenue: number; avgOrderValue: number };
  byStatus: Record<string, number>;
  revenueByDay: Array<{ date: string; revenue: number }>;
  ordersByDay: Array<{ date: string; orders: number }>;
  topItems: Array<{ itemId: string; name: string; quantity: number; revenue: number }>;
  peakHours: Array<{ hour: number; orders: number }>;
}

export interface InventoryAnalytics {
  windowDays: number;
  totals: {
    items: number; activeItems: number; lowStock: number;
    valuation: number; retailValue: number; deadStock: number;
  };
  lowStockItems: Array<{ id: string; name: string; sku: string; currentStock: number; minStock: number; unit: string }>;
  deadStockItems: Array<{ id: string; name: string; sku: string; currentStock: number }>;
  topMovers: Array<{ itemId: string; name: string; usage: number }>;
  supplierBreakdown: Array<{ supplierId: string; name: string; items: number; stockValue: number }>;
}

export interface CustomerAnalytics {
  windowDays: number;
  totals: {
    customers: number; newInWindow: number; active: number; returning: number;
    repeatRatePct: number; avgOrdersPerCustomer: number;
  };
  topCustomers: Array<{ customerId: string; name: string; orders: number; spend: number }>;
  avgRating: number;
  reviewCount: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  type: ReportType;
  config: { days: number; sections?: string[] };
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportTemplateInput {
  name: string;
  type: ReportType;
  config?: { days: number; sections?: string[] };
}

/** Live analytics snapshot pushed over the 19.5 SSE stream. */
export interface LiveAnalytics {
  revenueToday: number;
  ordersToday: number;
  activeOrders: number;
}