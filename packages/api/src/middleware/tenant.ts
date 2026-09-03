import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../services/database';
import { normalizeOverrides } from '../services/feature-flags';
import { runWithTenant } from '../services/tenant-context';

export interface TenantRequest extends AuthRequest {
  tenantId?: string;
  /** Week 14 — normalized `Tenant.features` boolean map ({ flagName: boolean }). */
  tenantFeatures?: Record<string, boolean>;
  /** Week 16.5 — the authenticated user's per-user permission overrides. */
  permissionOverrides?: Record<string, boolean>;
}

/**
 * Tenant resolution middleware for multi-tenant isolation.
 *
 * Tenant is resolved in the following priority order:
 *   1. X-Tenant-ID header
 *   2. ?tenantId= query parameter
 *   3. User's tenantId from their JWT (if authenticated)
 *   4. Subdomain (e.g. demo.api.example.com -> slug "demo")
 */
export async function resolveTenant(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    let tenantIdentifier: string | undefined;
    let lookupBy: 'id' | 'slug' = 'id';

    // 1. Header takes highest priority
    const headerTenant = req.headers['x-tenant-id'] as string | undefined;

    // 2. Query parameter
    const queryTenant = req.query.tenantId as string | undefined;

    // 3. Authenticated user's tenant
    const userTenant = req.user?.tenantId;

    // 4. Subdomain detection (skip localhost and IPs)
    const host = req.headers.host ?? '';
    const subdomain = extractSubdomain(host);

    if (headerTenant) {
      tenantIdentifier = headerTenant;
    } else if (queryTenant) {
      tenantIdentifier = queryTenant;
    } else if (userTenant) {
      tenantIdentifier = userTenant;
    } else if (subdomain) {
      tenantIdentifier = subdomain;
      lookupBy = 'slug';
    }

    if (!tenantIdentifier) {
      return res.status(400).json({
        error: {
          code: 'TENANT_REQUIRED',
          message:
            'Tenant could not be resolved. Provide X-Tenant-ID header, tenantId query param, authenticate, or use a tenant subdomain.',
        },
      });
    }

    // Look up tenant to verify it exists and is active
    const tenant = await prisma.tenant.findFirst({
      where:
        lookupBy === 'slug' ? { slug: tenantIdentifier, isActive: true } : { id: tenantIdentifier, isActive: true },
    });

    if (!tenant) {
      return res.status(404).json({
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found or inactive',
        },
      });
    }

    // Security check: authenticated users may not cross tenant boundaries
    if (req.user && req.user.tenantId !== tenant.id) {
      return res.status(403).json({
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Access to this tenant is forbidden with your credentials',
        },
      });
    }

    req.tenantId = tenant.id;
    req.tenantFeatures = normalizeOverrides(tenant.features);
    // Week 16.5 — per-user permission overrides ride along for requirePermission.
    // Fresh from the DB on every request (never baked into the JWT, so revocation
    // takes effect immediately without waiting for a token refresh).
    const overrideRow = req.user
      ? await prisma.user.findUnique({
          where: { id: req.user.userId },
          select: { permissionOverrides: true },
        })
      : null;
    req.permissionOverrides = normalizeOverrides(overrideRow?.permissionOverrides ?? null);
    // Week 15 — downstream handlers + every Prisma call inherit the tenant via
    // AsyncLocalStorage, so the data-access-layer guard can auto-scope.
    runWithTenant(tenant.id, () => next());
  } catch (error) {
    next(error);
  }
}

function extractSubdomain(host: string): string | null {
  // Skip localhost, IP addresses, and hosts without enough parts
  if (!host || host.startsWith('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(host)) {
    return null;
  }

  const parts = host.split('.');
  // e.g. demo.api.example.com -> ['demo', 'api', 'example', 'com'] (4+ parts)
  if (parts.length >= 4 || (parts.length === 3 && !parts[1].startsWith('api'))) {
    return parts[0] || null;
  }
  // demo-api.localhost style or api.example.com have no tenant subdomain
  return null;
}

/**
 * Enforces that all queries in handlers are scoped by req.tenantId.
 * Exported as a helper so controllers consistently scope their queries.
 */
export function getScopedWhere(req: TenantRequest): { tenantId: string } {
  if (!req.tenantId) {
    throw new Error('Tenant context missing - ensure resolveTenant middleware runs first');
  }
  return { tenantId: req.tenantId };
}
