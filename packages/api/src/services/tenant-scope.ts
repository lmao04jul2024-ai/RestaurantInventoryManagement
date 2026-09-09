/**
 * Week 15.1 — tenant isolation at the data-access layer.
 *
 * Every request runs inside an AsyncLocalStorage tenant context (set by
 * `resolveTenant` → `runWithTenant`). These pure guards rewrite Prisma args for
 * tenant-owned models so a `tenantId` can never be forgotten: reads, counts,
 * and bulk writes carry a scoped `where`, and creates inherit the tenant.
 *
 * Only models that carry THEIR OWN non-nullable `tenantId` column are guarded.
 * Transitively-owned rows (Category, MenuItem, OrderItem, pricing rules…) and
 * global tables (FeatureFlag, Session, ApiKey, Payment, Tenant) are
 * intentionally left alone — they are either reached through a scoped parent
 * or are deliberately cross-tenant.
 */

export const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Menu',
  'Table',
  'Order',
  'Review',
  'InventoryItem',
  'InventoryTransaction',
  'Supplier',
  'PurchaseOrder',
  'ReportTemplate',
  'GroupOrder',
  'GroupOrderItem',
  'LoyaltyEntry',
  'PromoCode',
  'RecurringOrder',
]);

/** Where-bearing operations that accept an injectable `where`. */
const SCOPED_WHERE_OPS = new Set([
  'findMany',
  'findFirst',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

/**
 * Transforms a Prisma invocation's args for a tenant-owned model.
 * Returns the (possibly identical) scoped args, or `undefined` to signal the
 * call should be left completely untouched (non-scoped model or an operation
 * whose unique `where` cannot be safely rewritten — e.g. findUnique/update).
 *
 * The request's tenantId ALWAYS wins: an existing scoped key is replaced, so a
 * stale hard-coded tenant can never leak into another tenant's context.
 */
export function applyTenantScope(
  model: string,
  operation: string,
  args: Record<string, unknown> | undefined,
  tenantId: string,
): Record<string, unknown> | undefined {
  if (!TENANT_SCOPED_MODELS.has(model)) return undefined;

  if (SCOPED_WHERE_OPS.has(operation)) {
    const where = (args?.where as Record<string, unknown> | undefined) ?? {};
    return { ...(args ?? {}), where: { ...where, tenantId } };
  }

  if (operation === 'create' && args?.data) {
    const data = args.data as Record<string, unknown>;
    if (data.tenantId === undefined) {
      return { ...args, data: { ...data, tenantId } };
    }
  }

  return undefined;
}