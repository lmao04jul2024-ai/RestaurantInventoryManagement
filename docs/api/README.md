# API Reference Guide (Week 23.1)

The complete REST surface of `@restaurant/api` is machine-described in
[`openapi.yaml`](./openapi.yaml) (OpenAPI 3.0.3, 71 paths / 30 schemas). This
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
| `PATCH /api/auth/password` | Change your own password (any role, incl. the platform operator) |
| `POST /api/tenants` | Onboard a new tenant (creates ADMIN) |

Access tokens are short-lived JWTs carrying `userId`, `tenantId`, `role` and
permission set. Refresh tokens are long-lived and rotate on use.

## Tenant resolution & isolation

The tenant is **always derived from the JWT**. `X-Tenant-ID` and `?tenantId=`
act as override hints but are rejected with `403 TENANT_MISMATCH` when they
disagree with the token. All reads and writes pass through the Week-15
tenant-scope guard (row-level security): cross-tenant rows are invisible, and
cross-tenant row access returns `404` (never `403`, to avoid existence leaks).

Subdomain resolution: without extra config, a `demo.api.example.com`-style
host resolves the slug `demo`. In production set `TENANT_ROOT_DOMAIN`
(e.g. `yourapp.com`) so ONLY hosts under that root resolve —
`{tenant}.yourapp.com` and `api.{tenant}.yourapp.com` → slug `{tenant}`;
the apex/`www` marketing host and foreign domains never resolve a tenant.
Full isolation audit: [`docs/security/TENANT_ISOLATION_AUDIT.md`](../security/TENANT_ISOLATION_AUDIT.md).

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
| Platform | `/api/platform/*` | super-admin (PLATFORM_ADMIN): tenant list/search, usage, audited plan/status/seats/suspension (Phase 5 S2) |

## RBAC

Roles are hierarchical **within a tenant**: `ADMIN > MANAGER > KITCHEN/SERVER > CUSTOMER`.
Permission strings (`menu:read`, `inventory:manage`, `analytics:read`, …) gate
individual routes via `requirePermission(...)`. Week 16 per-user overrides can
deny a role-granted permission or grant beyond the role — overrides always win.
Feature-flagged routes fail **closed** with `403 FEATURE_DISABLED`.

Phase 5 adds `PLATFORM_ADMIN`, which sits **outside** the tenant ladder: it
outranks `ADMIN` numerically but `resolveTenant` rejects it outright
(`403 PLATFORM_ADMIN_FORBIDDEN`), so the role can never act on a tenant surface
even though `requireRoleOrHigher(ADMIN)` would otherwise admit it. The reverse
holds too — tenant staff hitting `/api/platform/*` get `403 FORBIDDEN_ROLE`.

## Commercial state & manual billing (Phase 5 S2)

`plan`, `subscriptionStatus`, `seatsLimit` and `isActive` are **operator-only**.
There is no payment processor: payments are collected out of band and the
operator records the outcome through `PATCH /api/platform/tenants/:id`, which
writes an immutable `platform:tenant.updated` audit row (actor, timestamp,
field-level from→to diff) into the affected tenant's scope. That trail — surfaced
as `recentChanges` on `GET /api/platform/tenants/:id` — is the billing ledger.

Consequences for tenant-facing surfaces:

- `PATCH /api/tenants/me` strips those four fields from its payload (Joi), so a
  workspace can never change its own plan **or lift its own suspension**.
- Seat limits are enforced at every user-creation path (`register`, `POST /api/staff`)
  with `409 SEATS_LIMIT_REACHED`; `seatsLimit` cannot be lowered below current
  usage (`409 SEATS_BELOW_USAGE`).
- Suspension keeps the `WORKSPACE_INACTIVE` recovery semantics below, but the
  tenant can no longer self-reactivate — the operator must do it.

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body/query/params failed Joi schema (`details[]` names the fields) |
| `UNAUTHENTICATED` | 401 | Missing/expired token |
| `INVALID_CREDENTIALS` | 401 | Login email/password mismatch (uniform — never reveals which) |
| `USER_INACTIVE` | 401 | Account missing or deactivated (refresh / password change) |
| `CURRENT_PASSWORD_INCORRECT` | 400 | `PATCH /api/auth/password` without the right current password |
| `PASSWORD_UNCHANGED` | 400 | New password repeats the current one |
| `FORBIDDEN_ROLE` | 403 | Authenticated but the wrong role for this surface (e.g. tenant ADMIN on `/api/platform/*`) |
| `PLATFORM_ADMIN_FORBIDDEN` | 403 | `PLATFORM_ADMIN` attempted a tenant surface — the operator role has no tenant context |
| `FORBIDDEN_PERMISSION` | 403 | Authenticated but lacking permission (or deny-override) |
| `TENANT_MISMATCH` | 403 | Header/query tenant disagrees with JWT |
| `WORKSPACE_INACTIVE` | 403 | Tenant suspended by the operator — members keep GET/PATCH `/api/tenants/me` to read settings; every other surface is blocked. Reactivation is operator-only (S2.6) |
| `FEATURE_DISABLED` | 403 | Feature flag off for this tenant |
| `ORDER_NOT_FOUND` etc. | 404 | Resource absent **or** cross-tenant (indistinguishable) |
| `TENANT_NOT_FOUND` | 404 | Unknown tenant id on the platform surface |
| `SEATS_LIMIT_REACHED` | 409 | User creation/invite would exceed the plan's `seatsLimit` (S2.5) |
| `SEATS_BELOW_USAGE` | 409 | Operator tried to set `seatsLimit` below the current user count |
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

Week 22's limiter is applied per IP with stricter buckets on auth routes
(Phase 5 S1.4 adds a per-tenant fairness ceiling keyed on the verified JWT
tenant — one busy workspace cannot starve the others). On breach the API
returns `429 RATE_LIMITED` with `Retry-After`.

## Internal / proxy endpoints

These are **not** user features. They exist for the reverse proxy (Caddy) and the
release tooling, and have no JWT/auth surface of their own. The public edge
answers 404/NOT FOUND for them, so in production they are reachable only from
inside the compose network (see `deploy/Caddyfile`).

| Endpoint | Called by | Purpose |
| --- | --- | --- |
| `GET /api/internal/tls-ask?domain=<host>` | Caddy on-demand TLS | Before issuing a certificate for a host, Caddy asks whether we serve it. 2xx = issue; 403 = refuse. Allows apex/`www`/`api` and `{slug}`/`api.{slug}` hosts of **active** workspaces (mirrors `extractSubdomain` so the edge never certifies a host the API won't resolve); fails closed, so a DB outage means "no new certs". Offboarding an inactive workspace auto-reclaims its cert (§8). |

## Keeping this in sync

This file and `openapi.yaml` mirror `packages/api/src/routes/*.routes.ts`.
When adding endpoints: update the routes → update the spec → validate with
`python3 -c "import yaml; yaml.safe_load(open('docs/api/openapi.yaml'))"` →
update this guide's domain table.
