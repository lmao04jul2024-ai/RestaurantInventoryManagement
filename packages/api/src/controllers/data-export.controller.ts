/**
 * S3.2 — Tenant data export (churn-safety).
 *
 * A tenant can download an archive of its OWN data (inventory, orders, menu)
 * as CSV. The export is strictly scoped by `req.tenantId` — the tenant-scoped
 * Prisma client extension guarantees no cross-tenant rows are ever returned,
 * so a tenant simply cannot pull another restaurant's data through this surface.
 *
 * Per Phase B (manual billing, no transactions) this is an information-retrieval
 * feature only: no payment state is included, no transaction is recorded.
 *
 * CSV uses `toCsv` from services/report-export (RFC 4180 quoting + UTF-8 BOM).
 */

import { Response, NextFunction } from 'express';
import prisma from '../services/database';
import { requireTenant } from '../utils/http-error';
import { toCsv, type ExportColumn } from '../services/report-export';
import type { TenantRequest } from '../middleware/tenant';

/** YYYY-MM-DD stamp for export filenames (mirrors the local in analytics.controller). */
const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

const INVENTORY_COLUMNS: ExportColumn[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name' },
  { key: 'currentStock', label: 'Current stock' },
  { key: 'minStock', label: 'Min stock' },
  { key: 'maxStock', label: 'Max stock' },
  { key: 'unit', label: 'Unit' },
  { key: 'costPrice', label: 'Cost price' },
  { key: 'sellingPrice', label: 'Selling price' },
  { key: 'supplierName', label: 'Supplier' },
  { key: 'isActive', label: 'Active' },
  { key: 'lastRestockedAt', label: 'Last restocked' },
  { key: 'createdAt', label: 'Created' },
];

const MENU_COLUMNS: ExportColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'price', label: 'Price' },
  { key: 'categoryName', label: 'Category' },
  { key: 'isAvailable', label: 'Available' },
  { key: 'preparationTime', label: 'Prep (min)' },
  { key: 'calories', label: 'Calories' },
  { key: 'createdAt', label: 'Created' },
];

const ORDERS_COLUMNS: ExportColumn[] = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'status', label: 'Status' },
  { key: 'totalAmount', label: 'Total' },
  { key: 'taxAmount', label: 'Tax' },
  { key: 'discountAmount', label: 'Discount' },
  { key: 'tableNumber', label: 'Table' },
  { key: 'customerName', label: 'Customer' },
  { key: 'createdAt', label: 'Created' },
];

interface ExportOptions {
  type: 'inventory' | 'menu' | 'orders';
  format: 'csv' | 'pdf';
}

/**
 * GET /api/data-export?type=inventory&format=csv
 *
 * Streams one of the tenant's domains as CSV/PDF. The tenant is always taken
 * from the JWT (requireTenant); the scoped Prisma client enforces row-level
 * isolation, so there is no way to address another workspace's data.
 */
export async function exportTenantData(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);

    const type = (req.query.type as string) ?? 'inventory';
    const format = ((req.query.format as string) ?? 'csv') as 'csv' | 'pdf';
    const opts: ExportOptions = {
      type: type === 'menu' || type === 'orders' ? type : 'inventory',
      format: format === 'pdf' ? 'pdf' : 'csv',
    };

    let rows: Array<Record<string, unknown>>;
    let title: string;
    let columns: ExportColumn[];

    if (opts.type === 'inventory') {
      const items = await prisma.inventoryItem.findMany({
        where: { tenantId },
        include: { supplier: { select: { name: true } } },
      });
      columns = INVENTORY_COLUMNS;
      rows = items.map((i) => ({
        sku: i.sku,
        name: i.name,
        currentStock: i.currentStock,
        minStock: i.minStock,
        maxStock: i.maxStock ?? '',
        unit: i.unit,
        costPrice: i.costPrice ?? '',
        sellingPrice: i.sellingPrice ?? '',
        supplierName: i.supplier?.name ?? '',
        isActive: i.isActive,
        lastRestockedAt: i.lastRestockedAt?.toISOString() ?? '',
        createdAt: i.createdAt.toISOString(),
      }));
      title = 'Inventory export';
    } else if (opts.type === 'menu') {
      const items = await prisma.menuItem.findMany({
        // MenuItem has no tenantId of its own — scope through category → menu
        // (same pattern as menu-item.controller's itemTenantScope).
        where: { category: { menu: { tenantId } } },
        include: { category: { select: { name: true } } },
      });
      columns = MENU_COLUMNS;
      rows = items.map((i) => ({
        name: i.name,
        description: i.description ?? '',
        price: i.price,
        categoryName: i.category?.name ?? '',
        isAvailable: i.isAvailable,
        preparationTime: i.preparationTime ?? '',
        calories: i.calories ?? '',
        createdAt: i.createdAt.toISOString(),
      }));
      title = 'Menu export';
    } else {
      const orders = await prisma.order.findMany({
        where: { tenantId },
        include: { customer: { select: { firstName: true, lastName: true } } },
      });
      columns = ORDERS_COLUMNS;
      rows = orders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: o.totalAmount,
        taxAmount: o.taxAmount,
        discountAmount: o.discountAmount,
        tableNumber: o.tableNumber ?? '',
        customerName: o.customer ? `${o.customer.firstName} ${o.customer.lastName}`.trim() : '',
        createdAt: o.createdAt.toISOString(),
      }));
      title = 'Orders export';
    }

      const stamp = dayKey(new Date());
    const filename = `${opts.type}-export-${stamp}`;

    if (opts.format === 'pdf') {
      // Reuse the dependency-free PDF writer from report-export.
      const { toPdf } = await import('../services/report-export');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.send(Buffer.from(toPdf(title, columns, rows), 'latin1'));
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(toCsv(columns, rows));
    }
  } catch (e) {
    next(e);
  }
}
