import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { httpError, requireTenant } from '../utils/http-error';
import {
  createSupplierSchema,
  idParamSchema,
  supplierQuerySchema,
  updateSupplierSchema,
  validateBody,
  validateParams,
  validateQuery,
} from '../utils/validation';

/** Week 8 — supplier management (8.3). Writes are MANAGER+; reads need supplier:read. */

export async function listSuppliers(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const q = validateQuery(supplierQuerySchema, req.query);

    const where: Prisma.SupplierWhereInput = { tenantId };
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { contactName: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (q.isActive !== undefined) where.isActive = q.isActive;

    const rows = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { inventory: true, purchaseOrders: true } } },
    });

    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
}

export async function createSupplier(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const data = validateBody(createSupplierSchema, req.body);
    const supplier = await prisma.supplier.create({ data: { ...data, tenantId } });
    res.status(201).json({ data: supplier });
  } catch (e) {
    next(e);
  }
}

async function loadSupplierForTenant(tenantId: string, id: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id, tenantId } });
  if (!supplier) throw httpError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
  return supplier;
}

export async function getSupplier(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { inventory: true, purchaseOrders: true } } },
    });
    if (!supplier) throw httpError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    res.json({ data: supplier });
  } catch (e) {
    next(e);
  }
}

export async function updateSupplier(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    await loadSupplierForTenant(tenantId, id);
    const data = validateBody(updateSupplierSchema, req.body);
    const supplier = await prisma.supplier.update({ where: { id }, data });
    res.json({ data: supplier });
  } catch (e) {
    next(e);
  }
}

export async function deleteSupplier(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    await loadSupplierForTenant(tenantId, id);

    const [itemCount, poCount] = await prisma.$transaction([
      prisma.inventoryItem.count({ where: { supplierId: id } }),
      prisma.purchaseOrder.count({ where: { supplierId: id } }),
    ]);
    if (itemCount > 0 || poCount > 0) {
      throw httpError(
        409,
        'SUPPLIER_IN_USE',
        'Supplier has inventory items or purchase orders; deactivate it instead of deleting',
      );
    }

    await prisma.supplier.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

export async function listSupplierItems(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    const { id } = validateParams(idParamSchema, req.params);
    await loadSupplierForTenant(tenantId, id);

    const rows = await prisma.inventoryItem.findMany({
      where: { supplierId: id, tenantId },
      orderBy: { name: 'asc' },
    });

    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
}