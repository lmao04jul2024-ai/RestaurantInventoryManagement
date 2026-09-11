# API Reference Guide (Week 23.1)

The complete REST surface of `@restaurant/api` is machine-described in
[`openapi.yaml`](./openapi.yaml) (OpenAPI 3.0.3, 66 paths / 26 schemas). This
guide is the human-readable companion: how to authenticate, how every domain
fits together, and what every error code means.

## Quick start

```bash
# 1. Start the API (default http://localhost:3001)
cd packages/api && npm run dev

# 2. Register a tenant + admin in one call
curl -X POST http://localhost:3001/api/tenants \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bistro One","adminEmail":"admin@bistro.one","adminPassword":"s3cret!pass"}'
# → { "data": { "tenant": {…}, "accessToken": "…", "refreshToken": "…" } }

# 3. Call an authed endpoint
curl http://localhost:3001/api/menus -H "Authorization: Bearer $TOKEN"
```

## Authentication

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/register` | Create a CUSTOMER account |
| `POST /api/auth/login` | Mint access + refresh tokens |
| `POST /api/auth/refresh` | Rotate an expired access token |
| `POST /api/auth/forgot-password` / `reset-password` | Password recovery |
| `POST /api/tenants` | Onboard a new tenant (creates ADMIN) |

Access tokens are short-lived JWTs carrying `userId`, `tenantId`, `role` and
permission set. Refresh tokens are long-lived and rotate on use.

## Tenant resolution & isolation

The tenant is **always derived from the JWT**. `X-Tenant-ID` and `?tenantId=`
act as override hints but are rejected with `403 TENANT_MISMATCH` when they
disagree with the token. All reads and writes pass through the Week-15
tenant-scope guard (row-level security): cross-tenant rows are invisible, and
cross-tenant row access returns `404` (never `403`, to avoid existence leaks).

## Response envelopes

| Shape | When |
|---|---|
| `{ "data": … }` | Success (201 on create) |
| `{ "data": …, "pagination": { page, limit, total, totalPages } }` | Lists |
| `{ "error": { code, message, details? } }` | Any failure |
| `204` (no body) | Deletes |

## Endpoint domains

| Domain | Base path | Highlights |
|---|---|---|
| Auth | `/api/auth/*` | register, login, refresh, password reset |
| Tenants | `/api/tenants/*` | onboarding, settings, feature flags, branding (Week 17) |
| Menu | `/api/menus/*` | items, categories, availability windows, pricing rules, `/items/{id}/effective` |
| Orders | `/api/orders/*` | lifecycle, scheduled (20.1), group (20.2), recurring (20.6) |
| Payments | `/api/orders/:id/pay` | upsert payment, flips payment status |
| Kitchen | `/api/orders/kitchen*` | queue (`/kitchen`), prep analytics, kitchen settings (Week 21) |
| Customers | `/api/customers/*` | CRM, notes, tags |
| Inventory | `/api/inventory/*`, `/api/purchase-orders/*`, `/api/suppliers/*` | stock, transactions, suppliers, POs, low-stock/valuation/consumption reports |
| Reviews | `/api/reviews/*` | moderation + reply |
| Loyalty | `/api/loyalty/*` | balance, ledger (Week 20.3) |
| Promos | `/api/promo-codes/*` | validation + redemption counters (Week 20.4) |
| Analytics | `/api/analytics/*` | sales/inventory/customers reports, CSV/PDF export, SSE stream, report templates (Week 19) |
| Recommendations | `/api/recommendations` | favorites + popular rails (Week 20.5) |
| GDPR | `/api/me`, `/api/me/data` | data export (`GET /me/data`), self-service erasure (`DELETE /me`) (Week 22) |
| Security | `/api/security/*` | event feed with 24h rollup, control-objectives health (ADMIN, Week 22) |
| Staff | `/api/staff/*`, `/api/users/*` | invitations, roles, per-user permission overrides (Week 16) |
| Audit | `/api/audit-logs` | immutable action log (ADMIN) |

## RBAC

Roles are hierarchical: `ADMIN > MANAGER > KITCHEN/SERVER > CUSTOMER`.
Permission strings (`menu:read`, `inventory:manage`, `analytics:read`, …) gate
individual routes via `requirePermission(...)`. Week 16 per-user overrides can
deny a role-granted permission or grant beyond the role — overrides always win.
Feature-flagged routes fail **closed** with `403 FEATURE_DISABLED`.

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body/query/params failed Joi schema (`details[]` names the fields) |
| `UNAUTHENTICATED` | 401 | Missing/expired token |
| `FORBIDDEN_PERMISSION` | 403 | Authenticated but lacking permission (or deny-override) |
| `TENANT_MISMATCH` | 403 | Header/query tenant disagrees with JWT |
| `WORKSPACE_INACTIVE` | 403 | Tenant deactivated — members keep GET/PATCH `/api/tenants/me` to re-enable "Workspace active"; every other surface is blocked |
| `FEATURE_DISABLED` | 403 | Feature flag off for this tenant |
| `ORDER_NOT_FOUND` etc. | 404 | Resource absent **or** cross-tenant (indistinguishable) |
| `INSUFFICIENT_LOYALTY` | 409 | Redemption exceeded balance |
| `GROUP_CLOSED` / `GROUP_HOST_ONLY` / `GROUP_ITEM_FORBIDDEN` | 403/409 | Group-order rules |
| `PROMO_INVALID` | 400 | Unknown/expired/promo-limit-exceeded code |
| `RATE_LIMITED` | 429 | Too many requests (Week 22 rate limiter) |
| `TEST_MODE_FORBIDDEN` | 403 | `X-Test-Mode` header outside a test environment |

## Pagination

List endpoints accept `?page=` (1-based) and `?limit=` (default 20, max 100)
and return a `pagination` envelope. Sorting is per-domain (`?sort=`/`?order=`
where supported — see the spec's parameters).

## Rate limiting

Week 22's limiter is applied per IP + tenant with stricter buckets on auth
routes. On breach the API returns `429 RATE_LIMITED` with `Retry-After`.

## Keeping this in sync

This file and `openapi.yaml` mirror `packages/api/src/routes/*.routes.ts`.
When adding endpoints: update the routes → update the spec → validate with
`python3 -c "import yaml; yaml.safe_load(open('docs/api/openapi.yaml'))"` →
update this guide's domain table.
