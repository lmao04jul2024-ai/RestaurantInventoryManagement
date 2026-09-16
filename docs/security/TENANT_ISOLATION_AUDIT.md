# Tenant Isolation Audit (S1.1 — Phase 5, 2026-09-16)

Scope: every Prisma model/query path in `packages/api` against the row-level
tenant-scoping model (shared DB, shared schema). Verdict per path, fixes
applied, and residual documented risks.

## 1. Model coverage

Models carrying their **own** `tenantId` column (schema.prisma): `User`, `Menu`,
`Table`, `Order`, `Review`, `InventoryItem`, `InventoryTransaction`,
`Supplier`, `PurchaseOrder`, `ReportTemplate`, `GroupOrder`, `GroupOrderItem`,
`LoyaltyEntry`, `PromoCode`, `RecurringOrder` — **15/15 present in
`TENANT_SCOPED_MODELS`** (`src/services/tenant-scope.ts`). Pinned by the
"exposes the intended tenant-owned model set" test.

Transitively-owned rows (`Category`, `MenuItem`, `MenuPricingRule`,
`MenuItemAvailabilityWindow`, `OrderItem`, `PurchaseOrderItem`) are reached
only through a scoped parent (menu/category/order/P-O includes) — not directly
addressable cross-tenant through any controller; verified by reading every
controller's load helpers (`loadMenuForTenant`, `loadScopedItem`,
`findOrderForTenant`, `loadPoForTenant`, …), which all filter via
`{ tenantId }`-bearing relations.

Global tables (`Tenant`, `FeatureFlag`, `Session`, `ApiKey`, `Payment`,
`AuditLog`) are intentionally cross-tenant and not row-scoped; access is
RBAC-gated instead.

## 2. Operation coverage (`applyTenantScope`)

| Path | Status |
|---|---|
| findMany / findFirst / count / aggregate / groupBy / updateMany / deleteMany | ✅ scoped `where` injected; request tenant **replaces** any pre-scoped key |
| create | ✅ **S1.1 FIX** — context tenant now **overrides** an explicit `data.tenantId` (previously only injected when absent → cross-tenant write possible with a stale value) |
| createMany (array & object forms) | ✅ **S1.1 FIX** — every row stamped with the context tenant |
| findUnique / update / delete / upsert / findUniqueOrThrow | ⚠️ pass-through BY DESIGN (unique-where cannot be safely rewritten). Compensating control: every controller resolves via a scoped `findFirst`/load helper first, then writes by the row's id. Regression-net: tenant-scope.spec "untouched paths stay predictable". |
| includes / nested writes | ✅ nested payloads belong to a scoped parent row (created/loaded under the context tenant); no cross-tenant `connect` paths found in controllers |
| `$queryRaw` / `$executeRaw` | ✅ **zero occurrences** in `packages/api/src` (verified 2026-09-16). Rule: any future raw SQL must be reviewed against tenant scoping (PENTEST checklist §4). |

## 3. Safe cross-tenant writes (by design, outside any tenant context)

- `POST /api/tenants` onboarding (`services/tenant-onboarding.ts`): creates the
  Tenant + first ADMIN + default Menu with the **new** tenant id while no
  tenant context exists (public route) → the guard's no-context pass-through
  branch handles it. Verified no other call site creates scoped rows with a
  tenantId different from the current context (`auth.register` and
  `staff.createStaff` both stamp `req.tenantId`).

## 4. Residual risks / rules going forward

1. **Unique-where pass-through** stays the main residual surface. Rule: never
   call `update`/`delete`/`upsert` with a caller-supplied id without first
   loading the row through a tenant-scoped helper.
2. Any new model with its own `tenantId` MUST be added to
   `TENANT_SCOPED_MODELS` and to the isolation matrix test.
3. Raw SQL is prohibited without a written isolation review.

Test net: `packages/api/tests/tenant-scope.spec.ts`
(S1.1 create/createMany hardening + S1.2 isolation matrix over all 15 scoped
models × all scoped operations) and `tests/multi-tenant.integration.spec.ts`
(HTTP-level isolation, X-Tenant-ID mismatch 403, cross-tenant 404).
