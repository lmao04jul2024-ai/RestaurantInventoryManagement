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
  `node packages/api/dist/index.js`. `Dockerfile` (api-production stage) keeps
  the dev dependencies on purpose so the `prisma` CLI is present for the
  migration step — do NOT strip devDependencies. The image does **not** run
  `migrate deploy` at boot; migrations are applied explicitly before a rollout
  (`docker compose … run --rm migrate`, see §9).
- **Web**: `npm run build --workspace @restaurant/web`, then
  `next start` (port 3000). Terminate TLS at the edge (nginx/Caddy; the shipped
  config is `deploy/Caddyfile`, §9) and set `ALLOWED_ORIGINS` to the public
  origin. Remember `NEXT_PUBLIC_API_URL` is a **build** argument — see §9.2.
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
## 9. Single-host production stack (`docker-compose.prod.yml` + `deploy/Caddyfile`)

The supported shape for one VPS: four containers (`postgres`, `redis`, `api`,
`web`) plus a Caddy edge, with **only 80/443 published**. Everything else is
reachable exclusively on the internal compose network.

```
Internet ──► caddy :80/:443 ──► api.*  → api:3001 ──► postgres / redis
                              └► apex, www, {tenant}.* → web:3000
```

### 9.1 First deploy

```bash
# 0. DNS first — both records must exist before Caddy asks for a certificate:
#    A  restaurant.example.com      -> <server ip>
#    A  *.restaurant.example.com    -> <server ip>   (tenant + api subdomains)

cp .env.production.example .env.production
chmod 600 .env.production          # fill in every required value first

export COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

$COMPOSE build                              # web is built with PUBLIC_API_URL baked in
$COMPOSE --profile tools run --rm migrate   # schema first…
$COMPOSE --profile tools run --rm seed      # …then the platform operator account
$COMPOSE up -d
$COMPOSE ps                                # every service should be (healthy)
```

Then verify from outside the host:

```bash
curl -sS https://api.restaurant.example.com/health          # {"status":"ok",…}
curl -sSI https://restaurant.example.com | head -1          # HTTP/2 200
curl -sS "https://api.restaurant.example.com/api/internal/tls-ask?domain=acme.restaurant.example.com"
# → 404: the ACME hook is deliberately not an internet-facing surface
```

### 9.2 `NEXT_PUBLIC_API_URL` is a BUILD argument

Next.js inlines `NEXT_PUBLIC_*` into the **browser** bundle at `next build
(see the `web-builder` stage in `Dockerfile`). A runtime `environment:` value is
ignored, and the code's fallback (`http://localhost:3001`) ships instead — so
every visitor's browser would call its own machine.

Consequences:

- the value must be the **public** API origin (`https://api.<root>`), not a
  container name;
- changing the origin requires `docker compose … build web && up -d web`, not a
  restart;
- `ALLOWED_ORIGINS` on the API must list the public **web** origin(s), or the
  browser will block the responses CORS.

`NEXT_PUBLIC_SALES_EMAIL` is baked the same way, but lands in the **server**
bundle (`/pricing` is a server component) — still build-time, so still needs a
rebuild to change.

### 9.3 Sealing secrets (why this file exists)

`docker-compose.yml` is a **development** file: it hardcodes
`restaurant123` / `your-secret-key-change-in-production` and publishes
5433/6379/3000/3001 on every interface. Never run it on a public host — a
leaked `JWT_SECRET` lets anyone mint a token for any `tenantId`, which is
exactly the boundary `docs/security/TENANT_ISOLATION_AUDIT.md` certifies.

The prod file instead:

- takes every secret from `.env.production` via `${VAR:?message}`, so a missing
  value **aborts** the command instead of booting with a dev default;
- publishes nothing but 80/443;
- runs each container with `restart: unless-stopped` + `no-new-privileges`;
- healthchecks every service (`/health` for the API, `/` for web), which is
  what makes `depends_on: service_healthy` meaningful.

Also set `TRUST_PROXY=true` (already in the file): behind the edge `req.ip` is
otherwise the proxy's address and the rate limiters collapse into a single
bucket.

### 9.4 The Caddy edge and tenant certificates

`deploy/Caddyfile` serves the apex and `*.<root>` from one site block
(`api.*` → API, everything else → web) and issues certificates **on demand**:
the first request for `acme.restaurant.example.com` triggers an HTTP-01
issuance, cached in the `caddy_data` volume after that. No per-tenant operator
work when a restaurant is onboarded.

On-demand issuance is gated by `GET /api/internal/tls-ask?domain=<host>`
(`packages/api/src/controllers/internal.controller.ts`), which allows only the
apex, `www`, `api`, and `{slug}`/`api.{slug}` hosts whose workspace exists **and
is active**. It fails closed, so a database outage means "no new certificates"
rather than "any host may get one". Offboarding therefore releases the
certificate automatically (see §8, step 5).

> The endpoint is unauthenticated by necessity (Caddy presents no JWT) and the
> public edge answers **404** for its path — the routing rule exists purely so
> the API's own URL space has no anonymous exception reachable from outside.
5. After deletion, verify the tenant id no longer resolves (`TENANT_NOT_FOUND`) and subdomain is released.