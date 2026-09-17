/**
 * S3.2 — Tenant data export tests.
 *
 * The controller is exercised directly with the mocked tenant-scoped prisma
 * service (same pattern as gdpr.spec.ts) plus a mocked report-export so we
 * assert on the CSV/PDF payloads without real serialization side effects.
 */

jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    inventoryItem: { findMany: jest.fn() },
    menuItem: { findMany: jest.fn() },
    order: { findMany: jest.fn() },
  },
}));

jest.mock('../src/services/report-export', () => ({
  __esModule: true,
  toCsv: jest.fn((_cols, rows) => `CSV:${rows.length}`),
  toPdf: jest.fn((_title, _cols, rows) => `PDF:${rows.length}`),
}));

import prisma from '../src/services/database';
import { toCsv, toPdf } from '../src/services/report-export';
import { exportTenantData } from '../src/controllers/data-export.controller';
import type { TenantRequest } from '../src/middleware/tenant';
import { asRequest, createRes } from './helpers/mock-express';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const run = async (query: Record<string, string>) => {
  const res = createRes();
  const next = jest.fn();
  const req = asRequest<TenantRequest>({
    tenantId: 'tenant-1',
    user: { userId: uid(1), tenantId: 'tenant-1', role: 'ADMIN', email: 'a@x.com' } as TenantRequest['user'],
    query,
  });
  await exportTenantData(req, res as any, next as any);
  return { res, next };
};

describe('S3.2 — data export (GET /api/data-export)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports inventory scoped to the caller tenant with supplier names', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      {
        sku: 'FLOUR-1', name: 'Flour', currentStock: 10, minStock: 2, maxStock: 50,
        unit: 'kg', costPrice: 1.2, sellingPrice: null, isActive: true,
        lastRestockedAt: new Date('2026-01-01T00:00:00Z'), createdAt: new Date('2025-06-01T00:00:00Z'),
        supplier: { name: 'Acme Foods' },
      },
    ]);

    const { res, next } = await run({ type: 'inventory', format: 'csv' });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
    expect(toCsv).toHaveBeenCalledTimes(1);
    const [cols, rows] = (toCsv as jest.Mock).mock.calls[0];
    expect(cols.map((c: { key: string }) => c.key)).toContain('supplierName');
    expect(rows[0].supplierName).toBe('Acme Foods');
    expect(rows[0].sellingPrice).toBe('');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringMatching(/^attachment; filename="inventory-export-\d{4}-\d{2}-\d{2}\.csv"$/),
    );
    expect(res.send).toHaveBeenCalledWith('CSV:1');
  });

  it('exports menu with resolved category names', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      {
        name: 'Pizza', description: 'Margherita', price: 12.5, isAvailable: true,
        preparationTime: 15, calories: 800, createdAt: new Date('2025-06-01T00:00:00Z'),
        category: { name: 'Mains' },
      },
    ]);

    const { res, next } = await run({ type: 'menu' });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: { menu: { tenantId: 'tenant-1' } } } }),
    );
    const [, rows] = (toCsv as jest.Mock).mock.calls[0];
    expect(rows[0].categoryName).toBe('Mains');
    expect(res.send).toHaveBeenCalledWith('CSV:1');
  });

  it('exports orders with concatenated customer names', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      {
        orderNumber: 'ORD-1', status: 'COMPLETED', totalAmount: 25, taxAmount: 2.5,
        discountAmount: 0, tableNumber: 'T4', createdAt: new Date('2025-06-01T00:00:00Z'),
        customer: { firstName: 'Casey', lastName: 'Kim' },
      },
    ]);

    const { res, next } = await run({ type: 'orders' });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
    const [, rows] = (toCsv as jest.Mock).mock.calls[0];
    expect(rows[0].customerName).toBe('Casey Kim');
    expect(res.send).toHaveBeenCalledWith('CSV:1');
  });

  it('renders PDF when format=pdf, reusing the dependency-free writer', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);

    const { res, next } = await run({ type: 'inventory', format: 'pdf' });

    expect(next).not.toHaveBeenCalled();
    expect(toPdf).toHaveBeenCalledTimes(1);
    const [title, , rows] = (toPdf as jest.Mock).mock.calls[0];
    expect(title).toBe('Inventory export');
    expect(rows).toEqual([]);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('PDF:0', 'latin1'));
  });

  it('defaults to inventory/csv for unknown or missing query values', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);

    const { res, next } = await run({ type: 'hackery', format: 'xlsx' });

    expect(next).not.toHaveBeenCalled();
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.menuItem.findMany).not.toHaveBeenCalled();
    expect(prisma.order.findMany).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
  });

  it('propagates errors to the express error handler', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockRejectedValue(new Error('db down'));

    const { res, next } = await run({});

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.send).not.toHaveBeenCalled();
  });
});
