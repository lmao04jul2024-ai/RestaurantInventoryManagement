import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Week 15 — per-request tenant context propagated through AsyncLocalStorage so
 * the Prisma query guard (services/database.ts) can inject `tenantId` into
 * every tenant-owned model operation automatically.
 *
 * `resolveTenant` wraps the downstream middleware chain in `runWithTenant`, and
 * the context survives every await boundary for the duration of the request.
 */
export interface TenantContext {
  tenantId: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

/** Runs `fn` with a tenant context captured for the whole async continuation. */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantContext.run({ tenantId }, fn);
}

/** Returns the resolved tenant id for the current async request, if any. */
export function currentTenantId(): string | undefined {
  return tenantContext.getStore()?.tenantId;
}