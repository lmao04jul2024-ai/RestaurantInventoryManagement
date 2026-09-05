# Deployment Guide (Week 18.6)

Deployment targets for the `RestaurantInventoryMgmtAndOrders` monorepo.

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