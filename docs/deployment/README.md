# Deployment Guide (Week 18.6)

Deployment targets for the `RestaurantInventoryMgmtAndOrders` monorepo.

> **Related docs** — day-to-day operations, monitoring and runbooks:
> [`OPERATIONS.md`](./OPERATIONS.md) · backup/restore drills:
> [`BACKUP.md`](./BACKUP.md) · production go-live: the Week 24 roadmap items.

## Architecture

```
web (Next.js 14, App Router) ─┐
                               ├─► api (Express + Prisma) ─► PostgreSQL
mobile (React Native 0.73)   ─┘        │
                                       └─► Redis  (caching; optional at MVP)
```

Everything is a Node 18+ process. The API owns auth/RBAC and data; the web app
is a static-friendly Next server; mobile builds via Metro/Expo tooling.

## 1. Prerequisites

- Node `>=18`, npm `>=9`
- PostgreSQL `>=14`
- Redis `>=6` (optional for pure API dev — connections are lazy)
- One `.env` per package (`./.env.example` documents every key; copy to `.env`)

## 2. Local / Docker Compose (dev)

```bash
cp .env.example .env            # fill in DATABASE_URL, JWT_SECRET, REDIS_URL
docker compose up -d db redis   # Postgres + Redis only
npm install
npm run build                   # compiles shared, api, web
npm run prisma:migrate --workspace @restaurant/api
npm run dev --workspace @restaurant/api     # API on :3001
npm run dev --workspace @restaurant/web     # web on :3000
```

Seed data (optional):

```bash
npm run prisma:seed --workspace @restaurant/api
```

## 3. Database migrations

Prisma migrations are the only schema source of truth:

```bash
npm run prisma:migrate:deploy --workspace @restaurant/api   # prod (non-interactive)
npm run prisma:migrate:create --workspace @restaurant/api   # dev, create-only
```

`prisma migrate deploy` runs during the image boot for ephemeral deploys; staff
prefer migrating before release so rollbacks stay clean.

## 4. Environment variables

See `.env.example`. The critical ones:

| Variable        | Purpose                                  |
| --------------- | ---------------------------------------- |
| `DATABASE_URL`  | Postgres DSN (Prisma)                    |
| `JWT_SECRET`    | Signing secret for access/refresh tokens |
| `REDIS_URL`     | Redis DSN (caching; lazy)                |
| `PORT`          | API port (default 3001)                  |
| `ALLOWED_ORIGINS` | CORS allow-list for the web origin       |
| `NODE_ENV`      | `development` / `test` / `production`    |

> `JWT_SECRET` must be a long random value in production and shared across all
> API replicas (so tokens stay valid across instances).

## 5. CI/CD

`.github/workflows/ci.yml` runs the standard quality gate on every branch:

1. install (`npm ci`)
2. `npm run build` (all workspaces; produces dist/ and .next/)
3. lint + `tsc --noEmit` per package
4. `npm test` (api / web / shared / mobile jest suites)

The API's jest workers are pure unit/integration suites with Prisma mocked —
CI needs no database (see `packages/api/tests/multi-tenant.integration.spec.ts`
for the app-level integration harness).

## 6. Production notes

- **API**: `npm run build --workspace @restaurant/api` then
  `node packages/api/dist/index.js`. `Dockerfile` (api-production stage) runs
  `prisma generate` + `prisma migrate deploy` before boot — do NOT strip
  devDependencies before `prisma generate` runs (the CLI must be present).
- **Web**: `npm run build --workspace @restaurant/web`, then
  `next start` (port 3000). Terminate TLS at the edge (nginx/Caddy) and set
  `ALLOWED_ORIGINS` to the public origin.
- **Multi-tenant ops**: no tenant-scoped code may bypass
  `resolveTenant`; new endpoints must mount `authenticate` + `resolveTenant`
  and rely on the tenant-scope Prisma guard for where-bearing queries.
- **Backups**: standard `pg_dump` nightly + point-in-time recovery; the audit
  trail is insert-only and should be excluded from `TRUNCATE`-style resets.
- **Monitoring**: instrument `/health` (used by the orchestrator); add
  Prometheus/Grafana dashboards for order rate, error rate, and DB pools
  (roadmap Week 24).

## 7. Rollout checklist

1. Migration merged + `migrate deploy` run, backups verified.
2. API shipped and green `/health`.
3. Web shipped (build hash pinned), `ALLOWED_ORIGINS` updated.
4. Feature flags flipped for each tenant before a new surface goes live.
5. Smoke test one tenant end-to-end (menu → order → inventory → analytics).

## 8. Go-live checklist — multi-tenant SaaS operations (S4.4)

Beyond the rollout checklist above, selling to many businesses means the
operator is now running a *service*. This section is the launch gate; do not
sell a subscription until every box is checked.

### Platform & data safety
- [ ] S-Week 1 tenant-isolation audit green (`docs/security/TENANT_ISOLATION_AUDIT.md`) — no cross-tenant surface.
- [ ] Nightly Postgres backups verified per `BACKUP.md`, restore drill performed on the production database.
- [ ] `ENCRYPTION_KEY` unique + >= 16 chars; `GET /api/security/health` all-green in prod.
- [ ] Rate-limit ceilings reviewed (`RATE_LIMIT_*`), `TRUST_PROXY=true` behind the edge.
- [ ] `LOG_LEVEL=info` in prod; structured logs shipping to the aggregator (S4.2) and the paging hooks wired.

### Commercial state (manual billing)
- [ ] PLATFORM_ADMIN account created in prod (distinct from any tenant ADMIN; see S2.1).
- [ ] Platform console reachable (e.g. `/platform/tenants`); a plan/status/seat change verified end-to-end **and** visible in the audit trail.
- [ ] Attention queue (`GET /api/platform/attention`) reviewed daily during launch week.
- [ ] Sales inbox (`NEXT_PUBLIC_SALES_EMAIL`) monitored; pricing page live at `/pricing`.
- [ ] No payment processor anywhere in the codebase (Phase B invariant).

### Tenant provisioning runbook (new customer)
1. Customer signs up self-serve at `/onboarding` (creates the workspace + first ADMIN), or the operator provisions via a support session.
2. Operator sets the commercial state on the platform console: `plan`, `subscriptionStatus`, `seatsLimit` (every change audit-logged as `platform:tenant.updated`).
3. Operator verifies the workspace resolves on its tenant subdomain (S1.3 `TENANT_ROOT_DOMAIN`), the customer menu is reachable, and seat limits behave.
4. Optional: guided data import via the onboarding CSV panel (S3.1).
5. Confirm the customer received the verification/invite emails (S3.3) — or hand-configure SMTP (`SMTP_HOST`) before launch.

### Offboarding & data-retention policy (churned customer)
1. Operator records the outcome on the platform console: `subscriptionStatus=CANCELLED` (audit-logged), then `isActive=false` to suspend access (`WORKSPACE_INACTIVE` for members; non-members get 404 — no existence leak).
2. Customers can self-serve export **before** offboarding: `GET /api/data-export` (S3.2) and `GET /api/me/data` (GDPR portability). Remind them in the cancellation notice.
3. Data retention: keep the tenant's rows for the retention window agreed in the subscription (default: 90 days after cancellation) to allow win-backs, then hard-delete per the agreement. The `AuditLog` trail is insert-only (24-month retention) and survives workspace deletion for dispute resolution.
4. GDPR erasure requests (`DELETE /api/me`) for individual customers remain available at any time, independent of the workspace's commercial state.
5. After deletion, verify the tenant id no longer resolves (`TENANT_NOT_FOUND`) and subdomain is released.